import { describe, it, expect, afterEach, vi } from 'vitest';
import { checkoutHash, guestCheckoutAccess } from '@/lib/commerce/checkout-content';
import { purchaseResultFromOrder } from '@/lib/commerce/purchase-result';
import { requestFingerprint } from '@/services/checkout-intent.service';
import { completeCheckoutSchema } from '@/lib/validators/checkout.validators';
import type { CreateOrderParams } from '@/services/checkout.service';
const input: CreateOrderParams = { lojaID: 'store', customer: { name: 'Cliente', email: 'cliente@example.invalid', phone: '11999999999' },
  items: [{ productId: 'product', variantId: 'variant', quantity: 1 }], deliveryType: 'PICKUP', paymentMethod: 'WHATSAPP_PIX' };
const order = (overrides: Record<string, unknown> = {}) => ({ id: 'order', orderNumber: 1, lojaID: 'store', checkoutIntentID: 'intent', sourceCartID: 'cart',
  userID: 'user', status: 'PENDING', version: 0, paymentMethod: 'WHATSAPP_PIX', total: 100, subtotal: 100, financialTotal: 100,
  financingCharge: 0, freightValue: null, shippingCost: 0, shippingProvider: 'STORE_PICKUP', shippingServiceName: 'Retirada', shippingEstimatedDays: 0,
  pixKeyUsed: 'manual-key', asaasPaymentId: 'provider-id', asaasDueDate: new Date('2030-01-01'), asaasBankSlipUrl: 'https://example.invalid/boleto',
  financialSnapshot: { schemaVersion: 1, manualInstructions: { pixKey: 'manual-key', whatsappNumber: '11999999999' } },
  asaasDigitableLine: 'line', asaasBarCode: 'barcode', creditCardBrand: 'VISA', creditCardLast4: '0366', installments: 1, installmentValue: 100,
  pointsEarned: 0, pointsRedeemed: 0, pointsDiscountValue: 0, deliveryType: 'PICKUP', buyer: { name: 'Cliente', phone: '11999999999' }, user: null,
  items: [{ id: 'item', productId: 'product', productVariantsId: 'variant', name: 'Produto', quantity: 1, price: 100, color: 'Padrão', size: 'Único' }],
  paymentAttempts: [{ number: 1, status: 'NOT_STARTED', installments: 1, charges: [] }], ...overrides }) as unknown as Parameters<typeof purchaseResultFromOrder>[0];
afterEach(() => vi.unstubAllEnvs());
describe('WF-13: stable content, recovery capabilities and persisted result states', () => {
  it('hash is stable after JSON persistence, including dates and reordered keys', () => {
    const value = { b: 2, a: { date: new Date('2030-01-01'), optional: undefined }, rows: [2, 1] };
    expect(checkoutHash(value)).toBe(checkoutHash(JSON.parse(JSON.stringify(value))));
    expect(checkoutHash({ a: 1, b: 2 })).toBe(checkoutHash({ b: 2, a: 1 }));
    expect(checkoutHash([1, 2])).not.toBe(checkoutHash([2, 1]));
  });
  it('transport keys, browser prices and PAN/CVV cannot identify a purchase', () => {
    const card = { holderName: 'Cliente', number: '4532015112830366', expiryMonth: '12', expiryYear: '2030', ccv: '123' };
    expect(requestFingerprint({ ...input, idempotencyKey: 'first', creditCard: card, items: [{ ...input.items[0], price: 1 }] }))
      .toBe(requestFingerprint({ ...input, idempotencyKey: 'second', creditCard: { ...card, number: '4111111111111111', ccv: '999' }, items: [{ ...input.items[0], price: 999 }] }));
    expect(requestFingerprint({ ...input, items: [{ ...input.items[0], quantity: 2 }] })).not.toBe(requestFingerprint(input));
  });
  it('combines duplicate line quantities and ignores line insertion order', () => {
    expect(requestFingerprint({ ...input, items: [input.items[0], input.items[0]] }))
      .toBe(requestFingerprint({ ...input, items: [{ ...input.items[0], quantity: 2 }] }));
  });
  it('guest capability survives authorized replay, differs by owner/intent and uses a private production secret', () => {
    vi.stubEnv('FREIGHT_QUOTE_SECRET', 'fixture-secret-over-32-characters-long');
    const access = guestCheckoutAccess('g:owner', 'intent');
    expect(access.token).toMatch(/^[a-zA-Z0-9_-]{43}$/); expect(access.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(guestCheckoutAccess('g:owner', 'intent')).toEqual(access);
    expect(guestCheckoutAccess('g:other', 'intent').token).not.toBe(access.token);
    expect(guestCheckoutAccess('g:owner', 'other').token).not.toBe(access.token);
    vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('FREIGHT_QUOTE_SECRET', '');
    expect(() => guestCheckoutAccess('g:owner', 'intent')).toThrow('FREIGHT_QUOTE_SECRET_MISSING');
  });
  it.each([
    ['SUBMITTING', 'processing'], ['UNKNOWN', 'processing'], ['DECLINED', 'declined'], ['CANCELLED', 'cancelled'],
    ['REFUNDED', 'cancelled'], ['NOT_STARTED', 'review'], ['APPROVED', 'processing'],
  ])('remote attempt %s has truthful kind %s without fictitious instructions', (status, kind) => {
    const result = purchaseResultFromOrder(order({ paymentMethod: 'PIX', paymentAttempts: [{ status, installments: 1, charges: [] }] }));
    expect(result.kind).toBe(kind); expect(result.order.pixKey).toBeNull(); expect(result.order.pixPayload).toBeNull();
  });
  it('manual approval/cancellation cannot be replayed as a new manual payment', () => {
    expect(purchaseResultFromOrder(order()).kind).toBe('manual');
    for (const status of ['PAID', 'CANCELLED']) {
      const result = purchaseResultFromOrder(order({ status })); expect(result.order.pixKey).toBeNull();
      expect(result.kind).toBe(status === 'PAID' ? 'approved' : 'cancelled');
    }
  });
  it('reads persisted PIX instructions only for an actionable pending charge', () => {
    const result = purchaseResultFromOrder(order({ paymentMethod: 'PIX', paymentAttempts: [{ status: 'PENDING', installments: 1,
      charges: [{ instructions: { pixPayload: 'persisted-payload', pixQrCodeBase64: 'persisted-qr' } }] }] }));
    expect(result).toMatchObject({ kind: 'action_required', order: { pixPayload: 'persisted-payload', pixQrCode: 'persisted-qr', items: [{ variantId: 'variant' }] } });
    const missing = purchaseResultFromOrder(order({ paymentMethod: 'PIX', paymentAttempts: [{ status: 'PENDING', installments: 1, charges: [{ instructions: {} }] }] }));
    expect(missing.kind).toBe('review'); expect(missing.order.pixPayload).toBeNull();
  });
  it('pending card processing is not payment approval or another payment instruction', () => {
    const result = purchaseResultFromOrder(order({ paymentMethod: 'CREDIT_CARD', paymentAttempts: [{ status: 'PENDING', installments: 1, charges: [{}] }] }));
    expect(result.kind).toBe('processing'); expect(result.order.asaasPaymentId).toBeNull();
  });
  it('completion wire contract requires exact consent and rejects a historical free-form purchase', () => {
    expect(completeCheckoutSchema.safeParse(input).success).toBe(false);
    const consent = { checkoutIntentID: '11111111-1111-4111-8111-111111111111', acceptedRevision: 1, acceptedContentHash: 'a'.repeat(64) };
    expect(completeCheckoutSchema.safeParse(consent).success).toBe(true);
    expect(completeCheckoutSchema.safeParse({ ...consent, items: input.items }).success).toBe(false);
    expect(completeCheckoutSchema.safeParse({ ...consent, acceptedRevision: 1.5 }).success).toBe(false);
  });
});
