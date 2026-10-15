// Explicit clone-only rehearsal; never an execution path for a shared database.
import { command } from './disposable-postgres.mjs';
import { assertSmokeTarget } from './restored-application-smoke.mjs';

export const testProducts = [
  { id: '6a6e98eb-98c3-4ba2-aede-a357d43893cf', name: 'Aspirador de Pó', variants: 1,
    imageUrl: 'https://res.cloudinary.com/dpt3zi8kx/image/upload/v1789777720/images__teste_aspirador_1_geqkhm.jpg' },
  { id: '622731a7-0158-486c-9626-0a739b3ddb91', name: 'Calça Jeans', variants: 3 },
  { id: '6178ba96-b383-4e50-be1d-93a506912011', name: 'Camisa Branca ', variants: 3 },
  { id: 'fdd4cc6a-c8e4-4a58-b45c-04a6d5c07e13', name: 'Camisa Preta', variants: 3 },
];
export const preservedVacuums = [
  'c6b3097f-6174-44f1-86c9-e06aba7c9733',
  '0486f861-4e39-426a-81ce-8b39f60a177f',
  '5e86739a-6114-4df1-a15a-df88b7a349c3',
  '7fd834af-d2be-4ea5-8d30-9790bd48a79e',
  'bc076f2d-740c-45f3-84c5-9d0fb8657d84',
];
const literal = value => "'" + value.replaceAll("'", "''") + "'";
const identifier = value => '"' + value.replaceAll('"', '""') + '"';
const parse = output => JSON.parse(output.split('\n').find(line => line.trim().startsWith('{')));

export function validateTestProducts(rows) {
  if (rows.length !== testProducts.length || new Set(rows.map(p => p.id)).size !== rows.length ||
    testProducts.some(expected => {
      const actual = rows.find(row => row.id === expected.id);
      return !actual || actual.name !== expected.name || actual.lojaID !== '536bfa58-0531-49e8-9209-3a046281e516' ||
        actual.retiredAt !== null || actual.variants !== expected.variants || actual.retiredVariants !== 0 ||
        (expected.imageUrl && actual.imageUrl !== expected.imageUrl);
    })) throw new Error('TEST_PRODUCT_IDENTITY_CHANGED');
}

export async function rehearseTestProductRetirement(pg) {
  assertSmokeTarget(pg);
  const label = await command('docker', ['inspect', '--format', '{{index .Config.Labels "logic-audit.run-id"}}', pg.name], { capture: true });
  if (label !== pg.runId) throw new Error('RETIREMENT_CLONE_LABEL_MISMATCH');
  const ids = testProducts.map(p => literal(p.id)).join(',');
  const protectedIds = preservedVacuums.map(literal).join(',');
  const baseline = parse(await pg.sql(`BEGIN READ ONLY;
    SELECT jsonb_build_object('products',(SELECT jsonb_agg(x) FROM (SELECT p.id,p.name,p."imageUrl",p."lojaID",p."retiredAt",
      (SELECT count(*)::int FROM "ProductVariants" v WHERE v."ProductID"=p.id) AS variants,
      (SELECT count(*)::int FROM "ProductVariants" v WHERE v."ProductID"=p.id AND v."retiredAt" IS NOT NULL) AS "retiredVariants"
      FROM "Product" p WHERE p.id IN (${ids})) x),
      'protectedCount',(SELECT count(*) FROM "Product" WHERE id IN (${protectedIds}) AND "retiredAt" IS NULL),
      'tables',(SELECT jsonb_agg(tablename ORDER BY tablename) FROM pg_tables WHERE schemaname='public'));
    COMMIT;`));
  validateTestProducts(baseline.products ?? []);
  if (baseline.protectedCount !== preservedVacuums.length) throw new Error('PROTECTED_CATALOG_CHANGED');
  // Exclude only permitted fields on exactly the authorized product/variant IDs.
  // All stocks, links, prices, history and every other table must remain identical.
  async function fingerprint() {
    const result = {};
    for (const table of baseline.tables) {
      const row = table === 'Product'
        ? `CASE WHEN t.id IN (${ids}) THEN to_jsonb(t)-ARRAY['retiredAt','inventoryVersion','catalogVersion','updatedAt'] ELSE to_jsonb(t) END`
        : table === 'ProductVariants'
          ? `CASE WHEN t."ProductID" IN (${ids}) THEN to_jsonb(t)-ARRAY['retiredAt','inventoryVersion','updatedAt'] ELSE to_jsonb(t) END`
          : 'to_jsonb(t)';
      result[table] = parse(await pg.sql(`SELECT json_build_object('count',count(*),'hash',md5(COALESCE(string_agg(md5(r::text),'' ORDER BY r::text),''))) FROM (SELECT ${row} AS r FROM ${identifier(table)} t) s;`));
    }
    return JSON.stringify(result);
  }
  const before = await fingerprint();
  const result = parse(await pg.sql(`BEGIN;
    SELECT id FROM "Product" WHERE id IN (${ids}) ORDER BY id FOR UPDATE;
    SELECT id FROM "ProductVariants" WHERE "ProductID" IN (${ids}) ORDER BY id FOR UPDATE;
    UPDATE "Product" SET "retiredAt"=now(),"updatedAt"=now(),"inventoryVersion"="inventoryVersion"+1,"catalogVersion"="catalogVersion"+1 WHERE id IN (${ids}) AND "retiredAt" IS NULL;
    UPDATE "ProductVariants" SET "retiredAt"=now(),"updatedAt"=now(),"inventoryVersion"="inventoryVersion"+1 WHERE "ProductID" IN (${ids}) AND "retiredAt" IS NULL;
    SELECT json_build_object('retiredProducts',(SELECT count(*) FROM "Product" WHERE id IN (${ids}) AND "retiredAt" IS NOT NULL AND "inventoryVersion"=1 AND "catalogVersion"=1),
      'retiredVariants',(SELECT count(*) FROM "ProductVariants" WHERE "ProductID" IN (${ids}) AND "retiredAt" IS NOT NULL AND "inventoryVersion"=1),
      'activeProducts',(SELECT count(*) FROM "Product" WHERE "retiredAt" IS NULL)); COMMIT;`));
  if (result.retiredProducts !== 4 || result.retiredVariants !== 10 || before !== await fingerprint()) throw new Error('RETIREMENT_PRESERVATION_FAILED');
  return { at: new Date().toISOString(), cloneOnly: true, backupPreviouslyRestored: true,
    productIds: testProducts.map(p => p.id), protectedProductIds: preservedVacuums, ...result,
    stockValuesPreserved: true, allOtherDataPreserved: true, sharedDatabaseWritten: false,
    strategy: 'retiredAt with version increments; no deletion, stock reconciliation or financial effects', productionReady: false };
}
