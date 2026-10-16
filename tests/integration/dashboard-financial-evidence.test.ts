import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { readDashboardFinancial } from '@/services/dashboard-financial.service';
import { readCustomerFinancialSummaries } from '@/services/customer-financial-metrics.service';
import { getBusinessTimeRanges } from '@/lib/utils/date-ranges';
import { createFulfillmentFixture } from '@/tests/setup/fulfillment-fixture';
import { cleanupFixtureStores } from '@/tests/setup/fixture-scope';

beforeAll(verifyTestDatabase);
afterAll(async () => { await cleanupFixtureStores(); await prisma.$disconnect(); });
type F = Awaited<ReturnType<typeof createFulfillmentFixture>>;
async function contract(f: F, total = 100, financed = 100) {
  const id = randomUUID();
  const order = await prisma.order.create({ data: { id, lojaID: f.lojaID, userID: f.customer.id, status: 'PAID', deliveryType: 'PICKUP',
    subtotal: total, total, financialTotal: financed, financingCharge: financed-total, financialPlan: { fixture: true } } });
  const attempt = await prisma.paymentAttempt.create({ data: { orderId: id, number: 1, provider: 'MANUAL', method: 'WHATSAPP_PIX',
    externalReference: id, financialTotal: financed, planSnapshot: { fixture: true }, status: 'APPROVED' } });
  return { order, attempt };
}
const read = (f: F) => readDashboardFinancial(prisma, f.lojaID);
const nowMinus = (ms: number) => new Date(Date.now()-ms);
async function fact(c: Awaited<ReturnType<typeof contract>>, type: 'AUTHORIZED'|'SETTLED'|'REFUNDED', amount: number, createdAt = nowMinus(1000), occurredAt = createdAt, chargeId?: string, key = randomUUID()) {
  return prisma.financialFact.upsert({ where: { provider_factKey: { provider: 'MANUAL', factKey: key } }, update: {}, create: {
    orderId: c.order.id, attemptId: c.attempt.id, provider: 'MANUAL', factKey: key, type, amount, createdAt, occurredAt, chargeId,
  } });
}

describe('dashboard canonical financial evidence and registration periods', () => {
  it('authorization is recognized, not settled; later settlement and duplicate evidence never become two sales', async () => {
    const f = await createFulfillmentFixture(), c = await contract(f);
    await fact(c,'AUTHORIZED',100);
    expect(await read(f)).toMatchObject({ allTime: { recognizedGross: 100, settledGross: 0, netRecognized: 100, recognizedOrderCount: 1 }, averageNetTicket: 100 });
    await fact(c,'SETTLED',100); await fact(c,'AUTHORIZED',100);
    const d = await read(f);
    expect(d.allTime).toMatchObject({ recognizedGross: 100, settledGross: 100, confirmedRefunds: 0, netRecognized: 100 });
    const customer = (await readCustomerFinancialSummaries(prisma,f.lojaID,[f.customer.id])).get(f.customer.id)!;
    expect(d.allTime.recognizedGross).toBe(customer.recognizedGross); expect(d.allTime.settledGross).toBe(customer.settledGross);
  });
  it('refund registered this month does not erase prior-month recognition; old paidAt in refund is not its reporting date', async () => {
    const f = await createFulfillmentFixture(), c = await contract(f);
    const ranges = getBusinessTimeRanges(), prior = new Date(ranges.startOfMonth.getTime()-1000);
    await fact(c,'AUTHORIZED',100,prior); await fact(c,'SETTLED',100,prior);
    await fact(c,'REFUNDED',100,nowMinus(1000),prior);
    await prisma.order.update({ where: { id: c.order.id }, data: { status: 'CANCELLED', paidAt: prior } });
    const d = await read(f);
    expect(d.month).toMatchObject({ recognizedGross: 0, settledGross: 0, confirmedRefunds: 100, netRecognized: -100 });
    expect(d.today.netRecognized).toBe(-100);
    expect(d.allTime).toMatchObject({ recognizedGross: 100, settledGross: 100, confirmedRefunds: 100, netRecognized: 0, recognizedOrderCount: 1 });
    expect(d.cancelledUnpaidOrderValue).toBe(0); expect(d.cancelledUnpaidOrderCount).toBe(0);
  });
  it('uses Sao Paulo midnight for registration, ignoring order creation and paid dates', async () => {
    const f = await createFulfillmentFixture(); const a = await contract(f), b = await contract(f);
    const day = getBusinessTimeRanges().startOfDay;
    await fact(a,'AUTHORIZED',100,new Date(day.getTime()-1)); await fact(b,'AUTHORIZED',100,day);
    await prisma.order.updateMany({ where: { lojaID: f.lojaID }, data: { createdAt: new Date('2020-01-01'), paidAt: new Date('2020-01-02') } });
    expect(await read(f)).toMatchObject({ today: { recognizedGross: 100, recognizedOrderCount: 1 }, allTime: { recognizedGross: 200, recognizedOrderCount: 2 } });
  });
  it('sums installments with financing once; partial recognition has no invented product/freight split and charge refunds deduplicate', async () => {
    const f = await createFulfillmentFixture(), c = await contract(f,110,120);
    await prisma.order.update({ where: { id: c.order.id }, data: { subtotal: 100, shippingCost: 10 } });
    const charges = [];
    for(let ordinal=1;ordinal<=3;ordinal++) charges.push(await prisma.paymentCharge.create({ data: {
      attemptId: c.attempt.id, provider: 'MANUAL', providerPaymentId: randomUUID(), ordinal, amount: 40, providerStatus: 'CONFIRMED',
    } }));
    await fact(c,'AUTHORIZED',40,undefined,undefined,charges[0].id);
    expect((await read(f)).composition).toEqual({ merchandiseAfterDiscount: 0, shipping: 0, financingCharge: 0, unallocatedRecognized: 40 });
    for(const charge of charges.slice(1)) await fact(c,'AUTHORIZED',40,undefined,undefined,charge.id);
    await prisma.paymentCharge.update({ where: { id: charges[0].id }, data: { providerStatus: 'RECEIVED' } });
    await fact(c,'SETTLED',40,undefined,undefined,charges[0].id);
    expect(await read(f)).toMatchObject({ allTime: { recognizedGross: 120, settledGross: 40, recognizedOrderCount: 1 }, composition: { merchandiseAfterDiscount: 100, shipping: 10, financingCharge: 10, unallocatedRecognized: 0 } });
    await prisma.paymentCharge.update({ where: { id: charges[0].id }, data: { providerStatus: 'REFUNDED' } });
    await fact(c,'REFUNDED',40,undefined,undefined,charges[0].id); await fact(c,'REFUNDED',40,undefined,undefined,charges[0].id);
    expect((await read(f)).allTime).toMatchObject({ recognizedGross: 120, settledGross: 40, confirmedRefunds: 40, netRecognized: 80 });
  });
  it('distinct partial refunds add, replay does not; invalid excess is marked partial instead of clamped', async () => {
    const f = await createFulfillmentFixture(), c = await contract(f); const key = randomUUID();
    await fact(c,'AUTHORIZED',100); await fact(c,'REFUNDED',20,undefined,undefined,undefined,key); await fact(c,'REFUNDED',30);
    await fact(c,'REFUNDED',20,undefined,undefined,undefined,key);
    expect((await read(f)).allTime).toMatchObject({ recognizedGross: 100, confirmedRefunds: 50, netRecognized: 50 });
    await fact(c,'REFUNDED',60);
    expect(await read(f)).toMatchObject({ coverage: 'PARTIAL', financialReviewOrders: 1, allTime: { recognizedGross: 0, confirmedRefunds: 0 } });
  });
  it('legacy status is not revenue; future evidence and uncertain attempts expose partial coverage', async () => {
    const f = await createFulfillmentFixture();
    await prisma.order.create({ data: { lojaID: f.lojaID, userID: f.customer.id, status: 'PAID', deliveryType: 'PICKUP', subtotal: 999, total: 999, paidAt: nowMinus(1000) } });
    const c = await contract(f); await fact(c,'AUTHORIZED',100,nowMinus(1000),new Date('2099-01-01'));
    expect(await read(f)).toMatchObject({ unverifiedOrders: 1, financialReviewOrders: 1, coverage: 'PARTIAL', allTime: { recognizedGross: 0 } });
    const other = await contract(f); await fact(other,'AUTHORIZED',100);
    await prisma.paymentAttempt.update({ where: { id: other.attempt.id }, data: { status: 'UNKNOWN' } });
    expect(await read(f)).toMatchObject({ financialReviewOrders: 2, allTime: { recognizedGross: 100, settledGross: 0 } });
  });
  it('test classification excludes facts, foreign tenants are isolated and guest evidence is included', async () => {
    const f = await createFulfillmentFixture(), c = await contract(f), other = await createFulfillmentFixture();
    await fact(c,'AUTHORIZED',100);
    await prisma.orderReportingExclusion.create({ data: { orderId: c.order.id, reason: 'USER_CLASSIFIED_TEST_DATA', classificationBatch: 'fixture', classifiedBy: 'fixture' } });
    const foreign = await contract(other); await fact(foreign,'AUTHORIZED',100);
    expect(await read(f)).toMatchObject({ totalOrdersCount: 0, coverage: 'COMPLETE', allTime: { recognizedGross: 0 } });
    const guest = await contract(f);
    const buyer = await prisma.orderBuyer.create({ data: { lojaID: f.lojaID, name: 'Guest fixture', email: 'guest@example.invalid' } });
    await prisma.order.update({ where: { id: guest.order.id }, data: { userID: null, buyerID: buyer.id } });
    await fact(guest,'AUTHORIZED',100);
    expect(await read(f)).toMatchObject({ totalOrdersCount: 1, allTime: { recognizedGross: 100, recognizedOrderCount: 1 } });
    expect((await readCustomerFinancialSummaries(prisma,f.lojaID,[f.customer.id])).get(f.customer.id)?.recognizedGross).toBe(0);
    await expect(readDashboardFinancial(prisma,'')).rejects.toThrow('ACCOUNT_ACCESS_DENIED');
  });
  it('database session timezone does not shift periods or reject valid UTC facts', async () => {
    const f = await createFulfillmentFixture(), c = await contract(f); await fact(c,'AUTHORIZED',100);
    await prisma.$transaction(async tx => {
      const before = await readDashboardFinancial(tx,f.lojaID);
      await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'Pacific/Honolulu'");
      expect(await readDashboardFinancial(tx,f.lojaID)).toEqual(before);
      await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'Asia/Tokyo'");
      expect(await readDashboardFinancial(tx,f.lojaID)).toEqual(before);
    }, { isolationLevel: 'RepeatableRead' });
  });
});
