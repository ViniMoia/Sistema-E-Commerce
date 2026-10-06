import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { buyerSelect, orderCustomer, snapshotDeliveryAddress } from './order-buyer';
import type { CreateOrderResult } from '@/services/checkout.service';
export const purchaseInclude = { buyer: { select: { ...buyerSelect, recoveryExpiresAt: true, recoveryTokenHash: true } },
  user: { select: { name: true, phone: true, cpfCnpj: true } }, items: true,
  checkoutIntent: { select: { cartVersion: true } },
  paymentAttempts: { orderBy: { number: 'desc' as const }, take: 1, include: { charges: { orderBy: { ordinal: 'asc' as const } } } } };
type PersistedPurchase = Prisma.OrderGetPayload<{ include: typeof purchaseInclude }>;

/** One DTO for initial completion, transport replay and authorized recovery.
 * An issued charge is actionable; SUBMITTING/UNKNOWN never fabricate PIX. */
export function purchaseResultFromOrder(order: PersistedPurchase, orderAccessToken?: string, now = new Date()): CreateOrderResult {
  const attempt = order.paymentAttempts[0];
  const approved = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'].includes(order.status);
  const terminal = order.status === 'CANCELLED' || ['CANCELLED', 'REFUNDED'].includes(attempt?.status ?? '');
  const proof = attempt?.status === 'APPROVED';
  const complete = !!attempt && attempt.charges.length === attempt.installments;
  const manual = z.object({ pixKey: z.string().min(1), whatsappNumber: z.string().min(1) }).safeParse(
    (order.financialSnapshot as { manualInstructions?: unknown } | null)?.manualInstructions);
  const saved = attempt?.charges[0]?.instructions as Record<string, string> | null;
  const actionable = order.paymentMethod === 'PIX' ? !!saved?.pixPayload && !!saved?.pixQrCodeBase64 :
    order.paymentMethod === 'BOLETO' ? !!order.asaasBankSlipUrl && !!order.asaasDigitableLine && !!order.asaasDueDate : false;
  const needsReview = /REVIEW|MISMATCH|CONFLICT|LATE_PAYMENT|OVERDUE|PHYSICAL_RETURN/.test(attempt?.failureCode ?? '');
  const deadline = attempt?.externalExpiresAt ?? attempt?.reservationExpiresAt;
  const expired = !!deadline && deadline <= now && ['NOT_STARTED','PENDING'].includes(attempt?.status ?? '') && order.status === 'PENDING';
  const state: NonNullable<CreateOrderResult['paymentState']> = needsReview ? 'REVIEW' : terminal ? 'CANCELLED' :
    attempt?.status === 'DECLINED' ? 'DECLINED' : approved && (order.paymentMethod === 'WHATSAPP_PIX' || proof) ? 'APPROVED' :
    expired ? 'PROCESSING' : order.status === 'PENDING' && order.paymentMethod === 'WHATSAPP_PIX' && attempt?.status === 'NOT_STARTED' && manual.success ? 'MANUAL' :
    order.status === 'PENDING' && attempt?.status === 'PENDING' && complete && actionable ? 'ISSUED' :
    ['SUBMITTING', 'UNKNOWN', 'CANCEL_PENDING', 'REFUND_PENDING'].includes(attempt?.status ?? '') || (proof && !approved) ||
      (order.paymentMethod === 'CREDIT_CARD' && attempt?.status === 'PENDING') ? 'PROCESSING' : 'REVIEW';
  const kind = ({ APPROVED: 'approved', CANCELLED: 'cancelled', DECLINED: 'declined', MANUAL: 'manual',
    ISSUED: 'action_required', PROCESSING: 'processing', REVIEW: 'review' } as const)[state];
  const instructions = state === 'ISSUED' ? attempt?.charges[0]?.instructions as Record<string, string> | null : null;
  const customer = orderCustomer(order); const address = snapshotDeliveryAddress(order.buyer);
  return { success: true, kind, paymentState: state, financialState: attempt?.status, order: { id: order.id, status: order.status, version: order.version,
    financialState: attempt?.status, paymentExpiresAt: (attempt?.externalExpiresAt ?? attempt?.reservationExpiresAt)?.toISOString() ?? null,
    checkoutIntentID: order.checkoutIntentID ?? undefined, sourceCartID: order.sourceCartID,
    sourceCartVersion: order.checkoutIntent?.cartVersion ?? null, serverTime: now.toISOString(),
    allowedActions: state === 'MANUAL' ? ['CONTACT_MANUAL'] : state === 'ISSUED' ? [order.paymentMethod === 'PIX' ? 'PAY_PIX' : 'PAY_BOLETO'] : [],
    orderAccessToken, orderNumber: order.orderNumber,
    paymentState: state, paymentMethod: order.paymentMethod, financialTotal: Number(order.financialTotal ?? order.total),
    financingCharge: Number(order.financingCharge ?? 0), total: Number(order.total), subtotal: Number(order.subtotal),
    freightValue: order.freightValue === null ? null : Number(order.freightValue), shippingCost: Number(order.shippingCost),
    shippingProvider: order.shippingProvider, shippingServiceName: order.shippingServiceName, shippingEstimatedDays: order.shippingEstimatedDays,
    pixKey: state === 'MANUAL' && manual.success ? manual.data.pixKey : null,
    whatsappNumber: state === 'MANUAL' && manual.success ? manual.data.whatsappNumber : null,
    asaasPaymentId: ['ISSUED', 'APPROVED'].includes(state) ? order.asaasPaymentId : null,
    pixQrCode: instructions?.pixQrCodeBase64 ?? null, pixPayload: instructions?.pixPayload ?? null,
    creditCardBrand: ['ISSUED', 'APPROVED'].includes(state) ? order.creditCardBrand : null,
    creditCardLast4: ['ISSUED', 'APPROVED'].includes(state) ? order.creditCardLast4 : null,
    installments: order.installments, installmentValue: order.installmentValue === null ? null : Number(order.installmentValue),
    asaasBankSlipUrl: state === 'ISSUED' ? order.asaasBankSlipUrl : null,
    asaasDigitableLine: state === 'ISSUED' ? order.asaasDigitableLine : null,
    asaasBarCode: state === 'ISSUED' ? order.asaasBarCode : null,
    asaasDueDate: state === 'ISSUED' ? order.asaasDueDate?.toISOString() ?? null : null,
    pointsEarned: order.pointsEarned, pointsRedeemed: order.pointsRedeemed, pointsDiscountValue: Number(order.pointsDiscountValue),
    customer: { name: customer.name, phone: customer.phone ?? '', cpfCnpj: customer.cpfCnpj },
    items: order.items.map(i => ({ productId: i.productId ?? undefined, variantId: i.productVariantsId ?? undefined,
      name: i.name, quantity: i.quantity, price: Number(i.price), color: i.color ?? undefined, size: i.size ?? undefined })),
    address: address ?? undefined, deliveryType: order.deliveryType } };
}
