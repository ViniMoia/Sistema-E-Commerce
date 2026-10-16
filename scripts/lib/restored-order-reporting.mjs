import { PrismaClient } from '@prisma/client';
import { command } from './disposable-postgres.mjs';
import { assertSmokeTarget } from './restored-application-smoke.mjs';

const store = '536bfa58-0531-49e8-9209-3a046281e516';
const batch = 'legacy-test-orders-20261015-v1';
const reason = 'USER_CLASSIFIED_TEST_DATA';
const actor = 'CLONE_REPORTING_REHEARSAL';
const approvedBackup = '51f0d8d7f80fb9910114928450753e46cfd86ac571e9acdd711d745fda1a65f9';
const approvedOrders = '1d381f7497ca8ac5b9f3fbd7d82f47d1';
const quote = name => '"' + name.replaceAll('"', '""') + '"';
const literal = text => "'" + text.replaceAll("'", "''") + "'";

export function assertReportingBaseline(backupSha, count, hash) {
  if (backupSha !== approvedBackup || count !== 24 || hash !== approvedOrders) throw new Error('REPORTING_BASELINE_CHANGED');
}

/** This is intentionally not a production classifier. Requires a restored,
 * sanitized disposable clone of the exact approved snapshot, not a date cutoff. */
export async function rehearseOrderReporting(pg, { backupSha, originalOrderColumns }) {
  assertSmokeTarget(pg);
  const label = await command('docker', ['inspect', '--format', '{{index .Config.Labels "logic-audit.run-id"}}', pg.name], { capture: true });
  if (label !== pg.runId || !Array.isArray(originalOrderColumns) || !originalOrderColumns.length) throw new Error('REPORTING_CLONE_REQUIRED');
  const db = new PrismaClient({ datasources: { db: { url: pg.env.TEST_DATABASE_URL } } });
  try {
    return await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Order" ORDER BY id FOR UPDATE`;
      let projection = `(SELECT jsonb_object_agg(key,value) FROM jsonb_each(to_jsonb(t)) WHERE key = ANY(ARRAY[${originalOrderColumns.map(literal).join(',')}]))`;
      for (const field of ['freightValue','subtotal','shippingCost','total','pointsDiscountValue','installmentValue']) {
        projection += ` - ${literal(field)} || jsonb_build_object(${literal(field)},t.${quote(field)}::numeric(65,30))`;
      }
      const [fingerprint] = await tx.$queryRawUnsafe(`SELECT count(*)::int AS count,md5(COALESCE(string_agg(md5((${projection})::text),'' ORDER BY (${projection})::text),'')) AS hash FROM "Order" t`);
      assertReportingBaseline(backupSha, fingerprint.count, fingerprint.hash);
      const orders = await tx.order.findMany({ select: { id: true, lojaID: true, checkoutIntentID: true }, orderBy: { id: 'asc' } });
      if (orders.some(o => o.lojaID !== store || o.checkoutIntentID !== null) || await tx.paymentAttempt.count() || await tx.financialFact.count()) throw new Error('REPORTING_ACTIVITY_CHANGED');
      const existing = await tx.orderReportingExclusion.findMany();
      if (existing.length) {
        if (existing.length !== orders.length || existing.some(x => !orders.some(o => o.id === x.orderId) || x.reason !== reason || x.classificationBatch !== batch || x.classifiedBy !== actor)
          || await tx.auditLog.count({ where: { effectKey: { startsWith: batch+':' } } }) !== orders.length) throw new Error('REPORTING_REPLAY_CONFLICT');
        return { replay: true, excludedOrders: existing.length, batch, cloneOnly: true };
      }
      const before = await tx.order.findMany({ include: { items: true, statusHistory: true }, orderBy: { id: 'asc' } });
      for (const order of orders) {
        const classification = await tx.orderReportingExclusion.create({ data: { orderId: order.id, reason, classificationBatch: batch, classifiedBy: actor } });
        await tx.auditLog.create({ data: { action: 'TEST_ORDER_REPORTING_CLASSIFIED', actorType: 'SYSTEM', systemActor: actor,
          entity: 'OrderReportingExclusion', entityId: order.id, effectKey: batch+':'+order.id,
          newValue: JSON.parse(JSON.stringify(classification)), metadata: { lojaID: store, cloneOnly: true, approvedBackup, approvedOrders } } });
      }
      const after = await tx.order.findMany({ include: { items: true, statusHistory: true }, orderBy: { id: 'asc' } });
      if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('REPORTING_HISTORY_CHANGED');
      return { replay: false, excludedOrders: orders.length, batch, cloneOnly: true, ordersAndHistoryPreserved: true, auditRecords: orders.length };
    }, { isolationLevel: 'Serializable', timeout: 60000 });
  } finally { await db.$disconnect(); }
}
