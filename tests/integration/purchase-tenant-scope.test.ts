import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { createFixtureStore, cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { addToCart, getCart, updateCartItemQuantity, removeFromCart } from '@/services/cart.service';
import { getOrderById } from '@/services/order.service';
import { createOrderFromCart } from '@/tests/setup/checkout-fixture';
import { fixtureFreightQuote } from '@/tests/setup/freight-fixture';
import { InventoryService } from '@/services/inventory.service';
import { get, post, patch, del } from '@/tests/helpers/request';

let lojaID: string; let otherLojaID: string; let userID: string; let otherUserID: string; let peerID: string;
let productID: string; let variantID: string; let otherProductID: string; let otherVariantID: string;
let addressID: string; let peerAddressID: string; let cookie: string; let host: string; let otherHost: string;
beforeAll(async () => {
  await verifyTestDatabase();
  lojaID = await createFixtureStore(); otherLojaID = await createFixtureStore();
  const user = (tenant: string) => prisma.user.create({ data: { lojaID: tenant, name: 'Pessoa', email: `${randomUUID()}@example.invalid`, password: '' } });
  userID = (await user(lojaID)).id; otherUserID = (await user(otherLojaID)).id; peerID = (await user(lojaID)).id;
  const product = (tenant: string, owner: string) => prisma.product.create({ data: { lojaID: tenant, userID: owner,
    name: 'Produto', description: '', price: '79.90', stock: 10, imageUrl: '',
    productVariants: { create: { size: 'Único', color: 'Padrão', stock: 10 } } }, include: { productVariants: true } });
  const own = await product(lojaID, userID); productID = own.id; variantID = own.productVariants[0].id;
  const other = await product(otherLojaID, otherUserID); otherProductID = other.id; otherVariantID = other.productVariants[0].id;
  const address = (owner: string) => prisma.address.create({ data: { userID: owner, cep: '01001000', state: 'SP', city: 'São Paulo', district: 'Centro', street: 'Rua', number: '1' } });
  addressID = (await address(userID)).id; peerAddressID = (await address(peerID)).id;
  cookie = `session_id=${(await prisma.session.create({ data: { userId: userID, expiresAt: new Date(Date.now() + 600000) } })).id}`;
  host = `${(await prisma.loja.findUniqueOrThrow({ where: { id: lojaID } })).slug}.plataforma.com`;
  otherHost = `${(await prisma.loja.findUniqueOrThrow({ where: { id: otherLojaID } })).slug}.plataforma.com`;
});
afterAll(async () => { await cleanupFixtureStores(); await prisma.$disconnect(); });
const counts = async () => ({
  carts: await prisma.cart.count({ where: { userID } }), items: await prisma.cartItem.count({ where: { lojaID } }),
  orders: await prisma.order.count({ where: { lojaID } }),
  ownStock: (await prisma.product.findUniqueOrThrow({ where: { id: productID } })).stock,
  otherStock: (await prisma.product.findUniqueOrThrow({ where: { id: otherProductID } })).stock,
});

describe('WF-05 / LA-014: escopo da compra no PostgreSQL e HTTP reais', () => {
  it('serviços recusam produto externo, variante de outro produto e contexto falso antes de escrever', async () => {
    const before = await counts();
    await expect(addToCart(userID, { productID: otherProductID, variantID: otherVariantID, quantity: 1, commandId: randomUUID() })).rejects.toThrow('não pertence');
    await expect(addToCart(userID, { productID, variantID: otherVariantID, quantity: 1, commandId: randomUUID() })).rejects.toThrow('variante válida');
    await expect(addToCart(userID, { productID, variantID, quantity: 1, commandId: randomUUID() }, otherLojaID)).rejects.toThrow('Conta inválida');
    await expect(getCart(userID, otherLojaID)).rejects.toThrow('Conta inválida');
    expect(await counts()).toEqual(before);
  });
  it('constraints recusam conta/carrinho/produto/variante cruzados mesmo com escrita Prisma direta', async () => {
    await expect(prisma.cart.create({ data: { lojaID, userID: otherUserID } })).rejects.toThrow();
    const cart = await prisma.cart.create({ data: { lojaID, userID } });
    const data = { lojaID, cartID: cart.id, productID, variantID, quantity: 1, price: '79.90', productName: 'Produto', imageUrl: '', color: 'Padrão', size: 'Único' };
    await expect(prisma.cartItem.create({ data: { ...data, productID: otherProductID, variantID: otherVariantID } })).rejects.toThrow();
    await expect(prisma.cartItem.create({ data: { ...data, variantID: otherVariantID } })).rejects.toThrow();
    await expect(prisma.cartItem.create({ data: { ...data, lojaID: otherLojaID } })).rejects.toThrow();
    expect(await prisma.cartItem.count({ where: { cartID: cart.id } })).toBe(0);
  });
  it('domínio de outra loja recusa todos os métodos do carrinho, pedidos e checkout', async () => {
    const options = { headers: { Host: otherHost, Cookie: cookie } };
    expect((await get('/api/loja/active', options)).body).toMatchObject({ id: otherLojaID });
    const before = await counts();
    expect((await get('/api/cart', options)).status).toBe(403);
    expect((await post('/api/cart', { productID, variantID, quantity: 1 }, options)).status).toBe(403);
    expect((await patch('/api/cart', { variantID, quantity: 1 }, options)).status).toBe(403);
    expect((await del(`/api/cart?variantID=${variantID}`, options)).status).toBe(403);
    expect((await get('/api/orders', options)).status).toBe(403);
    expect((await post('/api/orders', { cartID: randomUUID(), addressID }, options)).status).toBe(403);
    expect((await post('/api/checkout', { lojaID: otherLojaID, customer: { name: 'Pessoa', email: 'person@example.invalid', phone: '11999999999', cpfCnpj: '52998224725' },
      items: [{ productId: otherProductID, variantId: otherVariantID, name: 'Produto', price: 79.9, quantity: 1 }], deliveryType: 'PICKUP' }, options)).status).toBe(403);
    expect(await counts()).toEqual(before);
  });
  it('reserva valida lote inteiro e não permite trocar produto/tenant de uma variante', async () => {
    const before = await counts();
    await expect(prisma.$transaction(tx => InventoryService.reserveStock([
      { productId: productID, variantId: variantID, quantity: 1 }, { productId: otherProductID, variantId: otherVariantID, quantity: 1 },
    ], tx, lojaID))).rejects.toMatchObject({ code: 'INVALID_SCOPE' });
    await expect(prisma.$transaction(tx => InventoryService.reserveStock([{ productId: productID, variantId: otherVariantID, quantity: 1 }], tx, lojaID))).rejects.toMatchObject({ code: 'INVALID_SCOPE' });
    expect(await counts()).toEqual(before);
  });
  it('carrinho próprio funciona por HTTP; produto alheio e endereço de terceiro são recusados sem efeitos', async () => {
    const options = { headers: { Host: host, Cookie: cookie } };
    expect((await post('/api/cart', { productID, variantID, quantity: 2, commandId: randomUUID() }, options)).status).toBe(201);
    const own = await getCart(userID, lojaID);
    expect(own).toMatchObject({ lojaID, userID, items: [{ variantID, price: 79.9, quantity: 2 }] });
    const before = await counts();
    expect((await post('/api/cart', { productID: otherProductID, variantID: otherVariantID, quantity: 1, commandId: randomUUID() }, options)).status).toBe(400);
    await expect(createOrderFromCart({ userID, lojaID: otherLojaID, cartID: own!.id, addressID })).rejects.toThrow('ACCOUNT_ACCESS_DENIED');
    await expect(createOrderFromCart({ userID, lojaID, cartID: own!.id, addressID: peerAddressID })).rejects.toThrow('ADDRESS_ACCESS_DENIED');
    expect(await counts()).toEqual(before);
    await updateCartItemQuantity(userID, variantID, 3, lojaID, { commandId: randomUUID(), cartId: own!.id, expectedVersion: own!.version });
    expect((await getCart(userID, lojaID))!.items[0].quantity).toBe(3);
  });
  it('pedido alternativo serializa consumo e leitura exige dono ou admin da mesma loja', async () => {
    const cart = (await getCart(userID, lojaID))!;
    const freightQuoteToken = await fixtureFreightQuote({ lojaID, ownerKey: 'u:' + userID, items: cart.items.map(item => ({ productId: item.productID, variantId: item.variantID!, quantity: item.quantity })) });
    const orders = await Promise.allSettled([createOrderFromCart({ userID, lojaID, cartID: cart.id, addressID, freightQuoteToken }), createOrderFromCart({ userID, lojaID, cartID: cart.id, addressID, freightQuoteToken })]);
    const successes = orders.filter(result => result.status === 'fulfilled');
    expect(successes).toHaveLength(2); expect(orders.filter(result => result.status === 'rejected')).toHaveLength(0);
    const order = (successes[0] as PromiseFulfilledResult<Awaited<ReturnType<typeof createOrderFromCart>>>).value;
    expect((await prisma.product.findUniqueOrThrow({ where: { id: productID } })).stock).toBe(7);
    expect((await getOrderById(order.id, { userID, lojaID })).id).toBe(order.id);
    await expect(getOrderById(order.id, { userID: peerID, lojaID })).rejects.toThrow('ORDER_NOT_FOUND');
    await expect(getOrderById(order.id, { userID: otherUserID, lojaID })).rejects.toThrow('ACCOUNT_ACCESS_DENIED');
    expect((await get(`/api/orders/${order.id}`, { headers: { Host: otherHost, Cookie: cookie } })).status).toBe(403);
  });
  it('remover item próprio continua possível e conta bloqueada não escreve', async () => {
    const cart = await addToCart(userID, { productID, variantID, quantity: 1, commandId: randomUUID() }, lojaID);
    await removeFromCart(userID, variantID, lojaID, { commandId: randomUUID(), cartId: cart.id, expectedVersion: cart.version });
    expect((await getCart(userID, lojaID))!.items).toHaveLength(0);
    await prisma.user.update({ where: { id: userID }, data: { status: 'BLOCKED' } });
    const before = await counts();
    await expect(addToCart(userID, { productID, variantID, quantity: 1, commandId: randomUUID() })).rejects.toThrow('Conta inválida');
    expect(await counts()).toEqual(before);
  });
});
