import { Prisma, type PaymentAttemptStatus } from '@prisma/client';
import { z } from 'zod';
import { transitionOrder } from '@/lib/commerce/order-command';
import { moneyCents } from './installment.service';
import type { PaymentInspection } from '@/types/payment-gateway.types';
import { paymentAccountScope } from '@/lib/commerce/payment-account';
import { refundOrderPoints } from '@/services/loyalty.service';
import { parseRefundHistory, refundHistoryReview } from './refund-history';

const chargeSchema = z.object({ paymentId: z.string().min(1).max(128), externalReference: z.string().min(1).max(128),
  method: z.enum(['PIX', 'BOLETO', 'CREDIT_CARD']), ordinal: z.number().int().positive(), value: z.number().finite().positive(),
  status: z.string().min(1).max(64), deleted: z.boolean().optional(), contractId: z.string().max(128).optional(),
  dueAt: z.string().datetime({ offset: true }).optional(), paidAt: z.string().datetime({ offset: true }).optional(),
  instructions: z.object({ pixPayload: z.string().min(1).max(10000).optional(), pixQrCodeBase64: z.string().min(1).max(200000).optional(),
    bankSlipUrl: z.string().url().optional(), digitableLine: z.string().max(256).optional(), expiresAt: z.string().datetime({ offset: true }).optional() }).optional() });

export async function paymentNow(tx: Prisma.TransactionClient): Promise<Date> {
  const rows = await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`;
  return rows[0].now;
}

export async function markPaymentReview(tx: Prisma.TransactionClient, attemptId: string, code: string, evidence?: Prisma.InputJsonObject) {
  const attempt = await tx.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId } });
  const key = 'payment-review:' + attemptId + ':' + code;
  const order = await tx.order.findUniqueOrThrow({ where: { id: attempt.orderId } });
  const existing = await tx.auditLog.findUnique({ where: { effectKey: key } });
  await tx.auditLog.upsert({ where: { effectKey: key }, update: {}, create: { effectKey: key,
    actorType: 'SYSTEM', actorId: null, systemActor: 'PAYMENT_RECONCILIATION', targetId: order.userID,
    action: code === 'LATE_PAYMENT' ? 'PAYMENT_RECEIVED_ON_CANCELLED_ORDER' : 'PAYMENT_REVIEW_REQUIRED', entity: 'Order', entityId: order.id,
    metadata: { attemptId, reasonCode: code, ...(evidence ? { evidence } : {}) } } });
  if (code === 'LATE_PAYMENT' && !existing) await tx.order.update({ where: { id: order.id }, data: {
    adminNotes: [order.adminNotes, '[ALERTA DE PAGAMENTO TARDIO] Evidência financeira conciliada; revisar estorno sem reabrir estoque.'].filter(Boolean).join('\n') } });
  await tx.paymentAttempt.update({ where: { id: attemptId }, data: { failureCode: code, version: { increment: 1 } } });
  await tx.commerceOutbox.upsert({ where: { effectKey: key }, create: { effectKey: key, commandType: 'PAYMENT_REVIEW', aggregateId: attempt.orderId,
    payload: { schemaVersion: 1, attemptId, reasonCode: code } }, update: {} });
}

// Caller holds Order FOR UPDATE. All evidence, projection, commercial effects
// and inbox acknowledgement share this transaction. No network I/O here.
export async function applyPaymentEvidence(tx: Prisma.TransactionClient, attemptId: string, inspection: PaymentInspection) {
  const attempt = await tx.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId }, include: { order: true, operations: true, charges: { include: { financialFacts: true } } } });
  if (attempt.provider !== 'ASAAS') throw new Error('PAYMENT_PROVIDER_MISMATCH');
  if (attempt.providerAccount !== paymentAccountScope()) throw new Error('PAYMENT_ACCOUNT_SCOPE_MISMATCH');
  if (!inspection.complete || inspection.charges.length === 0) throw new Error('PAYMENT_REFERENCE_UNRESOLVED');
  const rows = z.array(chargeSchema).parse(inspection.charges).sort((a, b) => a.ordinal - b.ordinal);
  const plan = attempt.planSnapshot as { installments?: string[] };
  const knownIds = new Set(attempt.charges.map(c => c.providerPaymentId));
  if (rows.length !== attempt.installments || new Set(rows.map(r => r.paymentId)).size !== rows.length || !plan.installments ||
    rows.some((r, i) => r.externalReference !== attempt.externalReference || r.method !== attempt.method || r.ordinal !== i + 1 ||
      moneyCents(r.value) !== moneyCents(plan.installments![i]) ||
      (knownIds.size > 0 && !knownIds.has(r.paymentId))) ||
    rows.reduce((sum, r) => sum + moneyCents(r.value), BigInt(0)) !== moneyCents(attempt.financialTotal.toString()) ||
    (rows.length > 1 && (!rows[0].contractId || rows.some(r => r.contractId !== rows[0].contractId))) ||
    (attempt.providerContractId && rows[0].contractId !== attempt.providerContractId)) {
    await markPaymentReview(tx, attemptId, 'PAYMENT_CONTRACT_MISMATCH');
    return { review: true, state: attempt.status };
  }
  const now = await paymentNow(tx);
  for (const operation of attempt.operations.filter(op => op.kind === 'REFUND' && op.status !== 'COMPLETED')) {
    const charge = attempt.charges.find(c => c.id === operation.chargeId)!;
    const row = inspection.charges.find(c => c.paymentId === charge.providerPaymentId)!;
    const parsedHistory = parseRefundHistory(row.refundHistory?.records);
    const history = { ...parsedHistory, complete: row.refundHistory?.complete === true && parsedHistory.complete };
    const reason = refundHistoryReview(history, row.status, Number(charge.amount), operation.submittedAt !== null);
    const heldForReview = operation.lastErrorCode?.startsWith('PAYMENT_REFUND_') && operation.lastErrorCode.endsWith('_REVIEW');
    if (reason || (heldForReview && row.status !== 'REFUNDED')) {
      const code = reason ?? operation.lastErrorCode ?? 'PAYMENT_REFUND_HISTORY_REVIEW';
      await tx.paymentOperation.update({ where: { id: operation.id }, data: { lastErrorCode: code } });
      await markPaymentReview(tx, attemptId, code, { operationId: operation.id, chargeId: charge.id,
        providerPaymentId: charge.providerPaymentId, providerAccount: attempt.providerAccount,
        chargeStatus: row.status, refundHistory: { complete: history.complete,
          records: history.records.map(record => ({ status: record.status, value: record.value })) } });
      // Keep observation possible, but do not hot-loop a case requiring review.
      await tx.paymentAttempt.update({ where: { id: attemptId }, data: { reconcileAfter: new Date(now.getTime() + 3600000) } });
      return { review: true, state: attempt.status };
    }
  }
  const chargeStates: string[] = [];
  let unknown = false;
  for (const row of rows) {
    const elsewhere = await tx.paymentCharge.findUnique({ where: { provider_providerPaymentId: { provider: 'ASAAS', providerPaymentId: row.paymentId } } });
    if (elsewhere && elsewhere.attemptId !== attempt.id) {
      await markPaymentReview(tx, attemptId, 'PAYMENT_CORRELATION_CONFLICT'); return { review: true, state: attempt.status };
    }
    const previous = attempt.charges.find(c => c.providerPaymentId === row.paymentId);
    let state = ['CONFIRMED', 'RECEIVED', 'REFUNDED'].includes(row.status) ? row.status : row.deleted ? 'DELETED' : row.status;
    if (previous?.providerStatus === 'REFUNDED' && state !== 'REFUNDED') state = 'REFUNDED';
    if (previous && ['CONFIRMED', 'RECEIVED'].includes(previous.providerStatus) && ['PENDING', 'OVERDUE', 'AWAITING_RISK_ANALYSIS', 'DELETED'].includes(state)) state = previous.providerStatus;
    if (previous?.providerStatus === 'RECEIVED' && state === 'CONFIRMED') state = 'RECEIVED';
    if (previous?.providerStatus === 'DELETED' && !['DELETED', 'CONFIRMED', 'RECEIVED', 'REFUNDED'].includes(state)) unknown = true;
    if (!['PENDING', 'OVERDUE', 'AWAITING_RISK_ANALYSIS', 'CONFIRMED', 'RECEIVED', 'REFUNDED', 'DELETED', 'CREDIT_CARD_CAPTURE_REFUSED'].includes(state)) unknown = true;
    const charge = await tx.paymentCharge.upsert({ where: { provider_providerPaymentId: { provider: 'ASAAS', providerPaymentId: row.paymentId } },
      create: { attemptId, provider: 'ASAAS', providerAccount: attempt.providerAccount, providerPaymentId: row.paymentId, ordinal: row.ordinal, amount: new Prisma.Decimal(row.value), providerStatus: state,
        dueAt: row.dueAt ? new Date(row.dueAt) : null, instructions: row.instructions ? { ...row.instructions } : undefined },
      update: { providerStatus: state, ...(row.dueAt ? { dueAt: new Date(row.dueAt) } : {}),
        ...(row.instructions && Object.values(row.instructions).some(Boolean) ? { instructions: { ...(previous?.instructions as object ?? {}), ...row.instructions } } : {}) } });
    chargeStates.push(state);
    const factTypes = state === 'RECEIVED' ? ['AUTHORIZED', 'SETTLED'] as const : state === 'CONFIRMED' ? ['AUTHORIZED'] as const :
      state === 'REFUNDED' ? ['REFUNDED'] as const : state === 'DELETED' ? ['CANCELLED'] as const : [];
    for (const type of factTypes) {
      const factKey = 'charge:' + charge.id + ':' + type;
      await tx.financialFact.upsert({ where: { provider_factKey: { provider: 'ASAAS', factKey } },
        create: { orderId: attempt.orderId, attemptId, chargeId: charge.id, provider: 'ASAAS', providerAccount: attempt.providerAccount, factKey, type,
          amount: charge.amount, occurredAt: row.paidAt ? new Date(row.paidAt) : now }, update: {} });
    }
    if (state === 'DELETED' || state === 'REFUNDED') await tx.paymentOperation.updateMany({ where: { chargeId: charge.id,
      kind: state === 'DELETED' ? 'CANCEL' : 'REFUND', status: { not: 'COMPLETED' } }, data: { status: 'COMPLETED', completedAt: now, lastErrorCode: null } });
  }
  const paid = inspection.contractApproved !== false && chargeStates.every(s => ['CONFIRMED', 'RECEIVED'].includes(s));
  const refunded = chargeStates.every(s => s === 'REFUNDED');
  const cancelled = chargeStates.every(s => s === 'DELETED');
  const declined = chargeStates.every(s => s === 'CREDIT_CARD_CAPTURE_REFUSED');
  const partial = chargeStates.some(s => ['REFUNDED', 'DELETED'].includes(s)) && !(refunded || cancelled);
  let next: PaymentAttemptStatus = paid ? 'APPROVED' : refunded ? 'REFUNDED' : cancelled ? 'CANCELLED' : declined ? 'DECLINED' : 'PENDING';
  if (attempt.status === 'REFUND_PENDING' && !refunded) next = 'REFUND_PENDING';
  // Terminal evidence is never overwritten by an old pending notification.
  if (['APPROVED', 'CANCEL_PENDING', 'REFUND_PENDING', 'REFUNDED', 'CANCELLED', 'DECLINED'].includes(attempt.status) && next === 'PENDING') next = attempt.status;
  const late = paid && (attempt.order.status === 'CANCELLED' || ['CANCELLED', 'REFUNDED', 'DECLINED'].includes(attempt.status));
  const expiry = attempt.method === 'PIX' ? rows[0].instructions?.expiresAt : attempt.method === 'BOLETO' ? rows[0].dueAt : undefined;
  const policy = attempt.planSnapshot as { expiryPolicy?: { boletoConfirmationGraceHours?: number } };
  const graceHours = policy.expiryPolicy?.boletoConfirmationGraceHours;
  const reconciledStatus = late ? attempt.status : next;
  // A pending reversal still needs prompt evidence even while the charge is RECEIVED.
  const reversalPending = ['CANCEL_PENDING', 'REFUND_PENDING'].includes(reconciledStatus);
  const reconcileDelay = reversalPending || !paid ? 60000 : chargeStates.every(s => s === 'RECEIVED') ? 86400000 : 3600000;
  await tx.paymentAttempt.update({ where: { id: attemptId }, data: { status: reconciledStatus,
    providerContractId: rows[0].contractId ?? attempt.providerContractId, failureCode: null,
    ...(expiry ? { externalExpiresAt: new Date(expiry),
      reservationExpiresAt: attempt.method === 'BOLETO' && (!Number.isInteger(graceHours) || graceHours! < 0) ? null :
        new Date(new Date(expiry).getTime() + (attempt.method === 'BOLETO' ? graceHours! * 3600000 : 0)) } : {}),
    reconcileAfter: new Date(now.getTime() + reconcileDelay),
    reconcileAttempts: 0, version: { increment: 1 } } });
  if (attempt.status !== (late ? attempt.status : next)) await tx.auditLog.create({ data: {
    actorType: 'SYSTEM', actorId: null, systemActor: 'PAYMENT_RECONCILIATION', entity: 'PaymentAttempt', entityId: attempt.id,
    action: 'PAYMENT_STATE_RECONCILED', effectKey: 'payment-state:' + attempt.id + ':' + (attempt.version + 1),
    previousValue: { status: attempt.status, version: attempt.version }, newValue: { status: next, version: attempt.version + 1 },
    metadata: { orderId: attempt.orderId, providerAccount: attempt.providerAccount } } });
  const primary = rows[0];
  await tx.order.update({ where: { id: attempt.orderId }, data: { asaasPaymentId: primary.paymentId,
    asaasPaymentStatus: chargeStates[0], ...(primary.instructions?.bankSlipUrl ? { asaasBankSlipUrl: primary.instructions.bankSlipUrl } : {}),
    ...(primary.instructions?.digitableLine ? { asaasDigitableLine: primary.instructions.digitableLine } : {}),
    ...(attempt.method === 'BOLETO' && primary.dueAt ? { asaasDueDate: new Date(primary.dueAt) } : {}) } });
  if (unknown || partial || late) {
    await markPaymentReview(tx, attemptId, late ? 'LATE_PAYMENT' : partial ? 'PAYMENT_PARTIAL_REVERSAL_REVIEW' : 'PAYMENT_EXTERNAL_STATE_REVIEW');
    return { review: true, state: late ? attempt.status : next };
  }
  if ((paid && attempt.order.status === 'PENDING') || ((refunded || cancelled || declined) && ['PENDING', 'PAID'].includes(attempt.order.status))) {
    const result = await transitionOrder({ orderId: attempt.orderId, lojaID: attempt.order.lojaID,
      newStatus: paid ? 'PAID' : 'CANCELLED', performedById: 'ASAAS_GATEWAY', actor: { type: 'SYSTEM', code: 'PAYMENT_RECONCILIATION' },
      expectedVersion: attempt.order.version, paidAt: now }, tx);
    if (!result.success) throw new Error('PAYMENT_COMMERCIAL_APPLICATION_RETRY');
  }
  if (refunded && ['SHIPPED', 'DELIVERED'].includes(attempt.order.status)) {
    if (attempt.order.userID) await refundOrderPoints({ lojaID: attempt.order.lojaID, orderId: attempt.orderId, reason: 'Estorno integral conciliado; estoque aguarda retorno físico.' }, tx);
    await markPaymentReview(tx, attemptId, 'PHYSICAL_RETURN_REQUIRED');
    // A financial refund does not prove that physical inventory returned.
    return { review: true, state: next };
  }
  if (paid) {
    const effectKey = 'payment-confirmation:' + attempt.orderId;
    await tx.commerceOutbox.upsert({ where: { effectKey }, create: { effectKey, commandType: 'PAYMENT_CONFIRMATION_EMAIL', aggregateId: attempt.orderId,
      payload: { schemaVersion: 1, orderId: attempt.orderId, paidAt: now.toISOString() } }, update: {} });
  }
  if (['CANCEL_PENDING','REFUND_PENDING'].includes(next) && attempt.reviewAfter && attempt.reviewAfter <= now) {
    await markPaymentReview(tx, attemptId, 'PAYMENT_REVERSAL_OVERDUE'); return { review: true, state: next };
  }
  if (!['CANCEL_PENDING','REFUND_PENDING'].includes(next)) await tx.commerceOutbox.updateMany({ where: { aggregateId: attempt.orderId,
    commandType: 'PAYMENT_REVIEW', status: { in: ['READY','DEAD_LETTER'] } }, data: { status: 'COMPLETED', completedAt: now, lastErrorCode: null } });
  return { review: false, state: next };
}
