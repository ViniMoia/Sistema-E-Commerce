import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { randomUUID, createHash } from 'node:crypto';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { createFixtureStore, cleanupFixtureStores } from '@/tests/setup/fixture-scope';
import { applyNuvemshopBindings, type BindingCommand } from '@/lib/integrations/nuvemshop-binding-writer';
import type { CatalogReadResult } from '@/lib/integrations/nuvemshop-catalog-reader';

let storeId: string, actorId: string;
beforeAll(async () => {
  await verifyTestDatabase();
  storeId = await createFixtureStore();
  actorId = (await prisma.user.create({ data: { lojaID: storeId, name: 'Synthetic admin', email: `${randomUUID()}@example.invalid`, password: '', role: 'ADMIN' } })).id;
});
afterAll(async () => { await cleanupFixtureStores(); await prisma.$disconnect(); });

async function fixture(count = 1) {
  const products = [];
  const remote: CatalogReadResult['remote'] = { environment: 'isolated', storeId: 'synthetic-shop', products: [] };
  for (let i = 0; i < count; i++) {
    const remoteProduct = randomUUID(), remoteVariant = randomUUID(), code = `00-${randomUUID()}`;
    const p = await prisma.product.create({ data: { lojaID: storeId, userID: actorId, name: 'Synthetic', description: '', imageUrl: '', price: 25, stock: 9,
      nuvemshopProductId: remoteProduct, sku: code, productVariants: { create: { size: 'Único', color: 'Padrão', stock: 9 } } }, include: { productVariants: true } });
    products.push(p);
    remote.products.push({ id: remoteProduct, storeId: remote.storeId, variants: [{ id: remoteVariant, productId: remoteProduct, sku: null, barcode: code, size: 'default', color: 'Padrão' }] });
  }
  const at = new Date().toISOString();
  const catalog: CatalogReadResult = { purpose: 'IDENTITY_REVIEW_ONLY', canApply: false, remote, issues: [], observations: [],
    scan: { pages: 1, productCount: count, requestCount: 2, startedAt: at, completedAt: at, readComplete: true, translationComplete: true, atomicSnapshot: false } };
  const command: BindingCommand = { target: 'ISOLATED', operation: 'BIND_EXISTING_VARIANTS_ONLY', commandId: randomUUID(), storeId,
    remoteStoreId: remote.storeId, actorId, backupReference: 'synthetic-disposable-fixture', linkAuditReference: 'synthetic-links',
    products: products.map((p, i) => ({ localProductId: p.id, remoteProductId: p.nuvemshopProductId!, catalogVersion: p.catalogVersion,
      variants: [{ localVariantId: p.productVariants[0].id, remoteVariantId: remote.products[i].variants[0].id }] })) };
  return { products, catalog, command };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
const apply = (f: Fixture) => applyNuvemshopBindings(process.env.TEST_DATABASE_URL!, f.command, f.catalog);
const read = (id: string) => prisma.product.findUniqueOrThrow({ where: { id }, include: { productVariants: true } });

describe('Nuvemshop offline bindings on sentinel-verified disposable PostgreSQL', () => {
  it('binds existing IDs, preserves stock/price/versions and cart/order references, and replays once', async () => {
    const f = await fixture(); const p = f.products[0], variant = p.productVariants[0];
    const cart = await prisma.cart.create({ data: { userID: actorId, lojaID: storeId, items: { create: {
      productID: p.id, variantID: variant.id, quantity: 1, productName: p.name, price: p.price,
      color: variant.color, size: variant.size, imageUrl: '' } } }, include: { items: true } });
    const order = await prisma.order.create({ data: { lojaID: storeId, userID: actorId, deliveryType: 'PICKUP', subtotal: 25, total: 25,
      items: { create: { productId: p.id, productVariantsId: variant.id, name: p.name, quantity: 1, price: 25 } } }, include: { items: true } });
    const reservation = await prisma.inventoryReservation.create({ data: { orderId: order.id, orderItemId: order.items[0].id, productId: p.id, variantId: variant.id, quantity: 1 } });
    const result = await apply(f);
    expect(result).toMatchObject({ replay: false, changedVariants: 1 });
    const after = await read(p.id);
    expect(after).toMatchObject({ id: p.id, stock: p.stock, price: p.price, inventoryVersion: p.inventoryVersion, catalogVersion: 1, retiredAt: null });
    expect(after.productVariants).toHaveLength(1);
    expect(after.productVariants[0]).toMatchObject({ id: variant.id, stock: variant.stock, inventoryVersion: variant.inventoryVersion, nuvemshopVariantId: f.command.products[0].variants[0].remoteVariantId });
    expect(await prisma.cartItem.findUnique({ where: { id: cart.items[0].id } })).toMatchObject({ productID: p.id, variantID: variant.id, quantity: 1 });
    expect(await prisma.orderItem.findUnique({ where: { id: order.items[0].id } })).toEqual(order.items[0]);
    expect(await prisma.inventoryReservation.findUnique({ where: { id: reservation.id } })).toEqual(reservation);
    expect((await prisma.auditLog.findUniqueOrThrow({ where: { effectKey: result.effectKey } })).metadata).toMatchObject({
      linkCounts: { carts: [{ variantID: variant.id, _count: { _all: 1 } }],
        orders: [{ productVariantsId: variant.id, _count: { _all: 1 } }], reservations: [{ variantId: variant.id, _count: { _all: 1 } }] } });
    expect(await apply(f)).toMatchObject({ replay: true, changedVariants: 0 });
    expect(await prisma.auditLog.count({ where: { effectKey: result.effectKey } })).toBe(1);
    expect((await read(p.id)).catalogVersion).toBe(1);
  });

  it('serializes two simultaneous deliveries of the same operation', async () => {
    const f = await fixture();
    const results = await Promise.all([apply(f), apply(f)]);
    expect(results.filter(r => r.replay)).toHaveLength(1);
    expect(results.reduce((n, r) => n + r.changedVariants, 0)).toBe(1);
    expect((await read(f.products[0].id)).catalogVersion).toBe(1);
  });

  it('rejects a different operation from the same stale catalog version', async () => {
    const f = await fixture(); const second = { ...f, command: structuredClone(f.command) }; second.command.commandId = randomUUID();
    const results = await Promise.allSettled([apply(f), apply(second)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find(r => r.status === 'rejected')).toMatchObject({ reason: { message: 'NUVEMSHOP_BINDING_VERSION_CONFLICT' } });
  });

  it('does not replace an existing different binding or accept a substituted barcode', async () => {
    const f = await fixture();
    f.catalog.remote.products[0].variants[0].barcode = 'different';
    await expect(apply(f)).rejects.toThrow('IDENTITY_CONFLICT');
    expect((await read(f.products[0].id)).productVariants[0].nuvemshopVariantId).toBeNull();
    f.catalog.remote.products[0].variants[0].barcode = f.products[0].sku;
    await prisma.productVariants.update({ where: { id: f.products[0].productVariants[0].id }, data: { nuvemshopVariantId: 'another-binding' } });
    await expect(apply(f)).rejects.toThrow('IDENTITY_CONFLICT');
  });

  it('detects an external variant ID used outside the approved batch', async () => {
    const f = await fixture(), other = await fixture();
    await prisma.productVariants.update({ where: { id: other.products[0].productVariants[0].id }, data: { nuvemshopVariantId: f.command.products[0].variants[0].remoteVariantId } });
    await expect(apply(f)).rejects.toThrow('IDENTITY_CONFLICT');
    expect((await read(f.products[0].id)).catalogVersion).toBe(0);
  });

  it('detects a second local product sharing the remote parent', async () => {
    const f = await fixture(), other = await fixture();
    await prisma.product.update({ where: { id: other.products[0].id }, data: { nuvemshopProductId: f.command.products[0].remoteProductId } });
    await expect(apply(f)).rejects.toThrow('IDENTITY_CONFLICT');
  });

  it('rejects an incomplete batch variant list and retired variants', async () => {
    const f = await fixture();
    await prisma.productVariants.create({ data: { ProductID: f.products[0].id, size: 'G', color: 'Azul', stock: 0, retiredAt: new Date() } });
    await expect(apply(f)).rejects.toThrow('IDENTITY_CONFLICT');
  });

  it('checks the current product revision after acquiring locks', async () => {
    const f = await fixture();
    let release!: () => void, locked!: () => void;
    const acquired = new Promise<void>(resolve => { locked = resolve; });
    const hold = new Promise<void>(resolve => { release = resolve; });
    const concurrentEdit = prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Product" WHERE id=${f.products[0].id} FOR UPDATE`;
      locked(); await hold;
      await tx.product.update({ where: { id: f.products[0].id }, data: { catalogVersion: { increment: 1 } } });
    });
    await acquired;
    const writing = apply(f);
    try {
      let waiting = false;
      for (let i = 0; i < 60; i++) {
        const [row] = await prisma.$queryRaw<Array<{ waiting: boolean }>>`SELECT EXISTS (
          SELECT 1 FROM pg_locks WHERE relation='"Product"'::regclass AND mode='ExclusiveLock' AND NOT granted
        ) AS waiting`;
        if (row.waiting) { waiting = true; break; }
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      expect(waiting).toBe(true);
    } finally { release(); await concurrentEdit; }
    await expect(writing).rejects.toThrow('VERSION_CONFLICT');
  });

  it('rolls back every product if audit insertion fails after the binding writes', async () => {
    const f = await fixture(2); const constraint = `binding_test_${randomUUID().replaceAll('-', '')}`;
    const effectKey = `nuvemshop-binding:${createHash('sha256').update(JSON.stringify([storeId, f.command.commandId])).digest('hex')}`;
    await prisma.$executeRawUnsafe(`ALTER TABLE "AuditLog" ADD CONSTRAINT "${constraint}" CHECK ("effectKey" <> '${effectKey}')`);
    try { await expect(apply(f)).rejects.toThrow(); }
    finally { await prisma.$executeRawUnsafe(`ALTER TABLE "AuditLog" DROP CONSTRAINT "${constraint}"`); }
    for (const p of f.products) {
      const after = await read(p.id);
      expect(after.catalogVersion).toBe(0);
      expect(after.productVariants[0].nuvemshopVariantId).toBeNull();
      expect(after.stock).toBe(9);
    }
  });

  it('validates all products before changing any member of the batch', async () => {
    const f = await fixture(2); f.command.products[1].catalogVersion = 100;
    await expect(apply(f)).rejects.toThrow('VERSION_CONFLICT');
    for (const p of f.products) expect((await read(p.id)).productVariants[0].nuvemshopVariantId).toBeNull();
  });

  it('rejects a reused command with different contents', async () => {
    const f = await fixture(); await apply(f); f.command.linkAuditReference = 'different-reference';
    await expect(apply(f)).rejects.toThrow('COMMAND_REUSED');
  });

  it('does not replay success over a subsequently changed local state', async () => {
    const f = await fixture(); await apply(f);
    await prisma.productVariants.update({ where: { id: f.products[0].productVariants[0].id }, data: { nuvemshopVariantId: null } });
    await expect(apply(f)).rejects.toThrow('REPLAY_STATE_CHANGED');
  });

  it('rejects a variant ID belonging to another product', async () => {
    const f = await fixture(), other = await fixture();
    f.command.products[0].variants[0].localVariantId = other.products[0].productVariants[0].id;
    await expect(apply(f)).rejects.toThrow('IDENTITY_CONFLICT');
  });

  it('rejects tenant/actor mismatches without writes', async () => {
    const f = await fixture(); f.command.storeId = await createFixtureStore();
    await expect(apply(f)).rejects.toThrow('SCOPE_REJECTED');
  });

  it.each(['stale', 'incomplete', 'translation', 'scope'] as const)('rejects %s remote evidence', async kind => {
    const f = await fixture();
    if (kind === 'stale') f.catalog.scan.startedAt = new Date(Date.now() - 610000).toISOString();
    if (kind === 'incomplete') f.catalog.scan.productCount++;
    if (kind === 'translation') f.catalog.scan.translationComplete = false;
    if (kind === 'scope') f.catalog.remote.storeId = 'other';
    await expect(apply(f)).rejects.toThrow('CATALOG_NOT_FRESH_OR_COMPLETE');
  });

  it('refuses duplicate identities, extra fields and missing provenance', async () => {
    const f = await fixture();
    f.command.products.push(f.command.products[0]);
    await expect(apply(f)).rejects.toThrow('DUPLICATE_COMMAND_IDENTITY');
    f.command.products.pop();
    await expect(applyNuvemshopBindings(process.env.TEST_DATABASE_URL!, { ...f.command, stock: 5 }, f.catalog)).rejects.toThrow('INVALID_COMMAND');
    f.command.backupReference = '';
    await expect(apply(f)).rejects.toThrow('INVALID_COMMAND');
  });

  it('refuses main and arbitrary targets before opening a database connection', async () => {
    const f = await fixture(); f.command.target = 'HOMOLOGACAO';
    await expect(applyNuvemshopBindings('postgresql://fake:fake@main.invalid/neondb', f.command, f.catalog)).rejects.toThrow('TARGET_REJECTED');
    await expect(apply(f)).rejects.toThrow('TARGET_REJECTED');
  });
});
