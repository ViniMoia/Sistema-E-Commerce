// Tests a private reviewed snapshot in disposable PostgreSQL only.
// node scripts/verify-main-hml-catalog.mjs path/to/private/source.json
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { catalogPlan, importCatalog } from './import-main-hml-catalog.mjs';
import { STORE_ID } from './import-jt-homologation.mjs';
import { command, provisionPostgres } from './lib/disposable-postgres.mjs';

const source = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const plan = catalogPlan(source);
const duplicate = structuredClone(source);
duplicate.variants.push({ ...duplicate.variants[0], id: 'duplicate-combination-test' });
assert.throws(() => catalogPlan(duplicate), /SOURCE_VARIANTS_INVALID/);
const fixture = await provisionPostgres();
const db = new PrismaClient({ datasources: { db: { url: fixture.env.DATABASE_URL } }, log: [] });
try {
  await command(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env: fixture.env, capture: true });
  await db.loja.create({ data: { id: STORE_ID, slug: 'continental-homologacao', name: 'Test', description: '', coverImageUrl: '' } });
  const user = await db.user.create({ data: { name: 'Test owner', email: 'catalog@example.invalid', password: 'unused-test', role: 'ADMIN', lojaID: STORE_ID } });
  const seed = await db.product.create({ data: { id: 'a26fdbc1-d8c3-4173-b114-f759654b9ca4', name: 'Preserved test product', description: '',
    price: '49.90', imageUrl: '', stock: 94, lojaID: STORE_ID, userID: user.id } });
  const variant = await db.productVariants.create({ data: { ProductID: seed.id, size: 'Pequeno', color: 'Vermelho', stock: 94 } });
  const cart = await db.cart.create({ data: { userID: user.id, lojaID: STORE_ID } });
  const item = await db.cartItem.create({ data: { cartID: cart.id, lojaID: STORE_ID, productID: seed.id, variantID: variant.id,
    quantity: 1, productName: seed.name, price: seed.price, color: variant.color, size: variant.size, imageUrl: '' } });
  const preview = await importCatalog(db, source);
  assert.equal(preview.code, 'READY_TO_IMPORT');
  assert.equal(await db.product.count(), 1);
  await assert.rejects(importCatalog(db, source, { apply: true }), /BACKUP_REQUIRED/);
  await assert.rejects(importCatalog(db, source, { apply: true, backup: () => { throw new Error('BACKUP_FAILED'); } }), /BACKUP_FAILED/);
  const failAudit = { $transaction: (fn, opts) => db.$transaction(tx => fn(new Proxy(tx, {
    get: (obj, key) => key === 'auditLog' ? { create: () => { throw new Error('AUDIT_FAILED'); } } : obj[key],
  })), opts) };
  await assert.rejects(importCatalog(failAudit, source, { apply: true, backup: () => {} }), /AUDIT_FAILED/);
  assert.equal(await db.product.count(), 1);
  assert.equal(await db.brand.count(), 0);
  assert.equal(await db.categoryTag.count(), 0);
  const result = await importCatalog(db, source, { apply: true, backup: value => assert.equal(value.before.products.length, 1) });
  assert.equal(result.products, plan.eligible.length);
  assert.equal(await db.product.count(), 1 + plan.eligible.length);
  assert.deepEqual(await db.product.findUnique({ where: { id: seed.id } }), seed);
  assert.deepEqual(await db.productVariants.findUnique({ where: { id: variant.id } }), variant);
  assert.deepEqual(await db.cartItem.findUnique({ where: { id: item.id } }), item);
  assert.equal(await db.product.count({ where: { id: { in: plan.deferred.map(p => p.id) } } }), 0);
  assert.equal(await db.product.count({ where: { userID: { not: user.id } } }), 0);
  assert.equal((await importCatalog(db, source, { apply: true })).code, 'NO_NEW_RECORDS');
  assert.equal(await db.auditLog.count({ where: { action: 'MAIN_CATALOG_IMPORT' } }), 1);
  await db.loja.update({ where: { id: STORE_ID }, data: { slug: 'wrong-store' } });
  await assert.rejects(importCatalog(db, source, { apply: true }), /HML_SCOPE_INVALID/);
  console.log('PASS: duplicate detection, preview, backup failures, full rollback, commercial data, owner mapping, existing cart/product preservation, quarantine and repeat safety.');
} catch (e) {
  console.error(JSON.stringify({ code: e.code || 'CATALOG_VERIFICATION_FAILED', assertion: e instanceof assert.AssertionError ? e.message : undefined }));
  process.exitCode = 1;
} finally { await db.$disconnect(); await fixture.dispose(); }
