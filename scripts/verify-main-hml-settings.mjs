// Disposable PostgreSQL only. No application env files or remote credentials.
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { command, provisionPostgres } from './lib/disposable-postgres.mjs';
import { SOURCE_ID, sourceUrl, readSource, syncSettings } from './sync-main-hml-freight-settings.mjs';
import { STORE_ID, targetUrl } from './import-jt-homologation.mjs';

assert.throws(() => sourceUrl(undefined), /MAIN_CONNECTION_REQUIRED/);
const main = 'postgresql://u:p@ep-round-bonus-b62kh6x2.c-2.sa-east-1.aws.neon.tech/neondb?sslmode=require';
assert.throws(() => targetUrl(main), /HML_TARGET_REJECTED/);
assert.throws(() => sourceUrl(main + '&host=other'), /MAIN_SOURCE_REJECTED/);
const fixture = await provisionPostgres();
const db = new PrismaClient({ datasources: { db: { url: fixture.env.DATABASE_URL } }, log: [] });
try {
  await command(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env: fixture.env, capture: true });
  await db.loja.create({ data: { id: SOURCE_ID, slug: 'continental-prototipo', name: 'Disposable source',
    description: '', coverImageUrl: '', originCep: '67140615', enableCorreios: true, additionalDays: 1 } });
  const source = await readSource(db);
  assert.equal(source.readOnly, true);
  // Both stores exist only in this disposable database; target must reject it.
  await db.loja.create({ data: { id: STORE_ID, slug: 'continental-homologacao', name: 'Disposable target',
    description: '', coverImageUrl: '', originCep: '67140615', customDomain: 'hml.example.invalid', loyaltyEnabled: true } });
  await assert.rejects(syncSettings(db, source, { apply: true }), /HML_SCOPE_MISMATCH/);
  await db.loja.delete({ where: { id: SOURCE_ID } });
  const before = await db.loja.findUniqueOrThrow({ where: { id: STORE_ID } });
  assert.equal((await syncSettings(db, source)).code, 'READY_TO_ALIGN');
  assert.deepEqual(await db.loja.findUniqueOrThrow({ where: { id: STORE_ID } }), before);
  await assert.rejects(syncSettings(db, source, { apply: true }), /BACKUP_REQUIRED/);
  await assert.rejects(syncSettings(db, source, { apply: true, backup: () => { throw new Error('BACKUP_FAILED'); } }), /BACKUP_FAILED/);
  assert.deepEqual(await db.loja.findUniqueOrThrow({ where: { id: STORE_ID } }), before);
  // Fail after updating settings: transaction must restore the previous values.
  const failAudit = { $transaction: (fn, options) => db.$transaction(tx => fn(new Proxy(tx, {
    get: (obj, key) => key === 'auditLog' ? { create: () => { throw new Error('AUDIT_FAILED'); } } : obj[key],
  })), options) };
  await assert.rejects(syncSettings(failAudit, source, { apply: true, backup: () => {} }), /AUDIT_FAILED/);
  assert.deepEqual(await db.loja.findUniqueOrThrow({ where: { id: STORE_ID } }), before);
  const result = await syncSettings(db, source, { apply: true, backup: value => assert.deepEqual(value.changes, { enableCorreios: true, additionalDays: 1 }) });
  assert.equal(result.code, 'ALIGNED_AND_VERIFIED');
  const after = await db.loja.findUniqueOrThrow({ where: { id: STORE_ID } });
  assert.equal(after.enableCorreios, true);
  assert.equal(after.additionalDays, 1);
  assert.equal(after.configurationVersion, before.configurationVersion + 1);
  for (const key of Object.keys(before).filter(k => !['enableCorreios', 'additionalDays', 'configurationVersion', 'updatedAt'].includes(k))) {
    assert.deepEqual(after[key], before[key], key);
  }
  assert.equal((await syncSettings(db, source, { apply: true })).code, 'ALREADY_ALIGNED');
  assert.equal(await db.auditLog.count({ where: { action: 'MAIN_FREIGHT_SETTINGS_IMPORT' } }), 1);
  await assert.rejects(syncSettings(db, { ...source, additionalDays: 2 }), /SOURCE_DECISION_CHANGED/);
  console.log('PASS: source read-only, target isolation, preview, backup failure, transactional rollback, narrow update, revision and idempotence.');
} catch {
  console.error('SETTINGS_VERIFICATION_FAILED');
  process.exitCode = 1;
} finally { await db.$disconnect(); await fixture.dispose(); }
