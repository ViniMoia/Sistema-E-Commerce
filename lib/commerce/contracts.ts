// Shared, versioned wire contracts. No Prisma, database, credentials or server
// environment imports: clients may validate a response without bundling them.
import { z } from 'zod';

export const commerceIdSchema = z.string().min(1).max(128).refine(value => value.trim() === value);
export const moneySchema = z.string().regex(/^(0|[1-9]\d{0,7})\.\d{2}$/, 'Valor monetário deve ser decimal canônico com duas casas.');
export const canonicalItemSchema = z.object({
  productId: commerceIdSchema, variantId: commerceIdSchema,
  quantity: z.number().int().positive().max(2147483647),
}).strict();
export const commerceActorSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('USER'), userId: commerceIdSchema, lojaID: commerceIdSchema }).strict(),
  z.object({ type: z.literal('SYSTEM'), code: z.enum([
    'ASAAS_WEBHOOK', 'PAYMENT_RECONCILIATION', 'ORDER_TIMEOUT', 'LOYALTY_EXPIRATION', 'ERP_SYNC',
    'PAYMENT_GATEWAY', 'CHECKOUT_COMPENSATION',
  ]) }).strict(),
]);
// This is a trusted context, constructed by the server after session/tenant
// resolution. It must not be accepted as part of a public request body.
export const purchaseContextSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('AUTHENTICATED'), lojaID: commerceIdSchema, userId: commerceIdSchema }).strict(),
  z.object({ kind: z.literal('GUEST'), lojaID: commerceIdSchema, guestIdentityHash: z.string().regex(/^[0-9a-f]{64}$/) }).strict(),
]);
export const paymentStates = ['NOT_STARTED', 'SUBMITTING', 'UNKNOWN', 'PENDING', 'APPROVED',
  'DECLINED', 'CANCEL_PENDING', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED'] as const;
export const paymentStateSchema = z.enum(paymentStates);
export const paymentMethodSchema = z.enum(['PIX', 'BOLETO', 'CREDIT_CARD', 'WHATSAPP_PIX']);
export const orderStatusSchema = z.enum(['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED']);
export const deliveryTypeSchema = z.enum(['DELIVERY', 'PICKUP', 'NONE']);
export const freightQuoteSchema = z.object({
  schemaVersion: z.literal(1), id: commerceIdSchema, lojaID: commerceIdSchema,
  configurationVersion: z.number().int().nonnegative(), deliveryType: deliveryTypeSchema,
  provider: z.string().min(1).max(32), serviceName: z.string().min(1).max(120),
  amount: moneySchema, estimatedDays: z.number().int().nonnegative(), expiresAt: z.string().datetime(),
}).strict(); // Private binding hashes and owner identity are not wire fields.

function cents(value: string): bigint { return BigInt(value.replace('.', '')); }
export const financialPlanSchema = z.object({
  schemaVersion: z.literal(1), policyVersion: z.number().int().nonnegative(),
  method: paymentMethodSchema, merchandiseSubtotal: moneySchema, loyaltyDiscount: moneySchema,
  shippingCost: moneySchema, financingCharge: moneySchema, commercialTotal: moneySchema,
  financialTotal: moneySchema, installments: z.array(moneySchema).min(1).max(12),
  loyaltyEarnBase: moneySchema, pointsEarned: z.number().int().nonnegative(),
}).strict().superRefine((plan, ctx) => {
  // Refinements do not run with invalid shapes; invalid money strings can still
  // reach here on an unsuccessful parse, so never convert them to BigInt.
  const monetary = [plan.merchandiseSubtotal, plan.loyaltyDiscount, plan.shippingCost,
    plan.financingCharge, plan.commercialTotal, plan.financialTotal, plan.loyaltyEarnBase, ...plan.installments];
  if (!monetary.every(value => moneySchema.safeParse(value).success)) return;
  const net = cents(plan.merchandiseSubtotal) - cents(plan.loyaltyDiscount);
  const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
  if (net < BigInt(0)) issue('loyaltyDiscount', 'Desconto excede o subtotal.');
  if (cents(plan.commercialTotal) !== net + cents(plan.shippingCost)) issue('commercialTotal', 'Total comercial incompatível.');
  if (cents(plan.financialTotal) !== cents(plan.commercialTotal) + cents(plan.financingCharge)) issue('financialTotal', 'Total financeiro incompatível.');
  if (plan.installments.reduce((sum, value) => sum + cents(value), BigInt(0)) !== cents(plan.financialTotal)) issue('installments', 'Parcelas não somam o total financeiro.');
  if (cents(plan.loyaltyEarnBase) !== net) issue('loyaltyEarnBase', 'Base de pontos deve excluir frete e encargos.');
  if (plan.method !== 'CREDIT_CARD' && plan.installments.length !== 1) issue('installments', 'Parcelamento habilitado somente para cartão.');
});

export const acceptedPurchaseSchema = z.object({
  schemaVersion: z.literal(1), intentId: commerceIdSchema, revision: z.number().int().nonnegative(),
  contentHash: z.string().regex(/^[0-9a-f]{64}$/), items: z.array(canonicalItemSchema).min(1),
  freightQuoteId: commerceIdSchema, deliveryType: deliveryTypeSchema, financialPlan: financialPlanSchema,
}).strict(); // No PAN/CVV, password, token de sessão or editable client prices.

const baseResult = {
  schemaVersion: z.literal(1), intentId: commerceIdSchema, orderId: commerceIdSchema,
  revision: z.number().int().nonnegative(), method: paymentMethodSchema,
  commercialTotal: moneySchema, financialTotal: moneySchema, replay: z.boolean(),
};
const instructionsSchema = z.object({
  invoiceUrl: z.string().url().optional(), bankSlipUrl: z.string().url().optional(),
  pixCopyPaste: z.string().optional(), pixQrCode: z.string().optional(),
  digitableLine: z.string().optional(), expiresAt: z.string().datetime().optional(),
}).strict();
export const purchaseResultSchema = z.discriminatedUnion('kind', [
  z.object({ ...baseResult, kind: z.literal('AWAITING_PAYMENT'), orderStatus: z.literal('PENDING'),
    paymentState: z.enum(['NOT_STARTED', 'SUBMITTING', 'UNKNOWN', 'PENDING', 'CANCEL_PENDING']),
    instructions: instructionsSchema.optional() }).strict(),
  z.object({ ...baseResult, kind: z.literal('CONFIRMED'), orderStatus: z.enum(['PAID', 'SHIPPED', 'DELIVERED']),
    paymentState: z.literal('APPROVED') }).strict(),
  z.object({ ...baseResult, kind: z.literal('CANCELLED'), orderStatus: z.literal('CANCELLED'),
    paymentState: z.enum(['NOT_STARTED', 'DECLINED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED']) }).strict(),
  z.object({ ...baseResult, kind: z.literal('REQUIRES_REVIEW'), orderStatus: orderStatusSchema,
    paymentState: paymentStateSchema, reasonCode: z.enum(['LATE_PAYMENT', 'INCONSISTENT_EXTERNAL_STATUS', 'RECONCILIATION_REQUIRED']) }).strict(),
]);
export const commerceFailureSchema = z.object({ schemaVersion: z.literal(1),
  code: z.enum(['NOT_AUTHORIZED', 'NOT_FOUND', 'VERSION_CONFLICT', 'IDEMPOTENCY_CONFLICT', 'REQUOTE_REQUIRED',
    'INSUFFICIENT_STOCK', 'PAYMENT_UNAVAILABLE', 'INVALID_TRANSITION', 'INVALID_INPUT']),
  retryable: z.boolean(),
}).strict();

export type CanonicalItem = z.infer<typeof canonicalItemSchema>;
export type CommerceActor = z.infer<typeof commerceActorSchema>;
export type PurchaseContext = z.infer<typeof purchaseContextSchema>;
export type FinancialPlan = z.infer<typeof financialPlanSchema>;
export type AcceptedPurchase = z.infer<typeof acceptedPurchaseSchema>;
export type PurchaseResult = z.infer<typeof purchaseResultSchema>;
export type PaymentState = z.infer<typeof paymentStateSchema>;
export type FreightQuoteDTO = z.infer<typeof freightQuoteSchema>;

const paymentTransitions: Record<PaymentState, readonly PaymentState[]> = {
  NOT_STARTED: ['SUBMITTING', 'CANCELLED'],
  SUBMITTING: ['UNKNOWN', 'PENDING', 'APPROVED', 'DECLINED'],
  UNKNOWN: ['PENDING', 'APPROVED', 'DECLINED', 'CANCELLED'],
  PENDING: ['APPROVED', 'DECLINED', 'CANCEL_PENDING'],
  APPROVED: ['REFUND_PENDING'],
  DECLINED: [],
  CANCEL_PENDING: ['CANCELLED', 'APPROVED', 'PENDING'],
  CANCELLED: [],
  REFUND_PENDING: ['REFUNDED', 'APPROVED'],
  REFUNDED: [],
};
// A permitted edge does not authorize an operation: the command must also
// validate actor, version and definitive provider facts. Late approval of a
// cancelled attempt is a new FinancialFact + review, not regression to APPROVED.
export function canTransitionPayment(current: PaymentState, next: PaymentState): boolean {
  return paymentTransitions[current]?.includes(next) ?? false;
}
