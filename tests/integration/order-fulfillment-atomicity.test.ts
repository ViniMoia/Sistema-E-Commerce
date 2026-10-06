import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { createFulfillmentFixture } from '@/tests/setup/fulfillment-fixture';
import { cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { transitionOrder, updateOrderTracking } from '@/lib/commerce/order-command';
import { getOrderDetailForAdmin } from '@/services/order.service';
import { drainPaymentOutbox } from '@/services/payment/payment-outbox.service';
import { get, patch, post } from '@/tests/helpers/request';
let f: Awaited<ReturnType<typeof createFulfillmentFixture>>;
beforeAll(async () => { await verifyTestDatabase(); f = await createFulfillmentFixture(); });
afterAll(async () => { await cleanupFixtureStores(); await prisma.$disconnect(); });
const options = () => ({ headers: { Host: f.host, Cookie: 'session_id=' + f.session.id } });
const command = (id: string, newStatus: 'SHIPPED' | 'DELIVERED' | 'CANCELLED', extra = {}) =>
  transitionOrder({ ...f.context, orderId: id, newStatus, expectedVersion: 1, commandId: randomUUID(), ...extra });
const read = (id: string) => prisma.order.findUniqueOrThrow({ where: { id }, include: { reservations: true, statusHistory: { orderBy: { orderVersion: 'asc' } } } });
describe('WF-16: atomic shipping and contextual pickup commands in PostgreSQL/HTTP', () => {
  it('status HTTP preserves normalized tracking, immutable carrier, history, audit and durable event together', async () => {
    const o = await f.order('DELIVERY', 'CORREIOS'); const input = { newStatus: 'SHIPPED', trackingCode: ' aa123456789br ', shippingProvider: 'CORREIOS', expectedVersion: 1, commandId: randomUUID() };
    expect((await patch(`/api/admin/orders/${o.id}/status`, input, options())).status).toBe(200);
    const detail = await get(`/api/admin/orders/${o.id}`, options());
    expect(detail.body).toMatchObject({ data: { trackingCode: 'AA123456789BR', shippingProvider: 'CORREIOS', version: 2, status: 'SHIPPED' } });
    const audit = await prisma.auditLog.findUniqueOrThrow({ where: { effectKey: `order:${o.id}:version:2` } });
    expect(audit.newValue).toMatchObject({ trackingCode: 'AA123456789BR', status: 'SHIPPED', version: 2 });
    expect((await read(o.id)).reservations[0].status).toBe('COMMITTED');
    expect((await patch(`/api/admin/orders/${o.id}/status`, input, options())).status).toBe(200);
    expect((await patch(`/api/admin/orders/${o.id}/status`, { ...input, trackingCode: 'BB123456789BR' }, options())).status).toBe(409);
    expect(await prisma.orderStatusHistory.count({ where: { orderId: o.id } })).toBe(2);
    expect(await prisma.commerceOutbox.count({ where: { aggregateId: o.id, commandType: 'ORDER_STATUS_CHANGED' } })).toBe(2);
  });
  it.each([null, '', 'INVALID'])('missing/invalid mandatory postal tracking %s leaves PAID unchanged', async trackingCode => {
    const o = await f.order('DELIVERY', 'CORREIOS');
    expect(await command(o.id, 'SHIPPED', { trackingCode })).toMatchObject({ success: false, code: 'INVALID_INPUT' });
    expect(await read(o.id)).toMatchObject({ status: 'PAID', version: 1, trackingCode: null });
    expect((await read(o.id)).statusHistory).toHaveLength(1);
  });
  it('local delivery ships without invented tracking and generic edits preserve case', async () => {
    const o = await f.order(); expect(await command(o.id, 'SHIPPED')).toMatchObject({ success: true });
    const input = { ...f.context, orderId: o.id, trackingCode: ' case-Abc-123 ', expectedVersion: 2, commandId: randomUUID() };
    expect(await updateOrderTracking(input)).toMatchObject({ success: true, order: { trackingCode: 'case-Abc-123', version: 3 } });
    expect((await read(o.id)).status).toBe('SHIPPED');
    expect(await updateOrderTracking(input)).toMatchObject({ success: true });
    expect(await updateOrderTracking({ ...input, trackingCode: 'other' })).toMatchObject({ success: false, code: 'CONFLICT' });
    const audit = await prisma.auditLog.findUniqueOrThrow({ where: { effectKey: `order:${o.id}:version:3` } });
    expect(audit).toMatchObject({ action: 'ORDER_TRACKING_UPDATED', previousValue: { trackingCode: null }, newValue: { trackingCode: 'case-Abc-123' } });
  });
  it('tracking HTTP requires revision and identity, does not override carrier or clear mandatory dispatched code', async () => {
    const o = await f.order('DELIVERY', 'CORREIOS'); await command(o.id, 'SHIPPED', { trackingCode: 'AA123456789BR' });
    const path = `/api/admin/orders/${o.id}/tracking`; const input = { trackingCode: 'BB123456789BR', expectedVersion: 2, commandId: randomUUID() };
    expect((await patch(path, { trackingCode: 'BB123456789BR' }, options())).status).toBe(400);
    expect((await patch(path, { ...input, shippingProvider: 'LOCAL_TABLE' }, options())).status).toBe(409);
    expect((await patch(path, { ...input, trackingCode: null }, options())).status).toBe(422);
    expect((await patch(path, input, options())).status).toBe(200);
    expect(await read(o.id)).toMatchObject({ status: 'SHIPPED', trackingCode: 'BB123456789BR', version: 3, shippingProvider: 'CORREIOS' });
    expect((await patch(path, { ...input, commandId: randomUUID() }, options())).status).toBe(409);
  });
  it.each(['AUDIT', 'HISTORY', 'OUTBOX'])('failure of %s rolls back shipping and tracking together', async point => {
    const o = await f.order('DELIVERY', 'CORREIOS'); const effectKey = `order:${o.id}:version:2`;
    if (point === 'AUDIT') await prisma.auditLog.create({ data: { actorType: 'SYSTEM', systemActor: 'PAYMENT_GATEWAY', action: 'FIXTURE_COLLISION', entity: 'Order', entityId: o.id, effectKey } });
    if (point === 'HISTORY') await prisma.orderStatusHistory.create({ data: { orderId: o.id, orderVersion: 2, status: 'PAID', performedById: f.admin.id } });
    if (point === 'OUTBOX') await prisma.commerceOutbox.create({ data: { effectKey, commandType: 'ORDER_STATUS_CHANGED', aggregateId: o.id, payload: { fixture: true } } });
    await expect(command(o.id, 'SHIPPED', { trackingCode: 'AA123456789BR' })).rejects.toMatchObject({ code: 'P2002' });
    expect(await read(o.id)).toMatchObject({ status: 'PAID', version: 1, trackingCode: null });
    expect((await read(o.id)).reservations[0].status).toBe('COMMITTED');
  });
  it('shipping and cancellation of one version have one winner with matching stock/history', async () => {
    const o = await f.order('DELIVERY', 'CORREIOS'); const results = await Promise.all([command(o.id, 'SHIPPED', { trackingCode: 'AA123456789BR' }), command(o.id, 'CANCELLED')]);
    expect(results.filter(r => r.success)).toHaveLength(1);
    expect(results.filter(r => r.success === false)).toMatchObject([{ code: 'CONFLICT' }]);
    const current = await read(o.id); expect(current.version).toBe(2); expect(current.statusHistory).toHaveLength(2);
    expect(current.trackingCode).toBe(current.status === 'SHIPPED' ? 'AA123456789BR' : null);
    expect(current.reservations[0].status).toBe(current.status === 'SHIPPED' ? 'COMMITTED' : 'RETURNED');
    expect((await prisma.productVariants.findUniqueOrThrow({ where: { id: current.reservations[0].variantId } })).stock).toBe(current.status === 'SHIPPED' ? 1 : 2);
  });
  it.each(['PICKUP', 'NONE'] as const)('Admin completes %s directly without attributing receipt to customer', async deliveryType => {
    const o = await f.order(deliveryType); const detail = await getOrderDetailForAdmin({ orderId: o.id, lojaID: f.lojaID });
    expect(detail.actions.statuses).toEqual(['DELIVERED', 'CANCELLED']);
    expect(await command(o.id, 'SHIPPED')).toMatchObject({ success: false, code: 'INVALID_TRANSITION' });
    expect(await command(o.id, 'DELIVERED')).toMatchObject({ success: true });
    const current = await read(o.id); expect(current).toMatchObject({ status: 'DELIVERED', deliveredConfirmedBy: null, deliveredConfirmedAt: null, trackingCode: null });
    expect(current.statusHistory[1]).toMatchObject({ previousStatus: 'PAID', performedById: f.admin.id });
    expect(current.reservations[0].status).toBe('COMMITTED');
  });
  it('delivery cannot skip shipping; customer receipt is distinct; legacy shipped pickup is preserved', async () => {
    const delivery = await f.order(); expect(await command(delivery.id, 'DELIVERED')).toMatchObject({ success: false, code: 'INVALID_TRANSITION' });
    const pickup = await f.order('PICKUP'); const session = await prisma.session.create({ data: { userId: f.customer.id, expiresAt: new Date(Date.now() + 600000) } });
    // Explicit legacy workaround fixture; no bulk reclassification in application.
    await prisma.order.update({ where: { id: pickup.id }, data: { status: 'SHIPPED' } });
    const response = await post(`/api/orders/${pickup.id}/confirm-delivery`, {}, { headers: { Host: f.host, Cookie: 'session_id=' + session.id } });
    expect(response.status).toBe(200); expect(await read(pickup.id)).toMatchObject({ status: 'DELIVERED', deliveredConfirmedBy: f.customer.id });
  });
  it('pickup completion versus cancellation serializes without duplicate stock restoration', async () => {
    const o = await f.order('PICKUP'); const results = await Promise.all([command(o.id, 'DELIVERED'), command(o.id, 'CANCELLED')]);
    expect(results.filter(r => r.success)).toHaveLength(1);
    const current = await read(o.id); expect(current.version).toBe(2); expect(current.statusHistory).toHaveLength(2);
    expect(current.reservations[0].status).toBe(current.status === 'DELIVERED' ? 'COMMITTED' : 'RETURNED');
  });
  it('financial review hides operations and direct commands cannot bypass it', async () => {
    const o = await f.order('PICKUP'); await prisma.paymentAttempt.updateMany({ where: { orderId: o.id }, data: { failureCode: 'PAYMENT_REVIEW_REQUIRED' } });
    expect((await getOrderDetailForAdmin({ orderId: o.id, lojaID: f.lojaID })).actions.statuses).not.toContain('DELIVERED');
    expect(await command(o.id, 'DELIVERED')).toMatchObject({ success: false, code: 'CONFLICT' });
  });
  it('concurrent tracking edits use one version; replay after delivery does not regress status or replace the latest code', async () => {
    const o = await f.order();
    const input = { ...f.context, orderId: o.id, expectedVersion: 1, commandId: randomUUID(), trackingCode: 'First-Code' };
    const other = { ...input, commandId: randomUUID(), trackingCode: 'Second-Code' };
    const results = await Promise.all([updateOrderTracking(input), updateOrderTracking(other)]);
    expect(results.filter(r => r.success)).toHaveLength(1);
    expect(results.filter(r => r.success === false)).toMatchObject([{ code: 'CONFLICT' }]);
    const winner = results[0].success ? input : other;
    expect(await command(o.id, 'SHIPPED', { expectedVersion: 2 })).toMatchObject({ success: true });
    expect(await command(o.id, 'DELIVERED', { expectedVersion: 3 })).toMatchObject({ success: true });
    expect(await updateOrderTracking(winner)).toMatchObject({ success: true, order: { status: 'DELIVERED', version: 4, trackingCode: winner.trackingCode } });
    expect((await read(o.id)).statusHistory).toHaveLength(4);
  });
  it('same status cannot claim to have saved a changed tracking field; omitted and null are different command contents', async () => {
    const o = await f.order(); const commandId = randomUUID();
    expect(await command(o.id, 'SHIPPED', { commandId, shippingProvider: 'LOCAL_TABLE' })).toMatchObject({ success: true });
    expect(await command(o.id, 'SHIPPED', { expectedVersion: 2, trackingCode: 'Unsaved-Code' })).toMatchObject({ success: false, code: 'CONFLICT' });
    expect(await command(o.id, 'SHIPPED', { commandId, shippingProvider: 'LOCAL_TABLE', trackingCode: null })).toMatchObject({ success: false, code: 'CONFLICT' });
    expect(await read(o.id)).toMatchObject({ version: 2, trackingCode: null });
  });
  it('failed tracking audit rolls back both the field and the version', async () => {
    const o = await f.order();
    await prisma.auditLog.create({ data: { actorType: 'SYSTEM', systemActor: 'PAYMENT_GATEWAY', action: 'FIXTURE_COLLISION', entity: 'Order', entityId: o.id, effectKey: `order:${o.id}:version:2` } });
    await expect(updateOrderTracking({ ...f.context, orderId: o.id, trackingCode: 'Code', expectedVersion: 1, commandId: randomUUID() })).rejects.toMatchObject({ code: 'P2002' });
    expect(await read(o.id)).toMatchObject({ version: 1, trackingCode: null });
    expect((await read(o.id)).statusHistory).toHaveLength(1);
  });
  it('tracking-only event in PAID does not issue a payment-confirmation email', async () => {
    const o = await f.order();
    const ids = (await prisma.order.findMany({ where: { lojaID: f.lojaID }, select: { id: true } })).map(order => order.id);
    // Fence older fixture events so only the event under investigation is drained.
    await prisma.commerceOutbox.updateMany({ where: { aggregateId: { in: ids } }, data: { status: 'COMPLETED' } });
    await updateOrderTracking({ ...f.context, orderId: o.id, trackingCode: 'Code', expectedVersion: 1, commandId: randomUUID() });
    let sends = 0;
    await drainPaymentOutbox(50, async () => { sends++; return { success: true, messageId: 'fixture' }; });
    expect(sends).toBe(0);
    expect(await prisma.commerceOutbox.count({ where: { effectKey: 'payment-confirmation:' + o.id } })).toBe(0);
    expect(await prisma.commerceOutbox.findUniqueOrThrow({ where: { effectKey: `order:${o.id}:version:2` } })).toMatchObject({ status: 'COMPLETED' });
  });
  it('tracking edit and cancellation of one version have one winner and no partially applied tracking', async () => {
    const o = await f.order(); const results = await Promise.all([
      updateOrderTracking({ ...f.context, orderId: o.id, trackingCode: 'Code', expectedVersion: 1, commandId: randomUUID() }), command(o.id, 'CANCELLED'),
    ]);
    expect(results.filter(r => r.success)).toHaveLength(1);
    const current = await read(o.id); expect(current.version).toBe(2);
    expect(current.trackingCode).toBe(current.status === 'CANCELLED' ? null : 'Code');
    expect(current.reservations[0].status).toBe(current.status === 'CANCELLED' ? 'RETURNED' : 'COMMITTED');
  });
  it('foreign/inactive/non-admin tracking authors cannot mutate a shipment', async () => {
    const o = await f.order(); const other = await createFulfillmentFixture();
    for (const performedById of [f.customer.id, other.admin.id]) expect(await updateOrderTracking({ ...f.context, orderId: o.id, trackingCode: 'abc', expectedVersion: 1, commandId: randomUUID(), performedById })).toMatchObject({ success: false, code: 'FORBIDDEN' });
    await prisma.user.update({ where: { id: other.admin.id }, data: { lojaID: f.lojaID, status: 'BLOCKED' } });
    expect(await updateOrderTracking({ ...f.context, orderId: o.id, trackingCode: 'abc', expectedVersion: 1, commandId: randomUUID(), performedById: other.admin.id })).toMatchObject({ success: false, code: 'FORBIDDEN' });
    expect(await read(o.id)).toMatchObject({ version: 1, trackingCode: null });
  });
});
