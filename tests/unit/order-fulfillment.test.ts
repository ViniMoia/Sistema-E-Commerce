import { describe, expect, it } from 'vitest';
import { allowedOrderActions, normalizeTracking, fulfillmentPaymentError } from '@/lib/commerce/order-fulfillment';
const order = { status: 'PAID' as const, deliveryType: 'DELIVERY', shippingProvider: 'CORREIOS', financialPlan: {}, paymentMethod: 'WHATSAPP_PIX', checkoutIntentID: 'intent' };
const approved = { status: 'APPROVED', provider: 'MANUAL', failureCode: null };
describe('WF-16: modality, financial evidence and carrier tracking contract', () => {
  it.each(['PICKUP', 'NONE'])('offers direct completion and never shipping for %s', deliveryType => {
    expect(allowedOrderActions({ ...order, deliveryType }, approved, 'ADMIN').statuses).toEqual(['DELIVERED', 'CANCELLED']);
    expect(allowedOrderActions({ ...order, deliveryType }, approved, 'CUSTOMER').statuses).toEqual(['DELIVERED']);
  });
  it('delivery has no direct completion and customer cannot act before shipping', () => {
    expect(allowedOrderActions(order, approved, 'ADMIN').statuses).toEqual(['SHIPPED', 'CANCELLED']);
    expect(allowedOrderActions(order, approved, 'CUSTOMER').statuses).toEqual([]);
  });
  it.each(['UNKNOWN', 'SUBMITTING', 'REFUND_PENDING', 'REFUNDED'])('financial %s suspends physical fulfillment', status => {
    expect(allowedOrderActions(order, { ...approved, status }, 'ADMIN').statuses).not.toContain('SHIPPED');
    expect(allowedOrderActions(order, { ...approved, status }, 'ADMIN').tracking.editable).toBe(false);
  });
  it('approved with a review flag cannot ship or complete', () => {
    expect(fulfillmentPaymentError(order, 'SHIPPED', 'USER', { ...approved, failureCode: 'PAYMENT_MISMATCH' })).toBe('PAYMENT_RECONCILIATION_REQUIRED');
  });
  it('preserves generic carrier case and normalizes only postal case', () => {
    expect(normalizeTracking(order, ' aa123456789br ')).toEqual({ success: true, value: 'AA123456789BR' });
    expect(normalizeTracking({ ...order, shippingProvider: 'LOCAL_TABLE' }, ' Abc-123 ')).toEqual({ success: true, value: 'Abc-123' });
  });
  it.each(['bad', 'AA12345678BR', 'AA123456789BR\nXX'])('rejects malformed postal code %s', code => {
    expect(normalizeTracking(order, code).success).toBe(false);
  });
  it.each(['PICKUP', 'NONE'])('never invents or accepts a tracking code for %s', deliveryType => {
    expect(normalizeTracking({ ...order, deliveryType }, 'AA123456789BR').success).toBe(false);
    expect(allowedOrderActions({ ...order, deliveryType }, approved, 'ADMIN').tracking).toMatchObject({ applicable: false, required: false, editable: false });
  });
  it('legacy unknown and local carriers do not acquire fictitious postal requirements', () => {
    for (const shippingProvider of [null, 'LOCAL_TABLE', 'OTHER']) expect(allowedOrderActions({ ...order, shippingProvider }, approved, 'ADMIN').tracking.required).toBe(false);
  });
});
