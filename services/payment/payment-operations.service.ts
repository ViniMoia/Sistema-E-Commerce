import { createHash } from 'node:crypto';
import prisma from '@/lib/prisma';
import { CommerceLocks } from '@/lib/commerce/locks';
import { paymentNow } from './payment-evidence.service';
import { paymentAccountScope } from '@/lib/commerce/payment-account';
import { boletoRefundUrl, type BoletoRefundView } from '@/lib/commerce/boleto-refund';
import { expectedAsaasEnvironment } from '@/lib/config/asaas-environment.mjs';
import { moneyCents } from './installment.service';

// Command responses never serialize the private payer link, including replays.
const operationResult = (operations: Array<{ id: string; kind: string; status: string; lastErrorCode: string | null }>) =>
  operations.map(({ id, kind, status, lastErrorCode }) => ({ id, kind, status, lastErrorCode }));

export async function readBoletoRefund(input: { orderId: string; lojaID: string; userId: string }): Promise<BoletoRefundView> {
  const actor = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!actor || actor.lojaID !== input.lojaID || actor.status !== 'ACTIVE' || actor.role !== 'ADMIN') throw new Error('PAYMENT_OPERATION_FORBIDDEN');
  const order = await prisma.order.findFirst({ where: { id: input.orderId, lojaID: input.lojaID }, include: {
    paymentAttempts: { orderBy: { number: 'desc' }, take: 1, include: { charges: true, operations: true } },
  } });
  if (!order) throw new Error('PAYMENT_ORDER_NOT_FOUND');
  const attempt = order.paymentAttempts[0];
  const applicable = attempt?.provider === 'ASAAS' && attempt.method === 'BOLETO' && attempt.providerAccount === paymentAccountScope();
  const operation = applicable ? attempt.operations.find(op => op.kind === 'REFUND') : undefined;
  const late = order.status === 'CANCELLED' && attempt?.failureCode === 'LATE_PAYMENT';
  const eligible = !!applicable && !operation && attempt.installments === 1 && attempt.charges.length === 1 &&
    attempt.charges.every(c => c.provider === attempt.provider && c.providerAccount === attempt.providerAccount && c.providerStatus === 'RECEIVED' &&
      c.ordinal === 1 && moneyCents(c.amount.toString()) === moneyCents(attempt.financialTotal.toString())) &&
    (late || ['PAID', 'SHIPPED', 'DELIVERED'].includes(order.status) && attempt.status === 'APPROVED') &&
    (!attempt.failureCode || late);
  const completed = operation?.status === 'COMPLETED' && attempt.status === 'REFUNDED';
  const review = !!operation && !completed && ((!!attempt.failureCode && attempt.failureCode !== 'LATE_PAYMENT') ||
    !!operation.lastErrorCode || ['UNKNOWN', 'SUBMITTING'].includes(operation.status));
  const requestUrl = operation?.status === 'PENDING' && !review && !completed
    ? boletoRefundUrl(operation.refundRequestUrl, expectedAsaasEnvironment(process.env)) : null;
  return { orderId: order.id, version: order.version, applicable: !!applicable, eligible,
    amount: attempt?.financialTotal.toFixed(2) ?? '0.00', requestUrl,
    state: completed ? 'COMPLETED' : review ? 'REVIEW' : requestUrl ? 'AWAITING_CUSTOMER' :
      operation ? operation.status === 'BOLETO_READY' ? 'QUEUED' : 'REVIEW' : eligible ? 'AVAILABLE' : 'UNAVAILABLE' };
}

export async function requestPaymentOperation(input: { orderId: string; lojaID: string; userId: string;
  kind: 'CANCEL' | 'REFUND'; commandId: string; expectedVersion: number }) {
  if (!/^[a-zA-Z0-9_-]{1,96}$/.test(input.commandId) || !Number.isInteger(input.expectedVersion) || input.expectedVersion < 0) throw new Error('PAYMENT_OPERATION_INVALID');
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${input.userId} FOR SHARE`;
    await new CommerceLocks(tx).acquire('order', [input.orderId]);
    const order = await tx.order.findUnique({ where: { id: input.orderId } });
    const actor = await tx.user.findUnique({ where: { id: input.userId } });
    if (!order || order.lojaID !== input.lojaID) throw new Error('PAYMENT_ORDER_NOT_FOUND');
    if (!actor || actor.lojaID !== input.lojaID || actor.status !== 'ACTIVE' || actor.role !== 'ADMIN') throw new Error('PAYMENT_OPERATION_FORBIDDEN');
    const attempt = await tx.paymentAttempt.findFirst({ where: { orderId: order.id }, orderBy: { number: 'desc' }, include: { charges: true, operations: true } });
    if (!attempt || attempt.provider !== 'ASAAS' || attempt.providerAccount !== paymentAccountScope() || attempt.charges.length !== attempt.installments) throw new Error('PAYMENT_RECONCILIATION_REQUIRED');
    const commandKey = createHash('sha256').update(JSON.stringify([input.lojaID, order.id, input.userId, input.kind, input.commandId, input.expectedVersion])).digest('hex');
    const applied = attempt.operations.filter(o => o.kind === input.kind);
    if (applied.length) {
      if (applied.length !== attempt.charges.length || applied.some(o => o.commandKey !== commandKey || o.requestedById !== input.userId)) throw new Error('PAYMENT_OPERATION_CONFLICT');
      return { attemptId: attempt.id, operations: operationResult(applied), replay: true };
    }
    if (order.version !== input.expectedVersion) throw new Error('PAYMENT_ORDER_VERSION_CONFLICT');
    if (attempt.failureCode?.startsWith('PAYMENT_CHARGEBACK_')) throw new Error('PAYMENT_RECONCILIATION_REQUIRED');
    const lateRefund = order.status === 'CANCELLED' && attempt.failureCode === 'LATE_PAYMENT';
    if (input.kind === 'REFUND' && attempt.method === 'BOLETO' &&
      (attempt.installments !== 1 || attempt.charges.some(c => c.provider !== attempt.provider || c.providerAccount !== attempt.providerAccount ||
        c.ordinal !== 1 || c.providerStatus !== 'RECEIVED' || moneyCents(c.amount.toString()) !== moneyCents(attempt.financialTotal.toString())) ||
        !!attempt.failureCode && !lateRefund)) throw new Error('PAYMENT_OPERATION_STATE_CONFLICT');
    if (input.kind === 'CANCEL' ? order.status !== 'PENDING' || attempt.status !== 'PENDING' || attempt.charges.some(c => !['PENDING','OVERDUE','AWAITING_RISK_ANALYSIS'].includes(c.providerStatus)) :
      (!(lateRefund || ['PAID', 'SHIPPED', 'DELIVERED'].includes(order.status) && attempt.status === 'APPROVED')) ||
      attempt.charges.some(c => !['CONFIRMED','RECEIVED'].includes(c.providerStatus))) throw new Error('PAYMENT_OPERATION_STATE_CONFLICT');
    const operations = [];
    for (const charge of attempt.charges) operations.push(await tx.paymentOperation.create({ data: { attemptId: attempt.id,
      chargeId: charge.id, kind: input.kind, commandKey, requestedById: input.userId,
      status: input.kind === 'REFUND' && attempt.method === 'BOLETO' ? 'BOLETO_READY' : 'READY' } }));
    const requestedAt = await paymentNow(tx);
    await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { status: input.kind === 'CANCEL' ? 'CANCEL_PENDING' : 'REFUND_PENDING',
      reconcileAfter: requestedAt, reviewAfter: new Date(requestedAt.getTime() + 24 * 3600000), failureCode: null, version: { increment: 1 } } });
    await tx.auditLog.create({ data: { actorType: 'USER', actorId: input.userId, entity: 'Order', entityId: order.id,
      action: 'PAYMENT_OPERATION_REQUESTED', effectKey: 'payment-operation:' + commandKey, metadata: { kind: input.kind, attemptId: attempt.id, commandKey } } });
    return { attemptId: attempt.id, operations: operationResult(operations), replay: false };
  });
}
