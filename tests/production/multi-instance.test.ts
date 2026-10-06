import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { createFixtureStore, cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { productionOrigins, productionRequest as request, restartSecondaryInstance } from '@/tests/helpers/production-request';

beforeAll(async () => { productionOrigins(); await verifyTestDatabase(); });
afterAll(async () => { await cleanupFixtureStores(); await prisma.$disconnect(); });

async function fixture(stock = 10) {
  const lojaID = await createFixtureStore();
  await prisma.loja.update({ where: { id: lojaID }, data: { enablePickup: true } });
  const author = await prisma.user.create({ data: { lojaID, name: 'Admin', email: randomUUID() + '@example.invalid', password: '', role: 'ADMIN' } });
  const product = await prisma.product.create({ data: { lojaID, userID: author.id, name: 'Produto multi-instance', description: '', imageUrl: '', price: 100, stock,
    productVariants: { create: { size: 'Único', color: 'Padrão', stock } } }, include: { productVariants: true } });
  const host = (await prisma.loja.findUniqueOrThrow({ where: { id: lojaID } })).slug + '.plataforma.com';
  const session = async (userId: string) => ({ Host: host, Cookie: 'session_id=' + (await prisma.session.create({ data: { userId, expiresAt: new Date(Date.now() + 3600000) } })).id });
  const buyer = async () => {
    const user = await prisma.user.create({ data: { lojaID, name: 'Cliente', email: randomUUID() + '@example.invalid', password: '' } });
    return { user, headers: await session(user.id) };
  };
  const addition = { productID: product.id, variantID: product.productVariants[0].id, quantity: 1, commandId: randomUUID() };
  const draft = async (instance: 0 | 1, customer: Awaited<ReturnType<typeof buyer>>) => {
    const cart = await request(instance, 'POST', '/api/cart', { ...addition, commandId: randomUUID() }, customer.headers);
    expect(cart.status).toBe(201);
    const data = cart.body as { id: string; version: number };
    const payload = { lojaID, cartID: data.id, cartVersion: data.version, customer: { name: customer.user.name, email: customer.user.email,
      phone: '11999999999', cpfCnpj: '52998224725' }, items: [{ productId: product.id, variantId: addition.variantID, quantity: 1 }],
      deliveryType: 'PICKUP', paymentMethod: 'WHATSAPP_PIX' };
    const proposal = await request(instance, 'POST', '/api/checkout/intents', payload, customer.headers);
    expect(proposal.status).toBe(200);
    const p = (proposal.body as { data: { checkoutIntentID: string; revision: number; contentHash: string } }).data;
    return { checkoutIntentID: p.checkoutIntentID, acceptedRevision: p.revision, acceptedContentHash: p.contentHash };
  };
  return { lojaID, product, addition, buyer, draft, adminHeaders: await session(author.id) };
}

describe('WF-19: compiled production runtime across independent Next processes', () => {
  it('both instances reject unauthenticated handshakes and external request destinations', async () => {
    const origins = productionOrigins();
    for (const origin of origins) {
      expect((await fetch(origin.baseUrl + '/api/test-environment', { redirect: 'error' })).status).toBe(404);
      expect((await fetch(origin.baseUrl + '/api/test-environment', { headers: { 'x-test-environment-token': 'incorrect' }, redirect: 'error' })).status).toBe(404);
    }
    await expect(request(0, 'POST', 'https://production.invalid/api/cart', {})).rejects.toThrow('Path de homologação');
    await expect(request(1, 'POST', '//production.invalid/api/cart', {})).rejects.toThrow('Path de homologação');
  });

  it('the same cart command arriving at two instances increments once', async () => {
    const f = await fixture(); const buyer = await f.buyer();
    const results = await Promise.all([request(0, 'POST', '/api/cart', f.addition, buyer.headers), request(1, 'POST', '/api/cart', f.addition, buyer.headers)]);
    expect(results.map(r => r.status).sort()).toEqual([200, 201]);
    const carts = await prisma.cart.findMany({ where: { lojaID: f.lojaID, userID: buyer.user.id, status: 'ACTIVE' }, include: { items: true } });
    expect(carts).toHaveLength(1); expect(carts[0].items).toHaveLength(1); expect(carts[0].items[0].quantity).toBe(1);
    expect(await prisma.auditLog.count({ where: { actorId: buyer.user.id, action: 'CART_MUTATED' } })).toBe(1);
  });

  it('competing absolute cart edits on the same revision have one winner', async () => {
    const f = await fixture(); const buyer = await f.buyer();
    const result = await request(0, 'POST', '/api/cart', f.addition, buyer.headers);
    const cart = result.body as { id: string; version: number };
    const change = (quantity: number) => ({ cartId: cart.id, expectedVersion: cart.version, variantID: f.addition.variantID, quantity, commandId: randomUUID() });
    const results = await Promise.all([request(0, 'PATCH', '/api/cart', change(2), buyer.headers), request(1, 'PATCH', '/api/cart', change(3), buyer.headers)]);
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    const stored = await prisma.cart.findUniqueOrThrow({ where: { id: cart.id }, include: { items: true } });
    expect(stored.version).toBe(cart.version + 1); expect([2, 3]).toContain(stored.items[0].quantity);
  });

  it('one accepted intent completes once on both instances and replays after process restart', async () => {
    const f = await fixture(); const buyer = await f.buyer(); const accepted = await f.draft(0, buyer);
    const results = await Promise.all([request(0, 'POST', '/api/checkout', accepted, buyer.headers), request(1, 'POST', '/api/checkout', accepted, buyer.headers)]);
    expect(results.map(r => r.status)).toEqual([200, 200]);
    const first = (results[0].body as { data: { order: { id: string } } }).data;
    expect(results[1].body).toMatchObject({ data: { order: { id: first.order.id } } });
    await restartSecondaryInstance();
    expect((await request(1, 'GET', '/api/checkout/intents/' + accepted.checkoutIntentID, undefined, buyer.headers)).body)
      .toMatchObject({ data: { result: { order: { id: first.order.id } } } });
    expect((await request(1, 'POST', '/api/checkout', accepted, buyer.headers)).body).toMatchObject({ data: { order: { id: first.order.id } } });
    expect(await prisma.order.count({ where: { lojaID: f.lojaID } })).toBe(1);
    expect(await prisma.inventoryReservation.count({ where: { orderId: first.order.id } })).toBe(1);
    expect(await prisma.paymentAttempt.count({ where: { orderId: first.order.id } })).toBe(1);
    expect(await prisma.commerceOutbox.count({ where: { effectKey: 'checkout:' + accepted.checkoutIntentID } })).toBe(1);
    expect((await prisma.productVariants.findUniqueOrThrow({ where: { id: f.addition.variantID } })).stock).toBe(9);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: f.product.id } })).stock).toBe(9);
  });

  it('different buyers competing across processes for the last unit never oversell', async () => {
    const f = await fixture(1); const a = await f.buyer(); const b = await f.buyer();
    const ca = await f.draft(0, a); const cb = await f.draft(1, b);
    const results = await Promise.all([request(0, 'POST', '/api/checkout', ca, a.headers), request(1, 'POST', '/api/checkout', cb, b.headers)]);
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    expect(await prisma.order.count({ where: { lojaID: f.lojaID } })).toBe(1);
    expect(await prisma.inventoryReservation.count({ where: { order: { lojaID: f.lojaID } } })).toBe(1);
    expect((await prisma.productVariants.findUniqueOrThrow({ where: { id: f.addition.variantID } })).stock).toBe(0);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: f.product.id } })).stock).toBe(0);
  });

  it('settings read on a warmed second process reflect a mutation committed by the first', async () => {
    const f = await fixture();
    expect((await request(1, 'GET', '/api/loja/settings', undefined, f.adminHeaders)).body).toMatchObject({ enablePickup: true });
    const changed = await request(0, 'PUT', '/api/loja/settings', { enablePickup: false }, f.adminHeaders);
    expect(changed.status).toBe(200);
    expect((await request(1, 'GET', '/api/loja/settings', undefined, f.adminHeaders)).body).toMatchObject({ enablePickup: false });
  });

  it('a revoked pickup quote and accepted proposal cannot bypass fresh persisted configuration on the other instance', async () => {
    const f = await fixture(); const buyer = await f.buyer(); const accepted = await f.draft(1, buyer);
    const payload = { lojaID: f.lojaID, deliveryType: 'PICKUP', items: [{ productId: f.product.id, variantId: f.addition.variantID, quantity: 1 }] };
    expect((await request(1, 'POST', '/api/freight/calculate', payload, buyer.headers)).status).toBe(200);
    expect((await request(0, 'PUT', '/api/loja/settings', { enablePickup: false }, f.adminHeaders)).status).toBe(200);
    expect((await request(1, 'POST', '/api/freight/calculate', payload, buyer.headers)).status).toBe(503);
    expect((await request(1, 'POST', '/api/checkout', accepted, buyer.headers)).status).toBe(409);
    expect(await prisma.order.count({ where: { lojaID: f.lojaID } })).toBe(0);
    expect(await prisma.inventoryReservation.count({ where: { order: { lojaID: f.lojaID } } })).toBe(0);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: f.product.id } })).stock).toBe(10);
  });
});
