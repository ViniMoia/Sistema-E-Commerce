import { z } from 'zod';

export const chargebackPaymentStatuses = ['CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE', 'AWAITING_CHARGEBACK_REVERSAL'];
const token = z.string().regex(/^[A-Z0-9_]{1,96}$/);
const remoteSchema = z.object({ status: token, reason: token.optional(), id: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/).optional() });
export const chargebackSnapshotSchema = z.object({
  status: z.string(), reason: z.string().nullable(), id: z.string().nullable(), paymentStatus: z.string(),
  outcome: z.enum(['OPEN', 'AWAITING_FINANCIAL_RESULT', 'REVERSED', 'REFUNDED', 'UNRESOLVED']),
  review: z.boolean(),
});
export type ChargebackSnapshot = z.infer<typeof chargebackSnapshotSchema>;
export function savedChargeback(instructions: unknown): ChargebackSnapshot | null {
  const parsed = chargebackSnapshotSchema.safeParse((instructions as { chargeback?: unknown } | null)?.chargeback);
  return parsed.success ? parsed.data : null;
}

/** Provider status alone is not proof of a financial debit/credit. A current
 * REFUNDED payment is the documented terminal outcome for an accepted/lost
 * dispute; REVERSED additionally requires CONFIRMED/RECEIVED payment evidence. */
export function classifyChargeback(raw: unknown, paymentStatus: string, method: string, previous: ChargebackSnapshot | null, previousPaymentStatus?: string): ChargebackSnapshot | null {
  const special = chargebackPaymentStatuses.includes(paymentStatus);
  if (raw == null && !special && !previous) return null;
  const parsed = remoteSchema.safeParse(raw);
  const status = parsed.success ? parsed.data.status : special ? paymentStatus : 'UNRESOLVED';
  const result: ChargebackSnapshot = { status, reason: parsed.success ? parsed.data.reason ?? null : null,
    id: parsed.success ? parsed.data.id ?? null : previous?.id ?? null, paymentStatus, outcome: 'UNRESOLVED', review: true };
  if (method !== 'CREDIT_CARD') return result;
  if (raw == null && previous && paymentStatus === 'REFUNDED') return { ...result, outcome: 'REFUNDED', review: false };
  if (!parsed.success) return result;
  if (['REQUESTED','IN_DISPUTE'].includes(status)) return { ...result, outcome: 'OPEN' };
  if (status === 'REVERSED' && ['CONFIRMED','RECEIVED'].includes(paymentStatus) && previousPaymentStatus !== 'REFUNDED')
    return { ...result, outcome: 'REVERSED', review: false };
  if (['DISPUTE_LOST','DONE'].includes(status) && paymentStatus === 'REFUNDED')
    return { ...result, outcome: 'REFUNDED', review: false };
  if (['REVERSED','DISPUTE_LOST','DONE'].includes(status)) return { ...result, outcome: 'AWAITING_FINANCIAL_RESULT' };
  return result;
}
