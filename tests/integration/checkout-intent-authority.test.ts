import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { createFixtureStore, cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { createOrder, recoverCheckout, type CreateOrderParams, type CreateOrderResult } from '@/services/checkout.service';
import { proposeCheckout, checkoutContext } from '@/services/checkout-intent.service';
import { updateCartItemQuantity } from '@/services/cart.service';
import { transitionOrder } from '@/lib/commerce/order-command';
import { get, post } from '@/tests/helpers/request';
import type { PaymentGateway, PaymentMethod } from '@/types/payment-gateway.types';
let lojaID: string, otherLojaID: string, adminID: string, host: string, otherHost: string;
// Recovery clock is observation metadata; compare every business field on replay.
function replayEvidence(result: CreateOrderResult) {
  expect(result.order.serverTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  return { ...result, order: { ...result.order, serverTime: '<database observation time>' } };
}
beforeAll(async () => {
  await verifyTestDatabase(); lojaID = await createFixtureStore(); otherLojaID = await createFixtureStore();
  await prisma.loja.update({ where: { id: lojaID }, data: { enablePickup: true, enablePix: true, enableCreditCard: true } });
  adminID = (await prisma.user.create({ data: { lojaID, name: 'Admin', email: randomUUID() + '@example.invalid', password: '', role: 'ADMIN' } })).id;
  host = (await prisma.loja.findUniqueOrThrow({ where: { id: lojaID } })).slug + '.plataforma.com';
  otherHost = (await prisma.loja.findUniqueOrThrow({ where: { id: otherLojaID } })).slug + '.plataforma.com';
});
afterAll(async () => { await cleanupFixtureStores(); await prisma.$disconnect(); });
async function draft(stock = 5, guest = false): Promise<CreateOrderParams> {
  const user = guest ? null : await prisma.user.create({ data: { lojaID, name: 'Cliente', email: randomUUID() + '@example.invalid', password: '' } });
  const product = await prisma.product.create({ data: { lojaID, userID: adminID, name: 'Produto canônico', description: '', imageUrl: '', price: 100, stock,
    productVariants: { create: { size: 'Único', color: 'Padrão', stock } } }, include: { productVariants: true } });
  const params: CreateOrderParams = { lojaID, customer: { userId: user?.id, name: 'Cliente', email: user?.email ?? randomUUID() + '@example.invalid',
    phone: '11999999999', cpfCnpj: '52998224725' }, items: [{ productId: product.id, variantId: product.productVariants[0].id, quantity: 1 }],
    deliveryType: 'PICKUP', paymentMethod: 'WHATSAPP_PIX', freightOwnerKey: guest ? 'g:' + randomBytes(32).toString('hex') : 'u:' + user!.id };
  if (user) {
    const cart = await prisma.cart.create({ data: { lojaID, userID: user.id, items: { create: { productID: product.id,
      variantID: product.productVariants[0].id, quantity: 1, price: 100, productName: product.name, color: 'Padrão', size: 'Único', imageUrl: '' } } } });
    params.cartID = cart.id; params.cartVersion = cart.version;
  } else params.basketID = (await checkoutContext(params)).basketID!;
  return params;
}
const accept = async (params: CreateOrderParams) => {
  const p = await proposeCheckout(params); return { ...params, checkoutIntentID: p.checkoutIntentID, acceptedRevision: p.revision, acceptedContentHash: p.contentHash };
};
const snapshot = async (params: CreateOrderParams) => ({ orders: await prisma.order.count({ where: { lojaID, userID: params.customer.userId } }),
  stock: (await prisma.product.findUniqueOrThrow({ where: { id: params.items[0].productId } })).stock,
  cart: params.cartID ? await prisma.cart.findUnique({ where: { id: params.cartID }, select: { status: true, version: true } }) : null });
const session = async (id: string) => 'session_id=' + (await prisma.session.create({ data: { userId: id, expiresAt: new Date(Date.now() + 600000) } })).id;
const port = (): PaymentGateway => ({ capabilities: vi.fn(async () => ({ configured: true, methods: ['PIX', 'CREDIT_CARD'] as PaymentMethod[], maximumInstallments: 1 })),
  createPixCharge: vi.fn(async () => { throw new Error('Simulated lost response after external acceptance'); }),
  createBoletoCharge: vi.fn(async () => { throw new Error('Not used'); }),
  createCreditCardCharge: vi.fn(async input => { const paymentId = randomUUID(); return { paymentId, value: input.value, status: 'CONFIRMED', approvedForEntireContract: true,
    charges: [{ paymentId, value: input.value, ordinal: 1, status: 'CONFIRMED' }] }; }),
  getPaymentStatus: vi.fn(async () => { throw new Error('WF-14'); }) });

describe('WF-13: durable consent and one canonical purchase command in real PostgreSQL/Next', () => {
  it('requires a persisted intent even for trusted internal creation', async () => {
    const p = await draft(); const before = await snapshot(p);
    await expect(createOrder(p)).rejects.toThrow('CHECKOUT_INTENT_REQUIRED'); expect(await snapshot(p)).toEqual(before);
  });
  it('quotes without order, buyer, stock reservation or charge', async () => {
    const p = await draft(); const before = await snapshot(p); const q = await proposeCheckout(p);
    expect(q.proposal.financial.financialTotal).toBe('100.00'); expect(await snapshot(p)).toEqual(before);
    expect(await prisma.checkoutIntent.count({ where: { cartID: p.cartID } })).toBe(1);
    expect(await prisma.orderBuyer.count({ where: { authenticatedUserID: p.customer.userId } })).toBe(0);
  });
  it('parallel proposal issuance and different transport keys converge on one intent', async () => {
    const p = await draft(); const [a, b] = await Promise.all([proposeCheckout({ ...p, idempotencyKey: randomUUID() }), proposeCheckout({ ...p, idempotencyKey: randomUUID() })]);
    expect(a.checkoutIntentID).toBe(b.checkoutIntentID); expect(a.contentHash).toBe(b.contentHash); expect(a.revision).toBe(1);
  });
  it('parallel completion with abundant stock returns the same persisted result and consumes once', async () => {
    const p = await accept(await draft(10)); const [a, b] = await Promise.all([createOrder({ ...p, idempotencyKey: randomUUID() }), createOrder({ ...p, idempotencyKey: randomUUID() })]);
    expect(replayEvidence(a)).toEqual(replayEvidence(b)); expect(a).toMatchObject({ kind: 'manual', order: { status: 'PENDING', items: [{ variantId: p.items[0].variantId }] } });
    expect(await snapshot(p)).toMatchObject({ orders: 1, stock: 9, cart: { status: 'COMPLETED', version: 1 } });
    expect(await prisma.inventoryReservation.count({ where: { orderId: a.order.id } })).toBe(1);
    expect(await prisma.paymentAttempt.count({ where: { orderId: a.order.id } })).toBe(1);
    expect(await prisma.commerceOutbox.count({ where: { effectKey: 'checkout:' + p.checkoutIntentID } })).toBe(1);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: a.order.id } })).idempotencyKey).toBeNull();
  });
  it('changed terms update one revision and reject the earlier accepted content', async () => {
    const p = await draft(); const first = await accept(p); const changed = await accept({ ...p, customer: { ...p.customer, phone: '11888888888' } });
    expect(changed.checkoutIntentID).toBe(first.checkoutIntentID); expect(changed.acceptedRevision).toBe(2);
    await expect(createOrder(first)).rejects.toThrow('CHECKOUT_RECONFIRM_REQUIRED'); expect((await createOrder(changed)).order.customer.phone).toBe('11888888888');
  });
  it('changed submitted content conflicts even when the intent/revision/hash are known', async () => {
    const p = await accept(await draft()); const before = await snapshot(p);
    await expect(createOrder({ ...p, customer: { ...p.customer, phone: '11888888888' } })).rejects.toThrow('CHECKOUT_CONTENT_CONFLICT');
    expect(await snapshot(p)).toEqual(before);
  });
  it('two different owners racing for the final unit have exactly one winner', async () => {
    const a = await draft(1); const b = await draft();
    await prisma.cartItem.updateMany({ where: { cartID: b.cartID }, data: { productID: a.items[0].productId!, variantID: a.items[0].variantId! } });
    b.items = a.items; const [ca, cb] = await Promise.all([accept(a), accept(b)]);
    const results = await Promise.allSettled([createOrder(ca), createOrder(cb)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1); expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: a.items[0].productId } })).stock).toBe(0);
    expect((await prisma.productVariants.findUniqueOrThrow({ where: { id: a.items[0].variantId } })).stock).toBe(0);
  });
  it('a cart mutation after review prevents consumption of the changed version', async () => {
    const p = await accept(await draft()); await updateCartItemQuantity(p.customer.userId!, p.items[0].variantId!, 2, lojaID,
      { commandId: randomUUID(), cartId: p.cartID!, expectedVersion: p.cartVersion! });
    await expect(createOrder(p)).rejects.toThrow('CHECKOUT_CART_CHANGED'); expect(await snapshot(p)).toMatchObject({ orders: 0, stock: 5, cart: { status: 'ACTIVE', version: 1 } });
  });
  it('catalog repricing needs a new displayed revision and never charges changed terms silently', async () => {
    const p = await accept(await draft()); await prisma.product.update({ where: { id: p.items[0].productId }, data: { price: 120 } });
    await expect(createOrder(p)).rejects.toThrow('CHECKOUT_RECONFIRM_REQUIRED'); expect(await snapshot(p)).toMatchObject({ orders: 0, stock: 5 });
    const renewed = await accept(p); expect(renewed.acceptedRevision).toBe(2);
    expect((await createOrder(renewed)).order.total).toBe(120);
  });
  it('retired variants cannot be purchased after quotation', async () => {
    const p = await accept(await draft()); await prisma.productVariants.update({ where: { id: p.items[0].variantId }, data: { retiredAt: new Date() } });
    await expect(createOrder(p)).rejects.toThrow('CHECKOUT_VARIANT_UNAVAILABLE'); expect(await snapshot(p)).toMatchObject({ orders: 0, stock: 5 });
  });
  it('aggregates repeated variant quantities into one canonical order item/reservation', async () => {
    const p = await draft(3, true); p.items = [...p.items, { ...p.items[0], price: .01, color: 'forged', size: 'forged' }];
    const result = await createOrder(await accept(p)); expect(result.order.items).toMatchObject([{ quantity: 2, price: 100, color: 'Padrão', size: 'Único' }]);
    expect(result.order.items).toHaveLength(1); expect(await prisma.inventoryReservation.findFirst({ where: { orderId: result.order.id } })).toMatchObject({ quantity: 2, variantId: p.items[0].variantId });
  });
  it('does not floor fractional quantities or select a foreign variant', async () => {
    const p = await draft(3, true), foreign = await draft();
    await expect(proposeCheckout({ ...p, items: [{ ...p.items[0], quantity: 1.5 }] })).rejects.toThrow('CHECKOUT_QUANTITY_INVALID');
    await expect(proposeCheckout({ ...p, items: [{ ...p.items[0], variantId: foreign.items[0].variantId }] })).rejects.toThrow('CHECKOUT_VARIANT_UNAVAILABLE');
  });
  it('neutral legacy combinations resolve to a persisted ID, with canonical labels', async () => {
    const p = await draft(3, true); await prisma.productVariants.update({ where: { id: p.items[0].variantId }, data: { size: ' default ', color: ' padrÃO ' } });
    p.items = [{ productId: p.items[0].productId, quantity: 1, size: ' ÚNICO ', color: 'DEFAULT' }];
    const result = await createOrder(await accept(p)); expect(result.order.items[0]).toMatchObject({ variantId: expect.any(String), size: 'Único', color: 'Padrão' });
  });
  it('ambiguous variant omission never silently selects a stocked commercial combination', async () => {
    const p = await draft(3, true); await prisma.productVariants.create({ data: { ProductID: p.items[0].productId!, size: 'Grande', color: 'Vermelho', stock: 2 } });
    await expect(proposeCheckout({ ...p, items: [{ productId: p.items[0].productId, quantity: 1 }] })).rejects.toThrow('CHECKOUT_VARIANT_UNAVAILABLE');
  });
  it('guest recovery survives the lost creation response and denies another cookie/store', async () => {
    const p = await draft(3, true); const cookie = randomBytes(32).toString('hex'); p.freightOwnerKey = 'g:' + createHash('sha256').update(cookie).digest('hex');
    p.basketID = (await checkoutContext(p)).basketID!; const accepted = await accept(p); const first = await createOrder(accepted);
    const response = await get('/api/checkout/intents/' + accepted.checkoutIntentID, { headers: { Host: host, Cookie: 'freight_owner=' + cookie } });
    const recoveredBody = response.body as { data: { result: CreateOrderResult } };
    expect(response.status).toBe(200); expect(replayEvidence(recoveredBody.data.result)).toEqual(JSON.parse(JSON.stringify(replayEvidence(first))));
    expect(response.headers?.['cache-control']).toBe('private, no-store');
    expect((await get('/api/checkout/intents/' + accepted.checkoutIntentID, { headers: { Host: host, Cookie: 'freight_owner=' + randomBytes(32).toString('hex') } })).status).toBe(404);
    expect((await get('/api/checkout/intents/' + accepted.checkoutIntentID, { headers: { Host: otherHost, Cookie: 'freight_owner=' + cookie } })).status).toBe(404);
    expect(replayEvidence((await recoverCheckout(p, accepted.checkoutIntentID!)).result!)).toEqual(replayEvidence(first));
  });
  it('an authenticated intent is not accessible to another user or tenant', async () => {
    const p = await accept(await draft()), peer = await draft(); await createOrder(p);
    await expect(recoverCheckout(peer, p.checkoutIntentID!)).rejects.toThrow('CHECKOUT_INTENT_NOT_FOUND');
    await expect(recoverCheckout({ ...p, lojaID: otherLojaID }, p.checkoutIntentID!)).rejects.toThrow('ACCOUNT_ACCESS_DENIED');
  });
  it('timeout/replay preserves the unknown attempt and never repeats the financial call', async () => {
    const p = await draft(3, true), gateway = port(); p.paymentMethod = 'PIX'; p.paymentGateway = gateway;
    const accepted = await accept(p); const first = await createOrder(accepted); const second = await createOrder({ ...accepted, idempotencyKey: randomUUID() });
    expect(replayEvidence(first)).toEqual(replayEvidence(second)); expect(first).toMatchObject({ kind: 'processing', order: { pixPayload: null, pixKey: null } });
    expect(gateway.createPixCharge).toHaveBeenCalledTimes(1);
    expect(await prisma.paymentAttempt.findFirst({ where: { orderId: first.order.id } })).toMatchObject({ status: 'UNKNOWN' });
    await expect(checkoutContext(p, p.basketID)).rejects.toThrow('PAYMENT_RECONCILIATION_REQUIRED');
  });
  it('guest refresh recovers its completed source; only an explicit known-state action starts another', async () => {
    const p = await accept(await draft(3, true)); await createOrder(p);
    expect((await checkoutContext(p)).basketID).toBe(p.basketID);
    const next = await checkoutContext(p, p.basketID); expect(next.basketID).not.toBe(p.basketID);
    expect((await prisma.checkoutBasket.findUniqueOrThrow({ where: { id: p.basketID } })).status).toBe('COMPLETED');
  });
  it('failure of the durable checkout audit rolls back all purchase effects', async () => {
    const p = await accept(await draft()); const before = await snapshot(p); const constraint = 'wf13_' + randomUUID().replaceAll('-', '');
    await prisma.$executeRawUnsafe(`ALTER TABLE "AuditLog" ADD CONSTRAINT "${constraint}" CHECK (action<>'CHECKOUT_COMMITTED' OR "actorId"<>'${p.customer.userId}') NOT VALID`);
    try {
      await expect(createOrder(p)).rejects.toThrow(); expect(await snapshot(p)).toEqual(before);
      expect(await prisma.paymentAttempt.count({ where: { order: { checkoutIntentID: p.checkoutIntentID } } })).toBe(0);
      expect(await prisma.inventoryReservation.count({ where: { order: { checkoutIntentID: p.checkoutIntentID } } })).toBe(0);
      expect(await prisma.orderBuyer.count({ where: { authenticatedUserID: p.customer.userId } })).toBe(0);
    } finally { await prisma.$executeRawUnsafe(`ALTER TABLE "AuditLog" DROP CONSTRAINT "${constraint}"`); }
    expect((await createOrder(p)).kind).toBe('manual');
  });
  it('reservation provenance rejects mismatched quantities and commits/releases exactly once', async () => {
    const p = await accept(await draft()); const order = (await createOrder(p)).order;
    const reservation = await prisma.inventoryReservation.findFirstOrThrow({ where: { orderId: order.id } });
    await expect(prisma.inventoryReservation.update({ where: { id: reservation.id }, data: { quantity: 2 } })).rejects.toThrow();
    const command = { orderId: order.id, lojaID, performedById: adminID };
    expect((await transitionOrder({ ...command, newStatus: 'PAID' })).success).toBe(true);
    expect(await prisma.inventoryReservation.findUnique({ where: { id: reservation.id } })).toMatchObject({ status: 'COMMITTED', version: 1 });
    expect((await transitionOrder({ ...command, newStatus: 'CANCELLED' })).success).toBe(true);
    expect((await transitionOrder({ ...command, newStatus: 'CANCELLED' })).success).toBe(true);
    expect(await snapshot(p)).toMatchObject({ stock: 5 });
    expect(await prisma.inventoryReservation.findUnique({ where: { id: reservation.id } })).toMatchObject({ status: 'RETURNED', version: 2 });
    expect((await recoverCheckout(p, p.checkoutIntentID!)).result).toMatchObject({ kind: 'review', paymentState: 'REVIEW', financialState: 'REFUND_PENDING', order: { pixKey: null } });
  });
  it('both HTTP creation routes share the intent command; incomplete old contracts are rejected', async () => {
    const p = await accept(await draft()); const options = { headers: { Host: host, Cookie: await session(p.customer.userId!) } };
    const old = await post('/api/orders', { cartID: p.cartID, addressID: randomUUID() }, options); expect(old.status).toBe(422);
    const payload = { checkoutIntentID: p.checkoutIntentID, acceptedRevision: p.acceptedRevision, acceptedContentHash: p.acceptedContentHash };
    const [a, b] = await Promise.all([post('/api/orders', payload, options), post('/api/checkout', payload, options)]);
    const aBody = a.body as { success: boolean; data: CreateOrderResult }, bBody = b.body as { success: boolean; data: CreateOrderResult };
    expect(a.status).toBe(200); expect(b.status).toBe(200); expect({ ...aBody, data: replayEvidence(aBody.data) }).toEqual({ ...bBody, data: replayEvidence(bBody.data) });
    expect(await snapshot(p)).toMatchObject({ orders: 1, stock: 4 });
  });
  it('expired proposals require review before any reservation', async () => {
    const p = await accept(await draft()); await prisma.checkoutIntent.update({ where: { id: p.checkoutIntentID }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(createOrder(p)).rejects.toThrow('CHECKOUT_RECONFIRM_REQUIRED'); expect(await snapshot(p)).toMatchObject({ orders: 0, stock: 5 });
  });
  it('consent deadlines use the database clock even when application clocks differ', async () => {
    const p = await accept(await draft()); const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 86400000);
    try { expect((await createOrder(p)).kind).toBe('manual'); }
    finally { clock.mockRestore(); }
  });
  it('manual instructions survive response loss and configuration changes without sessionStorage', async () => {
    const p = await accept(await draft()); const first = await createOrder(p);
    const store = await prisma.loja.findUniqueOrThrow({ where: { id: lojaID } });
    expect(first.order.whatsappNumber).toBe(store.whatsappNumber);
    await prisma.loja.update({ where: { id: lojaID }, data: { pixKey: 'changed@example.invalid', whatsappNumber: '11888888888' } });
    try { expect(replayEvidence((await recoverCheckout(p, p.checkoutIntentID!)).result!)).toEqual(replayEvidence(first)); }
    finally { await prisma.loja.update({ where: { id: lojaID }, data: { pixKey: store.pixKey, whatsappNumber: store.whatsappNumber } }); }
  });
  it('completion racing a versioned cart mutation never mixes quantities or consumes the changed cart', async () => {
    const p = await accept(await draft());
    const [purchase, mutation] = await Promise.allSettled([createOrder(p), updateCartItemQuantity(p.customer.userId!, p.items[0].variantId!, 2, lojaID,
      { commandId: randomUUID(), cartId: p.cartID!, expectedVersion: p.cartVersion! })]);
    if (purchase.status === 'fulfilled') {
      expect(mutation.status).toBe('rejected'); expect(purchase.value.order.items[0].quantity).toBe(1);
      expect(await snapshot(p)).toMatchObject({ orders: 1, stock: 4, cart: { status: 'COMPLETED', version: 1 } });
    } else {
      expect(mutation.status).toBe('fulfilled'); expect(purchase.reason.message).toBe('CHECKOUT_CART_CHANGED');
      expect(await snapshot(p)).toMatchObject({ orders: 0, stock: 5, cart: { status: 'ACTIVE', version: 1 } });
    }
  });
  it('rereads source items even when an invalid alternate writer forgets to increment the revision', async () => {
    const p = await accept(await draft()); await prisma.cartItem.updateMany({ where: { cartID: p.cartID }, data: { quantity: 2 } });
    await expect(createOrder(p)).rejects.toThrow('CHECKOUT_CART_CHANGED'); expect(await snapshot(p)).toMatchObject({ orders: 0, stock: 5 });
  });
  it('product aggregate stock and explicit depleted variants are independently enforced', async () => {
    const p = await draft(3, true); const second = await prisma.productVariants.create({ data: { ProductID: p.items[0].productId!, stock: 2, size: 'Grande', color: 'Vermelho' } });
    await expect(proposeCheckout({ ...p, items: [{ ...p.items[0], quantity: 2 }, { productId: p.items[0].productId, variantId: second.id, quantity: 2 }] })).rejects.toThrow('Estoque insuficiente para o produto');
    await prisma.productVariants.update({ where: { id: p.items[0].variantId }, data: { stock: 0 } });
    await expect(proposeCheckout(p)).rejects.toThrow('CHECKOUT_VARIANT_UNAVAILABLE'); expect(await snapshot(p)).toMatchObject({ stock: 3 });
  });
  it('full card approval has identical truthful DTO on creation and recovery without storing PAN/CVV', async () => {
    const p = await draft(), gateway = port(); p.paymentGateway = gateway; p.paymentMethod = 'CREDIT_CARD';
    p.address = { cep: '01001000', state: 'SP', city: 'São Paulo', neighborhood: 'Centro', street: 'Rua', number: '1' };
    p.creditCard = { holderName: 'CLIENTE', number: '4532015112830366', expiryMonth: '12', expiryYear: '2030', ccv: '123' };
    const accepted = await accept(p); const first = await createOrder(accepted); const replay = await createOrder(accepted);
    expect(replayEvidence(first)).toEqual(replayEvidence(replay)); expect(first).toMatchObject({ kind: 'approved', order: { status: 'PAID', paymentState: 'APPROVED', pixKey: null } });
    expect(gateway.createCreditCardCharge).toHaveBeenCalledTimes(1);
    const intent = await prisma.checkoutIntent.findUniqueOrThrow({ where: { id: accepted.checkoutIntentID } });
    expect((intent.snapshot as any).input.creditCard).toBeUndefined(); expect(JSON.stringify(intent.snapshot)).not.toContain(p.creditCard.number);
    expect(JSON.stringify(await prisma.paymentAttempt.findFirst({ where: { orderId: first.order.id } }))).not.toContain(p.creditCard.number);
    expect(await prisma.inventoryReservation.findFirst({ where: { orderId: first.order.id } })).toMatchObject({ status: 'COMMITTED' });
  });
  it('SQL protects the accepted proposal and forbids reopening a consumed cart', async () => {
    const p = await accept(await draft()); await createOrder(p);
    await expect(prisma.checkoutIntent.update({ where: { id: p.checkoutIntentID }, data: { revision: { increment: 1 } } })).rejects.toThrow('CHECKOUT_ACCEPTED_CONTENT_IMMUTABLE');
    await expect(prisma.cart.update({ where: { id: p.cartID }, data: { status: 'ACTIVE' } })).rejects.toThrow('CHECKOUT_SOURCE_ALREADY_CONSUMED');
  });
  it('SQL refuses a purported canonical order without the atomic reservation/source/attempt effects', async () => {
    const p = await accept(await draft()); const before = await snapshot(p);
    await expect(prisma.order.create({ data: { lojaID, userID: p.customer.userId, checkoutIntentID: p.checkoutIntentID,
      sourceCartID: p.cartID, subtotal: 100, total: 100, deliveryType: 'PICKUP', items: { create: {
        productId: p.items[0].productId, productVariantsId: p.items[0].variantId, name: 'Produto', quantity: 1, price: 100 } } } })).rejects.toThrow('CHECKOUT_COMMIT_INCOMPLETE');
    expect(await snapshot(p)).toEqual(before);
  });
  it('repricing demands the same new consent through both HTTP creation routes', async () => {
    const p = await accept(await draft()); const options = { headers: { Host: host, Cookie: await session(p.customer.userId!) } };
    await prisma.product.update({ where: { id: p.items[0].productId }, data: { price: 150 } });
    const payload = { checkoutIntentID: p.checkoutIntentID, acceptedRevision: p.acceptedRevision, acceptedContentHash: p.acceptedContentHash };
    for (const route of ['/api/checkout', '/api/orders']) {
      const response = await post(route, payload, options); expect(response.status).toBe(409);
      expect(response.body).toMatchObject({ error: 'CHECKOUT_RECONFIRM_REQUIRED' });
    }
    expect(await snapshot(p)).toMatchObject({ orders: 0, stock: 5 });
    const renewed = await accept(p); expect((await createOrder(renewed)).order.total).toBe(150);
  });
});
