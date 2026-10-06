import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { createFixtureStore, cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { addToCart, getCart, updateCartItemQuantity, removeFromCart } from '@/services/cart.service';
import { createOrderFromCart } from '@/tests/setup/checkout-fixture';
import { fixtureFreightQuote } from '@/tests/setup/freight-fixture';
import { CommerceLocks } from '@/lib/commerce/locks';
import { get, post, patch, del } from '@/tests/helpers/request';

let lojaID: string; let authorID: string; let productID: string; let variantID: string; let host: string;
beforeAll(async () => {
  await verifyTestDatabase(); lojaID = await createFixtureStore();
  authorID = (await prisma.user.create({ data: { lojaID, name: 'Admin', email: `${randomUUID()}@example.invalid`, password: '', role: 'ADMIN' } })).id;
  const product = await prisma.product.create({ data: { lojaID, userID: authorID, name: 'Produto', description: '', price: '79.90', imageUrl: '', stock: 100,
    productVariants: { create: { size: 'Único', color: 'Padrão', stock: 100 } } }, include: { productVariants: true } });
  productID = product.id; variantID = product.productVariants[0].id;
  host = `${(await prisma.loja.findUniqueOrThrow({ where: { id: lojaID } })).slug}.plataforma.com`;
});
afterAll(async () => { await cleanupFixtureStores(); await prisma.$disconnect(); });
const buyer = async () => (await prisma.user.create({ data: { lojaID, name: 'Cliente', email: `${randomUUID()}@example.invalid`, password: '' } })).id;
const addition = (quantity = 1) => ({ productID, variantID, quantity, commandId: randomUUID() });
const add = (userID: string, data = addition()) => addToCart(userID, data, lojaID);
const versioned = (cart: { id: string; version: number }) => ({ commandId: randomUUID(), cartId: cart.id, expectedVersion: cart.version });
const receipts = (userID: string) => prisma.auditLog.count({ where: { entity: 'Cart', actorId: userID, action: 'CART_MUTATED' } });

describe('WF-08 / LA-017: owner scope, row lock, revision and mutation receipt', () => {
  it('two initial creations converge to one active cart and preserve both increments', async () => {
    const userID = await buyer(); const results = await Promise.all([add(userID), add(userID)]);
    expect(new Set(results.map(r => r.id)).size).toBe(1);
    expect(results.map(r => r.version).sort()).toEqual([1, 2]);
    expect(await prisma.cart.count({ where: { userID, lojaID, status: 'ACTIVE' } })).toBe(1);
    expect(await getCart(userID, lojaID)).toMatchObject({ version: 2, items: [{ quantity: 2 }] });
    expect(await receipts(userID)).toBe(2);
  });
  it('simultaneous retries of the first inclusion create one cart, one item and one receipt', async () => {
    const userID = await buyer(); const input = addition(); const results = await Promise.all([add(userID, input), add(userID, input)]);
    expect(results.filter(r => r.replay)).toHaveLength(1);
    expect(await getCart(userID, lojaID)).toMatchObject({ version: 1, items: [{ quantity: 1 }] });
    expect(await receipts(userID)).toBe(1);
  });
  it('quantity1 plus two distinct inclusions becomes3; response loss/replay keeps3', async () => {
    const userID = await buyer(); await add(userID); const input = addition();
    const results = await Promise.all([add(userID, input), add(userID)]);
    expect(results.map(r => r.version).sort()).toEqual([2, 3]);
    expect(await add(userID, input)).toMatchObject({ version: 3, replay: true, items: [{ quantity: 3 }] });
    await expect(add(userID, { ...input, quantity: 2 })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await receipts(userID)).toBe(3);
  });
  it('the same revision cannot accept two absolute writes, and a retry can replay the winning one', async () => {
    const userID = await buyer(); const cart = await add(userID); const a = versioned(cart); const b = versioned(cart);
    const results = await Promise.allSettled([updateCartItemQuantity(userID, variantID, 3, lojaID, a), updateCartItemQuantity(userID, variantID, 4, lojaID, b)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find(r => r.status === 'rejected')).toMatchObject({ reason: { code: 'CONFLICT' } });
    const winner = results[0].status === 'fulfilled' ? { command: a, quantity: 3 } : { command: b, quantity: 4 };
    expect(await updateCartItemQuantity(userID, variantID, winner.quantity, lojaID, winner.command)).toMatchObject({ version: 2, replay: true, items: [{ quantity: winner.quantity }] });
    expect(await receipts(userID)).toBe(2);
  });
  it('removal replay does not fail on missing item or resurrect it through a stale PATCH', async () => {
    const userID = await buyer(); const cart = await add(userID); const command = versioned(cart);
    expect(await removeFromCart(userID, variantID, lojaID, command)).toMatchObject({ version: 2, items: [] });
    expect(await removeFromCart(userID, variantID, lojaID, command)).toMatchObject({ version: 2, replay: true, items: [] });
    await expect(updateCartItemQuantity(userID, variantID, 1, lojaID, versioned(cart))).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await receipts(userID)).toBe(2);
  });
  it('concurrent additions cannot cross the quantity limit, even with enough stock', async () => {
    const userID = await buyer(); await add(userID, addition(98));
    const results = await Promise.allSettled([add(userID), add(userID)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(await getCart(userID, lojaID)).toMatchObject({ version: 2, items: [{ quantity: 99 }] });
    expect(await receipts(userID)).toBe(2);
  });
  it('different variants share the product limit without overwriting its independent physical counts', async () => {
    const userID = await buyer();
    const product = await prisma.product.create({ data: { lojaID, userID: authorID, name: 'Limite geral', description: '', price: 10, imageUrl: '', stock: 2,
      productVariants: { create: [{ size: 'M', color: 'Azul', stock: 2 }, { size: 'G', color: 'Azul', stock: 2 }] } }, include: { productVariants: true } });
    const a = product.productVariants[0].id; const b = product.productVariants[1].id;
    const include = (variantID: string) => addToCart(userID, { productID: product.id, variantID, quantity: 1, commandId: randomUUID() }, lojaID);
    await include(a); const cart = await include(b);
    await expect(include(a)).rejects.toThrow('Insufficient stock');
    await expect(updateCartItemQuantity(userID, a, 2, lojaID, versioned(cart))).rejects.toThrow('Insufficient stock');
    expect(await getCart(userID, lojaID)).toMatchObject({ version: 2 });
    expect((await getCart(userID, lojaID))!.items.map(item => item.quantity).sort()).toEqual([1, 1]);
    expect(await receipts(userID)).toBe(2);
    expect(await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).toMatchObject({ stock: 2 });
  });
  it('mutation versus consumption is serialized; old commands cannot target a subsequent cart', async () => {
    const userID = await buyer(); const originalInput = addition(); const cart = await add(userID, originalInput);
    const address = await prisma.address.create({ data: { userID, cep: '01001000', state: 'SP', city: 'São Paulo', district: 'Centro', street: 'Rua', number: '1' } });
    const freightQuoteToken = await fixtureFreightQuote({ lojaID, ownerKey: 'u:' + userID, items: [{ productId: productID, variantId: variantID, quantity: 1 }] });
    const results = await Promise.allSettled([createOrderFromCart({ userID, lojaID, cartID: cart.id, addressID: address.id, freightQuoteToken }),
      addToCart(userID, { ...addition(), cartId: cart.id }, lojaID)] as const);
    if (results[0].status === 'rejected') {
      // An addition that wins changes the quoted content. Consumption must
      // refuse the old quote, rather than purchasing the changed cart.
      expect(['FREIGHT_REQUOTE_REQUIRED', 'CHECKOUT_CART_CHANGED']).toContain(results[0].reason.message);
      expect(results[1].status).toBe('fulfilled');
      expect(await getCart(userID, lojaID)).toMatchObject({ id: cart.id, version: 2, items: [{ quantity: 2 }] });
      expect(await prisma.order.count({ where: { lojaID, userID } })).toBe(0);
      const renewed = await fixtureFreightQuote({ lojaID, ownerKey: 'u:' + userID, items: [{ productId: productID, variantId: variantID, quantity: 2 }] });
      await createOrderFromCart({ userID, lojaID, cartID: cart.id, addressID: address.id, freightQuoteToken: renewed });
    }
    const completed = await prisma.cart.findUniqueOrThrow({ where: { id: cart.id } });
    expect(completed.status).toBe('COMPLETED');
    expect(completed.version).toBe(results[1].status === 'fulfilled' ? 3 : 2);
    const next = await add(userID); expect(next.id).not.toBe(cart.id);
    expect(await add(userID, originalInput)).toMatchObject({ id: cart.id, status: 'COMPLETED', replay: true });
    expect(await getCart(userID, lojaID)).toMatchObject({ id: next.id, version: 1, items: [{ quantity: 1 }] });
    await expect(updateCartItemQuantity(userID, variantID, 3, lojaID, versioned(cart))).rejects.toMatchObject({ code: 'CONFLICT' });
  });
  it('audit failure rolls back cart creation, item insertion, revision and receipt together', async () => {
    const userID = await buyer(); const constraint = `wf08_test_${randomUUID().replaceAll('-', '')}`;
    if (!/^[a-zA-Z0-9_-]+$/.test(userID)) throw new Error('Invalid fixture ID');
    await prisma.$executeRawUnsafe(`ALTER TABLE "AuditLog" ADD CONSTRAINT "${constraint}" CHECK ("actorId" <> '${userID}' OR action <> 'CART_MUTATED')`);
    try { await expect(add(userID)).rejects.toThrow(); }
    finally { await prisma.$executeRawUnsafe(`ALTER TABLE "AuditLog" DROP CONSTRAINT "${constraint}"`); }
    expect(await prisma.cart.count({ where: { userID } })).toBe(0);
    expect(await receipts(userID)).toBe(0);
  });
  it('DB partial uniqueness allows old carts but rejects two ACTIVE rows for the same owner', async () => {
    const userID = await buyer(); await add(userID);
    await expect(prisma.cart.create({ data: { lojaID, userID } })).rejects.toMatchObject({ code: 'P2002' });
    await prisma.cart.create({ data: { lojaID, userID, status: 'COMPLETED' } });
    await prisma.cart.create({ data: { lojaID, userID, status: 'ABANDONED' } });
    const indexes = await prisma.$queryRaw<Array<{ definition: string }>>`SELECT pg_get_indexdef(indexrelid) AS definition FROM pg_index WHERE indexrelid = '"Cart_active_owner_key"'::regclass`;
    expect(indexes[0].definition).toContain('UNIQUE'); expect(indexes[0].definition).toContain('ACTIVE');
  });
  it('lock order puts owner creation after intent and before cart/product locks', async () => {
    const userID = await buyer(); const cart = await add(userID);
    await prisma.$transaction(async tx => {
      const locks = new CommerceLocks(tx); await locks.acquireCartOwner(lojaID, userID);
      await locks.acquire('cart', [cart.id]); await locks.acquire('product', [productID]);
      await locks.acquireCartOwner(lojaID, userID); // already held, safe no-op
      await expect(locks.acquireCartOwner(lojaID, authorID)).rejects.toThrow('Inversão');
    });
    await prisma.$transaction(async tx => {
      const locks = new CommerceLocks(tx); await locks.acquire('cart', [cart.id]);
      await expect(locks.acquireCartOwner(lojaID, userID)).rejects.toThrow('Inversão');
    });
  });
  it('HTTP returns the committed version/snapshot, rejects legacy writes and exposes conflicts', async () => {
    const userID = await buyer(); const cookie = `session_id=${(await prisma.session.create({ data: { userId: userID, expiresAt: new Date(Date.now() + 600000) } })).id}`;
    const options = { headers: { Host: host, Cookie: cookie } }; const input = addition();
    expect((await post('/api/cart', { productID, variantID, quantity: 1 }, options)).status).toBe(400);
    expect((await post('/api/cart', { ...input, actorId: authorID }, options)).status).toBe(400);
    const first = await post('/api/cart', input, options); expect(first.status).toBe(201);
    const cart = first.body as { id: string; version: number }; expect(cart).toMatchObject({ version: 1, items: [{ quantity: 1 }] });
    expect((await post('/api/cart', input, options)).body).toMatchObject({ id: cart.id, version: 1, replay: true });
    expect((await patch('/api/cart', { variantID, quantity: 2 }, options)).status).toBe(400);
    const change = versioned(cart); expect((await patch('/api/cart', { variantID, quantity: 2, ...change }, options)).body).toMatchObject({ version: 2, items: [{ quantity: 2 }] });
    expect((await patch('/api/cart', { variantID, quantity: 3, ...change }, options)).status).toBe(409);
    expect((await patch('/api/cart', { variantID, quantity: 3, ...versioned(cart) }, options)).status).toBe(409);
    const query = new URLSearchParams({ variantID, cartId: cart.id, expectedVersion: '2', commandId: randomUUID() });
    expect((await del(`/api/cart?${query}`, options)).body).toMatchObject({ version: 3, items: [] });
    expect((await del(`/api/cart?${query}`, options)).body).toMatchObject({ version: 3, replay: true, items: [] });
    expect((await get('/api/cart', options)).body).toMatchObject({ version: 3, items: [] });
  });
});
