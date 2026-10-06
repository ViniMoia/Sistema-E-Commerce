import { isValidTransition, type OrderStatus } from '@/lib/order-transitions';

type FulfillmentOrder = {
  status: OrderStatus; deliveryType: string; shippingProvider: string | null;
  checkoutIntentID: string | null; financialPlan: unknown; paymentMethod: string | null;
};
type Attempt = { status: string; provider: string; failureCode: string | null } | null;
const review = /REVIEW|MISMATCH|CONFLICT|LATE_PAYMENT|PHYSICAL_RETURN/;

/** Uses persisted order/payment evidence; never accepts modality/provider from the browser. */
export function fulfillmentPaymentError(order: FulfillmentOrder, next: OrderStatus, actor: 'USER' | 'SYSTEM', attempt: Attempt): string | null {
  // Historical status/item links do not prove a payment or an inventory debit.
  // Keep ownership reads and acknowledgement of an existing physical delivery,
  // but do not approve, ship or manufacture restitution during migration.
  if (!order.checkoutIntentID && ['PAID','SHIPPED','CANCELLED'].includes(next)) return 'LEGACY_ORDER_RECONCILIATION_REQUIRED';
  if (order.financialPlan && order.paymentMethod !== 'WHATSAPP_PIX') {
    if ((next === 'PAID' && attempt?.status !== 'APPROVED') ||
      (['SHIPPED', 'DELIVERED'].includes(next) && (attempt?.status !== 'APPROVED' || review.test(attempt?.failureCode ?? ''))) ||
      (next === 'CANCELLED' && (!attempt || !['DECLINED', 'CANCELLED', 'REFUNDED'].includes(attempt.status)))) return 'PAYMENT_RECONCILIATION_REQUIRED';
  }
  if (order.checkoutIntentID && order.paymentMethod === 'WHATSAPP_PIX') {
    if (!attempt || attempt.provider !== 'MANUAL') return 'PAYMENT_RECONCILIATION_REQUIRED';
    if (next === 'PAID' && (actor !== 'USER' || attempt.status !== 'NOT_STARTED')) return 'MANUAL_PAYMENT_CONFIRMATION_REQUIRED';
    if (['SHIPPED', 'DELIVERED'].includes(next) && (attempt.status !== 'APPROVED' || review.test(attempt.failureCode ?? ''))) return 'PAYMENT_RECONCILIATION_REQUIRED';
  }
  return null;
}

export function trackingPolicy(order: Pick<FulfillmentOrder, 'deliveryType' | 'shippingProvider'>) {
  const postal = order.shippingProvider?.trim().toUpperCase() === 'CORREIOS';
  return { provider: order.shippingProvider, applicable: order.deliveryType === 'DELIVERY',
    required: order.deliveryType === 'DELIVERY' && postal, format: postal ? 'CORREIOS' as const : 'GENERIC' as const };
}

export function normalizeTracking(order: Pick<FulfillmentOrder, 'deliveryType' | 'shippingProvider'>, value: string | null) {
  const policy = trackingPolicy(order);
  const trimmed = value?.trim() || null;
  if (!policy.applicable && trimmed) return { success: false as const, error: 'Retirada e modalidade sem frete não utilizam rastreamento.' };
  if (trimmed && (trimmed.length > 128 || /\s|[\u0000-\u001f\u007f]/u.test(trimmed))) return { success: false as const, error: 'Código de rastreamento inválido.' };
  if (policy.format === 'CORREIOS' && trimmed && !/^[A-Za-z]{2}\d{9}[A-Za-z]{2}$/.test(trimmed)) return { success: false as const, error: 'Informe um código válido dos Correios (duas letras, nove dígitos e duas letras).' };
  return { success: true as const, value: policy.format === 'CORREIOS' ? trimmed?.toUpperCase() ?? null : trimmed };
}

export function allowedOrderActions(order: FulfillmentOrder, attempt: Attempt, actor: 'ADMIN' | 'CUSTOMER') {
  const statuses: OrderStatus[] = ['PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
  return {
    statuses: statuses.filter(next => (actor === 'ADMIN' || next === 'DELIVERED') &&
      isValidTransition(order.status, next, order.deliveryType) && !fulfillmentPaymentError(order, next, 'USER', attempt)),
    tracking: { ...trackingPolicy(order), editable: actor === 'ADMIN' && order.deliveryType === 'DELIVERY' &&
      ['PAID', 'SHIPPED', 'DELIVERED'].includes(order.status) && !fulfillmentPaymentError(order, 'SHIPPED', 'USER', attempt) },
  };
}
