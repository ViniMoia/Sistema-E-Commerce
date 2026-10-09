import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { createFixtureStore, cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { createOrder } from '@/tests/setup/checkout-fixture';
import { processExpiredOrders } from '@/services/order-timeout.service';
import { reconcilePaymentAttempts } from '@/services/payment/payment-worker.service';
import type { PaymentGateway, PaymentMethod, RemoteCharge } from '@/types/payment-gateway.types';

let lojaID: string;
const latency = new AsyncLocalStorage<{ enabled: boolean; delayed: boolean }>();
beforeAll(() => {
  prisma.$use(async (params, next) => {
    const active = latency.getStore();
    if (active?.enabled && !active.delayed && params.runInTransaction && params.model === 'Order' && params.action === 'findUnique') {
      active.delayed = true;
      // Real PostgreSQL transaction remains open during a simulated slow DB round trip.
      await new Promise(resolve => setTimeout(resolve, 5500));
    }
    return next(params);
  });
});
beforeEach(async () => {
  await verifyTestDatabase();
  lojaID = await createFixtureStore();
  vi.stubEnv('INSTALLMENT_MONTHLY_RATE', '0'); vi.stubEnv('INSTALLMENT_ABSORB_FEES', 'false');
  await prisma.loja.update({ where: { id: lojaID }, data: {
    enablePix: true, enableBoleto: true, enableCreditCard: true, enablePickup: true, loyaltyEnabled: true, loyaltyEarnRate: 1,
  } });
});
afterEach(async () => {
  vi.unstubAllEnvs(); await cleanupFixtureStores(); await prisma.$disconnect();
});

function provider(initial: 'PENDING' | 'CONFIRMED' | 'AWAITING_RISK_ANALYSIS' = 'PENDING', overdueDays = 1) {
  const remote: RemoteCharge[] = [];
  const dueDate = new Date(Date.now() - overdueDays * 86400000).toISOString().slice(0, 10);
  const gateway: PaymentGateway = {
    capabilities: async () => ({ configured: true, methods: ['PIX', 'BOLETO', 'CREDIT_CARD'] as PaymentMethod[], maximumInstallments: 3 }),
    createPixCharge: vi.fn(async input => {
      const charge: RemoteCharge = { paymentId: randomUUID(), externalReference: input.orderId, method: 'PIX', ordinal: 1,
        value: input.value, status: initial, instructions: { pixPayload: 'l04-copy', pixQrCodeBase64: 'l04-qr', expiresAt: new Date(0).toISOString() } };
      remote.push(charge);
      const active = latency.getStore(); if (active) active.enabled = true;
      return { ...charge, status: initial, pixPayload: 'l04-copy', pixQrCodeBase64: 'l04-qr', expirationDate: charge.instructions!.expiresAt };
    }),
    createBoletoCharge: vi.fn(async input => {
      const charge: RemoteCharge = { paymentId: randomUUID(), externalReference: input.orderId, method: 'BOLETO', ordinal: 1,
        value: input.value, status: initial, dueAt: new Date(new Date(dueDate + 'T00:00:00-03:00').getTime() + 86400000).toISOString(),
        instructions: { bankSlipUrl: 'https://example.invalid/l04', digitableLine: 'fixture-line' } };
      remote.push(charge); return { ...charge, status: initial, bankSlipUrl: charge.instructions!.bankSlipUrl!, digitableLine: 'fixture-line', dueDate };
    }),
    createCreditCardCharge: vi.fn(async input => {
      const contractId = randomUUID(); const values = input.installmentCount === 3 ? [33.33, 33.33, 33.34] : [input.value];
      values.forEach((value, index) => remote.push({ paymentId: randomUUID(), externalReference: input.orderId,
        method: 'CREDIT_CARD', ordinal: index + 1, value, status: initial, contractId }));
      return { ...remote[0], value: input.value, status: initial, contractId, charges: remote, approvedForEntireContract: initial === 'CONFIRMED' };
    }),
    inspectAttempt: vi.fn(async () => ({ complete: true, charges: structuredClone(remote) })),
    cancelPayment: vi.fn(async id => { remote.find(c => c.paymentId === id)!.deleted = true; }),
    getPaymentStatus: async () => { throw new Error('Unexpected single-charge lookup'); },
  };
  return { gateway, remote };
}
async function purchase(method: PaymentMethod = 'PIX', port = provider(), installments = 1) {
  const buyer = await prisma.user.create({ data: { lojaID, name: 'L04 buyer', email: randomUUID() + '@example.invalid', password: '' } });
  const product = await prisma.product.create({ data: { lojaID, userID: buyer.id, name: 'L04 product', description: '', imageUrl: '', price: 100, stock: 5,
    productVariants: { create: { size: 'Único', color: 'Padrão', stock: 5 } } }, include: { productVariants: true } });
  const result = await createOrder({ lojaID, customer: { userId: buyer.id, name: buyer.name, email: buyer.email, phone: '11999999999', cpfCnpj: '52998224725' },
    items: [{ productId: product.id, variantId: product.productVariants[0].id, quantity: 1 }], deliveryType: 'PICKUP', paymentMethod: method, paymentGateway: port.gateway,
    ...(method !== 'PIX' ? { address: { cep: '01001000', state: 'SP', city: 'São Paulo', street: 'Rua', neighborhood: 'Centro', number: '1' } } : {}),
    ...(method === 'CREDIT_CARD' ? { installments, acceptedFinancialTotal: 100,
      creditCard: { holderName: 'FIXTURE', number: '4532015112830366', expiryMonth: '12', expiryYear: '2030', ccv: '123' } } : {}),
  });
  return { ...port, buyer, product, result };
}
type Purchase = Awaited<ReturnType<typeof purchase>>;
const stored = (p: Purchase) => prisma.order.findUniqueOrThrow({ where: { id: p.result.order.id },
  include: { paymentAttempts: { include: { operations: true, charges: true } }, reservations: true } });
async function reconcile(p: Purchase) {
  const attempt = (await stored(p)).paymentAttempts[0];
  await prisma.paymentAttempt.update({ where: { id: attempt.id }, data: { reconcileAfter: new Date(0) } });
  return reconcilePaymentAttempts(50, p.gateway);
}
async function inventory(p: Purchase, expected: number) {
  expect(await prisma.product.findUniqueOrThrow({ where: { id: p.product.id } })).toMatchObject({ stock: expected });
  expect(await prisma.productVariants.findUniqueOrThrow({ where: { id: p.product.productVariants[0].id } })).toMatchObject({ stock: expected });
}
async function approvedOnce(p: Purchase) {
  expect(await stored(p)).toMatchObject({ status: 'PAID', version: 1, paymentAttempts: [{ status: 'APPROVED' }], reservations: [{ status: 'COMMITTED' }] });
  await inventory(p, 4);
  expect(await prisma.loyaltyTransaction.count({ where: { orderId: p.result.order.id, type: 'EARN' } })).toBe(1);
  expect(await prisma.commerceOutbox.count({ where: { effectKey: 'payment-confirmation:' + p.result.order.id } })).toBe(1);
}

describe('L-04: persisted deadlines, payment lifecycle and slow evidence application', () => {
  it('checkout applies immediate approval atomically beyond the Prisma default transaction deadline', async () => {
    const p = await latency.run({ enabled: false, delayed: false }, () => purchase('PIX', provider('CONFIRMED')));
    expect(p.result.paymentState).toBe('APPROVED'); await approvedOnce(p);
    await reconcile(p); await approvedOnce(p);
    expect(p.gateway.createPixCharge).toHaveBeenCalledTimes(1);
  });

  it('expiry finding payment received applies approval once even with a slow database', async () => {
    const p = await purchase(); p.remote[0].status = 'RECEIVED';
    const result = await latency.run({ enabled: true, delayed: false }, () => processExpiredOrders({ lojaID, gateway: p.gateway }));
    expect(result).toMatchObject({ success: true, processedCount: 1, errorCount: 0, cancelledCount: 0 });
    await approvedOnce(p); await processExpiredOrders({ lojaID, gateway: p.gateway }); await approvedOnce(p);
    expect(p.gateway.cancelPayment).not.toHaveBeenCalled();
    expect(await prisma.financialFact.count({ where: { orderId: p.result.order.id, type: 'SETTLED' } })).toBe(1);
  });

  it('overdue boleto within the frozen confirmation grace period keeps stock reserved', async () => {
    const p = await purchase('BOLETO', provider('PENDING', 1)); p.remote[0].status = 'OVERDUE';
    const before = await stored(p);
    expect(before.paymentAttempts[0].planSnapshot).toMatchObject({ expiryPolicy: { boletoConfirmationGraceHours: 72 } });
    expect(before.paymentAttempts[0].reservationExpiresAt!.getTime()).toBeGreaterThan(Date.now());
    expect(await processExpiredOrders({ lojaID, gateway: p.gateway })).toMatchObject({ processedCount: 0, cancelledCount: 0 });
    expect(await stored(p)).toEqual(before); await inventory(p, 4);
    expect(p.gateway.inspectAttempt).not.toHaveBeenCalled(); expect(p.gateway.cancelPayment).not.toHaveBeenCalled();
  });

  it('boleto beyond its grace queues cancellation but returns stock only after remote proof', async () => {
    const p = await purchase('BOLETO', provider('PENDING', 5)); p.remote[0].status = 'OVERDUE';
    expect(await processExpiredOrders({ lojaID, gateway: p.gateway })).toMatchObject({ success: true, processedCount: 1, cancelledCount: 0 });
    expect(await stored(p)).toMatchObject({ status: 'PENDING', paymentAttempts: [{ status: 'CANCEL_PENDING', operations: [{ status: 'READY' }] }] });
    await inventory(p, 4); expect(p.gateway.cancelPayment).not.toHaveBeenCalled();
    await reconcile(p); expect(await stored(p)).toMatchObject({ status: 'CANCELLED', reservations: [{ status: 'RELEASED' }] });
    await reconcile(p); await inventory(p, 5); expect(p.gateway.cancelPayment).toHaveBeenCalledTimes(1);
  });

  it('card under risk analysis has no PIX expiration even when a stale deadline exists', async () => {
    const p = await purchase('CREDIT_CARD', provider('AWAITING_RISK_ANALYSIS'));
    const attempt = (await stored(p)).paymentAttempts[0];
    await prisma.paymentAttempt.update({ where: { id: attempt.id }, data: { reservationExpiresAt: new Date(0) } });
    expect(await processExpiredOrders({ lojaID, gateway: p.gateway })).toMatchObject({ processedCount: 0 });
    expect(await stored(p)).toMatchObject({ status: 'PENDING', reservations: [{ status: 'RESERVED' }] });
    await inventory(p, 4); expect(p.gateway.cancelPayment).not.toHaveBeenCalled();
  });

  it('refusal of the full three-charge card contract releases inventory once without approval email or earned points', async () => {
    const p = await purchase('CREDIT_CARD', provider(), 3); p.remote.forEach(c => { c.status = 'CREDIT_CARD_CAPTURE_REFUSED'; });
    await reconcile(p); await reconcile(p);
    expect(await stored(p)).toMatchObject({ status: 'CANCELLED', version: 1, paymentAttempts: [{ status: 'DECLINED' }], reservations: [{ status: 'RELEASED' }] });
    await inventory(p, 5);
    expect(await prisma.loyaltyTransaction.count({ where: { orderId: p.result.order.id } })).toBe(0);
    expect(await prisma.commerceOutbox.count({ where: { effectKey: 'payment-confirmation:' + p.result.order.id } })).toBe(0);
    expect(p.gateway.createCreditCardCharge).toHaveBeenCalledTimes(1); expect(p.gateway.cancelPayment).not.toHaveBeenCalled();
  });

  it('refund of one whole card installment records its amount and requires review without assuming a full refund or physical return', async () => {
    const p = await purchase('CREDIT_CARD', provider('CONFIRMED'), 3); await approvedOnce(p);
    p.remote[0].status = 'REFUNDED';
    expect(await reconcile(p)).toMatchObject({ review: 1 });
    expect(await stored(p)).toMatchObject({ status: 'PAID', paymentAttempts: [{ failureCode: 'PAYMENT_PARTIAL_REVERSAL_REVIEW' }] });
    const facts = await prisma.financialFact.findMany({ where: { orderId: p.result.order.id, type: 'REFUNDED' } });
    expect(facts).toHaveLength(1); expect(facts[0].amount.toFixed(2)).toBe('33.33');
    await reconcile(p); await inventory(p, 4);
    expect(await prisma.financialFact.count({ where: { orderId: p.result.order.id, type: 'REFUNDED' } })).toBe(1);
    expect(await prisma.loyaltyTransaction.count({ where: { orderId: p.result.order.id, type: 'REFUND_EARN' } })).toBe(0);
  });

  it('unimplemented chargeback evidence requires review and cannot create an invented refund or return inventory', async () => {
    const p = await purchase('CREDIT_CARD', provider('CONFIRMED')); await approvedOnce(p);
    p.remote[0].status = 'CHARGEBACK_REQUESTED';
    expect(await reconcile(p)).toMatchObject({ review: 1 });
    expect(await stored(p)).toMatchObject({ status: 'PAID', paymentAttempts: [{ failureCode: 'PAYMENT_EXTERNAL_STATE_REVIEW' }] });
    await inventory(p, 4);
    expect(await prisma.financialFact.count({ where: { orderId: p.result.order.id, type: 'REFUNDED' } })).toBe(0);
    expect(await prisma.loyaltyTransaction.count({ where: { orderId: p.result.order.id, type: 'REFUND_EARN' } })).toBe(0);
  });
});
