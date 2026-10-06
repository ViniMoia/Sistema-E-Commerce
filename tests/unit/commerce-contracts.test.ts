import { describe, expect, it } from 'vitest';
import { acceptedPurchaseSchema, canonicalItemSchema, commerceActorSchema, financialPlanSchema,
  purchaseContextSchema, purchaseResultSchema, canTransitionPayment } from '@/lib/commerce/contracts';

const plan = { schemaVersion: 1, policyVersion: 0, method: 'CREDIT_CARD', merchandiseSubtotal: '100.00',
  loyaltyDiscount: '10.00', shippingCost: '5.00', financingCharge: '5.00', commercialTotal: '95.00',
  financialTotal: '100.00', installments: ['33.33', '33.33', '33.34'], loyaltyEarnBase: '90.00', pointsEarned: 45 };
const base = { schemaVersion: 1, intentId: 'intent', orderId: 'order', revision: 0,
  method: 'PIX', commercialTotal: '10.00', financialTotal: '10.00', replay: true };
describe('WF-04: fronteiras e estados financeiros', () => {
  it('aceita centavos e parcela residual sem float e exclui frete/juros da base de pontos', () => {
    expect(financialPlanSchema.parse(plan)).toEqual(plan);
  });
  it.each([
    { financialTotal: '99.99' }, { installments: ['33.33', '33.33', '33.33'] },
    { commercialTotal: '100.00' }, { loyaltyEarnBase: '100.00' },
    { loyaltyDiscount: '101.00' }, { method: 'BOLETO' },
    { merchandiseSubtotal: '1e2' }, { merchandiseSubtotal: Number.NaN },
  ])('recusa plano incoerente %j', change => {
    expect(financialPlanSchema.safeParse({ ...plan, ...change }).success).toBe(false);
  });
  it('item exige identidade da variante e quantidade inteira; preço externo não entra no comando', () => {
    const item = { productId: 'product', variantId: 'variant', quantity: 1 };
    expect(canonicalItemSchema.parse(item)).toEqual(item);
    for (const change of [{ variantId: undefined }, { quantity: 0 }, { quantity: 1.5 }, { price: 0.01 }]) {
      expect(canonicalItemSchema.safeParse({ ...item, ...change }).success).toBe(false);
    }
  });
  it('contexto convidado não vincula a conta por email ou ID declarado', () => {
    expect(purchaseContextSchema.safeParse({ kind: 'GUEST', lojaID: 'store', email: 'admin@example.test' }).success).toBe(false);
    expect(purchaseContextSchema.safeParse({ kind: 'GUEST', lojaID: 'store', guestIdentityHash: 'a'.repeat(64), userId: 'admin' }).success).toBe(false);
  });
  it('ator de sistema nunca é um User fictício', () => {
    expect(commerceActorSchema.parse({ type: 'SYSTEM', code: 'ASAAS_WEBHOOK' })).toEqual({ type: 'SYSTEM', code: 'ASAAS_WEBHOOK' });
    expect(commerceActorSchema.safeParse({ type: 'SYSTEM', code: 'ASAAS_WEBHOOK', userId: 'ASAAS_GATEWAY' }).success).toBe(false);
  });
  it('resultado incerto e pedido cancelado não podem ser apresentados como confirmados', () => {
    expect(purchaseResultSchema.parse({ ...base, kind: 'AWAITING_PAYMENT', orderStatus: 'PENDING', paymentState: 'UNKNOWN' }).kind).toBe('AWAITING_PAYMENT');
    for (const change of [{ orderStatus: 'CANCELLED', paymentState: 'APPROVED' }, { orderStatus: 'PAID', paymentState: 'UNKNOWN' }]) {
      expect(purchaseResultSchema.safeParse({ ...base, kind: 'CONFIRMED', ...change }).success).toBe(false);
    }
    expect(purchaseResultSchema.safeParse({ ...base, kind: 'CANCELLED', orderStatus: 'CANCELLED', paymentState: 'REFUND_PENDING' }).success).toBe(true);
  });
  it('pagamento incerto não volta para envio inicial, e estados terminais não regridem', () => {
    expect(canTransitionPayment('UNKNOWN', 'SUBMITTING')).toBe(false);
    expect(canTransitionPayment('UNKNOWN', 'NOT_STARTED')).toBe(false);
    expect(canTransitionPayment('UNKNOWN', 'APPROVED')).toBe(true);
    expect(canTransitionPayment('APPROVED', 'PENDING')).toBe(false);
    expect(canTransitionPayment('CANCELLED', 'APPROVED')).toBe(false);
    expect(canTransitionPayment('REFUNDED', 'REFUND_PENDING')).toBe(false);
  });
  it('snapshot persistível recusa material de cartão mesmo que os demais campos sejam válidos', () => {
    const accepted = { schemaVersion: 1, intentId: 'intent', revision: 0, contentHash: 'a'.repeat(64),
      items: [{ productId: 'product', variantId: 'variant', quantity: 1 }], freightQuoteId: 'quote', deliveryType: 'PICKUP', financialPlan: plan };
    expect(acceptedPurchaseSchema.safeParse(accepted).success).toBe(true);
    expect(acceptedPurchaseSchema.safeParse({ ...accepted, creditCard: { number: '4111111111111111', ccv: '123' } }).success).toBe(false);
  });
});
