// main is read-only. HML insertion only; never overwrites existing products.
// MAIN_DIRECT_URL / HML_DIRECT_URL are supplied in memory, not loaded from .env.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import ts from 'typescript';
import { PrismaClient } from '@prisma/client';
import { sourceUrl, SOURCE_ID } from './sync-main-hml-freight-settings.mjs';
import { targetUrl, STORE_ID } from './import-jt-homologation.mjs';

// Use the domain normalizer, rather than maintaining another variant policy.
const variantModule = { exports: {} };
new Function('exports', 'module', ts.transpileModule(fs.readFileSync(new URL('../lib/product-variants.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(variantModule.exports, variantModule);
const { canonicalizeVariant, getVariantCombinationKey } = variantModule.exports;
const seedId = 'a26fdbc1-d8c3-4173-b114-f759654b9ca4';
const productFields = ['id', 'name', 'description', 'price', 'imageUrl', 'galleryUrls', 'stock', 'sku', 'nuvemshopProductId',
  'stockBuffer', 'weightInGrams', 'lengthCm', 'widthCm', 'heightCm', 'freeShipping', 'brandID', 'tagsSearchCache'];
const variantFields = ['id', 'ProductID', 'size', 'color', 'stock', 'sku', 'nuvemshopVariantId'];
const brandFields = ['id', 'name', 'slug', 'logoUrl', 'description', 'websiteUrl', 'isActive'];
const categoryFields = ['id', 'name', 'slug', 'group', 'icon', 'order'];
const pick = (o, keys) => Object.fromEntries(keys.map(k => [k, o[k]]));
const digest = o => createHash('sha256').update(JSON.stringify(o)).digest('hex');
function check(ok, code) { if (!ok) throw new Error(code); }

export async function readCatalog(db) {
  return db.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout='20s'");
    const [scope] = await tx.$queryRawUnsafe("SELECT current_setting('transaction_read_only') AS ro");
    const [store] = await tx.$queryRawUnsafe('SELECT id,slug FROM public."Loja" WHERE id=$1', SOURCE_ID);
    check(scope.ro === 'on' && store?.slug === 'continental-prototipo', 'SOURCE_SCOPE_INVALID');
    const read = async (sql, fields) => (await tx.$queryRawUnsafe(sql, SOURCE_ID)).map(row => pick(row, fields));
    const products = await read('SELECT * FROM public."Product" WHERE "lojaID"=$1 ORDER BY id', productFields);
    const variants = await read('SELECT v.* FROM public."ProductVariants" v JOIN public."Product" p ON p.id=v."ProductID" WHERE p."lojaID"=$1 ORDER BY v.id', variantFields);
    const brands = await read('SELECT * FROM public."Brand" WHERE "lojaID"=$1 ORDER BY id', brandFields);
    const categories = await read('SELECT * FROM public."CategoryTag" WHERE "lojaID"=$1 ORDER BY id', categoryFields);
    const links = await read('SELECT t.* FROM public."ProductCategoryTag" t JOIN public."Product" p ON p.id=t."productID" WHERE p."lojaID"=$1 ORDER BY t."productID",t."categoryTagID"', ['productID', 'categoryTagID']);
    // Convert Decimal values before hashing/saving: same hash after JSON roundtrip.
    return JSON.parse(JSON.stringify({ sourceId: SOURCE_ID, readOnly: true, products, variants, brands, categories, links }));
  }, { isolationLevel: 'RepeatableRead', timeout: 60000 });
}

export function catalogPlan(source) {
  check(source.sourceId === SOURCE_ID && source.readOnly === true, 'SOURCE_SCOPE_INVALID');
  for (const rows of [source.products, source.variants, source.brands, source.categories]) {
    check(new Set(rows.map(r => r.id)).size === rows.length, 'SOURCE_DUPLICATE_ID');
  }
  const productIds = new Set(source.products.map(p => p.id));
  const brandIds = new Set(source.brands.map(b => b.id));
  const categoryIds = new Set(source.categories.map(c => c.id));
  check(source.variants.every(v => productIds.has(v.ProductID)), 'SOURCE_VARIANT_ORPHAN');
  check(source.links.every(l => productIds.has(l.productID) && categoryIds.has(l.categoryTagID)), 'SOURCE_CATEGORY_ORPHAN');
  const eligible = [], deferred = [];
  for (const p of source.products) {
    const vs = source.variants.filter(v => v.ProductID === p.id);
    check(!p.brandID || brandIds.has(p.brandID), 'SOURCE_BRAND_ORPHAN');
    check(vs.length > 0 && new Set(vs.map(getVariantCombinationKey)).size === vs.length, 'SOURCE_VARIANTS_INVALID');
    check([p, ...vs].every(v => Number.isSafeInteger(v.stock) && v.stock >= 0), 'SOURCE_STOCK_INVALID');
    check(Number.isFinite(Number(p.price)) && Number(p.price) >= 0 && Number.isInteger(p.stockBuffer) && p.stockBuffer >= 0,
      'SOURCE_PRODUCT_INVALID');
    check(['weightInGrams', 'lengthCm', 'widthCm', 'heightCm'].every(k => Number.isInteger(p[k]) && p[k] > 0), 'SOURCE_DIMENSIONS_INVALID');
    const variantSum = vs.reduce((sum, v) => sum + v.stock, 0);
    if (p.stock !== variantSum) deferred.push({ id: p.id, name: p.name, stock: p.stock, variantSum });
    else eligible.push(p);
  }
  return { eligible, deferred, sourceHash: digest(source) };
}

async function targetState(tx) {
  return { products: await tx.product.findMany({ orderBy: { id: 'asc' } }),
    variants: await tx.productVariants.findMany({ orderBy: { id: 'asc' } }),
    brands: await tx.brand.findMany({ orderBy: { id: 'asc' } }),
    categories: await tx.categoryTag.findMany({ orderBy: { id: 'asc' } }),
    links: await tx.productCategoryTag.findMany({ orderBy: [{ productID: 'asc' }, { categoryTagID: 'asc' }] }) };
}

export async function importCatalog(db, source, { apply = false, backup } = {}) {
  const plan = catalogPlan(source);
  return db.$transaction(async tx => {
    if (!apply) await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    await tx.$executeRawUnsafe("SET LOCAL lock_timeout='5s'");
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout='30s'");
    if (apply) {
      await tx.$executeRawUnsafe('LOCK TABLE public."Product",public."ProductVariants",public."Brand",public."CategoryTag",public."ProductCategoryTag" IN SHARE ROW EXCLUSIVE MODE');
      await tx.$queryRawUnsafe('SELECT id FROM public."Product" ORDER BY id FOR UPDATE');
    }
    const stores = await tx.loja.findMany({ select: { id: true, slug: true } });
    check(stores.length === 1 && stores[0].id === STORE_ID && stores[0].slug === 'continental-homologacao', 'HML_SCOPE_INVALID');
    const accounts = await tx.paymentAttempt.findMany({ select: { providerAccount: true }, distinct: ['providerAccount'] });
    check(accounts.every(a => a.providerAccount === 'sandbox-hml'), 'HML_ACCOUNTS_INVALID');
    const before = await targetState(tx);
    const seed = before.products.find(p => p.id === seedId);
    check(seed && seed.lojaID === STORE_ID && before.products.every(p => p.lojaID === STORE_ID), 'HML_SEED_REQUIRED');
    const owner = await tx.user.findUnique({ where: { id: seed.userID }, select: { id: true, lojaID: true, role: true } });
    check(owner?.lojaID === STORE_ID && owner.role === 'ADMIN', 'HML_OWNER_INVALID');
    const products = plan.eligible.filter(p => !before.products.some(b => b.id === p.id));
    const ids = new Set(products.map(p => p.id));
    const variants = source.variants.filter(v => ids.has(v.ProductID)).map(canonicalizeVariant);
    check(!variants.some(v => before.variants.some(b => b.id === v.id)), 'VARIANT_ID_COLLISION');
    // Existing brands/categories must match; don't silently overwrite local work.
    for (const [rows, existing, keys] of [[source.brands, before.brands, brandFields], [source.categories, before.categories, categoryFields]]) {
      for (const row of rows) {
        const old = existing.find(b => b.id === row.id || b.slug === row.slug);
        if (old) check(old.lojaID === STORE_ID && digest(pick(old, keys)) === digest(pick(row, keys)), 'CATALOG_REFERENCE_CONFLICT');
      }
    }
    const brands = source.brands.filter(b => !before.brands.some(old => old.id === b.id));
    const categories = source.categories.filter(c => !before.categories.some(old => old.id === c.id));
    const links = source.links.filter(l => ids.has(l.productID));
    const summary = { sourceHash: plan.sourceHash, products: products.length, variants: variants.length,
      brands: brands.length, categories: categories.length, categoryLinks: links.length,
      preservedExistingProducts: before.products.length, deferred: plan.deferred };
    if (!products.length && !brands.length && !categories.length) return { code: 'NO_NEW_RECORDS', changed: false, ...summary };
    if (!apply) return { code: 'READY_TO_IMPORT', changed: false, ...summary };
    check(typeof backup === 'function', 'BACKUP_REQUIRED');
    const bindings = { cartItems: await tx.cartItem.count(), orderItems: await tx.orderItem.count(), reservations: await tx.inventoryReservation.count() };
    await backup({ sourceHash: plan.sourceHash, before, bindings, summary });
    const batch = async (model, rows) => { for (let i = 0; i < rows.length; i += 100) await model.createMany({ data: rows.slice(i, i + 100) }); };
    await batch(tx.brand, brands.map(b => ({ ...pick(b, brandFields), lojaID: STORE_ID })));
    await batch(tx.categoryTag, categories.map(c => ({ ...pick(c, categoryFields), lojaID: STORE_ID })));
    await batch(tx.product, products.map(p => ({ ...pick(p, productFields), lojaID: STORE_ID, userID: owner.id })));
    await batch(tx.productVariants, variants.map(v => pick(v, variantFields)));
    await batch(tx.productCategoryTag, links);
    const after = await targetState(tx);
    for (const table of ['products', 'variants', 'brands', 'categories']) {
      for (const row of before[table]) check(digest(after[table].find(a => a.id === row.id)) === digest(row), 'EXISTING_RECORD_CHANGED');
    }
    check(after.products.length === before.products.length + products.length && after.variants.length === before.variants.length + variants.length,
      'IMPORT_COUNT_MISMATCH');
    // Check imported commercial values, IDs and remapping, not just counts.
    for (const p of products) check(digest(pick(after.products.find(a => a.id === p.id), productFields)) === digest(pick(p, productFields)), 'PRODUCT_IMPORT_MISMATCH');
    for (const v of variants) check(digest(pick(after.variants.find(a => a.id === v.id), variantFields)) === digest(pick(v, variantFields)), 'VARIANT_IMPORT_MISMATCH');
    check(after.links.length === before.links.length + links.length && before.links.every(l => after.links.some(a => a.productID === l.productID && a.categoryTagID === l.categoryTagID)), 'CATEGORY_LINK_MISMATCH');
    await tx.auditLog.create({ data: { action: 'MAIN_CATALOG_IMPORT', actorType: 'SYSTEM', systemActor: 'authorized-hml-catalog-import',
      entity: 'Loja', entityId: STORE_ID, effectKey: 'main-catalog:' + plan.sourceHash,
      metadata: { ...summary, mainReadOnly: true, stockIsTestData: true, preservedBindings: bindings } } });
    return { code: 'IMPORTED_AND_VERIFIED', changed: true, ...summary, totalProducts: after.products.length, totalVariants: after.variants.length };
  }, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 90000 });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let sourceDb, targetDb;
  try {
    check(process.argv.slice(2).every(arg => arg === '--apply'), 'UNSUPPORTED_ARGUMENT');
    sourceDb = new PrismaClient({ datasources: { db: { url: sourceUrl(process.env.MAIN_DIRECT_URL) } }, log: [] });
    targetDb = new PrismaClient({ datasources: { db: { url: targetUrl(process.env.HML_DIRECT_URL) } }, log: [] });
    const source = await readCatalog(sourceDb);
    if (process.argv.includes('--apply')) check(process.env.CATALOG_SOURCE_SHA256 === catalogPlan(source).sourceHash, 'REVIEWED_SOURCE_HASH_REQUIRED');
    const folder = fileURLToPath(new URL('../artifacts/main-hml-catalog/', import.meta.url));
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 'source-' + catalogPlan(source).sourceHash + '.json'), JSON.stringify(source, null, 2));
    const result = await importCatalog(targetDb, source, { apply: process.argv.includes('--apply'), backup: value =>
      fs.writeFileSync(path.join(folder, 'backup-' + randomUUID() + '.json'), JSON.stringify(value, null, 2), { flag: 'wx' }) });
    fs.writeFileSync(path.join(folder, 'result-' + randomUUID() + '.json'), JSON.stringify(result, null, 2), { flag: 'wx' });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ code: /^[A-Z][A-Z0-9_]+$/.test(error.message) ? error.message : 'CATALOG_IMPORT_FAILED' }));
    process.exitCode = 1;
  } finally { await sourceDb?.$disconnect(); await targetDb?.$disconnect(); }
}
