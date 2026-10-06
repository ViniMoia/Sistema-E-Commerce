import { freezeEarnPolicy } from '@/lib/commerce/loyalty-earn';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { createFixtureStore, cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { createTestOrder } from '@/tests/setup/factories';
import { createOrder } from '@/tests/setup/checkout-fixture';
import { adjustPointsManually, calculateExpiredPointsForUser, creditEarnedPoints, debitRedeemedPoints,
  expireUserPoints, processLoyaltyExpirations, reconcileLoyaltyWallet, refundOrderPoints, getWalletSummary, simulatePointsRedemption } from '@/services/loyalty.service';
import { transitionOrder } from '@/lib/commerce/order-command';
import { lockLoyaltyWallet, restoreRedeemLockedLoyalty } from '@/lib/commerce/loyalty-ledger';
import { post } from '@/tests/helpers/request';

let lojaID: string; let adminID: string; let host: string;
const now = new Date(); const day = 86400000;
const buyer = async () => (await prisma.user.create({ data: { lojaID, name: 'Cliente', email: `${randomUUID()}@example.invalid`, password: '' } })).id;
const order = async (userID: string, status: 'PENDING' | 'PAID' = 'PENDING') => {
  const policy = freezeEarnPolicy(await prisma.loja.findUniqueOrThrow({ where: { id: lojaID } }), new Prisma.Decimal(100), true);
  const fixture = await createTestOrder({ lojaID, userID, status });
  return prisma.order.update({ where: { id: fixture.id }, data: { loyaltyEarnSnapshot: policy, pointsEarned: policy.points } });
};
const grant = (userID: string, points: number, expiresAt?: string | null, commandId = randomUUID()) =>
  adjustPointsManually({ lojaID, userID, adminUserId: adminID, points, expiresAt, commandId, description: 'Ajuste auditado da fixture' });
const wallet = (userID: string) => prisma.loyaltyWallet.findUniqueOrThrow({ where: { lojaID_userID: { lojaID, userID } } });
const closed = async (userID: string, balance: number, debt = 0) => expect(await reconcileLoyaltyWallet(lojaID, userID)).toMatchObject({
  accountingReady: true, balance, debt, lotRemaining: balance, ledgerAvailable: balance, ledgerDebt: debt, conserved: true,
});
const earn = (userID: string, orderId: string, subtotal: number) => creditEarnedPoints({ lojaID, userID, orderId, subtotal });
const redeem = (userID: string, orderId: string, points: number) => debitRedeemedPoints({ lojaID, userID, orderId, points, monetaryValue: points / 100 });
const refund = (orderId: string) => refundOrderPoints({ lojaID, orderId });
const session = async (userId: string) => `session_id=${(await prisma.session.create({ data: { userId, expiresAt: new Date(Date.now() + 600000) } })).id}`;
beforeAll(async () => {
  await verifyTestDatabase(); lojaID = await createFixtureStore();
  await prisma.loja.update({ where: { id: lojaID }, data: { loyaltyEnabled: true, loyaltyEarnRate: 1, loyaltyPointValue: '0.01', loyaltyMinPointsRedeem: 1, loyaltyMaxDiscountPct: 100, loyaltyPointsExpiryDays: 1 } });
  adminID = (await prisma.user.create({ data: { lojaID, name: 'Administrador', email: `${randomUUID()}@example.invalid`, password: '', role: 'ADMIN' } })).id;
  host = `${(await prisma.loja.findUniqueOrThrow({ where: { id: lojaID } })).slug}.plataforma.com`;
});
afterAll(async () => {
  // Only the fixture-created deferred effects; generic outbox cleanup remains scoped.
  await prisma.commerceOutbox.deleteMany({ where: { commandType: { in: ['LOYALTY_RECONCILE_EARN', 'LOYALTY_RECONCILE_REFUND'] }, payload: { path: ['lojaID'], equals: lojaID } } });
  await cleanupFixtureStores(); await prisma.$disconnect();
});

describe('WF-09 / LA-021/022: lot origins, allocations, expiry and separate deficit', () => {
  it('an adjustment100 without EARN never expires, even with an arbitrary requested debit', async () => {
    const userID = await buyer(); await grant(userID, 100);
    expect(await calculateExpiredPointsForUser(lojaID, userID, 999, new Date(now.getTime() + 1000 * day))).toBe(0);
    expect(await expireUserPoints({ lojaID, userID, points: 100000, now: new Date(now.getTime() + 1000 * day) })).toBeNull();
    await closed(userID, 100);
  });
  it('FEFO consumes nearest deadline first, keeps non-expiring credits, and expires only the remainder', async () => {
    const userID = await buyer(); await grant(userID, 50); const near = await grant(userID, 100, new Date(now.getTime() + day).toISOString());
    const later = await grant(userID, 20, new Date(now.getTime() + 5 * day).toISOString()); const purchase = await order(userID);
    await redeem(userID, purchase.id, 60);
    const lots = await prisma.loyaltyLot.findMany({ where: { wallet: { userID, lojaID } } });
    expect(lots.find(lot => lot.sourceTransactionId === near.transaction.id)?.remaining).toBe(40);
    expect(lots.find(lot => lot.sourceTransactionId === later.transaction.id)?.remaining).toBe(20);
    expect(await expireUserPoints({ lojaID, userID, now: new Date(now.getTime() + 2 * day) })).toMatchObject({ pointsExpired: 40 });
    await closed(userID, 70);
  });
  it('two jobs over150 with100 due and50 valid leave50 with one expiration effect', async () => {
    const userID = await buyer(); await grant(userID, 100, new Date(now.getTime() + day).toISOString()); await grant(userID, 50);
    const options = { lojaID, now: new Date(now.getTime() + 2 * day) };
    await Promise.all([processLoyaltyExpirations(options), processLoyaltyExpirations(options)]);
    expect(await prisma.loyaltyTransaction.count({ where: { lojaID, userID, type: 'EXPIRATION' } })).toBe(1);
    await closed(userID, 50);
    expect(await processLoyaltyExpirations(options)).toMatchObject({ totalPointsExpired: 0, errors: [] });
  });
  it('concurrent initial credits/retries create one wallet and apply each command once', async () => {
    const userID = await buyer(); const commandId = randomUUID();
    const results = await Promise.all([grant(userID, 10, null, commandId), grant(userID, 10, null, commandId), grant(userID, 20)]);
    expect(results.filter(result => result.replay)).toHaveLength(1); await closed(userID, 30);
    await expect(grant(userID, 11, null, commandId)).rejects.toMatchObject({ code: 'CONFLICT' });
    await closed(userID, 30);
  });
  it('two different redemptions cannot spend the same100; a retry does not debit twice', async () => {
    const userID = await buyer(); await grant(userID, 100); const a = await order(userID); const b = await order(userID);
    const results = await Promise.allSettled([redeem(userID, a.id, 100), redeem(userID, b.id, 100)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.find(result => result.status === 'rejected')).toMatchObject({ reason: { code: 'INSUFFICIENT_POINTS' } });
    const winner = results[0].status === 'fulfilled' ? a : b;
    expect(await redeem(userID, winner.id, 100)).toMatchObject({ replay: true }); await closed(userID, 0);
  });
  it('expiration racing redemption cannot spend a due lot or take non-expiring balance twice', async () => {
    const userID = await buyer(); await grant(userID, 100, new Date(now.getTime() + day).toISOString()); await grant(userID, 50); const purchase = await order(userID);
    // Actual time is still before the deadline, so either serialization is legal.
    const results = await Promise.allSettled([expireUserPoints({ lojaID, userID, now: new Date(now.getTime() + 2 * day) }), redeem(userID, purchase.id, 100)]);
    expect(results[0].status).toBe('fulfilled'); await closed(userID, 50);
    expect(await prisma.loyaltyAllocation.aggregate({ where: { transaction: { lojaID, userID } }, _sum: { points: true } })).toMatchObject({ _sum: { points: 100 } });
  });
  it('a ledger insertion failure rolls back lot, wallet and version; retry remains eligible', async () => {
    const userID = await buyer(); await grant(userID, 100, new Date(now.getTime() + day).toISOString()); const before = await wallet(userID);
    const constraint = `fixture_expiry_${randomUUID().replaceAll('-', '')}`;
    if (!/^[a-f0-9-]{36}$/.test(userID)) throw new Error('Invalid fixture UUID');
    await prisma.$executeRawUnsafe(`ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "${constraint}" CHECK ("userID" <> '${userID}' OR type <> 'EXPIRATION')`);
    try { await expect(expireUserPoints({ lojaID, userID, now: new Date(now.getTime() + 2 * day) })).rejects.toThrow(); }
    finally { await prisma.$executeRawUnsafe(`ALTER TABLE "LoyaltyTransaction" DROP CONSTRAINT "${constraint}"`); }
    expect(await wallet(userID)).toMatchObject({ balance: before.balance, version: before.version }); await closed(userID, 100);
    expect(await expireUserPoints({ lojaID, userID, now: new Date(now.getTime() + 2 * day) })).toMatchObject({ pointsExpired: 100 }); await closed(userID, 0);
  });
  it('canceling a paid order after spending its credit creates debt and allows cancellation/retry', async () => {
    const userID = await buyer();
    const customer=await prisma.user.findUniqueOrThrow({ where:{ id:userID } });
    await prisma.loja.update({ where:{ id:lojaID },data:{ enablePickup:true } });
    const product=await prisma.product.create({ data:{ lojaID,userID:adminID,name:'Pedido com origem',description:'',imageUrl:'',price:100,stock:2,
      productVariants:{ create:{ size:'Único',color:'Padrão',stock:2 } } },include:{ productVariants:true } });
    const purchase=await createOrder({ lojaID,customer:{ userId:userID,name:customer.name,email:customer.email,phone:'11999999999' },
      deliveryType:'PICKUP',paymentMethod:'WHATSAPP_PIX',items:[{ productId:product.id,variantId:product.productVariants[0].id,quantity:1 }] });
    const paid=purchase.order;
    expect(await transitionOrder({ lojaID,orderId:paid.id,newStatus:'PAID',performedById:adminID })).toMatchObject({ success:true });
    const spent = await order(userID); await redeem(userID, spent.id, 100);
    const command = { lojaID, orderId: paid.id, newStatus: 'CANCELLED' as const, performedById: adminID, commandId: randomUUID() };
    expect(await transitionOrder(command)).toMatchObject({ success: true, order: { status: 'CANCELLED' } }); await closed(userID, 0, 100);
    expect(await transitionOrder(command)).toMatchObject({ success: true }); await closed(userID, 0, 100);
    expect(await getWalletSummary(lojaID, userID)).toMatchObject({ balance: 0, debt: 100, accountingReady: true });
    await grant(userID, 60); await closed(userID, 0, 40); await grant(userID, 70); await closed(userID, 30);
  });
  it('expired earned credits are not charged again on cancellation', async () => {
    const userID = await buyer(); const paid = await order(userID, 'PAID'); await earn(userID, paid.id, 100);
    await expireUserPoints({ lojaID, userID, now: new Date(now.getTime() + 2 * day) });
    await refund(paid.id); await refund(paid.id); await closed(userID, 0);
    expect(await prisma.loyaltyTransaction.findFirst({ where: { lojaID, userID, type: 'REFUND_EARN' } })).toMatchObject({ points: 0, debtDelta: 0 });
  });
  it('a refunded redemption preserves the original valid deadline and allocation identity', async () => {
    const userID = await buyer(); const expiry = new Date(now.getTime() + 5 * day).toISOString(); await grant(userID, 100, expiry);
    const purchase = await order(userID); await redeem(userID, purchase.id, 40); await refund(purchase.id); await refund(purchase.id); await closed(userID, 100);
    const restored = await prisma.loyaltyLot.findMany({ where: { wallet: { userID, lojaID }, sourceAllocationId: { not: null } } });
    expect(restored).toHaveLength(1); expect(restored[0]).toMatchObject({ remaining: 40, expiresAt: new Date(expiry) });
  });
  it('reversal follows refunded descendants instead of creating phantom debt while those points are available', async () => {
    const userID = await buyer(); const paid = await order(userID, 'PAID'); await earn(userID, paid.id, 100);
    const purchase = await order(userID); await redeem(userID, purchase.id, 60); await refund(purchase.id); await closed(userID, 100);
    await refund(paid.id); await closed(userID, 0);
  });
  it('expired return creates a separate compensating lot with its own snapshotted term and original allocation', async () => {
    const userID = await buyer(); await grant(userID, 100, new Date(now.getTime() + day).toISOString());
    const purchase = await order(userID); const redemption = await redeem(userID, purchase.id, 100);
    const returnedAt = new Date(now.getTime() + 2 * day);
    await prisma.$transaction(async tx => {
      const state = await lockLoyaltyWallet(tx, { lojaID, userID }, false, returnedAt);
      await restoreRedeemLockedLoyalty(state!, redemption!.transaction, 'Compensação explícita', 3);
    });
    const restored = await prisma.loyaltyLot.findFirstOrThrow({ where: { wallet: { lojaID, userID }, sourceAllocationId: { not: null } } });
    expect(restored.expiresAt).toEqual(new Date(returnedAt.getTime() + 3 * day));
    expect(await prisma.loyaltyTransaction.findUnique({ where: { id: restored.sourceTransactionId } })).toMatchObject({ policy: { expiredReturnTermDays: 3, returnedAt: returnedAt.toISOString() } });
    await closed(userID, 100);
    expect(await expireUserPoints({ lojaID, userID, now: new Date(returnedAt.getTime() + 2 * day) })).toBeNull();
  });
  it('an unexpired lease skips work; an expired lease is reclaimed; independent wallet still progresses', async () => {
    const userID = await buyer(); await grant(userID, 100, new Date(now.getTime() + day).toISOString());
    await prisma.loyaltyWallet.update({ where: { lojaID_userID: { lojaID, userID } }, data: { expirationLeaseOwner: 'stalled-worker', expirationLeaseUntil: new Date(Date.now() + 600000) } });
    const independent = await buyer(); await grant(independent, 10, new Date(now.getTime() + day).toISOString());
    const options = { lojaID, now: new Date(now.getTime() + 2 * day) }; await processLoyaltyExpirations(options);
    await closed(userID, 100); await closed(independent, 0);
    await prisma.loyaltyWallet.update({ where: { lojaID_userID: { lojaID, userID } }, data: { expirationLeaseUntil: new Date(Date.now() - 1) } });
    await processLoyaltyExpirations(options); await closed(userID, 0);
    expect(await wallet(userID)).toMatchObject({ expirationLeaseOwner: null, expirationLeaseUntil: null });
  });
  it('legacy balances do not expire or gain invented provenance; mutation is blocked and explicit reconciliation is durable', async () => {
    const userID = await buyer(); await prisma.loyaltyWallet.create({ data: { lojaID, userID, balance: 100 } }); const paid = await order(userID, 'PAID');
    await prisma.loyaltyTransaction.create({ data: { lojaID, userID, orderId: paid.id, type: 'EARN', points: 100, balanceAfter: 100, description: 'Histórico legado', expiresAt: new Date(now.getTime() - day) } });
    expect(await expireUserPoints({ lojaID, userID, now: new Date(now.getTime() + 2 * day) })).toBeNull();
    expect(await simulatePointsRedemption({ lojaID, userID, subtotal: 100, requestedPoints: 100 })).toMatchObject({ eligible: false });
    await expect(grant(userID, 10)).rejects.toMatchObject({ code: 'RECONCILIATION_REQUIRED' });
    expect(await transitionOrder({ lojaID, orderId: paid.id, newStatus: 'CANCELLED', performedById: adminID })).toMatchObject({ success: false, error:'LEGACY_ORDER_RECONCILIATION_REQUIRED' });
    expect(await prisma.commerceOutbox.count({ where: { aggregateId: paid.id, commandType: 'LOYALTY_RECONCILE_REFUND' } })).toBe(0);
    await refund(paid.id); await refund(paid.id);
    expect(await prisma.commerceOutbox.count({ where: { aggregateId: paid.id, commandType: 'LOYALTY_RECONCILE_REFUND' } })).toBe(1);
    expect(await wallet(userID)).toMatchObject({ balance: 100, accountingReady: false });
    expect(await prisma.loyaltyLot.count({ where: { wallet: { userID, lojaID } } })).toBe(0);
  });
  it('database constraints reject negative ready balance and inconsistent signed effects', async () => {
    const userID = await buyer(); await grant(userID, 100);
    await expect(prisma.loyaltyWallet.update({ where: { lojaID_userID: { lojaID, userID } }, data: { balance: -1 } })).rejects.toThrow();
    await expect(prisma.loyaltyTransaction.create({ data: { lojaID, userID, type: 'EARN', points: 10, balanceAfter: 110, availableDelta: 9, debtDelta: 0, debtAfter: 0,
      effectKey: randomUUID(), contentHash: 'invalid', policy: {}, description: 'Invalid fixture' } })).rejects.toThrow(); await closed(userID, 100);
  });
  it('gain replay keeps the original effect after configuration changes, and legacy gain is only queued', async () => {
    const userID = await buyer(); const paid = await order(userID, 'PAID'); const first = await earn(userID, paid.id, 100);
    await prisma.loja.update({ where: { id: lojaID }, data: { loyaltyEnabled: false, loyaltyEarnRate: 0 } });
    try {
      expect(await earn(userID, paid.id, 100)).toMatchObject({ replay: true, pointsCredited: 100, transaction: { id: first!.transaction.id } });
      await expect(earn(userID, paid.id, 101)).rejects.toMatchObject({ code: 'CONFLICT' });
      await closed(userID, 100);
    } finally { await prisma.loja.update({ where: { id: lojaID }, data: { loyaltyEnabled: true, loyaltyEarnRate: 1 } }); }
    const legacy = await buyer(); await prisma.loyaltyWallet.create({ data: { lojaID, userID: legacy, balance: 90 } }); const oldPaid = await order(legacy, 'PAID');
    expect(await earn(legacy, oldPaid.id, 100)).toBeNull(); expect(await earn(legacy, oldPaid.id, 100)).toBeNull();
    expect(await prisma.commerceOutbox.count({ where: { aggregateId: oldPaid.id, commandType: 'LOYALTY_RECONCILE_EARN' } })).toBe(1);
    expect(await wallet(legacy)).toMatchObject({ balance: 90, accountingReady: false });
    expect(await prisma.loyaltyTransaction.count({ where: { orderId: oldPaid.id } })).toBe(0);
  });
  it('HTTP adjustment requires tenant/Admin/command; repeat returns current balance without a second credit', async () => {
    const userID = await buyer(); const headers = { Host: host, Cookie: await session(adminID) }; const data = { userID, points: 100, description: 'Crédito HTTP', commandId: randomUUID() };
    expect(await post('/api/admin/loyalty/adjust', { userID, points: 100, description: 'Sem identidade' }, { headers })).toMatchObject({ status: 400 });
    expect(await post('/api/admin/loyalty/adjust', data, { headers })).toMatchObject({ status: 200, body: { success: true, data: { newBalance: 100, debt: 0, replay: false } } });
    expect(await post('/api/admin/loyalty/adjust', data, { headers })).toMatchObject({ status: 200, body: { data: { newBalance: 100, replay: true } } });
    expect(await post('/api/admin/loyalty/adjust', { ...data, points: 101 }, { headers })).toMatchObject({ status: 409 });
    expect(await post('/api/admin/loyalty/adjust', { ...data, commandId: randomUUID() }, { headers: { Host: host, Cookie: await session(userID) } })).toMatchObject({ status: 403 });
    const outsiderStore = await createFixtureStore(); const outsider = await prisma.user.create({ data: { lojaID: outsiderStore, name: 'Outro Admin', email: `${randomUUID()}@example.invalid`, password: '', role: 'ADMIN' } });
    expect(await post('/api/admin/loyalty/adjust', data, { headers: { Host: host, Cookie: await session(outsider.id) } })).toMatchObject({ status: 403 }); await closed(userID, 100);
  });
});
