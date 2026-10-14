// Verifies the import using a disposable database, never the application database.
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { command, provisionPostgres } from './lib/disposable-postgres.mjs';
import { importSnapshot, loadSnapshot, targetUrl, STORE_ID, TARGET_HOST } from './import-jt-homologation.mjs';

assert.throws(() => targetUrl('postgresql://u:p@ep-round-bonus-b62kh6x2.c-2.sa-east-1.aws.neon.tech/neondb?sslmode=require'), /HML_TARGET_REJECTED/);
assert.throws(() => targetUrl(`postgresql://u:p@${TARGET_HOST}/neondb?sslmode=require&host=another-host`), /HML_TARGET_REJECTED/);
assert.throws(() => targetUrl(undefined), /HML_CONNECTION_REQUIRED/);
assert.ok(targetUrl(`postgresql://u:p@${TARGET_HOST}/neondb?sslmode=require`));
const snapshot = loadSnapshot();
const fixture = await provisionPostgres();
const db = new PrismaClient({ datasources: { db: { url: fixture.env.DATABASE_URL } }, log: [] });
try {
  await command(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env: fixture.env, capture: true });
  await db.loja.create({ data: { id: STORE_ID, slug: 'continental-homologacao', name: 'Isolated test',
    description: 'Disposable logistics import', coverImageUrl: '' } });
  const dry = await importSnapshot(db, snapshot);
  assert.equal(dry.code, 'READY_TO_IMPORT');
  assert.equal(await db.jtExpressRate.count(), 0);
  // A failure late in the batch must roll back every earlier insert and revision bump.
  const broken = structuredClone(snapshot);
  broken.rates.at(-1).id = broken.rates[0].id;
  let backedUp = false;
  await assert.rejects(importSnapshot(db, broken, { apply: true, backup: data => {
    assert.equal(data.rates.length, 0); backedUp = true;
  } }));
  assert.ok(backedUp);
  assert.equal(await db.jtExpressRate.count(), 0);
  assert.equal((await db.freightTariffRevision.findUniqueOrThrow({ where: { id: 'JT_EXPRESS' } })).version, 0);
  assert.equal(await db.auditLog.count(), 0);
  const imported = await importSnapshot(db, snapshot, { apply: true, backup: data => {
    assert.equal(data.stores[0].originCep, null);
  } });
  assert.equal(imported.code, 'IMPORTED_AND_VERIFIED');
  assert.equal(imported.rates, 5181);
  assert.equal(imported.zones, 58);
  assert.equal(imported.tariffRevision, 12);
  assert.equal(imported.configurationVersion, 1);
  assert.equal(imported.destination.length, 1);
  assert.equal(imported.destination[0].geocomCode, 'PA-CAP');
  assert.equal(await db.auditLog.count(), 1);
  const repeated = await importSnapshot(db, snapshot, { apply: true });
  assert.equal(repeated.code, 'ALREADY_IMPORTED');
  assert.equal(repeated.tariffRevision, imported.tariffRevision);
  assert.equal(await db.auditLog.count(), 1);
  await db.jtExpressRate.update({ where: { id: snapshot.rates[0].id }, data: { basePrice: '999.99' } });
  await assert.rejects(importSnapshot(db, snapshot, { apply: true }), /IMPORTED_DATA_DRIFT/);
  await db.loja.update({ where: { id: STORE_ID }, data: { slug: 'wrong-store' } });
  await assert.rejects(importSnapshot(db, snapshot, { apply: true }), /HML_STORE_SCOPE_MISMATCH/);
  console.log('PASS: host isolation, read-only preflight, rollback, full import, revisions, idempotence, drift and tenant guards.');
} catch {
  console.error('JT_IMPORT_VERIFICATION_FAILED');
  process.exitCode = 1;
} finally {
  await db.$disconnect();
  await fixture.dispose();
}
