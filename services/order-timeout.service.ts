import { createHash } from 'node:crypto';
import prisma from '@/lib/prisma';
import { CommerceLocks } from '@/lib/commerce/locks';
import { transitionOrder } from '@/lib/commerce/order-command';
import { applyPaymentEvidence, paymentNow } from '@/services/payment/payment-evidence.service';
import { inspectPaymentAttempt } from '@/services/payment/payment-worker.service';
import type { PaymentGateway } from '@/types/payment-gateway.types';
import { paymentEvidenceTransactionOptions } from '@/services/payment/payment-execution-policy';

export const DEFAULT_ASAAS_TIMEOUT_MINUTES = 60; // Deprecated: never used as remote expiry.
export const DEFAULT_MANUAL_TIMEOUT_HOURS = 24;
export const DEFAULT_BATCH_SIZE = 50;
export interface ProcessExpiredOrdersOptions {
  lojaID?: string; batchSize?: number; dryRun?: boolean; gateway?: PaymentGateway;
  /** Compatibility only: runtime decisions exclusively use persisted deadlines and database time. */
  asaasTimeoutMinutes?: number; manualTimeoutHours?: number; now?: Date;
}
export interface OrderTimeoutSummary {
  success: boolean; processedCount: number; cancelledCount: number; errorCount: number;
  cancelledOrderIds: string[]; errors: Array<{ orderId: string; orderNumber?: number; error: string }>; executionTimeMs: number;
}
export async function processExpiredOrders(options: ProcessExpiredOrdersOptions = {}): Promise<OrderTimeoutSummary> {
  const started = Date.now();
  const summary: OrderTimeoutSummary = { success: true, processedCount: 0, cancelledCount: 0, errorCount: 0, cancelledOrderIds: [], errors: [], executionTimeMs: 0 };
  try {
    const now = await prisma.$transaction(paymentNow);
    const candidates = await prisma.paymentAttempt.findMany({ where: {
      order: { status: 'PENDING', ...(options.lojaID ? { lojaID: options.lojaID } : {}) },
      reservationExpiresAt: { lte: now }, status: { in: ['NOT_STARTED', 'PENDING'] },
      method: { in: ['WHATSAPP_PIX', 'PIX', 'BOLETO'] },
    }, take: Math.max(1, Math.min(100, Math.trunc(options.batchSize ?? DEFAULT_BATCH_SIZE))),
    orderBy: { reservationExpiresAt: 'asc' }, include: { order: true } });
    summary.processedCount = candidates.length;
    for (const candidate of candidates) {
      if (options.dryRun) continue;
      try {
        // Lookups are outside locks and never turn an OVERDUE/pending payment
        // into proof of remote cancellation. Legacy null deadlines are skipped.
        const evidence = candidate.provider === 'ASAAS' ? await inspectPaymentAttempt(candidate.id, options.gateway) : null;
        const cancelled = await prisma.$transaction(async tx => {
          await new CommerceLocks(tx).acquire('order', [candidate.orderId]);
          const attempt = await tx.paymentAttempt.findUniqueOrThrow({ where: { id: candidate.id } });
          const order = await tx.order.findUniqueOrThrow({ where: { id: candidate.orderId } });
          const clock = await paymentNow(tx);
          if (order.status !== 'PENDING' || !attempt.reservationExpiresAt || attempt.reservationExpiresAt > clock ||
            !['NOT_STARTED','PENDING'].includes(attempt.status)) return false;
          if (evidence) {
            const applied = await applyPaymentEvidence(tx, attempt.id, evidence);
            const currentOrder = await tx.order.findUniqueOrThrow({ where: { id: order.id } });
            const current = await tx.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id }, include: { charges: true } });
            if (currentOrder.status === 'CANCELLED') return true;
            if (applied.review || currentOrder.status !== 'PENDING' || current.status !== 'PENDING' ||
              !current.externalExpiresAt || !current.reservationExpiresAt || current.reservationExpiresAt > await paymentNow(tx)) return false;
            const commandKey = createHash('sha256').update('expiry:' + attempt.id).digest('hex');
            for (const charge of current.charges) await tx.paymentOperation.upsert({ where: { chargeId_kind: { chargeId: charge.id, kind: 'CANCEL' } },
              create: { attemptId: attempt.id, chargeId: charge.id, kind: 'CANCEL', commandKey }, update: {} });
            await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { status: 'CANCEL_PENDING', reconcileAfter: clock,
              reviewAfter: new Date(clock.getTime() + 24 * 3600000), version: { increment: 1 } } });
            const effectKey = 'payment-expiry:' + attempt.id;
            await tx.auditLog.upsert({ where: { effectKey }, update: {}, create: { effectKey, actorType: 'SYSTEM', actorId: null,
              systemActor: 'ORDER_TIMEOUT', entity: 'Order', entityId: order.id, action: 'PAYMENT_EXPIRATION_REQUESTED',
              metadata: { attemptId: attempt.id, commandKey, method: attempt.method } } });
            return false; // Stock remains held until definitive cancellation.
          }
          if (attempt.provider !== 'MANUAL' || attempt.method !== 'WHATSAPP_PIX') return false;
          await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { status: 'CANCELLED', version: { increment: 1 } } });
          const result = await transitionOrder({ orderId: order.id, lojaID: order.lojaID, newStatus: 'CANCELLED',
            expectedVersion: order.version, performedById: 'SYSTEM_CRON_TIMEOUT', actor: { type: 'SYSTEM', code: 'ORDER_TIMEOUT' },
            reason: 'Prazo manual persistido expirado.' }, tx);
          if (!result.success) throw new Error('EXPIRY_APPLICATION_RETRY');
          return true;
        }, paymentEvidenceTransactionOptions);
        if (cancelled) summary.cancelledOrderIds.push(candidate.orderId);
      } catch { summary.errors.push({ orderId: candidate.orderId, error: 'PAYMENT_EXPIRY_RECONCILIATION_REQUIRED' }); }
    }
  } catch { summary.errors.push({ orderId: 'QUERY_FAILED', error: 'PAYMENT_EXPIRY_QUERY_UNAVAILABLE' }); }
  summary.cancelledCount = summary.cancelledOrderIds.length; summary.errorCount = summary.errors.length;
  summary.success = !summary.errorCount; summary.executionTimeMs = Date.now() - started;
  return summary;
}
