import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { createFixtureStore, cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { createOrder, acceptFixtureCheckout } from '@/tests/setup/checkout-fixture';
import { checkoutContext } from '@/services/checkout-intent.service';
import { createOrder as completeCheckout, recoverCheckout } from '@/services/checkout.service';
import { getOrdersByUser, getOrderDetailForAdmin, updateOrderStatus } from '@/services/order.service';
import { fixtureFreightQuote } from '@/tests/setup/freight-fixture';
import { hashGuestOrderAccess } from '@/lib/commerce/order-buyer';
import { get, post } from '@/tests/helpers/request';

let lojaID: string; let otherLojaID: string; let victimID: string; let victimEmail: string;
let productID: string; let variantID: string; let host: string; let otherHost: string; let cookie: string; let adminCookie: string;
const freightCookie = randomBytes(32).toString('hex');
const freightOwnerKey = 'g:' + createHash('sha256').update(freightCookie).digest('hex');
let freightQuoteToken: string;
let guestID: string; let token: string; let guestBuyerID: string; let adminID: string;
const customer = () => ({ name: 'Comprador Declarado', email: victimEmail, phone: '11999999999', cpfCnpj: '52998224725' });
const input = () => ({ lojaID, customer: customer(), items: [{ productId: productID, variantId: variantID, quantity: 1, name: 'Produto', price: 79.9 }],
  deliveryType: 'DELIVERY' as const, address: { cep: '01001000', state: 'SP', city: 'São Paulo', neighborhood: 'Centro', street: 'Rua', number: '1' },
  freightQuoteToken, freightOwnerKey, paymentMethod: 'WHATSAPP_PIX' as const });
beforeAll(async () => {
  await verifyTestDatabase();
  lojaID = await createFixtureStore(); otherLojaID = await createFixtureStore();
  await prisma.loja.update({ where: { id: lojaID }, data: { loyaltyEnabled: true } });
  victimEmail = `${randomUUID()}@example.invalid`;
  victimID = (await prisma.user.create({ data: { lojaID, name: 'Titular Verificado', email: victimEmail, phone: '11888888888', cpfCnpj: '11144477735', password: 'unchanged-hash' } })).id;
  await prisma.loyaltyWallet.create({ data: { lojaID, userID: victimID, balance: 1000 } });
  adminID = (await prisma.user.create({ data: { lojaID, name: 'Admin', email: `${randomUUID()}@example.invalid`, password: '', role: 'ADMIN' } })).id;
  const session = async (userId: string) => `session_id=${(await prisma.session.create({ data: { userId, expiresAt: new Date(Date.now() + 600000) } })).id}`;
  cookie = await session(victimID); adminCookie = await session(adminID);
  const product = await prisma.product.create({ data: { lojaID, userID: adminID, name: 'Produto', description: '', imageUrl: '', price: '79.90', stock: 10,
    productVariants: { create: { size: 'Único', color: 'Padrão', stock: 10 } } }, include: { productVariants: true } });
  productID = product.id; variantID = product.productVariants[0].id;
  host = `${(await prisma.loja.findUniqueOrThrow({ where: { id: lojaID } })).slug}.plataforma.com`;
  otherHost = `${(await prisma.loja.findUniqueOrThrow({ where: { id: otherLojaID } })).slug}.plataforma.com`;
  freightQuoteToken = await fixtureFreightQuote({ lojaID, ownerKey: freightOwnerKey, items: [{ productId: productID, variantId: variantID, quantity: 1 }] });
});
afterAll(async () => { await cleanupFixtureStores(); await prisma.$disconnect(); });
const accountSnapshot = async () => ({ user: await prisma.user.findUniqueOrThrow({ where: { id: victimID } }),
  wallet: await prisma.loyaltyWallet.findUniqueOrThrow({ where: { lojaID_userID: { lojaID, userID: victimID } } }),
  addresses: await prisma.address.count({ where: { userID: victimID } }), users: await prisma.user.count({ where: { lojaID } }),
  ledger: await prisma.loyaltyTransaction.count({ where: { lojaID } }) });

describe('WF-05 / LA-020: identidade declarada não concede conta', () => {
  it('checkout HTTP convidado com email/ID da vítima preserva perfil, carteira, endereços e histórico da conta', async () => {
    const before = await accountSnapshot();
    const context = await checkoutContext(input());
    const opts = { headers: { Host: host, Cookie: 'freight_owner=' + freightCookie } };
    const proposal = await post('/api/checkout/intents', { ...input(), basketID: context.basketID, customer: { ...customer(), userId: victimID } }, opts);
    expect(proposal.status).toBe(200);
    const q = (proposal.body as any).data;
    const result = await post('/api/checkout', { checkoutIntentID: q.checkoutIntentID, acceptedRevision: q.revision, acceptedContentHash: q.contentHash }, opts);
    expect(result.status).toBe(200);
    const order = (result.body as { data: { order: { id: string; orderAccessToken: string; pointsEarned: number } } }).data.order;
    guestID = order.id; token = order.orderAccessToken;
    expect(token).toMatch(/^[a-zA-Z0-9_-]{43}$/); expect(order.pointsEarned).toBe(0);
    expect(await accountSnapshot()).toEqual(before);
    const stored = await prisma.order.findUniqueOrThrow({ where: { id: guestID }, include: { buyer: true } });
    expect(stored.userID).toBeNull(); expect(stored.addressID).toBeNull();
    expect(stored.buyer).toMatchObject({ authenticatedUserID: null, email: victimEmail, name: 'Comprador Declarado', recoveryTokenHash: hashGuestOrderAccess(token), deliveryAddress: input().address });
    guestBuyerID = stored.buyerID!;
    expect(await getOrdersByUser({ userID: victimID, lojaID })).toHaveLength(0);
  });
  it('recuperação exige token específico, válido e tenant correto; não serializa token/hash ou vínculo de conta', async () => {
    expect((await get(`/api/orders/${guestID}/recovery`, { headers: { Host: host } })).status).toBe(404);
    expect((await get(`/api/orders/${guestID}/recovery`, { headers: { Host: host, 'x-order-access-token': 'A'.repeat(43) } })).status).toBe(404);
    expect((await get(`/api/orders/${guestID}/recovery`, { headers: { Host: otherHost, 'x-order-access-token': token } })).status).toBe(404);
    const recovered = await get(`/api/orders/${guestID}/recovery`, { headers: { Host: host, 'x-order-access-token': token } });
    expect(recovered.status).toBe(200); expect(recovered.body).toMatchObject({ id: guestID, customer: { name: 'Comprador Declarado' }, address: { street: 'Rua' } });
    const json = JSON.stringify(recovered.body);
    for (const privateValue of [token, hashGuestOrderAccess(token), victimID, guestBuyerID]) expect(json).not.toContain(privateValue);
    expect(recovered.headers?.['cache-control']).toBe('no-store');
    expect((await get(`/api/orders/${guestID}/status`, { headers: { Host: host } })).status).toBe(404);
    expect((await get(`/api/orders/${guestID}/status`, { headers: { Host: host, 'x-order-access-token': token } })).status).toBe(200);
    // Matching the declared email in a real session grants no ownership of this guest purchase.
    expect((await get(`/api/orders/${guestID}`, { headers: { Host: host, Cookie: cookie } })).status).toBe(404);
  });
  it('Admin lê comprador/endereço em pedido sem User; DTO não divulga credenciais de recuperação', async () => {
    const detail = await getOrderDetailForAdmin({ orderId: guestID, lojaID });
    expect(detail).toMatchObject({ user: null, customer: { name: 'Comprador Declarado', email: victimEmail }, address: { street: 'Rua', district: 'Centro' } });
    const options = { headers: { Host: host, Cookie: adminCookie } };
    const detailHTTP = await get(`/api/admin/orders/${guestID}`, options); expect(detailHTTP.status).toBe(200);
    expect(detailHTTP.body).toMatchObject({ data: { customer: { name: 'Comprador Declarado' } } });
    const list = await get('/api/admin/orders', options); expect(list.status).toBe(200);
    for (const result of [detailHTTP, list]) { expect(JSON.stringify(result.body)).not.toContain(token); expect(JSON.stringify(result.body)).not.toContain(hashGuestOrderAccess(token)); }
  });
  it('sessão própria vincula conta sem atualizar CPF/telefone; novo email convidado não cria User', async () => {
    const before = await accountSnapshot();
    const ownQuote = await fixtureFreightQuote({ lojaID, ownerKey: 'u:' + victimID, items: [{ productId: productID, variantId: variantID, quantity: 1 }] });
    const accepted = await acceptFixtureCheckout({ ...input(), customer: { ...customer(), userId: victimID }, freightQuoteToken: ownQuote });
    const own = await post('/api/checkout', { checkoutIntentID: accepted.checkoutIntentID, acceptedRevision: accepted.acceptedRevision, acceptedContentHash: accepted.acceptedContentHash }, { headers: { Host: host, Cookie: cookie } }); expect(own.status).toBe(200);
    const ownID = (own.body as { data: { order: { id: string } } }).data.order.id;
    expect(await prisma.order.findUniqueOrThrow({ where: { id: ownID }, include: { buyer: true } })).toMatchObject({ userID: victimID, buyer: { authenticatedUserID: victimID } });
    expect(await accountSnapshot()).toEqual(before);
    const fresh = await createOrder({ ...input(), customer: { ...customer(), email: `${randomUUID()}@example.invalid` } });
    expect(await prisma.order.findUniqueOrThrow({ where: { id: fresh.order.id } })).toMatchObject({ userID: null });
    expect(await accountSnapshot()).toEqual(before);
  });
  it('convidado não resgata pontos e falha reverte comprador/reserva/pedido', async () => {
    const orders = await prisma.order.count({ where: { lojaID } }); const buyers = await prisma.orderBuyer.count({ where: { lojaID } });
    const stock = (await prisma.product.findUniqueOrThrow({ where: { id: productID } })).stock;
    await expect(createOrder({ ...input(), pointsToRedeem: 500 })).rejects.toThrow('Autenticação obrigatória');
    expect(await prisma.order.count({ where: { lojaID } })).toBe(orders); expect(await prisma.orderBuyer.count({ where: { lojaID } })).toBe(buyers);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: productID } })).stock).toBe(stock);
  });
  it('email/chave/token de outra compra não substituem a identidade da intenção', async () => {
    const accepted = await acceptFixtureCheckout(input()); const first = await completeCheckout(accepted);
    const stranger = { ...accepted, freightOwnerKey: 'g:' + randomBytes(32).toString('hex'), orderAccessToken: token, idempotencyKey: randomUUID() };
    await expect(completeCheckout(stranger)).rejects.toThrow('CHECKOUT_INTENT_NOT_FOUND');
    await expect(recoverCheckout(stranger, accepted.checkoutIntentID!)).rejects.toThrow('CHECKOUT_INTENT_NOT_FOUND');
    expect((await completeCheckout({ ...accepted, idempotencyKey: randomUUID() })).order.id).toBe(first.order.id);
  });
  it('transições de convidado não exigem User fictício nem geram pontos na carteira da vítima', async () => {
    const before = await accountSnapshot();
    // A compra é PIX manual: o gateway não pode atestar uma transferência externa.
    expect((await updateOrderStatus({ orderId: guestID, lojaID, newStatus: 'PAID', performedById: 'ASAAS_GATEWAY' })).success).toBe(false);
    expect((await updateOrderStatus({ orderId: guestID, lojaID, newStatus: 'PAID', performedById: adminID })).success).toBe(true);
    expect((await updateOrderStatus({ orderId: guestID, lojaID, newStatus: 'CANCELLED', performedById: 'SYSTEM' })).success).toBe(true);
    expect(await accountSnapshot()).toEqual(before);
    const logs = await prisma.auditLog.findMany({ where: { entityId: guestID, action: { not: 'CHECKOUT_COMMITTED' } } });
    expect(logs).toHaveLength(2); expect(logs.every(log => log.targetId === null)).toBe(true);
    expect(logs.find(log => log.actorType === 'USER')?.actorId).toBe(adminID);
    expect(logs.find(log => log.actorType === 'SYSTEM')).toMatchObject({ actorId: null, systemActor: 'CHECKOUT_COMPENSATION' });
  });
  it('token vencido deixa de autorizar recuperação e polling', async () => {
    await prisma.orderBuyer.update({ where: { id: guestBuyerID }, data: { recoveryExpiresAt: new Date(Date.now() - 1000) } });
    const options = { headers: { Host: host, 'x-order-access-token': token } };
    expect((await get(`/api/orders/${guestID}/recovery`, options)).status).toBe(404);
    expect((await get(`/api/orders/${guestID}/status`, options)).status).toBe(404);
  });
});
