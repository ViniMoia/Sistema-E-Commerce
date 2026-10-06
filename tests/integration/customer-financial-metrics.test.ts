import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { createFulfillmentFixture } from '@/tests/setup/fulfillment-fixture';
import { cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { createOrder } from '@/tests/setup/checkout-fixture';
import { listCustomers, getCustomerMetrics, getCustomerProfile } from '@/services/customer.service';
import { getCustomerMetrics as legacyMetrics } from '@/services/admin.service';
import { transitionOrder } from '@/lib/commerce/order-command';
import { applyPaymentEvidence } from '@/services/payment/payment-evidence.service';
import { CommerceLocks } from '@/lib/commerce/locks';
import { manualRefund } from '@/services/payment/manual-refund.service';
import { installmentPlan } from '@/services/payment/installment.service';
import { readCustomerFinancialSummaries } from '@/services/customer-financial-metrics.service';
import { get } from '@/tests/helpers/request';
import type { PaymentGateway } from '@/types/payment-gateway.types';
type Fixture = Awaited<ReturnType<typeof createFulfillmentFixture>>;
beforeAll(verifyTestDatabase);
afterAll(async () => { await cleanupFixtureStores(); await prisma.$disconnect(); });
const metrics = (f: Fixture) => getCustomerMetrics({ customerId: f.customer.id, lojaID: f.lojaID });
const partial = async (id: string, amount: number, key = randomUUID()) => {
  const a = await prisma.paymentAttempt.findFirstOrThrow({ where: { orderId: id } });
  return prisma.financialFact.upsert({ where: { provider_factKey: { provider: a.provider, factKey: key } }, update: {}, create: {
    orderId: id, attemptId: a.id, provider: a.provider, providerAccount: a.providerAccount, factKey: key,
    type: 'REFUNDED', amount, occurredAt: new Date('2026-10-04T12:00:00Z'),
  } });
};
async function pending(f: Fixture, port?: PaymentGateway) {
  const p = await prisma.product.create({ data: { lojaID: f.lojaID, userID: f.admin.id, name: 'Tentativa não paga', description: '', imageUrl: '', price: 100, stock: 2,
    productVariants: { create: { size: 'Único', color: 'Padrão', stock: 2 } } }, include: { productVariants: true } });
  const result = await createOrder({ lojaID: f.lojaID, customer: { userId: f.customer.id, name: f.customer.name, email: f.customer.email, phone: '11999999999', cpfCnpj: '52998224725' },
    deliveryType: 'PICKUP', paymentMethod: port ? 'PIX' : 'WHATSAPP_PIX', paymentGateway: port,
    items: [{ productId: p.id, variantId: p.productVariants[0].id, quantity: 1 }] });
  return prisma.order.findUniqueOrThrow({ where: { id: result.order.id } });
}
describe('WF-17: customer financial recognition in PostgreSQL and HTTP', () => {
  it('pending100 and cancelled-unpaid100 add no LTV or ticket denominator', async () => {
    const f = await createFulfillmentFixture(); await pending(f); const cancelled = await pending(f);
    await transitionOrder({ ...f.context, orderId: cancelled.id, newStatus: 'CANCELLED' });
    expect(await metrics(f)).toMatchObject({ totalOrders: 2, totalOrderValue: 200, totalMerchandiseOrdered: 200,
      totalSpent: 0, recognizedGross: 0, averageOrderValue: 0, recognizedOrderCount: 0, cancelledOrders: 1, coverage: 'COMPLETE', mostBoughtProduct: null });
  });
  it('paid100 less two distinct partial refunds20+10 is70; replay is not another refund; list equals profile', async () => {
    const f = await createFulfillmentFixture(); const o = await f.order('PICKUP'); const key = randomUUID();
    await partial(o.id, 20, key); await partial(o.id, 10); await partial(o.id, 20, key);
    const m = await metrics(f);
    expect(m).toMatchObject({ totalSpent: 70, recognizedGross: 100, confirmedRefunds: 30, averageOrderValue: 70, recognizedOrderCount: 1 });
    const row = (await listCustomers({ lojaID: f.lojaID })).data.find(r => r.id === f.customer.id);
    for (const field of ['totalSpent','recognizedGross','confirmedRefunds','averageOrderValue','recognizedOrderCount','totalOrders','coverage']) expect(row[field]).toEqual(m[field]);
    const legacy = await legacyMetrics(f.customer.id, f.lojaID); expect(legacy.totalSpent).toBe(70); expect(legacy.averageTicket).toBe(70);
  });
  it('cancelled paid order retains money until actual confirmed refund, not on REFUND_PENDING', async () => {
    const f = await createFulfillmentFixture(); const o = await f.order('PICKUP');
    await transitionOrder({ ...f.context, orderId: o.id, newStatus: 'CANCELLED', expectedVersion: 1 });
    expect(await metrics(f)).toMatchObject({ totalSpent: 100, cancelledOrders: 1, recognizedOrderCount: 1 });
    await manualRefund({ lojaID: f.lojaID, userId: f.admin.id, orderId: o.id, action: 'CONFIRM_REFUND', expectedVersion: 2, commandId: randomUUID(), bankReference: 'fixture-bank' });
    expect(await metrics(f)).toMatchObject({ totalSpent: 0, confirmedRefunds: 100, averageOrderValue: 0, recognizedOrderCount: 1 });
  });
  it('empty owned customer returns zeros; foreign/missing customer and tenant-less adapter are rejected', async () => {
    const f = await createFulfillmentFixture(); const other = await createFulfillmentFixture();
    expect(await metrics(f)).toMatchObject({ totalOrders: 0, totalSpent: 0, averageOrderValue: 0, coverage: 'COMPLETE', firstOrderAt: null, preferredDeliveryType: null });
    expect(await getCustomerProfile({ customerId: f.customer.id, lojaID: f.lojaID })).not.toBeNull();
    expect(await getCustomerProfile({ customerId: other.customer.id, lojaID: f.lojaID })).toBeNull();
    await expect(getCustomerMetrics({ customerId: other.customer.id, lojaID: f.lojaID })).rejects.toThrow('Cliente não encontrado');
    await expect(legacyMetrics(f.customer.id)).rejects.toThrow('ACCOUNT_ACCESS_DENIED');
  });
  it('fully refunded orders remain in the recognized-order denominator; exact cents round HALF_UP', async () => {
    const f = await createFulfillmentFixture(); const a = await f.order('PICKUP'); const b = await f.order('PICKUP');
    await partial(a.id, 100); await partial(b.id, 99.99);
    expect(await metrics(f)).toMatchObject({ recognizedGross: 200, confirmedRefunds: 199.99, totalSpent: 0.01, recognizedOrderCount: 2, averageOrderValue: 0.01 });
  });
  it('delivery total includes freight while commercial merchandise snapshots remain separate from money recognized', async () => {
    const f = await createFulfillmentFixture(); const o = await f.order('DELIVERY'); const m = await metrics(f);
    expect(m).toMatchObject({ totalMerchandiseOrdered: 100, totalOrderValue: 115, recognizedGross: 115, totalSpent: 115, averageOrderValue: 115 });
    await prisma.product.updateMany({ where: { lojaID: f.lojaID }, data: { price: 999 } });
    expect((await metrics(f)).totalSpent).toBe(115);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).subtotal.toNumber()).toBe(100);
  });
  it('legacy paid/shipped with no facts is flagged and contributes no fabricated revenue', async () => {
    const f = await createFulfillmentFixture();
    for (const status of ['PAID','SHIPPED'] as const) await prisma.order.create({ data: { userID: f.customer.id, lojaID: f.lojaID, status, deliveryType: 'PICKUP', total: 100, subtotal: 100, shippingCost: 0 } });
    expect(await metrics(f)).toMatchObject({ totalOrders: 2, totalSpent: 0, unverifiedOrders: 2, coverage: 'PARTIAL', recognizedOrderCount: 0 });
  });
  it('NONE is a valid preference and unpaid dominant items are excluded from purchase preferences', async () => {
    const f = await createFulfillmentFixture(); await f.order('NONE'); await pending(f);
    expect(await metrics(f)).toMatchObject({ mostBoughtProduct: 'Produto WF16', preferredDeliveryType: 'NONE', totalSpent: 100 });
  });
  it('amounts without balanced evidence require review instead of clipping or inventing principal', async () => {
    const f = await createFulfillmentFixture(); const o = await f.order('PICKUP'); await partial(o.id, 100); await partial(o.id, 1);
    expect(await metrics(f)).toMatchObject({ totalSpent: 0, recognizedGross: 0, confirmedRefunds: 0, financialReviewOrders: 1, coverage: 'PARTIAL' });
  });
  it('future evidence is excluded and flagged, independent of device timezone', async () => {
    const f = await createFulfillmentFixture(); const o = await f.order('PICKUP'); const a = await prisma.paymentAttempt.findFirstOrThrow({ where: { orderId: o.id } });
    await prisma.financialFact.create({ data: { orderId: o.id, attemptId: a.id, provider: 'MANUAL', factKey: randomUUID(), type: 'SETTLED', amount: 100, occurredAt: new Date('2099-01-01T00:00:00Z') } });
    expect(await metrics(f)).toMatchObject({ totalSpent: 0, financialReviewOrders: 1, coverage: 'PARTIAL' });
  });
  it('HTTP list/profile preserve tenant and expose no-store policy plus same money; filters and cursor do not change lifetime basis', async () => {
    const f = await createFulfillmentFixture(); const o = await f.order('PICKUP'); await partial(o.id, 30);
    const headers = { Host: f.host, Cookie: 'session_id=' + f.session.id };
    const list = await get('/api/admin/customers', { headers, query: { search: f.customer.email, limit: '1' } });
    const profile = await get('/api/admin/customers/' + f.customer.id + '/metrics', { headers });
    expect(list.status).toBe(200); expect(profile.status).toBe(200);
    expect(list.headers['cache-control']).toBe('private, no-store'); expect(profile.headers['cache-control']).toBe('private, no-store');
    expect(profile.body).toMatchObject({ data: { totalSpent: 70, policy: 'LIFETIME_RECOGNIZED_NET_V1', currency: 'BRL' } });
    expect(list.body).toMatchObject({ data: { data: [{ id: f.customer.id, totalSpent: 70 }] } });
    const foreign = await createFulfillmentFixture();
    expect((await get('/api/admin/customers/' + foreign.customer.id + '/metrics', { headers })).status).toBe(404);
    await expect(listCustomers({ lojaID: f.lojaID, cursor: foreign.customer.id })).rejects.toThrow('CUSTOMER_CURSOR_INVALID');
  });
  it('AUTHORIZED plus SETTLED and repeated reconciliation are one principal; full-charge refund facts are deduplicated', async () => {
    const f = await createFulfillmentFixture(); await prisma.loja.update({ where: { id: f.lojaID }, data: { enablePix: true } });
    let paymentID: string;
    const port: PaymentGateway = {
      capabilities: async () => ({ configured: true, methods: ['PIX'], maximumInstallments: 1 }),
      createPixCharge: async input => { paymentID = randomUUID(); return { paymentId: paymentID, value: input.value, status: 'PENDING', pixPayload: 'fixture-copy', pixQrCodeBase64: 'fixture-qr', expiresAt: new Date(Date.now()+3600000).toISOString() }; },
      createBoletoCharge: async () => { throw new Error('unused'); }, createCreditCardCharge: async () => { throw new Error('unused'); },
      getPaymentStatus: async () => { throw new Error('unused'); },
    };
    const o = await pending(f, port); const a = await prisma.paymentAttempt.findFirstOrThrow({ where: { orderId: o.id } });
    const reconcile = (status: string) => prisma.$transaction(async tx => {
      await new CommerceLocks(tx).acquire('order', [o.id]);
      return applyPaymentEvidence(tx, a.id, { complete: true, charges: [{ paymentId: paymentID, externalReference: o.id, method: 'PIX', ordinal: 1, value: 100, status, paidAt: '2026-10-04T12:00:00Z' }] });
    });
    await reconcile('RECEIVED'); await reconcile('RECEIVED');
    expect(await metrics(f)).toMatchObject({ recognizedGross: 100, settledGross: 100, totalSpent: 100 });
    expect(await prisma.financialFact.count({ where: { orderId: o.id } })).toBe(2);
    await reconcile('REFUNDED'); await reconcile('REFUNDED');
    expect(await metrics(f)).toMatchObject({ recognizedGross: 100, confirmedRefunds: 100, settledGross: 100, totalSpent: 0, recognizedOrderCount: 1 });
  });
  it('three installments and financing charges recognize the frozen contract total once per order', async () => {
    const f = await createFulfillmentFixture(); await prisma.loja.update({ where: { id: f.lojaID }, data: { enableCreditCard: true } });
    const p = await prisma.product.create({ data: { lojaID: f.lojaID, userID: f.admin.id, name: 'Parcelado', description: '', imageUrl: '', price: 100, stock: 2,
      productVariants: { create: { size: 'Único', color: 'Padrão', stock: 2 } } }, include: { productVariants: true } });
    vi.stubEnv('INSTALLMENT_MONTHLY_RATE', '0.025'); vi.stubEnv('INSTALLMENT_ABSORB_FEES', 'false');
    try {
      const plan = installmentPlan(100, 3); const contractId = randomUUID();
      const port: PaymentGateway = {
        capabilities: async () => ({ configured: true, methods: ['CREDIT_CARD'], maximumInstallments: 3 }),
        createCreditCardCharge: async input => {
          const charges = plan.installments.map((amount, i) => ({ paymentId: randomUUID(), ordinal: i+1, value: Number(amount), status: 'CONFIRMED' }));
          return { paymentId: charges[0].paymentId, value: input.value, status: 'CONFIRMED', contractId, approvedForEntireContract: true, charges };
        },
        createBoletoCharge: async () => { throw new Error('unused'); }, createPixCharge: async () => { throw new Error('unused'); },
        getPaymentStatus: async () => { throw new Error('unused'); },
      };
      const result = await createOrder({ lojaID: f.lojaID, customer: { userId: f.customer.id, name: f.customer.name, email: f.customer.email, phone: '11999999999', cpfCnpj: '52998224725' },
        deliveryType: 'PICKUP', paymentMethod: 'CREDIT_CARD', paymentGateway: port, installments: 3, acceptedFinancialTotal: Number(plan.financialTotal),
        billingAddress: { cep: '01001000', state: 'SP', city: 'São Paulo', street: 'Rua', neighborhood: 'Centro', number: '1' },
        creditCard: { holderName: 'FIXTURE', number: '4532015112830366', expiryMonth: '12', expiryYear: '2030', ccv: '123' },
        items: [{ productId: p.id, variantId: p.productVariants[0].id, quantity: 1 }] });
      const m = await metrics(f); expect(m.recognizedGross).toBe(Number(plan.financialTotal));
      expect(m).toMatchObject({ totalSpent: Number(plan.financialTotal), totalMerchandiseOrdered: 100, recognizedOrderCount: 1, averageOrderValue: Number(plan.financialTotal) });
      expect(await prisma.financialFact.count({ where: { orderId: result.order.id, type: 'AUTHORIZED' } })).toBe(3);
    } finally { vi.unstubAllEnvs(); }
  });
  it('lifetime totals survive UTC/local midnight and UNKNOWN is marked incomplete without fabricating money', async () => {
    const f = await createFulfillmentFixture(); const o = await f.order('PICKUP');
    await prisma.order.update({ where: { id: o.id }, data: { createdAt: new Date('2026-10-05T01:00:00Z') } });
    const unpaid = await pending(f); await prisma.paymentAttempt.updateMany({ where: { orderId: unpaid.id }, data: { status: 'UNKNOWN' } });
    expect(await metrics(f)).toMatchObject({ totalSpent: 100, totalOrders: 2, recognizedOrderCount: 1, firstOrderAt: '2026-10-05T01:00:00.000Z', financialReviewOrders: 1, coverage: 'PARTIAL' });
  });
  it('repeatable-read preserves one financial snapshot while a refund commits; the next request sees it', async () => {
    const f = await createFulfillmentFixture(); const o = await f.order('PICKUP');
    await prisma.$transaction(async tx => {
      const before = (await readCustomerFinancialSummaries(tx, f.lojaID, [f.customer.id])).get(f.customer.id);
      await partial(o.id, 30);
      const after = (await readCustomerFinancialSummaries(tx, f.lojaID, [f.customer.id])).get(f.customer.id);
      expect(before.totalSpent).toBe(100); expect(after).toEqual(before);
    }, { isolationLevel: 'RepeatableRead' });
    expect((await metrics(f)).totalSpent).toBe(70);
  });
  it('external-state/reconciliation review flags incomplete evidence without inventing a refund', async () => {
    const f = await createFulfillmentFixture(); const o = await f.order('PICKUP');
    for (const failureCode of ['PAYMENT_EXTERNAL_STATE_REVIEW', 'PAYMENT_RECONCILIATION_OVERDUE', 'PAYMENT_PARTIAL_REVERSAL_REVIEW']) {
      await prisma.paymentAttempt.updateMany({ where: { orderId: o.id }, data: { failureCode } });
      expect(await metrics(f)).toMatchObject({ totalSpent: 100, confirmedRefunds: 0, financialReviewOrders: 1, coverage: 'PARTIAL' });
    }
  });
});
