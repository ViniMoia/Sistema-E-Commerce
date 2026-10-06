import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { createFixtureStore, cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { createOrder } from '@/tests/setup/checkout-fixture';
import { updateOrderStatus } from '@/services/order.service';
import { updateOrderStatusAdmin as legacyUpdate } from '@/services/admin.service';
import { post, patch } from '@/tests/helpers/request';

let lojaID: string; let customerID: string; let adminID: string; let foreignAdminID: string;
let host: string; let cookie: string; let adminCookie: string;
const email = `${randomUUID()}@example.invalid`;
beforeAll(async () => {
  await verifyTestDatabase();
  lojaID = await createFixtureStore(); const foreignLoja = await createFixtureStore();
  await prisma.loja.update({ where: { id: lojaID }, data: { loyaltyEnabled: true, loyaltyEarnRate: 1 } });
  customerID = (await prisma.user.create({ data: { lojaID, name: 'Cliente', email, password: '' } })).id;
  adminID = (await prisma.user.create({ data: { lojaID, name: 'Admin', email: `${randomUUID()}@example.invalid`, password: '', role: 'ADMIN' } })).id;
  foreignAdminID = (await prisma.user.create({ data: { lojaID: foreignLoja, name: 'Outro Admin', email: `${randomUUID()}@example.invalid`, password: '', role: 'ADMIN' } })).id;
  const session = async (userId: string) => `session_id=${(await prisma.session.create({ data: { userId, expiresAt: new Date(Date.now() + 600000) } })).id}`;
  cookie = await session(customerID); adminCookie = await session(adminID);
  host = `${(await prisma.loja.findUniqueOrThrow({ where: { id: lojaID } })).slug}.plataforma.com`;
});
afterAll(async () => { await cleanupFixtureStores(); await prisma.$disconnect(); });

const makeOrder = async (deliveryType: 'PICKUP' | 'DELIVERY' = 'PICKUP') => {
  const product = await prisma.product.create({ data: { lojaID, userID: adminID, name: 'Produto', description: '', imageUrl: '', price: 100, stock: 2,
    productVariants: { create: { size: 'Único', color: 'Padrão', stock: 2 } } }, include: { productVariants: true } });
  const result = await createOrder({ lojaID, customer: { userId: customerID, name: 'Cliente', email, phone: '11999999999' },
    deliveryType, paymentMethod: 'WHATSAPP_PIX', items: [{ productId: product.id, variantId: product.productVariants[0].id, name: 'Produto', price: 100, quantity: 1 }],
    ...(deliveryType === 'DELIVERY' ? { address: { cep: '01001000', state: 'SP', city: 'São Paulo', neighborhood: 'Centro', street: 'Rua', number: '1' } } : {}) });
  return { id: result.order.id, productID: product.id, variantID: product.productVariants[0].id };
};
const command = (id: string, newStatus: 'PAID' | 'CANCELLED' | 'SHIPPED' | 'DELIVERED', extra = {}) =>
  updateOrderStatus({ orderId: id, lojaID, newStatus, performedById: adminID, ...extra });
const stock = async (ids: { productID: string; variantID: string }) => [
  (await prisma.product.findUniqueOrThrow({ where: { id: ids.productID } })).stock,
  (await prisma.productVariants.findUniqueOrThrow({ where: { id: ids.variantID } })).stock,
];
const effects = async (id: string) => ({ history: await prisma.orderStatusHistory.count({ where: { orderId: id } }),
  audit: await prisma.auditLog.count({ where: { entity: 'Order', entityId: id, action: { not: 'CHECKOUT_COMMITTED' } } }),
  outbox: await prisma.commerceOutbox.count({ where: { commandType: 'ORDER_STATUS_CHANGED', aggregateId: id } }) });

describe('WF-06: transições de pedido serializadas e atômicas no PostgreSQL', () => {
  it('aprovações concorrentes creditam uma vez sem decrementar novamente o estoque', async () => {
    const order = await makeOrder(); const results = await Promise.all([command(order.id, 'PAID'), command(order.id, 'PAID')]);
    expect(results.every(result => result.success)).toBe(true);
    expect(await stock(order)).toEqual([1, 1]);
    expect(await prisma.loyaltyTransaction.findMany({ where: { orderId: order.id, type: 'EARN' } })).toHaveLength(1);
    expect(await effects(order.id)).toEqual({ history: 1, audit: 1, outbox: 1 });
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({ status: 'PAID', version: 1 });
  });
  it('cancelamentos concorrentes devolvem produto e variante exatamente uma vez', async () => {
    const order = await makeOrder();
    expect((await Promise.all([command(order.id, 'CANCELLED'), command(order.id, 'CANCELLED')])).every(result => result.success)).toBe(true);
    expect(await stock(order)).toEqual([2, 2]); expect(await effects(order.id)).toEqual({ history: 1, audit: 1, outbox: 1 });
  });
  it('cancelamento pago concorrente estorna o crédito uma vez e mantém o saldo anterior', async () => {
    const before = await prisma.loyaltyWallet.findUniqueOrThrow({ where: { lojaID_userID: { lojaID, userID: customerID } } });
    const order = await makeOrder(); expect((await command(order.id, 'PAID')).success).toBe(true);
    await Promise.all([command(order.id, 'CANCELLED'), command(order.id, 'CANCELLED')]);
    const wallet = await prisma.loyaltyWallet.findUniqueOrThrow({ where: { lojaID_userID: { lojaID, userID: customerID } } });
    expect(wallet.balance).toBe(before.balance); expect(wallet.lifetimeEarn).toBe(before.lifetimeEarn);
    expect(await prisma.loyaltyTransaction.count({ where: { orderId: order.id, type: 'REFUND_EARN' } })).toBe(1);
    expect(await stock(order)).toEqual([2, 2]); expect(await effects(order.id)).toEqual({ history: 2, audit: 2, outbox: 2 });
  });
  it('aprovação e cancelamento da mesma versão têm um vencedor e um conflito explícito', async () => {
    const order = await makeOrder(); const results = await Promise.all([
      command(order.id, 'PAID', { expectedVersion: 0 }), command(order.id, 'CANCELLED', { expectedVersion: 0 }),
    ]);
    expect(results.filter(result => result.success)).toHaveLength(1);
    expect(results.filter(result => result.success === false)).toMatchObject([{ code: 'CONFLICT' }]);
    const stored = await prisma.order.findUniqueOrThrow({ where: { id: order.id } }); expect(stored.version).toBe(1);
    expect(await stock(order)).toEqual(stored.status === 'PAID' ? [1, 1] : [2, 2]);
    expect(await prisma.loyaltyTransaction.count({ where: { orderId: order.id, type: 'EARN' } })).toBe(stored.status === 'PAID' ? 1 : 0);
    expect(await effects(order.id)).toEqual({ history: 1, audit: 1, outbox: 1 });
  });
  it('falha real de auditoria após crédito reverte status, carteira, ledger, histórico e outbox', async () => {
    const order = await makeOrder(); const before = await prisma.loyaltyWallet.findUniqueOrThrow({ where: { lojaID_userID: { lojaID, userID: customerID } } });
    await prisma.auditLog.create({ data: { actorType: 'SYSTEM', systemActor: 'PAYMENT_GATEWAY', action: 'TEST_COLLISION', entity: 'Order', entityId: order.id, effectKey: `order:${order.id}:version:1` } });
    await expect(command(order.id, 'PAID')).rejects.toMatchObject({ code: 'P2002' });
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({ status: 'PENDING', version: 0 });
    expect(await prisma.loyaltyWallet.findUniqueOrThrow({ where: { lojaID_userID: { lojaID, userID: customerID } } })).toEqual(before);
    expect(await prisma.loyaltyTransaction.count({ where: { orderId: order.id } })).toBe(0);
    expect(await effects(order.id)).toEqual({ history: 0, audit: 1, outbox: 0 }); expect(await stock(order)).toEqual([1, 1]);
  });
  it('falha real de outbox após estorno reverte também o estoque e os registros da transição', async () => {
    const order = await makeOrder();
    await prisma.commerceOutbox.create({ data: { effectKey: `order:${order.id}:version:1`, commandType: 'ORDER_STATUS_CHANGED', aggregateId: order.id, payload: { test: true } } });
    await expect(command(order.id, 'CANCELLED')).rejects.toMatchObject({ code: 'P2002' });
    expect(await stock(order)).toEqual([1, 1]);
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({ status: 'PENDING', version: 0 });
    expect(await effects(order.id)).toEqual({ history: 0, audit: 0, outbox: 1 });
  });
  it('falha real de histórico depois do crédito reverte o efeito e a auditoria', async () => {
    const order = await makeOrder();
    const before = await prisma.loyaltyWallet.findUniqueOrThrow({ where: { lojaID_userID: { lojaID, userID: customerID } } });
    await prisma.orderStatusHistory.create({ data: { orderId: order.id, status: 'CANCELLED', actorType: 'USER', performedById: adminID, orderVersion: 1 } });
    await expect(command(order.id, 'PAID')).rejects.toMatchObject({ code: 'P2002' });
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({ status: 'PENDING', version: 0 });
    expect(await prisma.loyaltyWallet.findUniqueOrThrow({ where: { lojaID_userID: { lojaID, userID: customerID } } })).toEqual(before);
    expect(await prisma.loyaltyTransaction.count({ where: { orderId: order.id } })).toBe(0);
    expect(await effects(order.id)).toEqual({ history: 1, audit: 0, outbox: 0 }); expect(await stock(order)).toEqual([1, 1]);
  });
  it('banco rejeita recibo sem hash e versão de histórico não positiva', async () => {
    const order = await makeOrder();
    await expect(prisma.orderStatusHistory.create({ data: { orderId: order.id, status: 'PAID', actorType: 'USER', performedById: adminID, commandKey: randomUUID() } })).rejects.toThrow('OrderStatusHistory_command_receipt_check');
    await expect(prisma.orderStatusHistory.create({ data: { orderId: order.id, status: 'PAID', actorType: 'USER', performedById: adminID, orderVersion: 0 } })).rejects.toThrow('OrderStatusHistory_order_version_check');
    expect(await effects(order.id)).toEqual({ history: 0, audit: 0, outbox: 0 });
  });
  it('identidade de comando escopada permite replay e rejeita conteúdo/ator incompatível', async () => {
    const order = await makeOrder(); const extra = { commandId: randomUUID(), expectedVersion: 0, reason: 'Solicitação' };
    expect((await command(order.id, 'CANCELLED', extra)).success).toBe(true);
    expect((await command(order.id, 'CANCELLED', extra)).success).toBe(true);
    expect(await command(order.id, 'CANCELLED', { ...extra, reason: 'Outro motivo' })).toMatchObject({ success: false, code: 'CONFLICT' });
    expect(await command(order.id, 'PAID', extra)).toMatchObject({ success: false, code: 'CONFLICT' });
    expect(await effects(order.id)).toEqual({ history: 1, audit: 1, outbox: 1 }); expect(await stock(order)).toEqual([2, 2]);
  });
  it('usuário comum, ator SYSTEM inventado e Admin de outra loja não obtêm autoridade; adapter legado propaga falha', async () => {
    const order = await makeOrder();
    for (const performedById of [customerID, foreignAdminID, 'SYSTEM_FORGED']) {
      expect(await updateOrderStatus({ orderId: order.id, lojaID, newStatus: 'PAID', performedById })).toMatchObject({ success: false, code: 'FORBIDDEN' });
    }
    expect(await command(order.id, 'DELIVERED', { confirmReceipt: true })).toMatchObject({ success: false, code: 'FORBIDDEN' });
    expect(await legacyUpdate({ orderId: order.id, newStatus: 'SHIPPED', performedById: adminID })).toMatchObject({ success: false, code: 'INVALID_TRANSITION' });
    expect(await effects(order.id)).toEqual({ history: 0, audit: 0, outbox: 0 });
  });
  it('confirmação do titular usa o comando central e registra autoria, versão, histórico e outbox', async () => {
    const order = await makeOrder(); expect((await command(order.id, 'PAID')).success).toBe(true);
    const confirmed = await post(`/api/orders/${order.id}/confirm-delivery`, {}, { headers: { Host: host, Cookie: cookie } });
    expect(confirmed.status).toBe(200);
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({ status: 'DELIVERED', version: 2, deliveredConfirmedBy: customerID });
    expect(await effects(order.id)).toEqual({ history: 2, audit: 2, outbox: 2 });
    expect(await prisma.orderStatusHistory.findFirstOrThrow({ where: { orderId: order.id, status: 'DELIVERED' } })).toMatchObject({ previousStatus: 'PAID', actorType: 'USER', performedById: customerID });
    expect((await post(`/api/orders/${order.id}/confirm-delivery`, {}, { headers: { Host: host, Cookie: cookie } })).status).toBe(400);
    expect(await stock(order)).toEqual([1, 1]);
  });
  it('endpoint Admin preserva conflito/versionamento e não aceita ator SYSTEM do corpo', async () => {
    const order = await makeOrder(); const commandId = randomUUID(); const options = { headers: { Host: host, Cookie: adminCookie } };
    expect((await patch(`/api/admin/orders/${order.id}/status`, { newStatus: 'PAID', commandId, expectedVersion: 0, actor: { type: 'SYSTEM', code: 'ORDER_TIMEOUT' } }, options)).status).toBe(200);
    expect((await patch(`/api/admin/orders/${order.id}/status`, { newStatus: 'CANCELLED', expectedVersion: 0 }, options)).status).toBe(409);
    expect(await prisma.orderStatusHistory.findFirstOrThrow({ where: { orderId: order.id } })).toMatchObject({ actorType: 'USER', performedById: adminID, systemActor: null });
    expect(await effects(order.id)).toEqual({ history: 1, audit: 1, outbox: 1 });
  });
  it('webhook de legado preserva evento para conciliação sem inferir autorização financeira', async () => {
    const order = await makeOrder(); const paymentId = 'pay_' + randomUUID(); const eventID = 'evt_' + randomUUID();
    expect((await command(order.id, 'CANCELLED')).success).toBe(true);
    await prisma.order.update({ where: { id: order.id }, data: { adminNotes: 'Nota anterior', asaasPaymentId: paymentId } });
    const payload = { id: eventID, event: 'PAYMENT_CONFIRMED', payment: { id: paymentId, billingType: 'PIX', status: 'CONFIRMED', value: 100, externalReference: order.id } };
    const options = { headers: { Host: host, 'asaas-access-token': process.env.ASAAS_WEBHOOK_TOKEN! } };
    for (let i=0;i<2;i++) {
      const response = await post('/api/webhooks/asaas', payload, options); expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ received: true, status: 'RECEIVED' });
    }
    expect(await prisma.paymentInbox.count({ where: { eventId: eventID } })).toBe(1);
    const current = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(current.status).toBe('CANCELLED'); expect(current.adminNotes).toBe('Nota anterior'); expect(await stock(order)).toEqual([2, 2]);
    // New protocol late-payment effects and typed financial actors are proved
    // separately by the controlled real-DB durable execution suite.
  });});
