import { randomUUID } from 'node:crypto';
import { beforeAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { boletoRefundFixture } from '@/tests/setup/boleto-refund-fixture';
import { createFulfillmentFixture } from '@/tests/setup/fulfillment-fixture';
import { cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { readBoletoRefund, requestPaymentOperation } from '@/services/payment/payment-operations.service';
import { transitionOrder } from '@/lib/commerce/order-command';
import { get, post } from '@/tests/helpers/request';

let auditFailure: string | null = null;
beforeAll(() => prisma.$use(async (params, next) => {
  if (auditFailure && params.model === 'AuditLog' && params.action === 'create' && params.args.data.entityId === auditFailure &&
    params.args.data.action === 'BOLETO_REFUND_REQUEST_STARTED') throw new Error('fixture audit failed');
  return next(params);
}));
beforeEach(verifyTestDatabase);
afterEach(async () => { auditFailure = null; vi.restoreAllMocks(); await cleanupFixtureStores(); await prisma.$disconnect(); });
const history = (p: Awaited<ReturnType<typeof boletoRefundFixture>>, status: 'PENDING' | 'DONE' | 'CANCELLED') => {
  p.remote[0].refundHistory = { complete: true, records: [{ status, value: 100 }] };
};
const refundedCount = (orderId: string) => prisma.financialFact.count({ where: { orderId, type: 'REFUNDED' } });

describe('paid boleto durable refund', () => {
  it('concurrent replay starts once, exposes a private link, waits for proof and compensates once', async () => {
    const p = await boletoRefundFixture();
    const beforePoints = await prisma.loyaltyTransaction.count({ where: { orderId: p.orderId } });
    const commands = await Promise.all([requestPaymentOperation(p.command), requestPaymentOperation(p.command)]);
    expect(commands.map(c => c.replay).sort()).toEqual([false, true]);
    // The deployed old worker selects READY; it cannot dispatch this operation.
    expect(await prisma.paymentOperation.count({ where: { attemptId: p.attempt.id, status: 'READY', lastErrorCode: null } })).toBe(0);
    expect(commands[0].operations[0].status).toBe('BOLETO_READY');
    expect(await readBoletoRefund(p.scope)).toMatchObject({ eligible: false, state: 'QUEUED', requestUrl: null });
    await p.tick(); await p.tick();
    expect(p.gateway.refundBoleto).toHaveBeenCalledExactlyOnceWith(p.remote[0].paymentId);
    expect(p.gateway.refundPayment).not.toHaveBeenCalled(); expect(p.gateway.refundInstallment).not.toHaveBeenCalled();
    expect(await readBoletoRefund(p.scope)).toMatchObject({ state: 'AWAITING_CUSTOMER', requestUrl: p.requestUrl });
    expect(JSON.stringify(await requestPaymentOperation(p.command))).not.toContain(p.requestUrl);
    const headers = { Host: p.host, Cookie: 'session_id=' + p.session.id };
    const view = await get(`/api/admin/orders/${p.orderId}/payment-operation`, { headers });
    expect(view.status).toBe(200); expect(view.headers?.['cache-control']).toContain('private, no-store');
    expect(view.body).toMatchObject({ data: { requestUrl: p.requestUrl } });
    expect(JSON.stringify((await get(`/api/admin/orders/${p.orderId}`, { headers })).body)).not.toContain(p.requestUrl);
    expect(await refundedCount(p.orderId)).toBe(0); expect((await p.read()).status).toBe('PAID'); expect((await p.stock()).stock).toBe(4);
    expect(await prisma.loyaltyTransaction.count({ where: { orderId: p.orderId } })).toBe(beforePoints);
    history(p, 'PENDING'); await p.tick(); expect(await refundedCount(p.orderId)).toBe(0);
    history(p, 'DONE'); await p.tick(); // DONE alone while payment is RECEIVED is inconsistent.
    expect(await refundedCount(p.orderId)).toBe(0); expect(await readBoletoRefund(p.scope)).toMatchObject({ state: 'REVIEW', requestUrl: null });
    p.remote[0].status = 'REFUNDED'; await p.tick(); await p.observe();
    const done = await p.read(); expect(done.status).toBe('CANCELLED'); expect(done.paymentAttempts[0].status).toBe('REFUNDED');
    expect(done.paymentAttempts[0].operations[0]).toMatchObject({ status: 'COMPLETED', refundRequestUrl: null });
    expect(await refundedCount(p.orderId)).toBe(1); expect((await p.stock()).stock).toBe(5);
    expect(await prisma.loyaltyTransaction.count({ where: { orderId: p.orderId, type: 'REFUND_EARN' } })).toBe(1);
    expect(await readBoletoRefund(p.scope)).toMatchObject({ state: 'COMPLETED', requestUrl: null });
    const logs = await prisma.auditLog.findMany({ where: { entityId: p.orderId } });
    expect(JSON.stringify(logs)).not.toContain(p.requestUrl);
    expect(logs.filter(l => l.action === 'BOLETO_REFUND_REQUEST_STARTED')).toHaveLength(1);
    await expect(prisma.paymentOperation.update({ where: { id: commands[0].operations[0].id },
      data: { status: 'BOLETO_READY', submittedAt: null } })).rejects.toThrow();
    await expect(prisma.paymentOperation.update({ where: { id: commands[0].operations[0].id },
      data: { status: 'READY', submittedAt: null } })).rejects.toThrow();
  });
  it.each(['lost-response', 'invalid-link', 'audit-rollback'])('never repeats submission after %s and can reconcile later completion', async scenario => {
    const p = await boletoRefundFixture();
    if (scenario === 'lost-response') vi.mocked(p.gateway.refundBoleto!).mockImplementation(async () => { history(p, 'PENDING'); throw new Error('lost'); });
    if (scenario === 'invalid-link') vi.mocked(p.gateway.refundBoleto!).mockResolvedValue({ requestUrl: 'https://evil.invalid/form' });
    if (scenario === 'audit-rollback') auditFailure = p.orderId;
    await requestPaymentOperation(p.command); await p.tick(); await p.tick();
    expect(p.gateway.refundBoleto).toHaveBeenCalledTimes(1);
    expect((await p.read()).paymentAttempts[0].operations[0]).toMatchObject({ status: 'UNKNOWN', refundRequestUrl: null });
    expect(await readBoletoRefund(p.scope)).toMatchObject({ state: 'REVIEW', requestUrl: null });
    await expect(requestPaymentOperation({ ...p.command, commandId: randomUUID() })).rejects.toThrow('PAYMENT_OPERATION_CONFLICT');
    expect(await refundedCount(p.orderId)).toBe(0);
    history(p, 'DONE'); p.remote[0].status = 'REFUNDED'; await p.tick();
    expect(await refundedCount(p.orderId)).toBe(1); expect(p.gateway.refundBoleto).toHaveBeenCalledTimes(1);
  });
  it('keeps cancelled refund under review and hides the old payer link', async () => {
    const p = await boletoRefundFixture(); await requestPaymentOperation(p.command); await p.tick();
    history(p, 'CANCELLED'); await p.tick(); await p.tick();
    expect((await p.read()).paymentAttempts[0].failureCode).toBe('PAYMENT_REFUND_CANCELLED_REVIEW');
    expect(await readBoletoRefund(p.scope)).toMatchObject({ state: 'REVIEW', requestUrl: null });
    expect(p.gateway.refundBoleto).toHaveBeenCalledTimes(1); expect(await refundedCount(p.orderId)).toBe(0); expect((await p.stock()).stock).toBe(4);
  });
  it.each(['incomplete', 'prior-refund', 'mismatch'])('blocks the first POST on %s evidence', async scenario => {
    const p = await boletoRefundFixture(); await requestPaymentOperation(p.command);
    if (scenario === 'incomplete') p.remote[0].refundHistory = { complete: false, records: [] };
    if (scenario === 'prior-refund') history(p, 'PENDING');
    if (scenario === 'mismatch') p.remote[0].externalReference = randomUUID();
    await p.tick(); expect(p.gateway.refundBoleto).not.toHaveBeenCalled(); expect(await refundedCount(p.orderId)).toBe(0);
  });
  it('does not regress a completed webhook racing the POST response', async () => {
    const p = await boletoRefundFixture();
    vi.mocked(p.gateway.refundBoleto!).mockImplementation(async () => {
      history(p, 'DONE'); p.remote[0].status = 'REFUNDED'; await p.observe(); return { requestUrl: p.requestUrl };
    });
    await requestPaymentOperation(p.command); await p.tick();
    expect((await p.read()).paymentAttempts[0].operations[0]).toMatchObject({ status: 'COMPLETED', refundRequestUrl: null });
    expect(await refundedCount(p.orderId)).toBe(1);
  });
  it('refund after delivery preserves physical stock until inspected', async () => {
    const p = await boletoRefundFixture();
    expect(await transitionOrder({ ...p.context, orderId: p.orderId, newStatus: 'DELIVERED', expectedVersion: 1, commandId: randomUUID() })).toMatchObject({ success: true });
    await requestPaymentOperation({ ...p.command, expectedVersion: 2 }); await p.tick();
    history(p, 'DONE'); p.remote[0].status = 'REFUNDED'; await p.tick(); await p.observe();
    const o = await p.read(); expect(o.status).toBe('DELIVERED'); expect(o.paymentAttempts[0].failureCode).toBe('PHYSICAL_RETURN_REQUIRED');
    expect(o.reservations[0].status).toBe('COMMITTED'); expect((await p.stock()).stock).toBe(4);
    expect(await refundedCount(p.orderId)).toBe(1);
    expect(await prisma.loyaltyTransaction.count({ where: { orderId: p.orderId, type: 'REFUND_EARN' } })).toBe(1);
  });
  it('late paid boleto exposes its payer link without reopening a cancelled order or taking stock', async () => {
    const p = await boletoRefundFixture(false);
    p.remote[0].deleted = true; await p.observe();
    expect((await p.read()).status).toBe('CANCELLED');
    p.remote[0].deleted = false; p.remote[0].status = 'RECEIVED'; await p.observe();
    expect((await p.read()).paymentAttempts[0].failureCode).toBe('LATE_PAYMENT');
    expect(await readBoletoRefund(p.scope)).toMatchObject({ eligible: true });
    await requestPaymentOperation(p.command); await p.tick();
    expect(await readBoletoRefund(p.scope)).toMatchObject({ state: 'AWAITING_CUSTOMER', requestUrl: p.requestUrl });
    expect((await p.read()).status).toBe('CANCELLED'); expect((await p.stock()).stock).toBe(5);
    history(p, 'DONE'); p.remote[0].status = 'REFUNDED'; await p.tick();
    expect(await refundedCount(p.orderId)).toBe(1); expect((await p.stock()).stock).toBe(5);
    expect(await prisma.loyaltyTransaction.count({ where: { orderId: p.orderId } })).toBe(0);
  });
  it('rejects stale version, wrong tenant, customer and unpaid boleto without creating an operation', async () => {
    const p = await boletoRefundFixture();
    await expect(requestPaymentOperation({ ...p.command, expectedVersion: 0 })).rejects.toThrow('PAYMENT_ORDER_VERSION_CONFLICT');
    await expect(requestPaymentOperation({ ...p.command, userId: p.customer.id })).rejects.toThrow('PAYMENT_OPERATION_FORBIDDEN');
    const other = await createFulfillmentFixture();
    const endpoint = `/api/admin/orders/${p.orderId}/payment-operation`;
    expect((await get(endpoint, { headers: { Host: p.host } })).status).toBe(401);
    const customer = await prisma.session.create({ data: { userId: p.customer.id, expiresAt: new Date(Date.now() + 3600000) } });
    expect((await get(endpoint, { headers: { Host: p.host, Cookie: 'session_id=' + customer.id } })).status).toBe(403);
    const wrong = { Host: other.host, Cookie: 'session_id=' + other.session.id };
    expect((await get(endpoint, { headers: wrong })).status).toBe(404);
    expect((await post(endpoint, { kind: 'REFUND', commandId: randomUUID(), expectedVersion: 1 }, { headers: wrong })).status).toBe(404);
    expect((await post(endpoint, { kind: 'REFUND', commandId: randomUUID(), expectedVersion: 1 }, {
      headers: { Host: p.host, Cookie: 'session_id=' + p.session.id, Origin: 'https://evil.invalid' },
    })).status).toBe(403);
    await prisma.paymentAttempt.update({ where: { id: p.attempt.id }, data: { status: 'PENDING' } });
    await expect(requestPaymentOperation(p.command)).rejects.toThrow('PAYMENT_OPERATION_STATE_CONFLICT');
    expect(await prisma.paymentOperation.count({ where: { attemptId: p.attempt.id } })).toBe(0);
  });
});
