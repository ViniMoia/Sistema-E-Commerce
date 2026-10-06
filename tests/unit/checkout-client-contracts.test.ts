import { describe, it, expect } from 'vitest';
import { AsyncRevision } from '@/lib/commerce/async-revision';
import { checkoutAddresses } from '@/lib/commerce/checkout-address';
import { freightClientRequestSchema, freightClientResponseSchema } from '@/lib/commerce/freight-contract';
import { purchaseClientSchema, purchaseView } from '@/lib/commerce/purchase-client';
const address = { state: 'SP', city: 'São Paulo', neighborhood: 'Centro', street: 'Rua', number: '1', cep: '01001-000' };
const order = () => purchaseClientSchema.parse({ id: 'o', checkoutIntentID: 'i', orderNumber: 1, status: 'PENDING', version: 0,
  paymentState: 'ISSUED', financialState: 'PENDING', allowedActions: ['PAY_PIX'], serverTime: '2026-10-05T12:00:00Z', paymentExpiresAt: '2026-10-05T12:30:00Z',
  paymentMethod: 'PIX', customer: { name: 'Cliente', phone: '' }, items: [], deliveryType: 'PICKUP', total: 100, financialTotal: 100, freightValue: null,
  pixPayload: 'copy', pixQrCode: 'qr', pixKey: null });
describe('WF-15 client contracts and boundaries', () => {
  it('invalidates a response even when transport ignores abort', () => { const gate = new AsyncRevision(), a = gate.begin(); const b = gate.begin(); expect(a.signal.aborted).toBe(true); expect(a.current()).toBe(false); expect(b.current()).toBe(true); gate.invalidate(); expect(b.current()).toBe(false); });
  it('freight request contains only identifiers/quantities and destination', () => { const request = freightClientRequestSchema.parse({ lojaID: 'l', deliveryType: 'DELIVERY', destinationCep: '01001000', items: [{ productId: 'p', variantId: 'v', quantity: 1, price: 0, weightInGrams: 1 }] }); expect(request.items[0]).toEqual({ productId: 'p', variantId: 'v', quantity: 1 }); });
  it('wrong quote envelope or unsigned option cannot authorize delivery', () => { expect(freightClientResponseSchema.safeParse({ success: true, options: [] }).success).toBe(false); expect(freightClientResponseSchema.safeParse({ success: true, data: { merchandiseSubtotal: '100.00', options: [{ price: 0 }] } }).success).toBe(false); });
  for (const deliveryType of ['PICKUP','NONE']) for (const paymentMethod of ['BOLETO','CREDIT_CARD']) {
    it(paymentMethod + '+' + deliveryType + ' uses billing without inventing shipping', () => { expect(checkoutAddresses({ deliveryType, paymentMethod, billingAddress: address })).toEqual({ shippingAddress: undefined, billingAddress: { ...address, cep: '01001000' } }); });
  }
  it('different shipping and billing are preserved; reuse must be explicit', () => {
    const billing = { ...address, number: '22' }; expect(checkoutAddresses({ deliveryType: 'DELIVERY', paymentMethod: 'BOLETO', shippingAddress: address, billingAddress: billing }).billingAddress?.number).toBe('22');
    expect(() => checkoutAddresses({ deliveryType: 'DELIVERY', paymentMethod: 'BOLETO', shippingAddress: address })).toThrow('BILLING');
    expect(checkoutAddresses({ deliveryType: 'DELIVERY', paymentMethod: 'BOLETO', shippingAddress: address, billingSameAsShipping: true }).billingAddress?.number).toBe('1');
  });
  it('legacy address is translated only in an unambiguous old draft', () => { expect(checkoutAddresses({ deliveryType: 'PICKUP', paymentMethod: 'BOLETO', address }).shippingAddress).toBeUndefined(); expect(() => checkoutAddresses({ deliveryType: 'PICKUP', paymentMethod: 'BOLETO', address, billingSameAsShipping: false })).toThrow('BILLING'); });
  it('invalid UF and shipping on pickup are rejected before reserve', () => { expect(() => checkoutAddresses({ deliveryType: 'PICKUP', paymentMethod: 'BOLETO', billingAddress: { ...address, state: 'ZZ' } })).toThrow(); expect(() => checkoutAddresses({ deliveryType: 'PICKUP', shippingAddress: address })).toThrow('SHIPPING'); });
  it('stale PIX data never overrides a cancelled commercial state', () => { const p = order(); p.status = 'CANCELLED'; p.paymentState = 'CANCELLED'; p.financialState = 'CANCELLED'; expect(purchaseView(p).canPayPix).toBe(false); });
  it('refund pending is visible on cancelled or previously approved orders', () => { const p = order(); p.status = 'CANCELLED'; p.paymentState = 'PROCESSING'; p.financialState = 'REFUND_PENDING'; expect(purchaseView(p)).toMatchObject({ kind: 'refund_pending', canPayPix: false }); });
  it('delivered refund is financially confirmed but requires physical review', () => { const p = order(); p.status = 'DELIVERED'; p.financialState = 'REFUNDED'; p.paymentState = 'REVIEW'; expect(purchaseView(p)).toMatchObject({ kind: 'refunded', canPayPix: false }); });
  it('expiry uses server time plus elapsed time instead of the browser calendar', () => { expect(purchaseView(order(), 30 * 60000)).toMatchObject({ kind: 'expired', canPayPix: false }); expect(purchaseView(order()).canPayPix).toBe(true); });
  it('authorization is necessary even when PIX or manual artefacts remain', () => { const p = order(); p.allowedActions = []; expect(purchaseView(p).canPayPix).toBe(false); p.paymentMethod = 'WHATSAPP_PIX'; p.paymentState = 'MANUAL'; p.financialState = 'NOT_STARTED'; p.pixKey = 'key'; p.whatsappNumber = 'number'; expect(purchaseView(p).canContact).toBe(false); });
  it('boleto without complete artefacts is not presented as issued', () => { const p = order(); p.paymentMethod = 'BOLETO'; p.allowedActions = ['PAY_BOLETO']; expect(purchaseView(p)).toMatchObject({ kind: 'processing', canPayBoleto: false }); });
  it('UNKNOWN, analysis and cancellation pending cannot display active instructions', () => { const p = order(); p.paymentState = 'PROCESSING'; for (const financialState of ['UNKNOWN','SUBMITTING','CANCEL_PENDING','PENDING'] as const) { p.financialState = financialState; expect(purchaseView(p).canPayPix).toBe(false); } });
});
