// Targeted initial import for L-04. Never reads application .env files.
// HML_DIRECT_URL must be supplied in memory. Default: read-only inspection.
// node scripts/import-jt-homologation.mjs [--apply]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

export const STORE_ID = '3a82b33c-3646-4272-9a89-80bb1ba327a5';
export const TARGET_HOST = 'ep-blue-feather-b6l24gbu.c-2.sa-east-1.aws.neon.tech';
export const SNAPSHOT_SHA = '92dfdd216d47d950d526168b62db4834502a965ef3b8c30bbaf838ce1f08e6b5';
const root = fileURLToPath(new URL('../', import.meta.url));
const prepared = path.join(root, 'materiais/J&T/Tabela/preparado');
const effectKey = `jt-hml-initial-import:${STORE_ID}:${SNAPSHOT_SHA}`;

function requireCondition(value, code) {
  if (!value) throw new Error(code);
}

export function targetUrl(raw) {
  let url;
  try { url = new URL(raw); } catch { throw new Error('HML_CONNECTION_REQUIRED'); }
  requireCondition(url.protocol === 'postgresql:' && url.hostname === TARGET_HOST
    && url.pathname === '/neondb' && (!url.port || url.port === '5432')
    && url.searchParams.get('sslmode') === 'require'
    && [...url.searchParams.keys()].every(key => ['sslmode', 'channel_binding'].includes(key)),
  'HML_TARGET_REJECTED');
  url.searchParams.set('connect_timeout', '10');
  url.searchParams.set('connection_limit', '1');
  return url.toString();
}

export function loadSnapshot() {
  const bytes = fs.readFileSync(path.join(prepared, 'banco-origem-jt-somente-leitura.json'));
  requireCondition(createHash('sha256').update(bytes).digest('hex') === SNAPSHOT_SHA, 'SOURCE_HASH_MISMATCH');
  const snapshot = JSON.parse(bytes);
  requireCondition(snapshot.identity.read_only === 'on' && snapshot.databaseChanged === false
    && snapshot.rates.length === 5181 && snapshot.zones.length === 58
    && snapshot.stores.length === 1 && snapshot.stores[0].slug === 'continental-prototipo'
    && snapshot.stores[0].originCep === '67140615', 'SOURCE_SCOPE_MISMATCH');
  return snapshot;
}

function canonical(rates, zones) {
  return JSON.stringify({
    rates: rates.map(row => ({ id: row.id, geocom: row.geocom, macroRegion: row.macroRegion,
      weightMin: Number(row.weightMin), weightMax: Number(row.weightMax), basePrice: Number(row.basePrice),
      additionalKgPrice: row.additionalKgPrice == null ? null : Number(row.additionalKgPrice),
    })).sort((a, b) => a.id.localeCompare(b.id)),
    zones: zones.map(row => ({ id: row.id, state: row.state, cityPattern: row.cityPattern,
      cepStart: row.cepStart, cepEnd: row.cepEnd, geocomCode: row.geocomCode,
      deliveryDays: row.deliveryDays, isRiskZone: row.isRiskZone,
    })).sort((a, b) => a.id.localeCompare(b.id)),
  });
}

async function readState(tx) {
  return {
    stores: await tx.loja.findMany({ select: { id: true, slug: true, originCep: true,
      configurationVersion: true, additionalDays: true, enableCorreios: true } }),
    revision: await tx.freightTariffRevision.findUnique({ where: { id: 'JT_EXPRESS' } }),
    rates: await tx.jtExpressRate.findMany(),
    zones: await tx.jtExpressGeocom.findMany(),
  };
}

// Exported for tests against disposable PostgreSQL; the CLI accepts only the pinned HML host.
export async function importSnapshot(db, snapshot, { apply = false, backup } = {}) {
  return db.$transaction(async tx => {
    if (!apply) await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '5s'");
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '20s'");
    if (apply) {
      // Same authority lock order as the checkout: tariff revision, then store.
      await tx.$queryRawUnsafe('SELECT id FROM public."FreightTariffRevision" WHERE id = \'JT_EXPRESS\' FOR UPDATE');
      await tx.$executeRawUnsafe('LOCK TABLE public."Loja", public."JtExpressRate", public."JtExpressGeocom" IN SHARE ROW EXCLUSIVE MODE');
    }
    const before = await readState(tx);
    requireCondition(before.stores.length === 1 && before.stores[0].id === STORE_ID
      && before.stores[0].slug === 'continental-homologacao', 'HML_STORE_SCOPE_MISMATCH');
    requireCondition(before.revision, 'FREIGHT_REVISION_MISSING');
    const accounts = await tx.paymentAttempt.findMany({ select: { providerAccount: true }, distinct: ['providerAccount'] });
    requireCondition(accounts.every(row => row.providerAccount === 'sandbox-hml'), 'HML_ACCOUNT_SCOPE_MISMATCH');
    const existingAudit = await tx.auditLog.findUnique({ where: { effectKey } });
    if (existingAudit) {
      requireCondition(before.stores[0].originCep === '67140615'
        && canonical(before.rates, before.zones) === canonical(snapshot.rates, snapshot.zones), 'IMPORTED_DATA_DRIFT');
      return { code: 'ALREADY_IMPORTED', changed: false, rates: before.rates.length,
        zones: before.zones.length, tariffRevision: before.revision.version };
    }
    requireCondition(before.rates.length === 0 && before.zones.length === 0, 'HML_TABLES_NOT_EMPTY');
    requireCondition(before.stores[0].originCep === null || before.stores[0].originCep === '67140615', 'HML_ORIGIN_CONFLICT');
    const triggers = await tx.$queryRawUnsafe(`SELECT tgname FROM pg_trigger
      WHERE NOT tgisinternal AND tgenabled = 'O'
      AND tgrelid IN ('public."Loja"'::regclass, 'public."JtExpressRate"'::regclass, 'public."JtExpressGeocom"'::regclass)`);
    requireCondition(['freight_settings_revision', 'freight_jt_rate_revision', 'freight_jt_geography_revision']
      .every(name => triggers.some(row => row.tgname === name)), 'FREIGHT_REVISION_TRIGGERS_MISSING');
    if (!apply) return { code: 'READY_TO_IMPORT', changed: false, store: before.stores[0],
      rates: snapshot.rates.length, zones: snapshot.zones.length, tariffRevision: before.revision.version };
    requireCondition(typeof backup === 'function', 'BACKUP_REQUIRED');
    // Snapshot is saved before the first write. A failed backup aborts the transaction.
    await backup({ at: new Date().toISOString(), sourceSnapshotSha256: SNAPSHOT_SHA, ...before });
    for (let start = 0; start < snapshot.rates.length; start += 500) {
      await tx.jtExpressRate.createMany({ data: snapshot.rates.slice(start, start + 500).map(row => ({
        id: row.id, geocom: row.geocom, macroRegion: row.macroRegion, weightMin: row.weightMin,
        weightMax: row.weightMax, basePrice: row.basePrice, additionalKgPrice: row.additionalKgPrice,
      })) });
    }
    await tx.jtExpressGeocom.createMany({ data: snapshot.zones.map(row => ({
      id: row.id, state: row.state, cityPattern: row.cityPattern, cepStart: row.cepStart,
      cepEnd: row.cepEnd, geocomCode: row.geocomCode, deliveryDays: row.deliveryDays, isRiskZone: row.isRiskZone,
    })) });
    await tx.loja.update({ where: { id: STORE_ID }, data: { originCep: '67140615' } });
    const after = await readState(tx);
    requireCondition(canonical(after.rates, after.zones) === canonical(snapshot.rates, snapshot.zones), 'IMPORT_VERIFICATION_FAILED');
    requireCondition(after.revision.version > before.revision.version && after.stores[0].originCep === '67140615'
      && (before.stores[0].originCep === '67140615'
        || after.stores[0].configurationVersion > before.stores[0].configurationVersion), 'AUTHORITY_REVISION_NOT_UPDATED');
    const result = { code: 'IMPORTED_AND_VERIFIED', changed: true, at: new Date().toISOString(),
      storeId: STORE_ID, originCep: after.stores[0].originCep,
      rates: after.rates.length, zones: after.zones.length, tariffRevision: after.revision.version,
      configurationVersion: after.stores[0].configurationVersion, sourceSnapshotSha256: SNAPSHOT_SHA,
      destination: after.zones.filter(row => row.cepStart <= '67140180' && row.cepEnd >= '67140180') };
    await tx.auditLog.create({ data: { action: 'JT_TARIFF_IMPORT', actorType: 'SYSTEM',
      systemActor: 'authorized-hml-logistics-import', effectKey, entity: 'Loja', entityId: STORE_ID,
      previousValue: { stores: before.stores, rateCount: 0, zoneCount: 0, revision: before.revision },
      newValue: result, metadata: { sourceReadOnly: true, userAuthorized: true, scope: 'homologacao_teste',
        limitations: ['Geography and deadlines inherited from main', 'All source zones marked non-risk', 'ICMS not independently confirmed'] },
    } });
    return result;
  }, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 90000 });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let db;
  try {
    requireCondition(process.argv.slice(2).every(arg => arg === '--apply'), 'UNSUPPORTED_ARGUMENT');
    const connection = targetUrl(process.env.HML_DIRECT_URL);
    const snapshot = loadSnapshot();
    db = new PrismaClient({ datasources: { db: { url: connection } }, log: [] });
    const result = await importSnapshot(db, snapshot, { apply: process.argv.includes('--apply'),
      backup: data => fs.writeFileSync(path.join(prepared, `backup-hml-jt-${randomUUID()}.json`),
        JSON.stringify(data, null, 2), { flag: 'wx' }),
    });
    fs.writeFileSync(path.join(prepared, `resultado-importacao-hml-${Date.now()}.json`), JSON.stringify(result, null, 2), { flag: 'wx' });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    // Prisma error messages can include connection strings; emit only a safe code.
    const code = /^[A-Z][A-Z0-9_]+$/.test(error.message) ? error.message : error.code || 'IMPORT_FAILED';
    console.error(JSON.stringify({ code }));
    process.exitCode = 1;
  } finally { await db?.$disconnect(); }
}
