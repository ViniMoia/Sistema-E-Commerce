import prisma from '@/lib/prisma';
import { paymentNow } from './payment-evidence.service';
import { paymentAccountScope } from '@/lib/commerce/payment-account';
import { CommerceLocks } from '@/lib/commerce/locks';
import { createHash } from 'node:crypto';

export async function paymentBacklog() {
  const now = await prisma.$transaction(paymentNow);
  const [inbox, outbox, uncertain, overdue, abandoned, operations, legacy] = await Promise.all([
    prisma.paymentInbox.groupBy({ by: ['status'], _count: true }),
    prisma.commerceOutbox.groupBy({ by: ['status'], _count: true }),
    prisma.paymentAttempt.count({ where: { status: { in: ['SUBMITTING','UNKNOWN'] }, provider: 'ASAAS' } }),
    prisma.paymentAttempt.count({ where: { provider: 'ASAAS', reviewAfter: { lte: now }, status: { in: ['SUBMITTING','UNKNOWN','CANCEL_PENDING','REFUND_PENDING'] } } }),
    prisma.paymentAttempt.count({ where: { leaseExpiresAt: { lte: now } } }),
    prisma.paymentOperation.groupBy({ by: ['status','kind'], _count: true }),
    prisma.order.count({ where: { status: 'PENDING', asaasPaymentId: { not: null }, paymentAttempts: { none: {} } } }),
  ]);
  const oldestInbox = await prisma.paymentInbox.findFirst({ where: { status: { in: ['READY','LEASED','DEAD_LETTER'] } }, orderBy: { receivedAt: 'asc' }, select: { receivedAt: true } });
  return { schemaVersion: 1, at: now.toISOString(), accountScope: paymentAccountScope(), inbox, outbox, uncertain,
    overdue, abandonedLeases: abandoned, operations, untrackedLegacyOrders: legacy, oldestUnresolvedInboxAt: oldestInbox?.receivedAt.toISOString() ?? null };
}

export async function requestPaymentReconciliation(input: { orderId: string; lojaID: string; userId: string; commandId: string }) {
  if (!/^[a-zA-Z0-9_-]{1,96}$/.test(input.commandId)) throw new Error('PAYMENT_RECONCILIATION_INVALID');
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${input.userId} FOR SHARE`;
    await new CommerceLocks(tx).acquire('order', [input.orderId]);
    const user = await tx.user.findUnique({ where: { id: input.userId } });
    if (!user || user.lojaID !== input.lojaID || user.role !== 'ADMIN' || user.status !== 'ACTIVE') throw new Error('PAYMENT_RECONCILIATION_FORBIDDEN');
    const order = await tx.order.findUnique({ where: { id: input.orderId } });
    if (!order || order.lojaID !== input.lojaID) throw new Error('PAYMENT_ORDER_NOT_FOUND');
    const attempt = await tx.paymentAttempt.findFirst({ where: { orderId: order.id }, orderBy: { number: 'desc' } });
    if (!attempt || attempt.providerAccount !== paymentAccountScope()) throw new Error('PAYMENT_RECONCILIATION_REQUIRED');
    const now = await paymentNow(tx);
    await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { reconcileAfter: now, reviewAfter: new Date(now.getTime() + 24 * 3600000) } });
    const retry = await tx.paymentInbox.updateMany({ where: { provider: 'ASAAS:' + paymentAccountScope(), status: 'DEAD_LETTER',
      payload: { path: ['payment','externalReference'], equals: order.id } }, data: { status: 'READY', nextAttemptAt: now, attempts: 0, lastErrorCode: null } });
    const effectKey = 'payment-reconcile:' + createHash('sha256').update(JSON.stringify([order.id, input.userId, input.commandId])).digest('hex');
    await tx.auditLog.upsert({ where: { effectKey }, create: { effectKey, actorType: 'USER', actorId: input.userId,
      action: 'PAYMENT_RECONCILIATION_REQUESTED', entity: 'Order', entityId: order.id, metadata: { attemptId: attempt.id } }, update: {} });
    // Never reset PaymentOperation or PaymentAttempt to permission to POST.
    return { attemptId: attempt.id, requeuedEvents: retry.count, status: attempt.status };
  });
}
