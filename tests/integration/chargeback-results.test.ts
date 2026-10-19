import { randomUUID } from 'node:crypto';
import { beforeAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { chargebackFixture } from '@/tests/setup/chargeback-fixture';
import { cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { requestPaymentOperation } from '@/services/payment/payment-operations.service';
import { reconcilePaymentAttempts, inspectPaymentAttempt, drainPaymentInbox } from '@/services/payment/payment-worker.service';
import { receivePaymentEvent } from '@/services/payment/payment-inbox.service';
import { completeWork } from '@/services/payment/durable-work.service';
import { transitionOrder } from '@/lib/commerce/order-command';
import { completePhysicalReturn } from '@/services/physical-return.service';
import { readDashboardFinancial } from '@/services/dashboard-financial.service';
import { get } from '@/tests/helpers/request';
import { AsaasPaymentAdapter } from '@/services/asaas/asaas.adapter';
import { asaasClient } from '@/services/asaas/asaas.client';
import type { AsaasPaymentResponse } from '@/types/asaas.types';

let failingAudit: string | null = null;
beforeAll(() => prisma.$use(async (params, next) => {
  if (failingAudit && params.model === 'AuditLog' && params.action === 'upsert' && params.args.create.entityId === failingAudit && params.args.create.action === 'PAYMENT_CHARGEBACK_OBSERVED') throw new Error('fixture-chargeback-audit-failed');
  return next(params);
}));
beforeEach(async () => { await verifyTestDatabase(); vi.stubEnv('INSTALLMENT_MONTHLY_RATE','0'); vi.stubEnv('INSTALLMENT_ABSORB_FEES','false'); });
afterEach(async () => { failingAudit = null; vi.restoreAllMocks(); vi.unstubAllEnvs(); await cleanupFixtureStores(); await prisma.$disconnect(); });
const refund = (p: Awaited<ReturnType<typeof chargebackFixture>>) => requestPaymentOperation({ orderId: p.orderId, lojaID: p.lojaID, userId: p.admin.id, kind: 'REFUND', commandId: randomUUID(), expectedVersion: 1 });
const auditCount = (id: string) => prisma.auditLog.count({ where: { entityId: id, action: 'PAYMENT_CHARGEBACK_OBSERVED' } });
const facts = (id: string) => prisma.financialFact.findMany({ where: { orderId: id }, orderBy: { factKey: 'asc' } });

describe('provider-confirmed chargeback results', () => {
  it('nested dispute on a RECEIVED charge blocks fulfillment/refund and keeps financial coverage partial without inventing settlement', async () => {
    const p = await chargebackFixture(), before = await facts(p.orderId);
    p.remote[0].status = 'RECEIVED'; p.remote[0].chargeback = { status: 'IN_DISPUTE', reason: 'FRAUD', secret: 'never-store-this' };
    expect(await p.observe()).toMatchObject({ review: true }); await p.observe();
    expect((await p.read()).paymentAttempts[0]).toMatchObject({ status: 'APPROVED', failureCode: 'PAYMENT_CHARGEBACK_REVIEW' });
    expect(await facts(p.orderId)).toEqual(before); expect((await p.stock()).stock).toBe(4); expect(await auditCount(p.orderId)).toBe(1);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityId: p.orderId, action: 'PAYMENT_CHARGEBACK_OBSERVED' } });
    expect(JSON.stringify(audit)).not.toContain('never-store-this');
    await expect(refund(p)).rejects.toThrow('PAYMENT_RECONCILIATION_REQUIRED');
    expect(await transitionOrder({ ...p.context, orderId: p.orderId, newStatus: 'DELIVERED', expectedVersion: 1, commandId: randomUUID() })).toMatchObject({ success: false });
    const d = await readDashboardFinancial(prisma, p.lojaID);
    expect(d).toMatchObject({ coverage: 'PARTIAL', allTime: { recognizedGross: 100, settledGross: 0, confirmedRefunds: 0 } });
    const response = await get(`/api/admin/orders/${p.orderId}`, { headers: { Host: p.host, Cookie: 'session_id=' + p.session.id } });
    expect(response.status).toBe(200); expect(response.body).toMatchObject({ data: { chargebacks: [{ ordinal: 1, outcome: 'OPEN', review: true }] } });
    expect((await get(`/api/admin/orders/${p.orderId}`, { headers: { Host: p.host } })).status).toBe(401);
  });
  it.each(['REQUESTED','IN_DISPUTE','DISPUTE_LOST','DONE','REVERSED','NEW_PROVIDER_STATUS'])('%s without a compatible financial result remains in review', async status => {
    const p = await chargebackFixture(), before = await facts(p.orderId);
    p.remote[0].status = 'AWAITING_CHARGEBACK_REVERSAL'; p.remote[0].chargeback = { status };
    expect(await p.observe()).toMatchObject({ review: true });
    expect(await facts(p.orderId)).toEqual(before); expect((await p.stock()).stock).toBe(4);
    expect(await prisma.loyaltyTransaction.count({ where: { orderId: p.orderId, type: 'REFUND_EARN' } })).toBe(0);
  });
  it('reversal requires REVERSED plus current paid evidence; missing metadata cannot clear an earlier dispute', async () => {
    const p = await chargebackFixture(); p.remote[0].chargeback = { status: 'REQUESTED' }; await p.observe();
    delete p.remote[0].chargeback;
    expect(await p.observe()).toMatchObject({ review: true });
    const owner = randomUUID();
    const review = await prisma.commerceOutbox.update({ where: { effectKey: `payment-review:${p.attempt.id}:PAYMENT_CHARGEBACK_REVIEW` },
      data: { status: 'LEASED', leaseOwner: owner, leaseExpiresAt: new Date(Date.now() + 60000) } });
    p.remote[0].chargeback = { status: 'REVERSED' };
    expect(await p.observe()).toMatchObject({ review: false }); await p.observe();
    await expect(prisma.$transaction(tx => completeWork(tx, 'CommerceOutbox', review.id, owner, true))).rejects.toThrow('DURABLE_WORK_LEASE_LOST');
    expect(await prisma.commerceOutbox.findUniqueOrThrow({ where: { id: review.id } })).toMatchObject({ status: 'COMPLETED', leaseOwner: null });
    expect((await p.read()).paymentAttempts[0]).toMatchObject({ status: 'APPROVED', failureCode: null });
    expect((await facts(p.orderId)).map(f => f.type)).toEqual(['AUTHORIZED']);
    expect((await p.stock()).stock).toBe(4);
    expect(await prisma.loyaltyTransaction.count({ where: { orderId: p.orderId, type: 'EARN' } })).toBe(1);
    expect(await prisma.commerceOutbox.count({ where: { effectKey: 'payment-confirmation:' + p.orderId } })).toBe(1);
  });
  it.each([false,true])('confirmed loss compensates once, preserving physical delivery=%s until inspection', async delivered => {
    const p = await chargebackFixture();
    if (delivered) expect(await transitionOrder({ ...p.context, orderId: p.orderId, newStatus: 'DELIVERED', expectedVersion: 1, commandId: randomUUID() })).toMatchObject({ success: true });
    p.remote[0].chargeback = { status: 'DISPUTE_LOST' }; await p.observe();
    p.remote[0].status = 'REFUNDED'; await p.observe(); await p.observe();
    const order = await p.read(); expect(order.status).toBe(delivered ? 'DELIVERED' : 'CANCELLED');
    expect((await p.stock()).stock).toBe(delivered ? 4 : 5);
    expect((await facts(p.orderId)).filter(f => f.type === 'REFUNDED')).toHaveLength(1);
    expect(await prisma.loyaltyTransaction.count({ where: { orderId: p.orderId, type: 'REFUND_EARN' } })).toBe(1);
    expect(p.gateway.refundPayment).not.toHaveBeenCalled();
    if (delivered) {
      expect(order.paymentAttempts[0].failureCode).toBe('PHYSICAL_RETURN_REQUIRED');
      await completePhysicalReturn({ orderId: p.orderId, lojaID: p.lojaID, actorId: p.admin.id }, {
        commandId: randomUUID(), expectedVersion: order.version, inspectionReference: 'chargeback-inspection', receivedAllItems: true,
        items: order.items.map(i => ({ orderItemId: i.id, receivedQuantity: i.quantity, restockQuantity: i.quantity })),
      });
      await p.observe(); expect((await p.stock()).stock).toBe(5); expect((await p.read()).paymentAttempts[0].failureCode).toBeNull();
    }
    p.remote[0].status = 'CONFIRMED'; p.remote[0].chargeback = { status: 'REVERSED' };
    expect(await p.observe()).toMatchObject({ review: true });
    expect((await p.read()).paymentAttempts[0].status).toBe('REFUNDED');
  });
  it('a single refunded installment records only its amount and cannot return the whole order', async () => {
    const p = await chargebackFixture(3); p.remote[0].status = 'REFUNDED'; p.remote[0].chargeback = { status: 'DONE' };
    expect(await p.observe()).toMatchObject({ review: true }); await p.observe();
    expect((await p.read()).paymentAttempts[0].failureCode).toBe('PAYMENT_PARTIAL_REVERSAL_REVIEW');
    const refunded = (await facts(p.orderId)).filter(f => f.type === 'REFUNDED');
    expect(refunded).toHaveLength(1); expect(refunded[0].amount.toFixed(2)).toBe('33.33');
    expect((await p.stock()).stock).toBe(4); expect(await prisma.loyaltyTransaction.count({ where: { orderId: p.orderId, type: 'REFUND_EARN' } })).toBe(0);
  });
  it('freezes a queued refund during dispute and never resumes its POST automatically after a win', async () => {
    const p = await chargebackFixture(); await refund(p);
    p.remote[0].chargeback = { status: 'IN_DISPUTE' };
    await reconcilePaymentAttempts(50, p.gateway);
    expect((await p.read()).paymentAttempts[0].operations[0]).toMatchObject({ status: 'READY', lastErrorCode: 'PAYMENT_CHARGEBACK_REVIEW', submittedAt: null });
    p.remote[0].chargeback = { status: 'REVERSED' };
    await prisma.paymentAttempt.update({ where: { id: p.attempt.id }, data: { reconcileAfter: new Date(0) } });
    await reconcilePaymentAttempts(50, p.gateway);
    expect(p.gateway.refundPayment).not.toHaveBeenCalled(); expect(p.gateway.refundInstallment).not.toHaveBeenCalled();
    expect((await p.read()).paymentAttempts[0].failureCode).toMatch(/REVIEW/);
    p.remote[0].status = 'REFUNDED'; p.remote[0].chargeback = { status: 'DONE' };
    await p.observe(); expect((await p.read()).paymentAttempts[0].operations[0].status).toBe('COMPLETED');
    expect(p.gateway.refundPayment).not.toHaveBeenCalled();
  });
  it('adapter follows known chargebacks, rejects mismatched detail and preserves unresolved lookups', async () => {
    const p = await chargebackFixture(); p.remote[0].chargeback = { status: 'REQUESTED' }; await p.observe();
    const payment = { id: p.remote[0].paymentId, externalReference: p.orderId, billingType: 'CREDIT_CARD', status: 'CONFIRMED',
      installment: p.remote[0].contractId, installmentNumber: 1, value: 100, dueDate: '2030-01-01' } as AsaasPaymentResponse;
    vi.spyOn(asaasClient, 'listPaymentsByReference').mockResolvedValue([payment]);
    const lookup = vi.spyOn(asaasClient, 'getPaymentChargeback').mockResolvedValue({ status: 'REVERSED', payment: 'foreign' });
    const adapter = new AsaasPaymentAdapter();
    let inspection = await inspectPaymentAttempt(p.attempt.id, adapter); expect(inspection.charges[0].chargeback).toEqual({});
    lookup.mockRejectedValueOnce(new Error('lookup failed'));
    inspection = await inspectPaymentAttempt(p.attempt.id, adapter); expect(inspection.charges[0].chargeback).toEqual({});
    lookup.mockResolvedValue({ status: 'REVERSED', payment: payment.id });
    inspection = await inspectPaymentAttempt(p.attempt.id, adapter); expect(inspection.charges[0].chargeback).toMatchObject({ status: 'REVERSED' });
    expect(lookup).toHaveBeenCalledWith(payment.id);
  });
  it('chargeback webhook prompts a fresh lookup even when the payment list omits the dispute object', async () => {
    const p = await chargebackFixture(), eventId = randomUUID();
    vi.spyOn(asaasClient, 'listPaymentsByReference').mockResolvedValue([{ id: p.remote[0].paymentId, externalReference: p.orderId,
      billingType: 'CREDIT_CARD', status: 'CONFIRMED', installment: p.remote[0].contractId, installmentNumber: 1, value: 100, dueDate: '2030-01-01' } as AsaasPaymentResponse]);
    const lookup = vi.spyOn(asaasClient, 'getPaymentChargeback').mockResolvedValue({ status: 'REQUESTED' });
    try {
      await receivePaymentEvent({ id: eventId, event: 'PAYMENT_CHARGEBACK_REQUESTED', payment: {
        id: p.remote[0].paymentId, externalReference: p.orderId, billingType: 'CREDIT_CARD', status: 'CONFIRMED', value: 100,
      } });
      await drainPaymentInbox(50, new AsaasPaymentAdapter());
      expect(lookup).toHaveBeenCalledWith(p.remote[0].paymentId);
      expect((await p.read()).paymentAttempts[0].failureCode).toBe('PAYMENT_CHARGEBACK_REVIEW');
      expect((await facts(p.orderId)).map(f => f.type)).toEqual(['AUTHORIZED']);
    } finally { await prisma.paymentInbox.deleteMany({ where: { eventId } }); }
  });
  it('failed observation audit rolls back charge projection, financial facts and commercial effects together', async () => {
    const p = await chargebackFixture(), before = await p.read(), financial = await facts(p.orderId);
    p.remote[0].chargeback = { status: 'DISPUTE_LOST' }; p.remote[0].status = 'REFUNDED'; failingAudit = p.orderId;
    await expect(p.observe()).rejects.toThrow('fixture-chargeback-audit-failed'); failingAudit = null;
    expect(await p.read()).toEqual(before); expect(await facts(p.orderId)).toEqual(financial);
    expect((await p.stock()).stock).toBe(4); expect(await auditCount(p.orderId)).toBe(0);
  });
});
