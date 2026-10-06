import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { randomUUID, createHash } from 'node:crypto';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { createFixtureStore, cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { createOrder } from '@/tests/setup/checkout-fixture';
import { updateOrderStatus } from '@/services/order.service';
import { updateProduct, getProducts } from '@/services/product.service';
import { adjustInventory, type InventoryCommand } from '@/lib/commerce/inventory-command';
import { post, put } from '@/tests/helpers/request';

let lojaID: string; let adminID: string; let customerID: string; let foreignAdminID: string; let foreignLojaID: string;
let host: string; let foreignHost: string; let adminCookie: string; let customerCookie: string;
const email = `${randomUUID()}@example.invalid`;
beforeAll(async () => {
  await verifyTestDatabase(); lojaID = await createFixtureStore(); foreignLojaID = await createFixtureStore();
  adminID = (await prisma.user.create({ data: { lojaID, name: 'Admin', email: `${randomUUID()}@example.invalid`, password: '', role: 'ADMIN' } })).id;
  customerID = (await prisma.user.create({ data: { lojaID, name: 'Cliente', email, password: '' } })).id;
  foreignAdminID = (await prisma.user.create({ data: { lojaID: foreignLojaID, name: 'Outro', email: `${randomUUID()}@example.invalid`, password: '', role: 'ADMIN' } })).id;
  const session = async (userId: string) => `session_id=${(await prisma.session.create({ data: { userId, expiresAt: new Date(Date.now() + 600000) } })).id}`;
  adminCookie = await session(adminID); customerCookie = await session(customerID);
  host = `${(await prisma.loja.findUniqueOrThrow({ where: { id: lojaID } })).slug}.plataforma.com`;
  foreignHost = `${(await prisma.loja.findUniqueOrThrow({ where: { id: foreignLojaID } })).slug}.plataforma.com`;
});
afterAll(async () => { await cleanupFixtureStores(); await prisma.$disconnect(); });

const makeProduct = () => prisma.product.create({ data: { lojaID, userID: adminID, name: 'Produto', description: '', imageUrl: '', price: 100, stock: 10,
  productVariants: { create: [{ size: 'M', color: 'Azul', stock: 5 }, { size: 'G', color: 'Azul', stock: 5 }] } }, include: { productVariants: true } });
type Product = Awaited<ReturnType<typeof makeProduct>>;
const edit = (product: Product, variants = product.productVariants) => updateProduct(product.id, { expectedCatalogVersion: product.catalogVersion, variants }, lojaID, adminID);
const buy = (product: Product) => createOrder({ lojaID, customer: { userId: customerID, name: 'Cliente', email, phone: '11999999999' }, deliveryType: 'PICKUP', paymentMethod: 'WHATSAPP_PIX',
  items: [{ productId: product.id, variantId: product.productVariants[0].id, name: 'Produto', price: 100, quantity: 1 }] });
const count = (product: Product, extra: Partial<InventoryCommand> = {}) => adjustInventory(product.id, lojaID, adminID,
  { commandId: randomUUID(), mode: 'ABSOLUTE', quantity: 10, expectedVersion: 0, reason: 'Conferência física', ...extra });
const read = (id: string) => prisma.product.findUniqueOrThrow({ where: { id }, include: { productVariants: { orderBy: { size: 'asc' } } } });

describe('WF-07: catalog, inventory and order share protected PostgreSQL writes', () => {
  it('catalog revision cannot be negative even through direct database writes', async () => {
    const product = await makeProduct();
    await expect(prisma.product.update({ where: { id: product.id }, data: { catalogVersion: -1 } })).rejects.toThrow('Product_catalog_version_check');
    expect((await read(product.id)).catalogVersion).toBe(0);
  });
  it('old full form after a sale cannot replace quantities; new variant starts at zero', async () => {
    const product = await makeProduct(); await buy(product);
    const changed = await updateProduct(product.id, { name: 'Nome novo', stock: 10, expectedCatalogVersion: 0,
      variants: [...product.productVariants, { size: 'P', color: 'Azul', stock: 99 }] }, lojaID, adminID);
    expect(changed).toMatchObject({ stock: 9, catalogVersion: 1 });
    expect(changed!.productVariants.find(v => v.id === product.productVariants[0].id)).toMatchObject({ stock: 4, inventoryVersion: 1 });
    expect(changed!.productVariants.find(v => v.size === 'P')).toMatchObject({ stock: 0 });
  });
  it('reserve → retire → cancel preserves links, records unavailable destination and cannot resell', async () => {
    const product = await makeProduct(); const { order } = await buy(product); const variantId = product.productVariants[0].id;
    await edit(product, [product.productVariants[1]]);
    expect(await prisma.productVariants.findUniqueOrThrow({ where: { id: variantId } })).toMatchObject({ stock: 0, unavailableStock: 4, retiredAt: expect.any(Date) });
    const command = { orderId: order.id, lojaID, newStatus: 'CANCELLED' as const, performedById: adminID, commandId: randomUUID() };
    expect((await updateOrderStatus(command)).success).toBe(true); expect((await updateOrderStatus(command)).success).toBe(true);
    expect(await read(product.id)).toMatchObject({ stock: 9, unavailableStock: 1 });
    expect(await prisma.productVariants.findUniqueOrThrow({ where: { id: variantId } })).toMatchObject({ stock: 0, unavailableStock: 5, retiredAt: expect.any(Date) });
    expect(await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } })).toMatchObject({ productVariantsId: variantId });
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityId: order.id, action: 'ORDER_STATUS_UPDATED' } });
    expect(audit.metadata).toMatchObject({ inventoryReleases: [{ productId: product.id, variantId, quantity: 1, destination: 'UNAVAILABLE' }] });
    const catalogAudit = await prisma.auditLog.findFirstOrThrow({ where: { entityId: product.id, action: 'PRODUCT_UPDATED' } });
    expect(catalogAudit.metadata).toMatchObject({ withdrawals: [{ variantId, availableBefore: 4, unavailableBefore: 0, unavailableAfter: 4 }] });
    await expect(buy(product)).rejects.toThrow();
    expect(await prisma.order.count({ where: { lojaID, items: { some: { productId: product.id } } } })).toBe(1);
    expect((await getProducts({ lojaId: lojaID, all: true })).find(p => p.id === product.id)!.productVariants.map(v => v.id)).toEqual([product.productVariants[1].id]);
  });
  it('metadata revision prevents a stale form from retiring or reactivating variants', async () => {
    const product = await makeProduct(); await edit(product, [product.productVariants[1]]);
    await expect(edit(product)).rejects.toThrow('CATALOG_VERSION_CONFLICT');
    await expect(updateProduct(product.id, { variants: product.productVariants }, lojaID, adminID)).rejects.toThrow('CATALOG_VERSION_REQUIRED');
    await expect(updateProduct(product.id, { expectedCatalogVersion: 1, variants: product.productVariants }, lojaID, adminID)).rejects.toThrow('VARIANT_REACTIVATION_REQUIRED');
    const variant = product.productVariants[0];
    await expect(count(product, { variantId: variant.id, expectedVersion: 1 })).rejects.toMatchObject({ code: 'RETIRED' });
    const reactivated = await count(product, { variantId: variant.id, mode: 'REACTIVATE', quantity: 5, expectedVersion: 1 });
    expect(reactivated).toMatchObject({ stock: 5, unavailableStock: 0, replay: false });
    expect(await read(product.id)).toMatchObject({ catalogVersion: 2 });
    await expect(updateProduct(product.id, { expectedCatalogVersion: 1, variants: [product.productVariants[1]] }, lojaID, adminID)).rejects.toThrow('CATALOG_VERSION_CONFLICT');
  });
  it('retired combination cannot be recreated under a new ID', async () => {
    const product = await makeProduct(); await edit(product, [product.productVariants[1]]);
    await expect(updateProduct(product.id, { expectedCatalogVersion: 1, variants: [product.productVariants[1], { size: ' m ', color: 'AZUL', stock: 10 }] }, lojaID, adminID)).rejects.toThrow('VARIANT_COMBINATION_RETIRED');
    expect((await read(product.id)).productVariants).toHaveLength(2);
  });
  it('an old retired duplicate does not prevent editing its existing active combination', async () => {
    const product = await makeProduct(); const active = product.productVariants[0];
    const duplicate = await prisma.productVariants.create({ data: { ProductID: product.id, size: active.size, color: active.color, stock: 0, unavailableStock: 3, retiredAt: new Date() } });
    expect(await edit(product)).toMatchObject({ catalogVersion: 1 });
    expect(await prisma.productVariants.findUniqueOrThrow({ where: { id: duplicate.id } })).toMatchObject({ unavailableStock: 3, retiredAt: expect.any(Date) });
    await expect(count(product, { variantId: duplicate.id, mode: 'REACTIVATE', quantity: 3, expectedVersion: 0 })).rejects.toMatchObject({ code: 'CONFLICT' });
  });
  it('omitting the variant cannot buy withdrawn stock or skip a distinct dimension', async () => {
    const product = await makeProduct();
    const omitted = () => createOrder({ lojaID, customer: { userId: customerID, name: 'Cliente', email, phone: '11999999999' }, deliveryType: 'PICKUP', paymentMethod: 'WHATSAPP_PIX', items: [{ productId: product.id, quantity: 1 }] });
    await expect(omitted()).rejects.toThrow('CHECKOUT_VARIANT_UNAVAILABLE');
    await prisma.productVariants.updateMany({ where: { ProductID: product.id }, data: { retiredAt: new Date(), stock: 0 } }); // owned invalid legacy fixture
    await expect(omitted()).rejects.toThrow('CHECKOUT_VARIANT_UNAVAILABLE');
    expect((await read(product.id)).stock).toBe(10);
    expect(await prisma.order.count({ where: { items: { some: { productId: product.id } } } })).toBe(0);
  });
  it('two absolute adjustments from one revision cannot both commit', async () => {
    const product = await makeProduct();
    const attempts = await Promise.allSettled([count(product, { quantity: 12 }), count(product, { quantity: 14 })]);
    expect(attempts.filter(a => a.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.find(a => a.status === 'rejected')).toMatchObject({ reason: { code: 'CONFLICT' } });
    expect(await prisma.auditLog.count({ where: { entityId: product.id, action: 'INVENTORY_ADJUSTED' } })).toBe(1);
    expect((await read(product.id)).inventoryVersion).toBe(1);
  });
  it('distinct concurrent deltas accumulate; duplicate command/retry cannot add twice', async () => {
    const product = await makeProduct(); const command: InventoryCommand = { commandId: randomUUID(), mode: 'DELTA', quantity: 2, reason: 'Reposição' };
    const commands = [command, { ...command, commandId: randomUUID(), quantity: 3 }];
    await Promise.all(commands.map(c => adjustInventory(product.id, lojaID, adminID, c)));
    expect((await read(product.id)).stock).toBe(15);
    expect(await adjustInventory(product.id, lojaID, adminID, command)).toMatchObject({ stock: 15, replay: true });
    await expect(adjustInventory(product.id, lojaID, adminID, { ...command, reason: 'Outro motivo' })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await prisma.auditLog.count({ where: { entityId: product.id, action: 'INVENTORY_ADJUSTED' } })).toBe(2);
  });
  it('an inventory audit failure rolls back the quantities and versions', async () => {
    const product = await makeProduct(); const commandId = randomUUID();
    const effectKey = `inventory:${createHash('sha256').update(JSON.stringify([lojaID, product.id, commandId])).digest('hex')}`;
    // A short-lived constraint on this fixture's audits forces failure after
    // the command's inventory writes. Only the sentinel-verified disposable DB.
    const constraint = `wf07_test_${randomUUID().replaceAll('-', '')}`;
    if (!/^[a-zA-Z0-9_-]+$/.test(product.id)) throw new Error('Invalid fixture ID');
    await prisma.$executeRawUnsafe(`ALTER TABLE "AuditLog" ADD CONSTRAINT "${constraint}" CHECK ("entityId" <> '${product.id}' OR action <> 'INVENTORY_ADJUSTED')`);
    try { await expect(count(product, { commandId, variantId: product.productVariants[0].id, quantity: 9 })).rejects.toThrow(); }
    finally { await prisma.$executeRawUnsafe(`ALTER TABLE "AuditLog" DROP CONSTRAINT "${constraint}"`); }
    expect(await read(product.id)).toMatchObject({ stock: 10, inventoryVersion: 0 });
    expect((await read(product.id)).productVariants.every(v => v.stock === 5 && v.inventoryVersion === 0)).toBe(true);
    expect(await prisma.auditLog.count({ where: { effectKey } })).toBe(0);
  });
  it('only empty unlinked variants are physically removed; linked or physical quantities survive', async () => {
    const product = await makeProduct(); const empty = await prisma.productVariants.create({ data: { ProductID: product.id, size: 'P', color: 'Azul', stock: 0 } });
    const linked = await prisma.productVariants.create({ data: { ProductID: product.id, size: 'PP', color: 'Azul', stock: 0 } });
    const cart = await prisma.cart.create({ data: { lojaID, userID: customerID, status: 'ABANDONED' } });
    await prisma.cartItem.create({ data: {
      cartID: cart.id, lojaID, productID: product.id, variantID: linked.id, quantity: 1, price: 100, productName: 'Produto', imageUrl: '', size: 'PP', color: 'Azul',
    } });
    await edit(product, [product.productVariants[1]]);
    expect(await prisma.productVariants.findUnique({ where: { id: empty.id } })).toBeNull();
    expect(await prisma.productVariants.findUniqueOrThrow({ where: { id: product.productVariants[0].id } })).toMatchObject({ stock: 0, unavailableStock: 5, retiredAt: expect.any(Date) });
    expect(await prisma.productVariants.findUniqueOrThrow({ where: { id: linked.id } })).toMatchObject({ stock: 0, retiredAt: expect.any(Date) });
    expect(await prisma.cartItem.findFirstOrThrow({ where: { cartID: cart.id } })).toMatchObject({ variantID: linked.id });
  });
  it('authorization, tenant and variant ownership cannot be supplied in an adjustment body', async () => {
    const product = await makeProduct(); const other = await makeProduct();
    const body: InventoryCommand = { commandId: randomUUID(), mode: 'ABSOLUTE', quantity: 20, expectedVersion: 0, reason: 'Contagem' };
    await expect(adjustInventory(product.id, lojaID, customerID, body)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(adjustInventory(product.id, lojaID, foreignAdminID, body)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(adjustInventory(product.id, foreignLojaID, foreignAdminID, body)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(count(product, { variantId: other.productVariants[0].id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const path = `/api/products/${product.id}/inventory`; const options = { headers: { Host: host, Cookie: adminCookie } };
    expect((await post(path, { ...body, actorId: 'forged' }, options)).status).toBe(422);
    expect((await post(path, body, { headers: { Host: host, Cookie: customerCookie } })).status).toBe(403);
    expect((await post(path, body, { headers: { Host: foreignHost, Cookie: adminCookie } })).status).toBe(403);
    expect((await post(path, body, options)).status).toBe(200);
    expect((await post(path, body, options)).body).toMatchObject({ data: { stock: 20, replay: true } });
    expect((await post(path, { ...body, commandId: randomUUID() }, options)).status).toBe(409);
    expect((await put(`/api/products/${product.id}`, { name: 'Catálogo editado', stock: 10 }, options)).status).toBe(200);
    expect((await read(product.id)).stock).toBe(20);
  });
  it('catalog withdrawal and purchase competing for the same variant cannot bypass retirement', async () => {
    const product = await makeProduct();
    const results = await Promise.allSettled([buy(product), edit(product, [product.productVariants[1]])] as const);
    expect(results[1].status).toBe('fulfilled');
    const variantId = product.productVariants[0].id;
    if (results[0].status === 'fulfilled') {
      const order = results[0].value.order;
      expect((await updateOrderStatus({ orderId: order.id, lojaID, newStatus: 'CANCELLED', performedById: adminID })).success).toBe(true);
    }
    expect(await prisma.productVariants.findUniqueOrThrow({ where: { id: variantId } })).toMatchObject({ stock: 0, unavailableStock: 5, retiredAt: expect.any(Date) });
    await expect(buy(product)).rejects.toThrow();
  });
});
