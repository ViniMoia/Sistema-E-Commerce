import prisma from '@/lib/prisma';
import { paymentNow } from './payment-evidence.service';
import { paymentAccountScope } from '@/lib/commerce/payment-account';
import { CommerceLocks } from '@/lib/commerce/locks';
import { createHash } from 'node:crypto';

/** Installation-wide aggregate snapshot. No customer IDs, payloads or mutations.
 * The configured scope identifies the installation; mismatched stored accounts
 * are reported explicitly rather than silently hidden by a scope filter. */
export async function paymentBacklog() {
  const accountScope = paymentAccountScope();
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const now = await paymentNow(tx);
    const pending = ['READY', 'LEASED', 'DEAD_LETTER'] as const;
    const [inbox, outbox, uncertain, overdue, abandoned, operations, legacy,
      oldestInbox, oldestOutbox, reviewGroups, heldOperations, emailDeadLetters,
      oldestEmail, inboxLeases, outboxLeases, foreignAccounts, due] = await Promise.all([
      tx.paymentInbox.groupBy({ by: ['status'], _count: true }),
      tx.commerceOutbox.groupBy({ by: ['status'], _count: true }),
      tx.paymentAttempt.count({ where: { status: { in: ['SUBMITTING','UNKNOWN'] }, provider: 'ASAAS' } }),
      tx.paymentAttempt.count({ where: { provider: 'ASAAS', reviewAfter: { lte: now }, status: { in: ['SUBMITTING','UNKNOWN','CANCEL_PENDING','REFUND_PENDING'] } } }),
      tx.paymentAttempt.count({ where: { leaseExpiresAt: { lte: now }, leaseOwner: { not: null } } }),
      tx.paymentOperation.groupBy({ by: ['status','kind'], _count: true }),
      tx.order.count({ where: { status: 'PENDING', asaasPaymentId: { not: null }, paymentAttempts: { none: {} } } }),
      tx.paymentInbox.findFirst({ where: { status: { in: [...pending] } }, orderBy: { receivedAt: 'asc' }, select: { receivedAt: true } }),
      tx.commerceOutbox.findFirst({ where: { status: { in: [...pending] } }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
      tx.paymentAttempt.groupBy({ by: ['failureCode'], where: { failureCode: { not: null } }, _count: true }),
      tx.paymentOperation.count({ where: { status: { not: 'COMPLETED' }, lastErrorCode: { not: null } } }),
      tx.commerceOutbox.count({ where: { commandType: 'PAYMENT_CONFIRMATION_EMAIL', status: 'DEAD_LETTER' } }),
      tx.commerceOutbox.findFirst({ where: { commandType: 'PAYMENT_CONFIRMATION_EMAIL', status: { in: [...pending] } }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
      tx.paymentInbox.count({ where: { status: 'LEASED', leaseExpiresAt: { lte: now } } }),
      tx.commerceOutbox.count({ where: { status: 'LEASED', leaseExpiresAt: { lte: now } } }),
      tx.paymentAttempt.count({ where: { provider: 'ASAAS', OR: [{ providerAccount: null }, { providerAccount: { not: accountScope } }] } }),
      tx.$queryRaw<Array<{ oldest: Date | null }>>`SELECT MIN(COALESCE("reconcileAfter", "createdAt")) AS oldest
        FROM "PaymentAttempt" WHERE provider='ASAAS' AND status NOT IN ('DECLINED','CANCELLED','REFUNDED')
        AND COALESCE("reconcileAfter", "createdAt") <= ${now}`,
    ]);
    const chargebackReviews = reviewGroups.filter(g => g.failureCode?.startsWith('PAYMENT_CHARGEBACK_')).reduce((n,g) => n + g._count, 0);
    const physicalReturnReviews = reviewGroups.filter(g => g.failureCode === 'PHYSICAL_RETURN_REQUIRED').reduce((n,g) => n + g._count, 0);
    return { schemaVersion: 1, at: now.toISOString(), accountScope, inbox, outbox, uncertain,
      overdue, abandonedLeases: abandoned, operations, untrackedLegacyOrders: legacy,
      oldestUnresolvedInboxAt: oldestInbox?.receivedAt.toISOString() ?? null,
      supervision: { schemaVersion: 1, reviewAttempts: reviewGroups.reduce((n,g) => n + g._count, 0),
        chargebackReviews, physicalReturnReviews, heldOperations, emailDeadLetters,
        expiredQueueLeases: inboxLeases + outboxLeases, foreignAccountAttempts: foreignAccounts,
        oldestUnresolvedOutboxAt: oldestOutbox?.createdAt.toISOString() ?? null,
        oldestPendingEmailAt: oldestEmail?.createdAt.toISOString() ?? null,
        oldestDueReconciliationAt: due[0]?.oldest?.toISOString() ?? null },
    };
  }, { isolationLevel: 'RepeatableRead', timeout: 20000 });
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
