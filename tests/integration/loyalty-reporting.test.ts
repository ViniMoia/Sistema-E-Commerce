import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Prisma, type LoyaltyTxType } from '@prisma/client';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { createFulfillmentFixture } from '@/tests/setup/fulfillment-fixture';
import { cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { readLoyaltyReport } from '@/services/loyalty-report.service';
import { getAggregatedDashboardMetrics } from '@/services/dashboard.service';
import { adjustPointsManually, debitRedeemedPoints, refundOrderPoints, reconcileLoyaltyWallet } from '@/services/loyalty.service';

beforeAll(verifyTestDatabase);
afterAll(async () => { await cleanupFixtureStores(); await prisma.$disconnect(); });
type F = Awaited<ReturnType<typeof createFulfillmentFixture>>;
async function purchase(f: F) {
  return prisma.order.create({ data: { lojaID: f.lojaID, userID: f.customer.id, deliveryType: 'PICKUP', subtotal: 100, total: 100 } });
}
async function movement(f: F, orderId: string | null, type: LoyaltyTxType, points: number, monetaryValue: number | null) {
  return prisma.loyaltyTransaction.create({ data: { lojaID: f.lojaID, userID: f.customer.id, orderId, type, points,
    monetaryValue, balanceAfter: 0, description: 'Historical reporting fixture' } });
}
async function state(f: F) {
  return {
    wallets: await prisma.loyaltyWallet.findMany({ where: { lojaID: f.lojaID }, orderBy: { id: 'asc' } }),
    ledger: await prisma.loyaltyTransaction.findMany({ where: { lojaID: f.lojaID }, orderBy: { id: 'asc' } }),
  };
}
describe('loyalty reporting keeps historical values, commercial scope and wallet obligations separate', () => {
  it('changing current point value changes only wallet estimate, not historical discounts; dashboard agrees', async () => {
    const f = await createFulfillmentFixture(), o = await purchase(f);
    await prisma.loyaltyWallet.create({ data: { lojaID: f.lojaID, userID: f.customer.id, balance: 50, lifetimeEarn: 0, accountingReady: true } });
    await movement(f,o.id,'EARN',100,1); await movement(f,o.id,'REFUND_EARN',-20,0.2);
    await movement(f,o.id,'REDEEM',-100,1); await movement(f,o.id,'REDEEM',-20,0.4);
    await movement(f,o.id,'REFUND_REDEEM',20,0.4);
    await prisma.loja.update({ where: { id: f.lojaID }, data: { loyaltyPointValue: '0.50' } });
    const before = await state(f), first = await readLoyaltyReport(f.lojaID);
    expect(first.metrics).toMatchObject({ totalCirculatingPoints: 50, totalDebtPoints: 0, totalLifetimeEarnedPoints: 0, projectedFinancialLiability: 25,
      commercial: { earnedPoints: 100, reversedEarnedPoints: 20, redeemedPoints: 120, returnedPoints: 20, netRedeemedPoints: 100,
        redeemedValue: 1.4, returnedValue: 0.4, netRedeemedValue: 1, coverage: 'COMPLETE' } });
    await prisma.loja.update({ where: { id: f.lojaID }, data: { loyaltyPointValue: '0.25' } });
    const second = await readLoyaltyReport(f.lojaID);
    expect(second.metrics.projectedFinancialLiability).toBe(12.5);
    expect(second.metrics.commercial).toEqual(first.metrics.commercial);
    const dashboard = await getAggregatedDashboardMetrics(f.lojaID);
    expect(dashboard.loyalty.commercial).toEqual(second.metrics.commercial);
    expect(dashboard.loyalty.totalRedeemedMonetaryDiscount).toBe(1.4);
    expect(await state(f)).toEqual(before);
  });
  it('explicit test orders leave commercial history, but ledger, zero wallet accumulator and test debt survive', async () => {
    const f = await createFulfillmentFixture(), commercial = await purchase(f), test = await purchase(f);
    await movement(f, commercial.id,'REDEEM',-20,2);
    await movement(f,test.id,'EARN',100,10); await movement(f,test.id,'REDEEM',-100,10); await movement(f,test.id,'REFUND_REDEEM',100,10);
    await prisma.loyaltyWallet.create({ data: { lojaID: f.lojaID, userID: f.customer.id, balance: 25, debt: 5, lifetimeEarn: 0 } });
    const before = await state(f);
    await prisma.orderReportingExclusion.create({ data: { orderId: test.id, reason: 'USER_CLASSIFIED_TEST_DATA', classificationBatch: randomUUID(), classifiedBy: f.admin.id } });
    const report = await readLoyaltyReport(f.lojaID);
    expect(report.metrics).toMatchObject({ totalCirculatingPoints: 25, totalLifetimeEarnedPoints: 0, totalDebtPoints: 5, legacyWallets: 1,
      commercial: { earnedPoints: 0, redeemedPoints: 20, redeemedValue: 2, returnedPoints: 0, returnedValue: 0 } });
    expect(report.recentTransactions.filter(t => t.isTestOrder)).toHaveLength(3);
    expect(await state(f)).toEqual(before);
  });
  it('missing historical money and unlinked legacy entries are explicit; zero is a known value and tenant scope is strict', async () => {
    const f = await createFulfillmentFixture(), o = await purchase(f), other = await createFulfillmentFixture(), foreign = await purchase(other);
    await movement(f,o.id,'REDEEM',-10,null); await movement(f,o.id,'REDEEM',-5,0);
    await movement(f,null,'REDEEM',-999,999); await movement(f,null,'ADMIN_ADJUSTMENT',10,null);
    await movement(other,foreign.id,'REDEEM',-1000,1000);
    const r = await readLoyaltyReport(f.lojaID);
    expect(r.metrics.commercial).toMatchObject({ redeemedPoints: 15, redeemedValue: 0, missingMonetaryValues: 1, unlinkedTransactions: 1, coverage: 'PARTIAL' });
    expect(r.recentTransactions).toHaveLength(4);
    const empty = await createFulfillmentFixture();
    expect((await readLoyaltyReport(empty.lojaID)).metrics).toMatchObject({ totalCirculatingPoints: 0, totalLifetimeEarnedPoints: 0,
      commercial: { redeemedPoints: 0, returnedPoints: 0, netRedeemedValue: 0, coverage: 'COMPLETE' } });
  });
  it('actual redemption and cancellation replays leave one debit/return; report reads never mutate wallet or ledger', async () => {
    const f = await createFulfillmentFixture(), o = await purchase(f);
    await prisma.loja.update({ where: { id: f.lojaID }, data: { loyaltyEnabled: true, loyaltyPointValue: new Prisma.Decimal('0.01') } });
    await adjustPointsManually({ lojaID: f.lojaID, userID: f.customer.id, adminUserId: f.admin.id, points: 100, commandId: randomUUID(), description: 'Reporting test initial balance' });
    const args = { lojaID: f.lojaID, userID: f.customer.id, orderId: o.id, points: 40, monetaryValue: 0.4 };
    await debitRedeemedPoints(args); await debitRedeemedPoints(args);
    await refundOrderPoints({ lojaID: f.lojaID, orderId: o.id }); await refundOrderPoints({ lojaID: f.lojaID, orderId: o.id });
    const before = await state(f);
    const a = await readLoyaltyReport(f.lojaID), b = await readLoyaltyReport(f.lojaID);
    expect(a).toEqual(b);
    expect(a.metrics).toMatchObject({ totalCirculatingPoints: 100, commercial: { earnedPoints: 0, redeemedPoints: 40, returnedPoints: 40,
      netRedeemedPoints: 0, redeemedValue: 0.4, returnedValue: 0.4, netRedeemedValue: 0 } });
    expect(await prisma.loyaltyTransaction.count({ where: { orderId: o.id, type: 'REDEEM' } })).toBe(1);
    expect(await prisma.loyaltyTransaction.count({ where: { orderId: o.id, type: 'REFUND_REDEEM' } })).toBe(1);
    expect(await reconcileLoyaltyWallet(f.lojaID, f.customer.id)).toMatchObject({ conserved: true, balance: 100 });
    expect(await state(f)).toEqual(before);
  });
});
