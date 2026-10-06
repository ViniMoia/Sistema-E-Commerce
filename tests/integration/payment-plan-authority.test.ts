import { randomUUID } from 'node:crypto';
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { createFixtureStore, cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { createOrder, type CreateOrderParams } from '@/tests/setup/checkout-fixture';
import { transitionOrder } from '@/lib/commerce/order-command';
import { adjustPointsManually, creditEarnedPoints } from '@/services/loyalty.service';
import { installmentPlan } from '@/services/payment/installment.service';
import { updateLojaSettings } from '@/services/loja.service';
import { get, post } from '@/tests/helpers/request';
import type { PaymentGateway, PaymentMethod } from '@/types/payment-gateway.types';
let lojaID: string; let adminID: string; let userID: string; let email: string; let productID: string; let variantID: string; let host: string;
const card = { holderName: 'CLIENTE FIXTURE', number: '4532015112830366', expiryMonth: '12', expiryYear: '2030', ccv: '123' };
const config = { installmentAbsorbFees: false, installmentMonthlyRate: 0, installmentMinValue: 20, installmentMaxCount: 12, boletoDueDays: 1, asaasMinValue: 5 };
function gateway(): PaymentGateway {
  return {
    capabilities: vi.fn(async () => ({ configured: true, methods: ['PIX', 'CREDIT_CARD', 'BOLETO'] as PaymentMethod[], maximumInstallments: 3 })),
    createPixCharge: vi.fn(async input => ({ paymentId: randomUUID(), value: input.value, status: 'PENDING', pixPayload: 'fixture-pix', pixQrCodeBase64: 'fixture-qr' })),
    createBoletoCharge: vi.fn(async input => ({ paymentId: randomUUID(), value: input.value, status: 'PENDING', bankSlipUrl: 'https://example.invalid/boleto', digitableLine: 'fixture-line', dueDate: '2030-10-05' })),
    createCreditCardCharge: vi.fn(async input => {
      const values = installmentPlan(input.value, input.installmentCount ?? 1, config).installments;
      const charges = values.map((value, index) => ({ paymentId: randomUUID(), ordinal: index + 1, value: Number(value), status: 'CONFIRMED' }));
      return { paymentId: charges[0].paymentId, value: input.value, status: 'CONFIRMED', contractId: randomUUID(), charges, approvedForEntireContract: true };
    }),
    getPaymentStatus: vi.fn(async () => { throw new Error('Not used by this stage'); }),
  };
}
function input(port = gateway()): CreateOrderParams {
  return { lojaID, customer: { userId: userID, name: 'Cliente', email, phone: '11999999999', cpfCnpj: '52998224725' },
    items: [{ productId: productID, variantId: variantID, quantity: 1 }], deliveryType: 'PICKUP', paymentMethod: 'PIX', paymentGateway: port };
}
const stored = (id: string) => prisma.order.findUniqueOrThrow({ where: { id }, include: { paymentAttempts: { include: { charges: true } } } });
const effects = async () => ({ orders: await prisma.order.count({ where: { lojaID } }), buyers: await prisma.orderBuyer.count({ where: { lojaID } }),
  stock: (await prisma.product.findUniqueOrThrow({ where: { id: productID } })).stock });
beforeAll(async () => {
  await verifyTestDatabase(); lojaID = await createFixtureStore();
  adminID = (await prisma.user.create({ data: { lojaID, name: 'Administrador', email: randomUUID() + '@example.invalid', password: '', role: 'ADMIN' } })).id;
  email = randomUUID() + '@example.invalid'; userID = (await prisma.user.create({ data: { lojaID, name: 'Cliente', email, password: '' } })).id;
  const product = await prisma.product.create({ data: { lojaID, userID: adminID, name: 'Produto', description: '', imageUrl: '', price: 100, stock: 200,
    productVariants: { create: { size: 'Único', color: 'Padrão', stock: 200 } } }, include: { productVariants: true } });
  productID = product.id; variantID = product.productVariants[0].id;
  host = (await prisma.loja.findUniqueOrThrow({ where: { id: lojaID } })).slug + '.plataforma.com';
});
beforeEach(async () => {
  vi.stubEnv('INSTALLMENT_MONTHLY_RATE', '0'); vi.stubEnv('INSTALLMENT_ABSORB_FEES', 'false');
  await prisma.loja.update({ where: { id: lojaID }, data: { enableManualPix: true, enablePix: true, enableBoleto: true, enableCreditCard: true,
    enablePickup: true, loyaltyEnabled: false, loyaltyEarnRate: '.5', loyaltyPointValue: '.05', loyaltyMinPointsRedeem: 1, loyaltyMaxDiscountPct: 100, loyaltyPointsExpiryDays: 365 } });
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await prisma.commerceOutbox.deleteMany({ where: { commandType: 'LOYALTY_RECONCILE_EARN', payload: { path: ['lojaID'], equals: lojaID } } });
  await cleanupFixtureStores(); await prisma.$disconnect();
});
describe('WF-12 / LA-035/009/023: real PostgreSQL with an explicitly injected gateway', () => {
  it('rejects an unavailable actual gateway before buyer, reservation or order', async () => {
    const before = await effects(); const args = input(); delete args.paymentGateway;
    await expect(createOrder(args)).rejects.toThrow('PAYMENT_METHOD_UNAVAILABLE'); expect(await effects()).toEqual(before);
  });
  it('does not authorize injected remote capacity when the store disabled that method', async () => {
    await prisma.loja.update({ where: { id: lojaID }, data: { enablePix: false } });
    const before = await effects(); const port = gateway(); await expect(createOrder(input(port))).rejects.toThrow('PAYMENT_METHOD_UNAVAILABLE');
    expect(port.createPixCharge).not.toHaveBeenCalled(); expect(await effects()).toEqual(before);
  });
  it('manual PIX requires its explicit flag and stored instructions; client cannot supply them', async () => {
    await prisma.loja.update({ where: { id: lojaID }, data: { pixKey: null } }); const before = await effects();
    await expect(createOrder({ ...input(), paymentMethod: 'WHATSAPP_PIX', pixKey: 'forged-key' })).rejects.toThrow('PAYMENT_METHOD_UNAVAILABLE');
    expect(await effects()).toEqual(before); await prisma.loja.update({ where: { id: lojaID }, data: { pixKey: 'fixture@example.invalid' } });
    const port = gateway(); const result = await createOrder({ ...input(port), paymentMethod: 'WHATSAPP_PIX', pixKey: 'forged-key' });
    expect(result).toMatchObject({ paymentState: 'MANUAL', order: { pixKey: 'fixture@example.invalid' } });
    expect((await stored(result.order.id)).paymentAttempts[0].status).toBe('NOT_STARTED'); expect(port.createPixCharge).not.toHaveBeenCalled();
  });
  it('validates CPF and billing address before creating local effects', async () => {
    const before = await effects();
    await expect(createOrder({ ...input(), customer: { ...input().customer, cpfCnpj: '11111111111' } })).rejects.toThrow('PAYMENT_CUSTOMER_REQUIRED');
    await expect(createOrder({ ...input(), paymentMethod: 'CREDIT_CARD', creditCard: card, acceptedFinancialTotal: 100 })).rejects.toThrow('PAYMENT_CARD_BILLING_REQUIRED');
    await expect(createOrder({ ...input(), paymentMethod: 'BOLETO' })).rejects.toThrow('PAYMENT_BOLETO_BILLING_REQUIRED');
    expect(await effects()).toEqual(before);
  });
  const cardInput = (port = gateway()) => ({ ...input(port), paymentMethod: 'CREDIT_CARD' as const, creditCard: card, installments: 3,
    acceptedFinancialTotal: 100, address: { cep: '01001000', state: 'SP', city: 'São Paulo', street: 'Rua', neighborhood: 'Centro', number: '1' } });
  it('rejects forged financial consent and installment before inventory or remote I/O', async () => {
    const before = await effects(); const port = gateway();
    await expect(createOrder({ ...cardInput(port), acceptedFinancialTotal: 10 })).rejects.toThrow('PAYMENT_RECONFIRM_REQUIRED');
    await expect(createOrder({ ...cardInput(port), installmentValue: 1 })).rejects.toThrow('PAYMENT_RECONFIRM_REQUIRED');
    expect(port.createCreditCardCharge).not.toHaveBeenCalled(); expect(await effects()).toEqual(before);
  });
  it('persists the accepted exact three-charge contract; full proof confirms once, no PAN/CVV storage', async () => {
    const before = await effects(); const port = gateway(); const result = await createOrder(cardInput(port)); const order = await stored(result.order.id);
    expect(result.paymentState).toBe('APPROVED'); expect(order.status).toBe('PAID'); expect(order.financialTotal?.toFixed(2)).toBe('100.00');
    expect(order.financialPlan).toMatchObject({ installments: ['33.33','33.33','33.34'], financingCharge: '0.00' });
    expect(order.paymentAttempts[0]).toMatchObject({ status: 'APPROVED', externalReference: order.id, installments: 3 });
    expect(order.paymentAttempts[0].charges.map(c => c.amount.toFixed(2)).sort()).toEqual(['33.33','33.33','33.34']);
    expect((await effects()).stock).toBe(before.stock - 1);
    const durable = JSON.stringify({ order, outbox: await prisma.commerceOutbox.findMany({ where: { aggregateId: order.id } }),
      audit: await prisma.auditLog.findMany({ where: { entityId: order.id } }) });
    expect(durable).not.toContain(card.number); expect(durable).not.toContain('"ccv"');
    expect(port.createCreditCardCharge).toHaveBeenCalledWith(expect.objectContaining({ value: 100, installmentCount: 3 }));
    expect(port.createCreditCardCharge).not.toHaveBeenCalledWith(expect.objectContaining({ installmentValue: expect.anything() }));
  });
  it('pending full contract does not pay the order when the first installment alone is confirmed', async () => {
    const port = gateway(); vi.mocked(port.createCreditCardCharge).mockImplementationOnce(async args => { const first = randomUUID(); return { paymentId: first, value: args.value,
      status: 'CONFIRMED', contractId: randomUUID(), charges: [33.33,33.33,33.34].map((value,index) => ({ paymentId: index ? randomUUID() : first, ordinal: index+1, value, status: index ? 'PENDING' : 'CONFIRMED' })), approvedForEntireContract: false }; });
    const result = await createOrder(cardInput(port)); expect(result.paymentState).toBe('PROCESSING');
    expect(await stored(result.order.id)).toMatchObject({ status: 'PENDING', paymentAttempts: [{ status: 'PENDING' }] });
    expect(await transitionOrder({ lojaID, orderId: result.order.id, newStatus: 'PAID', performedById: adminID })).toMatchObject({ success: false });
  });
  it('incomplete contract remains UNKNOWN with inventory reserved, never pretends a manual PIX success', async () => {
    const before = await effects(); const port = gateway(); vi.mocked(port.createCreditCardCharge).mockResolvedValueOnce({ paymentId: randomUUID(), value: 100,
      status: 'CONFIRMED', charges: [{ paymentId: randomUUID(), ordinal: 1, value: 33.33, status: 'CONFIRMED' }], approvedForEntireContract: true });
    const result = await createOrder(cardInput(port)); expect(result).toMatchObject({ paymentState: 'PROCESSING', order: { pixKey: null, asaasPaymentId: null } });
    expect(await stored(result.order.id)).toMatchObject({ status: 'PENDING', paymentAttempts: [{ status: 'UNKNOWN' }] });
    expect(await transitionOrder({ lojaID, orderId: result.order.id, newStatus: 'CANCELLED', performedById: adminID })).toMatchObject({ success: false });
    expect((await effects()).stock).toBe(before.stock - 1);
  });
  it('ambiguous timeout is durable, retries return PROCESSING without a second remote submission', async () => {
    const port = gateway(); vi.mocked(port.createPixCharge).mockRejectedValueOnce(new Error('Timeout after acceptance'));
    const args = { ...input(port), idempotencyKey: randomUUID() }; const result = await createOrder(args);
    expect(result.paymentState).toBe('PROCESSING'); expect((await stored(result.order.id)).paymentAttempts[0].status).toBe('UNKNOWN');
    const retry = await createOrder(args); expect(retry).toMatchObject({ paymentState: 'PROCESSING', order: { id: result.order.id, asaasPaymentId: null } });
    expect(port.createPixCharge).toHaveBeenCalledTimes(1);
  });
  it('missing PIX artifacts are not issued as success', async () => {
    const port = gateway(); vi.mocked(port.createPixCharge).mockResolvedValueOnce({ paymentId: randomUUID(), value: 100, status: 'PENDING', pixPayload: '', pixQrCodeBase64: '' });
    const result = await createOrder(input(port)); expect(result.paymentState).toBe('PROCESSING'); expect((await stored(result.order.id)).paymentAttempts[0].status).toBe('UNKNOWN');
  });
  it('capability loss after acceptance preserves a recoverable state without calling the gateway', async () => {
    const port = gateway(); vi.mocked(port.capabilities).mockImplementation(async () => ({ configured: !(await prisma.paymentAttempt.findFirst({ where: { order: { userID, lojaID }, status: 'SUBMITTING' } })), methods: ['PIX'], maximumInstallments: 1 }));
    const result = await createOrder(input(port)); expect(result.paymentState).toBe('PROCESSING');
    expect(port.createPixCharge).not.toHaveBeenCalled(); expect((await stored(result.order.id)).paymentAttempts[0].status).toBe('UNKNOWN');
  });
  it('minimum remote value is checked before inventory, order and submission', async () => {
    await prisma.product.update({ where: { id: productID }, data: { price: 2 } }); const before = await effects(); const port = gateway();
    try { await expect(createOrder(input(port))).rejects.toThrow('PAYMENT_BELOW_MINIMUM'); expect(await effects()).toEqual(before); expect(port.createPixCharge).not.toHaveBeenCalled(); }
    finally { await prisma.product.update({ where: { id: productID }, data: { price: 100 } }); }
  });
  it('issued PIX retry recovers committed artifacts and never resubmits', async () => {
    const port = gateway(); const args = { ...input(port), idempotencyKey: randomUUID() }; const first = await createOrder(args); const retry = await createOrder(args);
    expect(first.paymentState).toBe('ISSUED'); expect(retry).toMatchObject({ paymentState: 'ISSUED', order: { id: first.order.id, pixPayload: 'fixture-pix', pixQrCode: 'fixture-qr' } });
    expect(port.createPixCharge).toHaveBeenCalledTimes(1);
  });
  it('issued boleto stores actual instructions, while missing line is unresolved', async () => {
    const port = gateway(); const issued = await createOrder({ ...input(port), address: cardInput().address, paymentMethod: 'BOLETO' });
    expect(issued).toMatchObject({ paymentState: 'ISSUED', order: { asaasDigitableLine: 'fixture-line', asaasBankSlipUrl: 'https://example.invalid/boleto' } });
    const incomplete = gateway(); vi.mocked(incomplete.createBoletoCharge).mockResolvedValueOnce({ paymentId: randomUUID(), value: 100, status: 'PENDING', bankSlipUrl: 'https://example.invalid/boleto', digitableLine: '', dueDate: '2030-10-05' });
    expect((await createOrder({ ...input(incomplete), address: cardInput().address, paymentMethod: 'BOLETO' })).paymentState).toBe('PROCESSING');
  });
  it('interest increases only financial total, never the merchandise earn base', async () => {
    vi.stubEnv('INSTALLMENT_MONTHLY_RATE', '0.0299'); await prisma.loja.update({ where: { id: lojaID }, data: { loyaltyEnabled: true } });
    const term = installmentPlan(100, 3, { ...config, installmentMonthlyRate: .0299 }); const port = gateway();
    const result = await createOrder({ ...cardInput(port), acceptedFinancialTotal: Number(term.financialTotal) }); const order = await stored(result.order.id);
    expect(order.status).toBe('PAID'); expect(order.total.toFixed(2)).toBe('100.00'); expect(order.financialTotal?.toFixed(2)).toBe(term.financialTotal);
    expect(order.financingCharge?.toFixed(2)).toBe(term.financingCharge); expect(order.loyaltyEarnSnapshot).toMatchObject({ base: '100.00', points: 50 });
    expect(port.createCreditCardCharge).toHaveBeenCalledWith(expect.objectContaining({ value: Number(term.financialTotal) }));
  });
  it('local failure after provider acceptance preserves the attempt for reconciliation', async () => {
    const constraint = 'fixture_payment_' + randomUUID().replaceAll('-', '');
    await prisma.$executeRawUnsafe('ALTER TABLE "PaymentCharge" ADD CONSTRAINT "' + constraint + '" CHECK ("providerPaymentId" <> \'fixture-persistence-failure\')');
    const port = gateway(); vi.mocked(port.createPixCharge).mockResolvedValueOnce({ paymentId: 'fixture-persistence-failure', value: 100, status: 'PENDING', pixPayload: 'fixture', pixQrCodeBase64: 'fixture' });
    try { const result = await createOrder(input(port)); expect(result.paymentState).toBe('PROCESSING');
      expect(await stored(result.order.id)).toMatchObject({ status: 'PENDING', paymentAttempts: [{ status: 'UNKNOWN', charges: [] }] }); }
    finally { await prisma.$executeRawUnsafe('ALTER TABLE "PaymentCharge" DROP CONSTRAINT "' + constraint + '"'); }
  });
  it('local confirmation failure rolls the atomic financial projection back and reports PROCESSING', async () => {
    const constraint = 'fixture_confirmation_' + randomUUID().replaceAll('-', '');
    // NOT VALID leaves earlier fixture confirmations untouched, while enforcing
    // failure of the next INSERT. The temporary check is removed in finally.
    await prisma.$executeRawUnsafe('ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "' + constraint + '" CHECK ("systemActor" <> \'PAYMENT_RECONCILIATION\') NOT VALID');
    const port = gateway(); const args = { ...cardInput(port), idempotencyKey: randomUUID() };
    try { const result = await createOrder(args); expect(result.paymentState).toBe('PROCESSING');
      const order = await stored(result.order.id); expect(order.status).toBe('PENDING');
      expect(order.paymentAttempts[0]).toMatchObject({ status: 'UNKNOWN', failureCode: 'PAYMENT_RESULT_UNRESOLVED' });
      expect(order.paymentAttempts[0].reconcileAfter).not.toBeNull(); expect(order.paymentAttempts[0].charges).toHaveLength(0);
      expect(await createOrder(args)).toMatchObject({ paymentState: 'PROCESSING', order: { id: order.id } });
      expect(port.createCreditCardCharge).toHaveBeenCalledTimes(1); }
    finally { await prisma.$executeRawUnsafe('ALTER TABLE "OrderStatusHistory" DROP CONSTRAINT "' + constraint + '"'); }
  });
  it('public HTTP capacity is tenant-scoped, no-store, has no secrets and remote defaults unavailable', async () => {
    const result = await get('/api/payment/capabilities', { headers: { Host: host } }); expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ lojaID, methods: ['WHATSAPP_PIX'] }); expect(result.headers?.['cache-control']).toContain('no-store');
    for (const field of ['pixKey','whatsappNumber','asaasApiKey','correiosPassword']) expect(JSON.stringify(result.body)).not.toContain(field);
    const args = input(); delete args.paymentGateway; const before = await effects();
    const refused = await post('/api/checkout/intents', args, { headers: { Host: host, Cookie: 'session_id=' + (await prisma.session.create({ data: { userId: userID, expiresAt: new Date(Date.now() + 600000) } })).id } }); expect(refused.status).toBe(409); expect(await effects()).toEqual(before);
  });
  it('honors gain policy accepted before disabling loyalty and changing its rate/term; credits once', async () => {
    await prisma.loja.update({ where: { id: lojaID }, data: { loyaltyEnabled: true } });
    await adjustPointsManually({ lojaID, userID, adminUserId: adminID, points: 400, commandId: randomUUID(), description: 'Fixture balance' });
    const result = await createOrder({ ...input(), paymentMethod: 'WHATSAPP_PIX', pointsToRedeem: 400 });
    expect(await stored(result.order.id)).toMatchObject({ pointsEarned: 40, pointsCredited: 0, loyaltyEarnSnapshot: { base: '80.00', rate: '0.50', expiryDays: 365 } });
    await prisma.loja.update({ where: { id: lojaID }, data: { loyaltyEnabled: false, loyaltyEarnRate: 2, loyaltyPointsExpiryDays: 30 } });
    expect(await transitionOrder({ lojaID, orderId: result.order.id, newStatus: 'PAID', performedById: adminID })).toMatchObject({ success: true });
    const ledger = await prisma.loyaltyTransaction.findFirstOrThrow({ where: { orderId: result.order.id, type: 'EARN' } });
    expect(ledger.points).toBe(40); expect(ledger.policy).toMatchObject({ base: '80.00', rate: '0.50', expiryDays: 365 });
    expect(ledger.expiresAt!.getTime() - ledger.createdAt.getTime()).toBeGreaterThan(364 * 86400000);
    expect(await creditEarnedPoints({ lojaID, userID, orderId: result.order.id, subtotal: 100 })).toMatchObject({ replay: true });
    expect((await stored(result.order.id)).pointsCredited).toBe(40); expect(await prisma.loyaltyTransaction.count({ where: { orderId: result.order.id, type: 'EARN' } })).toBe(1);
  });
  it('legacy order without an accepted gain policy is deferred instead of recalculated from current settings', async () => {
    const old = await prisma.order.create({ data: { lojaID, userID, subtotal: 100, total: 100, status: 'PAID', deliveryType: 'PICKUP' } });
    expect(await creditEarnedPoints({ lojaID, userID, orderId: old.id, subtotal: 100 })).toBeNull();
    expect((await stored(old.id)).pointsCredited).toBe(0); expect(await prisma.commerceOutbox.count({ where: { aggregateId: old.id, commandType: 'LOYALTY_RECONCILE_EARN' } })).toBe(1);
  });
  it('rechecks administrator under the store lock before changing payment flags', async () => {
    const before = await prisma.loja.findUniqueOrThrow({ where: { id: lojaID } });
    expect(await updateLojaSettings(lojaID, { enablePix: false }, userID)).toBeNull();
    expect((await prisma.loja.findUniqueOrThrow({ where: { id: lojaID } })).enablePix).toBe(before.enablePix);
    expect(await updateLojaSettings(lojaID, { enablePix: false }, adminID)).toMatchObject({ enablePix: false });
    expect((await prisma.loja.findUniqueOrThrow({ where: { id: lojaID } })).configurationVersion).toBeGreaterThan(before.configurationVersion);
  });
});
