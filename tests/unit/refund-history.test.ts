import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseRefundHistory, refundHistoryReview } from '@/services/payment/refund-history';
import { AsaasClient, asaasClient } from '@/services/asaas/asaas.client';
import { AsaasPaymentAdapter } from '@/services/asaas/asaas.adapter';
import type { AsaasPaymentResponse } from '@/types/asaas.types';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const cancelled = { status: 'CANCELLED', value: 49.9 };
const history = (rows: unknown[]) => parseRefundHistory({ data: rows, hasMore: false });
describe('refund history evidence and read-only transport', () => {
  it('keeps only financial fields from a complete response', () => {
    expect(history([{ ...cancelled, description: 'private', transactionReceiptUrl: 'private' }]))
      .toEqual({ complete: true, records: [cancelled] });
    expect(parseRefundHistory([cancelled])).toEqual(history([cancelled]));
  });
  it.each([null, {}, { data: [cancelled] }, { data: [cancelled], hasMore: true },
    { data: [{ status: 'OTHER', value: 49.9 }], hasMore: false },
    { data: [{ ...cancelled, value: '49.90' }], hasMore: false },
    { data: [{ ...cancelled, value: 0 }], hasMore: false },
    { data: [{ ...cancelled, value: 49.901 }], hasMore: false },
    { data: [{ ...cancelled, value: 49.900000001 }], hasMore: false },
    Array.from({ length: 101 }, () => cancelled),
  ])('does not infer success or absence from malformed/incomplete history %#', raw => {
    expect(parseRefundHistory(raw)).toEqual({ complete: false, records: [] });
    expect(refundHistoryReview(parseRefundHistory(raw), 'RECEIVED', 49.9, true)).toBe('PAYMENT_REFUND_HISTORY_REVIEW');
  });
  it('distinguishes cancelled, authorization and pending without proof of refund', () => {
    expect(refundHistoryReview(history([cancelled]), 'RECEIVED', 49.9, true)).toBe('PAYMENT_REFUND_CANCELLED_REVIEW');
    expect(refundHistoryReview(history([{ ...cancelled, status: 'AWAITING_CRITICAL_ACTION_AUTHORIZATION' }]), 'RECEIVED', 49.9, true))
      .toBe('PAYMENT_REFUND_AUTHORIZATION_REVIEW');
    expect(refundHistoryReview(history([{ ...cancelled, status: 'PENDING' }]), 'RECEIVED', 49.9, true)).toBeNull();
  });
  it('allows only an empty history before dispatch and escalates missing submitted evidence', () => {
    expect(refundHistoryReview(history([]), 'RECEIVED', 49.9, false)).toBeNull();
    expect(refundHistoryReview(history([]), 'RECEIVED', 49.9, true)).toBe('PAYMENT_REFUND_HISTORY_REVIEW');
    expect(refundHistoryReview(history([{ ...cancelled, status: 'PENDING' }]), 'RECEIVED', 49.9, false)).toBe('PAYMENT_REFUND_HISTORY_REVIEW');
  });
  it('requires full DONE value and REFUNDED charge, ignoring cancelled amounts', () => {
    const done = { ...cancelled, status: 'DONE' };
    expect(refundHistoryReview(history([done]), 'REFUNDED', 49.9, true)).toBeNull();
    expect(refundHistoryReview(history([cancelled, done]), 'REFUNDED', 49.9, true)).toBeNull();
    for (const [rows, status] of [[[done], 'RECEIVED'], [[cancelled], 'REFUNDED'],
      [[{ ...done, value: 20 }], 'REFUNDED'], [[done, done], 'REFUNDED'],
      [[done, { ...done, status: 'PENDING' }], 'REFUNDED'],
      [[cancelled, { ...done, status: 'PENDING' }], 'RECEIVED']] as const) {
      expect(refundHistoryReview(history([...rows]), status, 49.9, true)).toBe('PAYMENT_REFUND_HISTORY_REVIEW');
    }
  });
  it('uses only one bounded GET for refund history', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [cancelled], hasMore: false }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    const client = new AsaasClient('https://api-sandbox.asaas.com/v3', 'fixture');
    expect(await client.listPaymentRefunds('pay/fixture')).toEqual({ data: [cancelled], hasMore: false });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe('https://api-sandbox.asaas.com/v3/payments/pay%2Ffixture/refunds?limit=100&offset=0');
    expect(fetcher.mock.calls[0][1].body).toBeUndefined();
    expect(fetcher.mock.calls[0][1].method ?? 'GET').toBe('GET');
  });
  it('adapter scopes lookup to requested known charge and treats unavailable history as incomplete', async () => {
    const payment = { id: 'pay_fixture', externalReference: 'order_fixture', billingType: 'PIX', value: 49.9, status: 'RECEIVED', dueDate: '2026-10-10' } as AsaasPaymentResponse;
    const listed = vi.spyOn(asaasClient, 'listPaymentsByReference').mockResolvedValue([payment]);
    const lookup = vi.spyOn(asaasClient, 'listPaymentRefunds').mockResolvedValue({ data: [cancelled], hasMore: false });
    const adapter = new AsaasPaymentAdapter();
    const input = { externalReference: 'order_fixture', paymentIds: ['pay_fixture'], method: 'PIX' as const, installments: 1 };
    await adapter.inspectAttempt(input); expect(lookup).not.toHaveBeenCalled();
    expect((await adapter.inspectAttempt({ ...input, refundPaymentIds: ['pay_fixture'] })).charges[0].refundHistory).toEqual(history([cancelled]));
    lookup.mockRejectedValueOnce(new Error('transport/private message'));
    expect((await adapter.inspectAttempt({ ...input, refundPaymentIds: ['pay_fixture'] })).charges[0].refundHistory).toEqual({ complete: false, records: [] });
    lookup.mockClear(); listed.mockResolvedValue([{ ...payment, externalReference: 'wrong' }]);
    await expect(adapter.inspectAttempt({ ...input, refundPaymentIds: ['pay_fixture'] })).rejects.toThrow('PAYMENT_CORRELATION_CONFLICT');
    expect(lookup).not.toHaveBeenCalled();
  });
});
