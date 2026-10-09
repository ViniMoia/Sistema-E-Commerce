import { randomUUID } from 'node:crypto';
import prisma from '@/lib/prisma';
import { CommerceLocks } from '@/lib/commerce/locks';
import { asaasPaymentAdapter } from '@/services/asaas/asaas.adapter';
import { asaasClient } from '@/services/asaas/asaas.client';
import type { PaymentGateway, PaymentMethod, PaymentInspection } from '@/types/payment-gateway.types';
import { applyPaymentEvidence, markPaymentReview, paymentNow } from './payment-evidence.service';
import { claimWork, fenceWork, completeWork, retryWork } from './durable-work.service';
import { webhookEnvelopeSchema } from './payment-inbox.service';
import { paymentAccountScope } from '@/lib/commerce/payment-account';
import { logger } from '@/lib/logger';
import { paymentEvidenceTransactionOptions, paymentRetryCode } from './payment-execution-policy';

export async function inspectPaymentAttempt(attemptId: string, gateway: PaymentGateway = asaasPaymentAdapter): Promise<PaymentInspection> {
  const attempt = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId }, include: { charges: true, operations: true } });
  if (attempt.providerAccount !== paymentAccountScope()) throw new Error('PAYMENT_ACCOUNT_SCOPE_MISMATCH');
  if (!gateway.inspectAttempt || (gateway === asaasPaymentAdapter && !asaasClient.configurationReady())) throw new Error('PAYMENT_LOOKUP_UNAVAILABLE');
  return gateway.inspectAttempt({ externalReference: attempt.externalReference, paymentIds: attempt.charges.map(c => c.providerPaymentId),
    method: attempt.method as PaymentMethod, installments: attempt.installments,
    refundPaymentIds: attempt.charges.filter(c => attempt.operations.some(op => op.chargeId === c.id && op.kind === 'REFUND')).map(c => c.providerPaymentId) });
}

export async function drainPaymentInbox(limit = 10, gateway: PaymentGateway = asaasPaymentAdapter) {
  const batch = await claimWork('PaymentInbox', Math.max(1, Math.min(50, Math.trunc(limit))));
  const summary = { claimed: batch.ids.length, completed: 0, retried: 0, review: 0 };
  for (const id of batch.ids) {
    let phase = 'lookup';
    try {
      const inbox = await prisma.paymentInbox.findUniqueOrThrow({ where: { id } });
      if (inbox.provider !== 'ASAAS:' + paymentAccountScope()) throw new Error('PAYMENT_ACCOUNT_SCOPE_MISMATCH');
      const envelope = webhookEnvelopeSchema.parse(inbox.payload);
      // ID correlation takes precedence; externalReference must agree. An OR
      // lookup could combine another order's reference with this payment ID.
      const charge = await prisma.paymentCharge.findUnique({ where: { provider_providerPaymentId: { provider: 'ASAAS', providerPaymentId: envelope.payment.id } }, include: { attempt: true } });
      const attempt = charge?.attempt ?? (envelope.payment.externalReference ? await prisma.paymentAttempt.findUnique({ where: { externalReference: envelope.payment.externalReference } }) : null);
      if (!attempt) throw new Error('PAYMENT_ORDER_NOT_YET_FOUND');
      if ((envelope.payment.externalReference && attempt.externalReference !== envelope.payment.externalReference) || attempt.method !== envelope.payment.billingType) {
        phase = 'evidence';
        await prisma.$transaction(async tx => {
          await new CommerceLocks(tx).acquire('order', [attempt.orderId]);
          await fenceWork(tx, 'PaymentInbox', id, batch.owner);
          await markPaymentReview(tx, attempt.id, 'WEBHOOK_CORRELATION_CONFLICT');
          await completeWork(tx, 'PaymentInbox', id, batch.owner, true);
        }, paymentEvidenceTransactionOptions); summary.review++; continue;
      }
      // A webhook triggers lookup, not unconditional approval/refund. Current
      // complete contract also neutralizes duplicates and out-of-order events.
      const inspection = await inspectPaymentAttempt(attempt.id, gateway);
      if (!inspection.charges.some(c => c.paymentId === envelope.payment.id)) throw new Error('PAYMENT_EVENT_REFERENCE_UNRESOLVED');
      phase = 'evidence';
      const outcome = await prisma.$transaction(async tx => {
        await new CommerceLocks(tx).acquire('order', [attempt.orderId]);
        await fenceWork(tx, 'PaymentInbox', id, batch.owner);
        const result = await applyPaymentEvidence(tx, attempt.id, inspection);
        await completeWork(tx, 'PaymentInbox', id, batch.owner, result.review);
        return result;
      }, paymentEvidenceTransactionOptions);
      if (outcome.review) summary.review++; else summary.completed++;
    } catch (error) {
      logger.warn('Evento de pagamento preservado para nova tentativa.', {
        action: 'PAYMENT_INBOX_RETRY', workId: id, phase, errorCode: paymentRetryCode(error),
      });
      await retryWork('PaymentInbox', id, batch.owner, 'PAYMENT_EVENT_RETRY'); summary.retried++;
    }
  }
  return summary;
}

export async function reconcilePaymentAttempts(limit = 10, gateway: PaymentGateway = asaasPaymentAdapter) {
  const owner = randomUUID();
  const ids = await prisma.$transaction(async tx => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "PaymentAttempt" WHERE provider='ASAAS'
      AND ("reconcileAfter" IS NULL OR "reconcileAfter"<=clock_timestamp())
      AND ("leaseExpiresAt" IS NULL OR "leaseExpiresAt"<=clock_timestamp())
      AND status NOT IN ('DECLINED','CANCELLED','REFUNDED')
      ORDER BY "reconcileAfter" NULLS FIRST,id FOR UPDATE SKIP LOCKED LIMIT ${Math.max(1, Math.min(50, Math.trunc(limit)))}`;
    for (const row of rows) await tx.$executeRaw`UPDATE "PaymentAttempt" SET "leaseOwner"=${owner},
      "leaseExpiresAt"=clock_timestamp()+interval '10 minutes', "reconcileAttempts"="reconcileAttempts"+1 WHERE id=${row.id}`;
    return rows.map(r => r.id);
  });
  const summary = { claimed: ids.length, completed: 0, retried: 0, review: 0 };
  for (const id of ids) {
    let phase = 'lookup';
    try {
      const attempt = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id }, include: { charges: true } });
      // Reconcile before operation dispatch; approval racing cancellation is
      // observed before a destructive operation can be initiated.
      const inspection = await inspectPaymentAttempt(id, gateway);
      phase = 'evidence';
      const first = await prisma.$transaction(async tx => {
        await new CommerceLocks(tx).acquire('order', [attempt.orderId]);
        await fenceAttempt(tx, id, owner);
        return applyPaymentEvidence(tx, id, inspection);
      }, paymentEvidenceTransactionOptions);
      const current = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id } });
      const pendingReversal = current.status === 'REFUND_PENDING' && ['LATE_PAYMENT', 'PAYMENT_PARTIAL_REVERSAL_REVIEW'].includes(current.failureCode ?? '');
      let operationReview = false;
      if (!first.review || pendingReversal) {
        phase = 'operations';
        operationReview = await dispatchPaymentOperations(id, owner, gateway);
      }
      if (first.review || operationReview) summary.review++; else summary.completed++;
    } catch (error) {
      logger.warn('Conciliação de pagamento preservada para nova tentativa.', {
        action: 'PAYMENT_RECONCILIATION_RETRY', attemptId: id, phase, errorCode: paymentRetryCode(error),
      });
      summary.retried++;
      await prisma.$transaction(async tx => {
        const reference = await tx.paymentAttempt.findUnique({ where: { id } });
        if (!reference) return;
        await new CommerceLocks(tx).acquire('order', [reference.orderId]);
        const held = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "PaymentAttempt" WHERE id=${id} AND "leaseOwner"=${owner}
          AND "leaseExpiresAt">clock_timestamp() FOR UPDATE`;
        if (!held.length) return;
        const attempt = await tx.paymentAttempt.findUniqueOrThrow({ where: { id } });
        const overdue = attempt.reconcileAttempts >= 10 || !!attempt.reviewAfter && attempt.reviewAfter <= await paymentNow(tx);
        if (overdue) await markPaymentReview(tx, id, 'PAYMENT_RECONCILIATION_OVERDUE');
        const existingReview = /REVIEW|MISMATCH|CONFLICT|LATE_PAYMENT|PHYSICAL_RETURN/.test(attempt.failureCode ?? '');
        await tx.paymentAttempt.update({ where: { id }, data: { failureCode: overdue ? 'PAYMENT_RECONCILIATION_OVERDUE' : existingReview ? attempt.failureCode : 'PAYMENT_RECONCILIATION_RETRY',
          ...(attempt.status === 'SUBMITTING' ? { status: 'UNKNOWN', version: { increment: 1 } } : {}),
          reconcileAfter: new Date((await paymentNow(tx)).getTime() + Math.min(3600000, 1000 * 2 ** Math.min(attempt.reconcileAttempts, 12))) } });
      });
    } finally {
      await prisma.paymentAttempt.updateMany({ where: { id, leaseOwner: owner }, data: { leaseOwner: null, leaseExpiresAt: null } });
    }
  }
  return summary;
}

async function fenceAttempt(tx: import('@prisma/client').Prisma.TransactionClient, id: string, owner: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "PaymentAttempt" WHERE id=${id} AND "leaseOwner"=${owner}
    AND "leaseExpiresAt">clock_timestamp() FOR UPDATE`;
  if (rows.length !== 1) throw new Error('PAYMENT_LEASE_LOST');
}

async function dispatchPaymentOperations(attemptId: string, owner: string, gateway: PaymentGateway) {
  const operations = await prisma.paymentOperation.findMany({ where: { attemptId, status: 'READY', lastErrorCode: null }, include: { charge: true } });
  for (const operation of operations) {
    const submit = await prisma.$transaction(async tx => {
      const attempt = await tx.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId } });
      await new CommerceLocks(tx).acquire('order', [attempt.orderId]); await fenceAttempt(tx, attemptId, owner);
      const order = await tx.order.findUniqueOrThrow({ where: { id: attempt.orderId } });
      const current = await tx.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId } });
      const stateValid = operation.kind === 'CANCEL' ? current.status === 'CANCEL_PENDING' && order.status === 'PENDING' : current.status === 'REFUND_PENDING';
      if (!stateValid) return false;
      const applied = await tx.paymentOperation.updateMany({ where: { id: operation.id, status: 'READY', lastErrorCode: null }, data: { status: 'SUBMITTING', submittedAt: await paymentNow(tx) } });
      return applied.count === 1;
    });
    if (!submit) continue;
    try {
      if (operation.kind === 'CANCEL') {
        if (!gateway.cancelPayment) throw new Error('PAYMENT_CANCEL_UNAVAILABLE');
        await gateway.cancelPayment(operation.charge.providerPaymentId);
      } else {
        if (!gateway.refundPayment) throw new Error('PAYMENT_REFUND_UNAVAILABLE');
        await gateway.refundPayment(operation.charge.providerPaymentId, Number(operation.charge.amount));
      }
      await prisma.paymentOperation.updateMany({ where: { id: operation.id, status: 'SUBMITTING' }, data: { status: 'PENDING' } });
    } catch {
      await prisma.paymentOperation.updateMany({ where: { id: operation.id, status: 'SUBMITTING' }, data: { status: 'UNKNOWN', lastErrorCode: 'PAYMENT_OPERATION_UNRESOLVED' } });
    }
  }
  // Merely returning 200 for a DELETE/refund is not proof of final settlement.
  if (operations.length) {
    const inspection = await inspectPaymentAttempt(attemptId, gateway);
    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    const result = await prisma.$transaction(async tx => {
      await new CommerceLocks(tx).acquire('order', [attempt.orderId]); await fenceAttempt(tx, attemptId, owner);
      return applyPaymentEvidence(tx, attemptId, inspection);
    }, paymentEvidenceTransactionOptions);
    return result.review;
  }
  return false;
}
