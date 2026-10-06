import { createHash } from 'node:crypto';
import prisma from '@/lib/prisma';
import { CommerceLocks } from '@/lib/commerce/locks';
import { paymentNow } from './payment-evidence.service';
import { paymentAccountScope } from '@/lib/commerce/payment-account';

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
      return { attemptId: attempt.id, operations: applied, replay: true };
    }
    if (order.version !== input.expectedVersion) throw new Error('PAYMENT_ORDER_VERSION_CONFLICT');
    const lateRefund = order.status === 'CANCELLED' && attempt.failureCode === 'LATE_PAYMENT';
    if (input.kind === 'CANCEL' ? order.status !== 'PENDING' || attempt.status !== 'PENDING' || attempt.charges.some(c => !['PENDING','OVERDUE','AWAITING_RISK_ANALYSIS'].includes(c.providerStatus)) :
      (!(lateRefund || ['PAID', 'SHIPPED', 'DELIVERED'].includes(order.status) && attempt.status === 'APPROVED')) ||
      attempt.method === 'BOLETO' || attempt.charges.some(c => !['CONFIRMED','RECEIVED'].includes(c.providerStatus))) throw new Error('PAYMENT_OPERATION_STATE_CONFLICT');
    const operations = [];
    for (const charge of attempt.charges) operations.push(await tx.paymentOperation.create({ data: { attemptId: attempt.id,
      chargeId: charge.id, kind: input.kind, commandKey, requestedById: input.userId } }));
    const requestedAt = await paymentNow(tx);
    await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { status: input.kind === 'CANCEL' ? 'CANCEL_PENDING' : 'REFUND_PENDING',
      reconcileAfter: requestedAt, reviewAfter: new Date(requestedAt.getTime() + 24 * 3600000), failureCode: null, version: { increment: 1 } } });
    await tx.auditLog.create({ data: { actorType: 'USER', actorId: input.userId, entity: 'Order', entityId: order.id,
      action: 'PAYMENT_OPERATION_REQUESTED', effectKey: 'payment-operation:' + commandKey, metadata: { kind: input.kind, attemptId: attempt.id, commandKey } } });
    return { attemptId: attempt.id, operations, replay: false };
  });
}
