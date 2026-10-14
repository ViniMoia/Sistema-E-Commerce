// Reuse existing commercial decisions; main is always read-only.
// Supply MAIN_DIRECT_URL and HML_DIRECT_URL in memory. Default is read-only.
// --apply changes only enableCorreios/additionalDays in the pinned HML store.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { targetUrl, STORE_ID } from './import-jt-homologation.mjs';

export const SOURCE_ID = '536bfa58-0531-49e8-9209-3a046281e516';
const SOURCE_HOST = 'ep-round-bonus-b62kh6x2.c-2.sa-east-1.aws.neon.tech';
const fields = ['enableCorreios', 'additionalDays'];
const select = { id: true, slug: true, originCep: true, enableCorreios: true,
  additionalDays: true, configurationVersion: true };
function requireValue(ok, code) { if (!ok) throw new Error(code); }

export function sourceUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { throw new Error('MAIN_CONNECTION_REQUIRED'); }
  requireValue(u.protocol === 'postgresql:' && u.hostname === SOURCE_HOST && u.pathname === '/neondb'
    && (!u.port || u.port === '5432') && u.searchParams.get('sslmode') === 'require'
    && [...u.searchParams.keys()].every(k => ['sslmode', 'channel_binding'].includes(k)), 'MAIN_SOURCE_REJECTED');
  u.searchParams.set('connection_limit', '1');
  u.searchParams.set('connect_timeout', '10');
  return u.toString();
}

export async function readSource(db) {
  return db.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '15s'");
    const [scope] = await tx.$queryRawUnsafe("SELECT current_setting('transaction_read_only') AS read_only");
    requireValue(scope.read_only === 'on', 'MAIN_READ_ONLY_REQUIRED');
    // Explicit fields compatible with the source schema; never read secrets.
    const rows = await tx.$queryRawUnsafe('SELECT "id", "slug", "originCep", "enableCorreios", "additionalDays" FROM public."Loja" WHERE "id"=$1', SOURCE_ID);
    requireValue(rows.length === 1 && rows[0].slug === 'continental-prototipo'
      && rows[0].originCep === '67140615', 'MAIN_SCOPE_MISMATCH');
    return { capturedAt: new Date().toISOString(), readOnly: true, ...rows[0] };
  }, { isolationLevel: 'RepeatableRead', timeout: 30000 });
}

export async function syncSettings(db, source, { apply = false, backup } = {}) {
  // Narrow reviewed change, not a general copier of mutable financial settings.
  requireValue(source.readOnly === true && source.id === SOURCE_ID && source.slug === 'continental-prototipo'
    && source.originCep === '67140615' && source.enableCorreios === true && source.additionalDays === 1,
  'SOURCE_DECISION_CHANGED');
  return db.$transaction(async tx => {
    if (!apply) await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '5s'");
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '15s'");
    if (apply) await tx.$queryRawUnsafe('SELECT "id" FROM public."Loja" WHERE "id"=$1 FOR UPDATE', STORE_ID);
    const stores = await tx.loja.findMany({ select });
    requireValue(stores.length === 1 && stores[0].id === STORE_ID && stores[0].slug === 'continental-homologacao'
      && stores[0].originCep === source.originCep, 'HML_SCOPE_MISMATCH');
    const before = stores[0];
    const accounts = await tx.paymentAttempt.findMany({ select: { providerAccount: true }, distinct: ['providerAccount'] });
    requireValue(accounts.every(a => a.providerAccount === 'sandbox-hml'), 'HML_ACCOUNT_MISMATCH');
    const changes = Object.fromEntries(fields.filter(k => before[k] !== source[k]).map(k => [k, source[k]]));
    if (!Object.keys(changes).length) return { code: 'ALREADY_ALIGNED', changed: false, before };
    requireValue(before.enableCorreios === false && before.additionalDays === 0, 'HML_SETTINGS_CHANGED');
    const [trigger] = await tx.$queryRawUnsafe("SELECT count(*)::int AS n FROM pg_trigger WHERE tgname='freight_settings_revision' AND tgrelid='public.\"Loja\"'::regclass AND tgenabled='O'");
    requireValue(trigger.n === 1, 'FREIGHT_REVISION_TRIGGER_REQUIRED');
    if (!apply) return { code: 'READY_TO_ALIGN', changed: false, source, before, changes };
    requireValue(typeof backup === 'function', 'BACKUP_REQUIRED');
    await backup({ source, before, changes });
    const after = await tx.loja.update({ where: { id: STORE_ID }, data: changes, select });
    requireValue(fields.every(k => after[k] === source[k]) && after.configurationVersion > before.configurationVersion,
      'SETTINGS_VERIFICATION_FAILED');
    await tx.auditLog.create({ data: { action: 'MAIN_FREIGHT_SETTINGS_IMPORT', actorType: 'SYSTEM',
      systemActor: 'authorized-main-hml-settings-sync', entity: 'Loja', entityId: STORE_ID,
      effectKey: 'main-freight-settings:' + STORE_ID + ':' + before.configurationVersion,
      previousValue: before, newValue: after, metadata: { source, copiedFields: fields, mainReadOnly: true } } });
    return { code: 'ALIGNED_AND_VERIFIED', changed: true, source, before, after };
  }, { isolationLevel: 'Serializable', timeout: 30000 });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let sourceDb, targetDb;
  try {
    requireValue(process.argv.slice(2).every(arg => arg === '--apply'), 'UNSUPPORTED_ARGUMENT');
    sourceDb = new PrismaClient({ datasources: { db: { url: sourceUrl(process.env.MAIN_DIRECT_URL) } }, log: [] });
    targetDb = new PrismaClient({ datasources: { db: { url: targetUrl(process.env.HML_DIRECT_URL) } }, log: [] });
    const source = await readSource(sourceDb);
    const folder = fileURLToPath(new URL('../artifacts/main-hml-settings/', import.meta.url));
    fs.mkdirSync(folder, { recursive: true });
    const result = await syncSettings(targetDb, source, { apply: process.argv.includes('--apply'), backup: value =>
      fs.writeFileSync(path.join(folder, 'backup-' + randomUUID() + '.json'), JSON.stringify(value, null, 2), { flag: 'wx' }) });
    fs.writeFileSync(path.join(folder, 'result-' + randomUUID() + '.json'), JSON.stringify(result, null, 2), { flag: 'wx' });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ code: /^[A-Z][A-Z0-9_]+$/.test(error.message) ? error.message : 'SETTINGS_SYNC_FAILED' }));
    process.exitCode = 1;
  } finally { await sourceDb?.$disconnect(); await targetDb?.$disconnect(); }
}
