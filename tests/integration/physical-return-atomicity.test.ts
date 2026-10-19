import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { createFulfillmentFixture } from '@/tests/setup/fulfillment-fixture';
import { refundedPhysicalOrder } from '@/tests/setup/physical-return-fixture';
import { cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { completePhysicalReturn, readPhysicalReturn } from '@/services/physical-return.service';
import { physicalReturnKey, PHYSICAL_RETURN_ACTION } from '@/lib/commerce/physical-return';
import { get, post } from '@/tests/helpers/request';
import { completeWork } from '@/services/payment/durable-work.service';
let f: Awaited<ReturnType<typeof createFulfillmentFixture>>;
let failAuditFor: string | null = null;
beforeAll(async () => {
  await verifyTestDatabase(); f = await createFulfillmentFixture();
  prisma.$use(async (params, next) => {
    if (failAuditFor && params.model === 'AuditLog' && params.action === 'create' && params.args.data.effectKey === physicalReturnKey(failAuditFor)) throw new Error('Fixture: audit unavailable');
    return next(params);
  });
});
afterAll(async () => { await cleanupFixtureStores(); await prisma.$disconnect(); });
const scope = (id: string) => ({ orderId: id, lojaID: f.lojaID, actorId: f.admin.id });
const input = (o: Awaited<ReturnType<typeof refundedPhysicalOrder>>, restockQuantity = 1) => ({
  commandId: randomUUID(), expectedVersion: o.version, inspectionReference: 'inspection-fixture', receivedAllItems: true,
  items: o.items.map(i => ({ orderItemId: i.id, receivedQuantity: i.quantity, restockQuantity })),
});
const headers = () => ({ Host: f.host, Cookie: 'session_id=' + f.session.id });
const stocks = async (o: Awaited<ReturnType<typeof refundedPhysicalOrder>>) => ({
  product: await prisma.product.findUniqueOrThrow({ where: { id: o.reservations[0].productId } }),
  variant: await prisma.productVariants.findUniqueOrThrow({ where: { id: o.reservations[0].variantId } }),
});

describe('full physical return after confirmed refund', () => {
  it('concurrent identical commands restore once, preserve delivery/finance/loyalty and expose the receipt over HTTP', async () => {
    const o = await refundedPhysicalOrder(f), cmd = input(o);
    const facts = await prisma.financialFact.findMany({ where: { orderId: o.id } });
    const points = await prisma.loyaltyTransaction.findMany({ where: { orderId: o.id } });
    const results = await Promise.all([completePhysicalReturn(scope(o.id), cmd), completePhysicalReturn(scope(o.id), cmd)]);
    expect(results.map(r => r.replay).sort()).toEqual([false, true]);
    const s = await stocks(o); expect(s.product.stock).toBe(2); expect(s.variant.stock).toBe(2);
    expect(s.variant.unavailableStock).toBe(0);
    expect(await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).toMatchObject({ status: 'DELIVERED', version: 3 });
    expect(await prisma.inventoryReservation.findUniqueOrThrow({ where: { id: o.reservations[0].id } })).toMatchObject({ status: 'RETURNED', version: o.reservations[0].version + 1 });
    expect(await prisma.financialFact.findMany({ where: { orderId: o.id } })).toEqual(facts);
    expect(await prisma.loyaltyTransaction.findMany({ where: { orderId: o.id } })).toEqual(points);
    expect(await prisma.orderStatusHistory.count({ where: { orderId: o.id } })).toBe(2);
    expect(await prisma.auditLog.count({ where: { entityId: o.id, action: PHYSICAL_RETURN_ACTION } })).toBe(1);
    expect(await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: o.paymentAttempts[0].id } })).toMatchObject({ status: 'REFUNDED', failureCode: null });
    const response = await get(`/api/admin/orders/${o.id}/physical-return`, { headers: headers() });
    expect(response.status).toBe(200); expect(response.headers?.['cache-control']).toContain('no-store');
    expect(response.body).toMatchObject({ data: { completed: true, eligible: false, receipt: { result: { orderVersion: 3, movements: [{ available: 1, unavailable: 0 }] } } } });
    expect((await post(`/api/admin/orders/${o.id}/physical-return`, cmd, { headers: headers() })).body).toMatchObject({ data: { replay: true } });
    await expect(completePhysicalReturn(scope(o.id), { ...cmd, commandId: randomUUID() })).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(completePhysicalReturn(scope(o.id), { ...cmd, items: [{ ...cmd.items[0], restockQuantity: 0 }] })).rejects.toMatchObject({ code: 'CONFLICT' });
  });
  it('different concurrent commands have one winner and one conflict', async () => {
    const o = await refundedPhysicalOrder(f);
    const results = await Promise.allSettled([completePhysicalReturn(scope(o.id), input(o)), completePhysicalReturn(scope(o.id), input(o))]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
    expect((await stocks(o)).variant.stock).toBe(2);
  });
  it('splits a full receipt into saleable and damaged units without accepting a partial receipt', async () => {
    const o = await refundedPhysicalOrder(f, 3), cmd = input(o, 1);
    await expect(completePhysicalReturn(scope(o.id), { ...cmd, items: [{ ...cmd.items[0], receivedQuantity: 2 }] })).rejects.toMatchObject({ code: 'CONFLICT' });
    const result = await completePhysicalReturn(scope(o.id), cmd);
    expect(result.result).toMatchObject({ movements: [{ received: 3, available: 1, unavailable: 2 }] });
    const s = await stocks(o); expect(s.product).toMatchObject({ stock: 2, unavailableStock: 2 }); expect(s.variant).toMatchObject({ stock: 2, unavailableStock: 2 });
  });
  it('fences an in-flight review worker and preserves unrelated warnings', async () => {
    const o = await refundedPhysicalOrder(f), owner = randomUUID();
    const review = await prisma.commerceOutbox.update({ where: { effectKey: `manual-refund:${o.paymentAttempts[0].id}` },
      data: { status: 'LEASED', leaseOwner: owner, leaseExpiresAt: new Date(Date.now() + 60000) } });
    const unrelated = await prisma.commerceOutbox.create({ data: { effectKey: randomUUID(), aggregateId: o.id, commandType: 'PAYMENT_REVIEW', payload: {}, status: 'DEAD_LETTER' } });
    await completePhysicalReturn(scope(o.id), input(o));
    await expect(prisma.$transaction(tx => completeWork(tx, 'CommerceOutbox', review.id, owner, true))).rejects.toThrow('DURABLE_WORK_LEASE_LOST');
    expect(await prisma.commerceOutbox.findUniqueOrThrow({ where: { id: review.id } })).toMatchObject({ status: 'COMPLETED', leaseOwner: null });
    expect(await prisma.commerceOutbox.findUniqueOrThrow({ where: { id: unrelated.id } })).toEqual(unrelated);
  });
  it.each(['damaged', 'retiredVariant', 'retiredProduct'])('keeps %s goods unavailable and records the actual disposition', async kind => {
    const o = await refundedPhysicalOrder(f);
    if (kind === 'retiredVariant') await prisma.productVariants.update({ where: { id: o.reservations[0].variantId }, data: { retiredAt: new Date() } });
    if (kind === 'retiredProduct') await prisma.product.update({ where: { id: o.reservations[0].productId }, data: { retiredAt: new Date() } });
    const result = await completePhysicalReturn(scope(o.id), input(o, kind === 'damaged' ? 0 : 1));
    expect(result.result).toMatchObject({ movements: [{ received: 1, available: 0, unavailable: 1 }] });
    const s = await stocks(o); expect(s.product).toMatchObject({ stock: 1, unavailableStock: 1 }); expect(s.variant).toMatchObject({ stock: 1, unavailableStock: 1 });
  });
  it('audit failure rolls back stocks, reservation, order, attempt and review closure', async () => {
    const o = await refundedPhysicalOrder(f), before = await stocks(o);
    const review = await prisma.commerceOutbox.findUniqueOrThrow({ where: { effectKey: `manual-refund:${o.paymentAttempts[0].id}` } });
    failAuditFor = o.id;
    try { await expect(completePhysicalReturn(scope(o.id), input(o))).rejects.toThrow('audit unavailable'); }
    finally { failAuditFor = null; }
    expect(await stocks(o)).toEqual(before);
    expect(await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).toMatchObject({ version: o.version, status: o.status });
    expect(await prisma.inventoryReservation.findUniqueOrThrow({ where: { id: o.reservations[0].id } })).toEqual(o.reservations[0]);
    expect(await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: o.paymentAttempts[0].id } })).toEqual(o.paymentAttempts[0]);
    expect(await prisma.commerceOutbox.findUniqueOrThrow({ where: { id: review.id } })).toEqual(review);
    expect((await readPhysicalReturn(o.id, f.lojaID)).completed).toBe(false);
  });
  it('HTTP rejects anonymous, foreign store, customer and invalid/partial/oversized inspections without inventory mutation', async () => {
    const o = await refundedPhysicalOrder(f), path = `/api/admin/orders/${o.id}/physical-return`, cmd = input(o), before = await stocks(o);
    expect((await post(path, cmd, { headers: { Host: f.host } })).status).toBe(401);
    expect((await post(path, cmd, { headers: { ...headers(), 'Content-Type': 'text/plain' } })).status).toBe(415);
    const other = await createFulfillmentFixture();
    expect((await post(path, cmd, { headers: { Host: other.host, Cookie: 'session_id=' + other.session.id } })).status).toBe(404);
    const customerSession = await prisma.session.create({ data: { userId: f.customer.id, expiresAt: new Date(Date.now() + 60000) } });
    expect((await post(path, cmd, { headers: { Host: f.host, Cookie: 'session_id=' + customerSession.id } })).status).toBe(403);
    for (const bad of [{ ...cmd, receivedAllItems: false }, { ...cmd, items: [] }, { ...cmd, items: [{ ...cmd.items[0], restockQuantity: -1 }] }])
      expect((await post(path, bad, { headers: headers() })).status).toBe(400);
    for (const bad of [{ ...cmd, expectedVersion: 0 }, { ...cmd, items: [cmd.items[0], cmd.items[0]] },
      { ...cmd, items: [{ ...cmd.items[0], receivedQuantity: 2 }] }, { ...cmd, items: [{ ...cmd.items[0], restockQuantity: 2 }] }])
      expect((await post(path, bad, { headers: headers() })).status).toBe(409);
    expect(await stocks(o)).toEqual(before);
    expect((await post(path, cmd, { headers: headers() })).status).toBe(200);
  });
  it('canonical refund without immutable full evidence, or unrelated review, cannot authorize stock', async () => {
    const o = await f.order('PICKUP');
    const attempt = await prisma.paymentAttempt.findFirstOrThrow({ where: { orderId: o.id } });
    await prisma.order.update({ where: { id: o.id }, data: { status: 'DELIVERED' } });
    await prisma.paymentAttempt.update({ where: { id: attempt.id }, data: { status: 'REFUNDED', failureCode: 'PHYSICAL_RETURN_REQUIRED' } });
    const fixture = await prisma.order.findUniqueOrThrow({ where: { id: o.id }, include: { items: true, reservations: true, paymentAttempts: true } });
    await expect(completePhysicalReturn(scope(o.id), input(fixture))).rejects.toMatchObject({ code: 'CONFLICT' });
    const refunded = await refundedPhysicalOrder(f);
    await prisma.paymentAttempt.update({ where: { id: refunded.paymentAttempts[0].id }, data: { failureCode: 'PAYMENT_PARTIAL_REVERSAL_REVIEW' } });
    await expect(completePhysicalReturn(scope(refunded.id), input(refunded))).rejects.toMatchObject({ code: 'CONFLICT' });
    expect((await stocks(refunded)).variant.stock).toBe(1);
  });
});
