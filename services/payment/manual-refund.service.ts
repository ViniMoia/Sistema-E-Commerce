import { createHash } from 'node:crypto';
import prisma from '@/lib/prisma';
import { CommerceLocks } from '@/lib/commerce/locks';
import { transitionOrder } from '@/lib/commerce/order-command';
import { paymentNow } from './payment-evidence.service';
import { refundOrderPoints } from '@/services/loyalty.service';

/** Administrative attestation only: this function never transfers money.
 * REFUND_PENDING is maintained until the administrator records a completed
 * bank operation. The bank reference is stored as a hash, never as raw PII. */
export async function manualRefund(input: { orderId: string; lojaID: string; userId: string; commandId: string;
  expectedVersion: number; action: 'REQUEST_REFUND' | 'CONFIRM_REFUND'; bankReference?: string }) {
  if (!/^[a-zA-Z0-9_-]{1,96}$/.test(input.commandId) || !Number.isInteger(input.expectedVersion) || input.expectedVersion < 0 ||
    (input.action === 'CONFIRM_REFUND' && (!input.bankReference || !/^[a-zA-Z0-9_:/.-]{8,128}$/.test(input.bankReference)))) throw new Error('MANUAL_REFUND_INVALID');
  const referenceHash = input.bankReference ? createHash('sha256').update(input.bankReference).digest('hex') : null;
  const effectKey = 'manual-refund-command:' + createHash('sha256').update(JSON.stringify([input.orderId, input.userId, input.commandId])).digest('hex');
  const contentHash = createHash('sha256').update(JSON.stringify([input.action, input.expectedVersion, referenceHash])).digest('hex');
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${input.userId} FOR SHARE`;
    await new CommerceLocks(tx).acquire('order', [input.orderId]);
    const user = await tx.user.findUnique({ where: { id: input.userId } });
    if (!user || user.role !== 'ADMIN' || user.status !== 'ACTIVE' || user.lojaID !== input.lojaID) throw new Error('MANUAL_REFUND_FORBIDDEN');
    const order = await tx.order.findUnique({ where: { id: input.orderId } });
    if (!order || order.lojaID !== input.lojaID) throw new Error('PAYMENT_ORDER_NOT_FOUND');
    const previous = await tx.auditLog.findUnique({ where: { effectKey } });
    if (previous) {
      if ((previous.metadata as { contentHash?: string } | null)?.contentHash !== contentHash) throw new Error('MANUAL_REFUND_COMMAND_CONFLICT');
      return { orderId: order.id, replay: true };
    }
    if (order.version !== input.expectedVersion) throw new Error('MANUAL_REFUND_VERSION_CONFLICT');
    const attempt = await tx.paymentAttempt.findFirst({ where: { orderId: order.id }, orderBy: { number: 'desc' } });
    if (!attempt || attempt.provider !== 'MANUAL' || order.paymentMethod !== 'WHATSAPP_PIX') throw new Error('MANUAL_REFUND_METHOD_CONFLICT');
    const now = await paymentNow(tx);
    if (input.action === 'REQUEST_REFUND') {
      if (attempt.status !== 'APPROVED' || !['PAID','SHIPPED','DELIVERED'].includes(order.status)) throw new Error('MANUAL_REFUND_STATE_CONFLICT');
      await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { status: 'REFUND_PENDING', failureCode: 'MANUAL_REFUND_REVIEW', version: { increment: 1 } } });
      await tx.commerceOutbox.upsert({ where: { effectKey: 'manual-refund:' + attempt.id }, update: {}, create: {
        effectKey: 'manual-refund:' + attempt.id, commandType: 'PAYMENT_REVIEW', aggregateId: order.id,
        payload: { schemaVersion: 1, attemptId: attempt.id, reasonCode: 'MANUAL_REFUND_VERIFICATION_REQUIRED' } } });
    } else {
      if (attempt.status !== 'REFUND_PENDING') throw new Error('MANUAL_REFUND_STATE_CONFLICT');
      await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { status: 'REFUNDED', failureCode: ['SHIPPED','DELIVERED'].includes(order.status) ? 'PHYSICAL_RETURN_REQUIRED' : null, version: { increment: 1 } } });
      const factKey = 'manual:' + order.id + ':REFUNDED';
      await tx.financialFact.create({ data: { provider: 'MANUAL', factKey, type: 'REFUNDED', orderId: order.id, attemptId: attempt.id,
        amount: attempt.financialTotal, occurredAt: now } });
      if (order.status === 'PAID') {
        const result = await transitionOrder({ orderId: order.id, lojaID: order.lojaID, newStatus: 'CANCELLED', expectedVersion: order.version,
          performedById: input.userId, actor: { type: 'USER', userId: input.userId, lojaID: input.lojaID } }, tx);
        if (!result.success) throw new Error('MANUAL_REFUND_APPLICATION_RETRY');
      } else if (['SHIPPED','DELIVERED'].includes(order.status) && order.userID) {
        await refundOrderPoints({ lojaID: order.lojaID, orderId: order.id, reason: 'Estorno manual integral confirmado; sem inferência de retorno físico.' }, tx);
      }
      if (!['SHIPPED','DELIVERED'].includes(order.status)) await tx.commerceOutbox.updateMany({ where: {
        effectKey: 'manual-refund:' + attempt.id, status: { in: ['READY','DEAD_LETTER'] } }, data: { status: 'COMPLETED', completedAt: now, lastErrorCode: null } });
    }
    await tx.auditLog.create({ data: { effectKey, actorType: 'USER', actorId: input.userId, entity: 'Order', entityId: order.id,
      action: input.action === 'REQUEST_REFUND' ? 'MANUAL_REFUND_REQUESTED' : 'MANUAL_REFUND_CONFIRMED',
      metadata: { attemptId: attempt.id, contentHash, bankReferenceHash: referenceHash, source: 'ADMIN_ATTESTATION' } } });
    return { orderId: order.id, replay: false };
  });
}
