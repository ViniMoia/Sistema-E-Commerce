import { z } from 'zod';
import type { RemoteRefundHistory } from '@/types/payment-gateway.types';
import { moneyCents } from './installment.service';

const recordsSchema = z.array(z.object({
  status: z.enum(['DONE', 'PENDING', 'CANCELLED', 'AWAITING_CRITICAL_ACTION_AUTHORIZATION']),
  value: z.number().finite().positive().max(99999999.99).refine(value => /^(0|[1-9]\d{0,7})(\.\d{1,2})?$/.test(String(value))),
})).max(100);

// No receipt URLs, personal data or free-text provider messages enter evidence.
// An incomplete page is never interpreted as an empty or successful history.
export function parseRefundHistory(raw: unknown): RemoteRefundHistory {
  const wrapper = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
  const rows = Array.isArray(raw) ? raw : wrapper && wrapper.hasMore === false && Array.isArray(wrapper.data) ? wrapper.data : undefined;
  const result = recordsSchema.safeParse(rows);
  return result.success ? { complete: true, records: result.data } : { complete: false, records: [] };
}

// A cancelled history entry cannot establish which local command created it.
// Escalate rather than changing the paid order or authorizing another POST.
export function refundHistoryReview(history: RemoteRefundHistory, chargeStatus: string, amount: number, submitted: boolean): string | null {
  const parsed = recordsSchema.safeParse(history.records);
  if (history.complete !== true || !parsed.success) return 'PAYMENT_REFUND_HISTORY_REVIEW';
  const rows = parsed.data;
  const total = moneyCents(amount);
  if (rows.some(row => moneyCents(row.value) > total)) return 'PAYMENT_REFUND_HISTORY_REVIEW';
  const done = rows.filter(row => row.status === 'DONE').reduce((sum, row) => sum + moneyCents(row.value), BigInt(0));
  const active = rows.filter(row => ['PENDING', 'AWAITING_CRITICAL_ACTION_AUTHORIZATION'].includes(row.status));
  if (chargeStatus === 'REFUNDED' && done === total && active.length === 0) return null;
  if (done > 0 || chargeStatus === 'REFUNDED') return 'PAYMENT_REFUND_HISTORY_REVIEW';
  if (rows.length === 0) return submitted ? 'PAYMENT_REFUND_HISTORY_REVIEW' : null;
  if (rows.length !== 1 || moneyCents(rows[0].value) !== total) return 'PAYMENT_REFUND_HISTORY_REVIEW';
  if (rows[0].status === 'CANCELLED') return 'PAYMENT_REFUND_CANCELLED_REVIEW';
  if (!submitted) return 'PAYMENT_REFUND_HISTORY_REVIEW';
  if (rows[0].status === 'AWAITING_CRITICAL_ACTION_AUTHORIZATION') return 'PAYMENT_REFUND_AUTHORIZATION_REVIEW';
  return null;
}
