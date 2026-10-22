import { createHash } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { CommerceLocks } from '@/lib/commerce/locks';
import { assertTestDatabaseIdentity, testDatabaseConfig, type TestDatabaseIdentity } from '@/lib/testing/database-policy';
import { planNuvemshopVariantMapping, type VariantMappingInput } from './nuvemshop-variant-mapping';
import type { CatalogReadResult } from './nuvemshop-catalog-reader';

const id = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
const commandSchema = z.object({
  target: z.enum(['ISOLATED', 'HOMOLOGACAO']),
  operation: z.literal('BIND_EXISTING_VARIANTS_ONLY'),
  commandId: z.string().uuid(), storeId: id, remoteStoreId: id, actorId: id,
  // References are audit provenance, not programmatic proof of backup usability.
  backupReference: z.string().trim().min(1).max(200),
  linkAuditReference: z.string().trim().min(1).max(200),
  products: z.array(z.object({
    localProductId: id, remoteProductId: id, catalogVersion: z.number().int().nonnegative(),
    variants: z.array(z.object({ localVariantId: id, remoteVariantId: id }).strict()).min(1).max(200),
  }).strict()).min(1).max(600),
}).strict();
export type BindingCommand = z.infer<typeof commandSchema>;
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail = (code: string): never => { throw new Error(`NUVEMSHOP_BINDING_${code}`); };

/** Offline maintenance primitive: no route, CLI, env loader or provider mutation.
 * Caller must review the explicit batch, verify backup/audit references and obtain
 * a fresh catalog with the authenticated reader before invocation. Never pass a
 * browser-supplied CatalogReadResult. No remote I/O occurs inside the transaction.
 */
export async function applyNuvemshopBindings(connectionString: string, input: unknown, catalogInput: CatalogReadResult) {
  const catalog = structuredClone(catalogInput);
  const parsed = commandSchema.safeParse(input);
  if (!parsed.success) return fail('INVALID_COMMAND');
  const command = parsed.data;
  command.products.sort((a, b) => a.localProductId.localeCompare(b.localProductId));
  command.products.forEach(p => p.variants.sort((a, b) => a.localVariantId.localeCompare(b.localVariantId)));
  const unique = (values: string[]) => new Set(values).size === values.length;
  if (!unique(command.products.map(p => p.localProductId)) || !unique(command.products.map(p => p.remoteProductId))
    || !unique(command.products.flatMap(p => p.variants.map(v => v.localVariantId)))
    || !unique(command.products.flatMap(p => p.variants.map(v => v.remoteVariantId)))) return fail('DUPLICATE_COMMAND_IDENTITY');

  let target: URL;
  try { target = new URL(connectionString); } catch { return fail('TARGET_REJECTED'); }
  if (command.target === 'ISOLATED') {
    if (target.href !== testDatabaseConfig().url) return fail('TARGET_REJECTED');
  } else {
    if (!['postgres:', 'postgresql:'].includes(target.protocol)
      || target.hostname.replace('-pooler', '') !== 'ep-blue-feather-b6l24gbu.c-2.sa-east-1.aws.neon.tech'
      || target.pathname !== '/neondb' || !target.username || !target.password || target.hash
      || [...target.searchParams.keys()].some(k => !['sslmode', 'channel_binding', 'schema', 'connection_limit', 'connect_timeout'].includes(k))
      || [...target.searchParams.keys()].some(k => target.searchParams.getAll(k).length !== 1)
      || (target.searchParams.has('schema') && target.searchParams.get('schema') !== 'public')
      || command.storeId !== '3a82b33c-3646-4272-9a89-80bb1ba327a5' || command.remoteStoreId !== '8179726') return fail('TARGET_REJECTED');
  }
  const started = Date.parse(catalog?.scan?.startedAt), completed = Date.parse(catalog?.scan?.completedAt);
  const now = Date.now();
  if (!Number.isFinite(started) || !Number.isFinite(completed) || started > completed || completed > now
    || now - started > 600000 || catalog.scan.readComplete !== true || catalog.scan.translationComplete !== true
    || catalog.issues.length || catalog.remote.storeId !== command.remoteStoreId
    || catalog.scan.productCount !== catalog.remote.products.length) return fail('CATALOG_NOT_FRESH_OR_COMPLETE');
  const catalogHash = hash(catalog.remote);
  const commandHash = hash(command);
  const effectKey = `nuvemshop-binding:${hash([command.storeId, command.commandId])}`;
  const db = new PrismaClient({ datasources: { db: { url: target.href } }, log: [] });
  try {
    if (command.target === 'ISOLATED') {
      const rows = await db.$queryRaw<TestDatabaseIdentity[]>`
        SELECT current_database() AS database, current_user AS role, s.run_id AS "runId",
          r.rolsuper AS superuser, r.rolcreatedb AS "createDb"
        FROM public."_TestDatabaseSentinel" s JOIN pg_roles r ON r.rolname=current_user WHERE s.id=1`;
      assertTestDatabaseIdentity(rows.length === 1 ? rows[0] : undefined);
    }
    return await db.$transaction(async tx => {
      await tx.$executeRawUnsafe("SET LOCAL lock_timeout='5s'");
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout='20s'");
      const store = await tx.loja.findUnique({ where: { id: command.storeId }, select: { slug: true, nuvemshopStoreId: true } });
      const actor = await tx.user.findFirst({ where: { id: command.actorId, lojaID: command.storeId, role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } });
      if (!store || !actor || (command.target === 'HOMOLOGACAO' && store.slug !== 'continental-homologacao')
        || (store.nuvemshopStoreId && store.nuvemshopStoreId !== command.remoteStoreId)) return fail('SCOPE_REJECTED');
      // This bounded offline batch also excludes uncooperative catalog writers
      // during validation. No schema-wide uniqueness guarantee after commit.
      // EXCLUSIVE also waits for SELECT FOR UPDATE (ROW SHARE). A weaker
      // SHARE ROW EXCLUSIVE lock would let an editor hold a row and then block
      // its UPDATE while we wait for that row, producing a lock-upgrade deadlock.
      // Ordinary SELECT remains available. Use only in an offline maintenance window.
      await tx.$executeRawUnsafe('LOCK TABLE "Product", "ProductVariants" IN EXCLUSIVE MODE');
      const locks = new CommerceLocks(tx);
      const ids = command.products.map(p => p.localProductId);
      const owned = await tx.product.count({ where: { id: { in: ids }, lojaID: command.storeId } });
      if (owned !== ids.length) return fail('SCOPE_REJECTED');
      await locks.acquire('product', ids);
      await locks.acquire('variant', command.products.flatMap(p => p.variants.map(v => v.localVariantId)));
      if (Date.now() - started > 600000) return fail('CATALOG_NOT_FRESH_OR_COMPLETE');
      // Read all products of this tenant, including retired rows, to catch a
      // remote ID already assigned outside the requested batch.
      const products = await tx.product.findMany({ where: { lojaID: command.storeId }, select: {
        id: true, lojaID: true, sku: true, nuvemshopProductId: true, catalogVersion: true, retiredAt: true,
        productVariants: { select: { id: true, ProductID: true, sku: true, size: true, color: true, retiredAt: true, nuvemshopVariantId: true } },
      } });
      const local: VariantMappingInput['local'] = { environment: catalog.remote.environment, storeId: command.storeId,
        products: products.map(p => ({ id: p.id, storeId: p.lojaID, sku: p.sku, remoteProductId: p.nuvemshopProductId,
          catalogVersion: p.catalogVersion, lifecycle: p.retiredAt ? 'RETIRED' : 'ACTIVE',
          variants: p.productVariants.map(v => ({ id: v.id, productId: v.ProductID, sku: v.sku, size: v.size, color: v.color,
            remoteVariantId: v.nuvemshopVariantId, lifecycle: v.retiredAt ? 'RETIRED' : 'ACTIVE' })) })) };
      const plan = planNuvemshopVariantMapping({ expected: { environment: local.environment, localStoreId: command.storeId, remoteStoreId: command.remoteStoreId }, local, remote: catalog.remote });
      if (plan.errors.length) return fail('IDENTITY_CONFLICT');
      const prior = await tx.auditLog.findUnique({ where: { effectKey } });
      const metadata = prior?.metadata as { commandHash?: string; versions?: Record<string, number> } | null;
      if (prior && (prior.action !== 'NUVEMSHOP_VARIANTS_BOUND' || metadata?.commandHash !== commandHash)) return fail('COMMAND_REUSED');
      const changes: Array<{ productId: string; variantId: string; remoteVariantId: string }> = [];
      const versions: Record<string, number> = Object.create(null);
      for (const approved of command.products) {
        const proposed = plan.products.find(p => p.localProductId === approved.localProductId);
        const current = local.products.find(p => p.id === approved.localProductId)!;
        if (!proposed || proposed.status !== 'CANDIDATE' || proposed.remoteProductId !== approved.remoteProductId
          || hash(proposed.variants.map(v => ({ localVariantId: v.localVariantId, remoteVariantId: v.remoteVariantId }))) !== hash(approved.variants)) return fail('IDENTITY_CONFLICT');
        if (current.catalogVersion !== (prior ? metadata?.versions?.[current.id] : approved.catalogVersion)) return fail('VERSION_CONFLICT');
        for (const binding of approved.variants) {
          const existing = current.variants.find(v => v.id === binding.localVariantId)!;
          const other = local.products.some(p => p.variants.some(v => v.id !== existing.id && v.remoteVariantId === binding.remoteVariantId));
          if (other || (existing.remoteVariantId && existing.remoteVariantId !== binding.remoteVariantId)) return fail('IDENTITY_CONFLICT');
          if (!existing.remoteVariantId) changes.push({ productId: current.id, variantId: existing.id, remoteVariantId: binding.remoteVariantId });
        }
        versions[current.id] = current.catalogVersion! + (changes.some(c => c.productId === current.id) ? 1 : 0);
      }
      if (prior) {
        if (changes.length) return fail('REPLAY_STATE_CHANGED');
        return { replay: true, changedVariants: 0, effectKey, versions };
      }
      const variantIds = command.products.flatMap(p => p.variants.map(v => v.localVariantId));
      // Counts only: record existing references before writes, without customer
      // or order payloads. All selected variants already belong to this tenant.
      const linkCounts = {
        carts: await tx.cartItem.groupBy({ by: ['variantID'], where: { variantID: { in: variantIds } }, _count: { _all: true } }),
        orders: await tx.orderItem.groupBy({ by: ['productVariantsId'], where: { productVariantsId: { in: variantIds } }, _count: { _all: true } }),
        reservations: await tx.inventoryReservation.groupBy({ by: ['variantId'], where: { variantId: { in: variantIds } }, _count: { _all: true } }),
      };
      for (const change of changes) {
        const updated = await tx.productVariants.updateMany({ where: { id: change.variantId, ProductID: change.productId, nuvemshopVariantId: null }, data: { nuvemshopVariantId: change.remoteVariantId } });
        if (updated.count !== 1) return fail('IDENTITY_CONFLICT');
      }
      for (const productId of new Set(changes.map(c => c.productId))) {
        await tx.product.update({ where: { id: productId }, data: { catalogVersion: { increment: 1 } } });
      }
      // Audit and bindings commit or roll back together. No stock, order,
      // price, retirement, inventoryVersion or product/variant insertion.
      await tx.auditLog.create({ data: { action: 'NUVEMSHOP_VARIANTS_BOUND', entity: 'Loja', entityId: command.storeId,
        actorId: command.actorId, effectKey,
        previousValue: changes.map(c => ({ variantId: c.variantId, remoteVariantId: null })), newValue: changes,
        metadata: { commandHash, versions, linkCounts, remoteStoreId: command.remoteStoreId, catalogHash,
          catalogReadAt: catalog.scan.completedAt, backupReference: command.backupReference, linkAuditReference: command.linkAuditReference } } });
      return { replay: false, changedVariants: changes.length, effectKey, versions };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 10000, timeout: 60000 });
  } finally { await db.$disconnect(); }
}
