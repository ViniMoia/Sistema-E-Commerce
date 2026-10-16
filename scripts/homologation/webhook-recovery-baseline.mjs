// Read-only, fixed Sandbox scope. Never submits/rearms events or processes queues.
// Uses the same Next env loader as the project, then rejects every other DB host.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nextEnv from '@next/env';

export const identity = Object.freeze({ accountScope: 'sandbox-hml', orderNumber: 6,
  storeId: '3a82b33c-3646-4272-9a89-80bb1ba327a5',
  orderId: '0f0a05ff-2a24-4e6f-93ef-be13451388c9', paymentId: 'pay_blfexx8zkousw431',
  attemptId: '39fa8608-e1c5-4ac5-8689-3a3dcb904a26',
  eventId: 'evt_d26e303b238e509335ac9ba210e51b0f&22120169' });
const parts = {
  order: `SELECT id,status,version,"asaasPaymentStatus","paidAt","total","financialTotal","pointsCredited","pointsRedeemed" FROM "Order" WHERE id=$1`,
  items: `SELECT * FROM "OrderItem" WHERE "orderId"=$1`,
  history: `SELECT * FROM "OrderStatusHistory" WHERE "orderId"=$1`,
  reservations: `SELECT * FROM "InventoryReservation" WHERE "orderId"=$1`,
  stock: `SELECT p.id,p.stock,p."inventoryVersion" FROM "Product" p WHERE p.id IN (SELECT "productId" FROM "OrderItem" WHERE "orderId"=$1)`,
  variants: `SELECT v.* FROM "ProductVariants" v WHERE v.id IN (SELECT "productVariantsId" FROM "OrderItem" WHERE "orderId"=$1)`,
  wallet: `SELECT w.id,w.balance,w.pending,w."lifetimeEarn",w.debt,w.version FROM "LoyaltyWallet" w JOIN "Order" o ON o."userID"=w."userID" AND o."lojaID"=w."lojaID" WHERE o.id=$1`,
  loyaltyTransactions: `SELECT * FROM "LoyaltyTransaction" WHERE "orderId"=$1`,
  loyaltyLots: `SELECT * FROM "LoyaltyLot" WHERE "sourceTransactionId" IN (SELECT id FROM "LoyaltyTransaction" WHERE "orderId"=$1) OR "originTransactionId" IN (SELECT id FROM "LoyaltyTransaction" WHERE "orderId"=$1)`,
  loyaltyAllocations: `SELECT * FROM "LoyaltyAllocation" WHERE "transactionId" IN (SELECT id FROM "LoyaltyTransaction" WHERE "orderId"=$1)`,
  financialFacts: `SELECT * FROM "FinancialFact" WHERE "orderId"=$1`,
  // Poller timestamps/counters are excluded; this is not proof of a global freeze.
  attempts: `SELECT id,status,version,"providerAccount","externalReference","financialTotal","failureCode" FROM "PaymentAttempt" WHERE "orderId"=$1`,
  charges: `SELECT id,"attemptId","providerPaymentId","providerAccount",ordinal,amount,"providerStatus","settledAt" FROM "PaymentCharge" WHERE "attemptId" IN (SELECT id FROM "PaymentAttempt" WHERE "orderId"=$1)`,
  operations: `SELECT * FROM "PaymentOperation" WHERE "attemptId" IN (SELECT id FROM "PaymentAttempt" WHERE "orderId"=$1)`,
  outbox: `SELECT * FROM "CommerceOutbox" WHERE "aggregateId"=$1`,
  inbox: `SELECT * FROM "PaymentInbox" WHERE provider='ASAAS:sandbox-hml' AND (payload->'payment'->>'externalReference'=$1 OR payload->'payment'->>'id'=(SELECT "asaasPaymentId" FROM "Order" WHERE id=$1))`,
  protectedBoleto8: `SELECT * FROM "Order" WHERE "orderNumber"=8 AND "lojaID"=(SELECT "lojaID" FROM "Order" WHERE id=$1)`,
};

export function compareSnapshots(before, after) {
  for (const snapshot of [before, after]) {
    if (snapshot?.schemaVersion !== 1 || snapshot.readOnly !== true || snapshot.code !== 'BASELINE_CAPTURED'
      || Object.entries(identity).some(([key, value]) => snapshot.identity?.[key] !== value)
      || !snapshot.parts || Object.keys(snapshot.parts).length !== Object.keys(parts).length
      || Object.keys(parts).some(key => !Number.isSafeInteger(snapshot.parts[key]?.count)
        || snapshot.parts[key].count < 0 || !/^[a-f0-9]{32}$/.test(snapshot.parts[key]?.hash))) {
      throw new Error('INVALID_COMPARISON_BASELINE');
    }
  }
  const changedParts = Object.keys(parts).filter(key => before.parts[key].count !== after.parts[key].count
    || before.parts[key].hash !== after.parts[key].hash);
  return { unchanged: changedParts.length === 0, changedParts,
    providerRedeliveryVerified: false, instruction: 'Comparacao de estado apenas; correlacionar logs reais do Asaas pelo mesmo eventId.' };
}

export async function capture(db) {
  return db.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout='15s'");
    const [mode] = await tx.$queryRawUnsafe("SELECT current_setting('transaction_read_only') AS ro,clock_timestamp() AS at");
    if (mode.ro !== 'on') throw new Error('READ_ONLY_REQUIRED');
    const order = await tx.order.findUnique({ where: { id: identity.orderId }, select: {
      lojaID: true, orderNumber: true, status: true, version: true, asaasPaymentId: true,
      asaasPaymentStatus: true, paymentMethod: true, total: true, pointsCredited: true, pointsRedeemed: true } });
    if (!order || order.lojaID !== identity.storeId || order.orderNumber !== 6 || order.status !== 'PAID'
      || order.version !== 1 || order.asaasPaymentId !== identity.paymentId || order.paymentMethod !== 'BOLETO'
      || order.asaasPaymentStatus !== 'RECEIVED' || Number(order.total) !== 49.9 || order.pointsCredited !== 24 || order.pointsRedeemed !== 0) {
      throw new Error('REFERENCE_ORDER_CHANGED');
    }
    const attempt = await tx.paymentAttempt.findUnique({ where: { id: identity.attemptId } });
    if (!attempt || attempt.orderId !== identity.orderId || attempt.providerAccount !== identity.accountScope
      || attempt.externalReference !== identity.orderId || attempt.status !== 'APPROVED') throw new Error('ATTEMPT_CHANGED');
    const event = await tx.paymentInbox.findUnique({ where: { provider_eventId: { provider: 'ASAAS:sandbox-hml', eventId: identity.eventId } } });
    if (!event || event.status !== 'COMPLETED' || event.eventType !== 'PAYMENT_RECEIVED'
      || event.payload?.payment?.id !== identity.paymentId || event.payload?.payment?.externalReference !== identity.orderId
      || event.payload?.payment?.billingType !== 'BOLETO' || event.payload?.payment?.value !== 49.9) throw new Error('EVENT_CHANGED');
    const fingerprints = {};
    for (const [key, sql] of Object.entries(parts)) {
      [fingerprints[key]] = await tx.$queryRawUnsafe(`SELECT count(*)::int AS count,
        md5(COALESCE(string_agg(to_jsonb(t)::text,'' ORDER BY to_jsonb(t)::text),'')) AS hash FROM (${sql}) t`, identity.orderId);
    }
    if (fingerprints.operations.count !== 0 || fingerprints.protectedBoleto8.count !== 1) throw new Error('SCOPE_CHANGED');
    return { schemaVersion: 1, code: 'BASELINE_CAPTURED', readOnly: true, at: mode.at.toISOString(), identity,
      event: { status: event.status, attempts: event.attempts, receivedAt: event.receivedAt, completedAt: event.completedAt },
      parts: fingerprints, requestAttempted: false, processingAttempted: false,
      providerRedeliveryVerified: false };
  }, { isolationLevel: 'RepeatableRead', maxWait: 10000, timeout: 60000 });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let db;
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || (args.length && !args[0].startsWith('--compare='))) throw new Error('UNSUPPORTED_ARGUMENT');
    const previous = args.length ? JSON.parse(fs.readFileSync(args[0].slice(10), 'utf8').replace(/^\uFEFF/, '')) : null;
    nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
    // Import Prisma only after Next resolves .env.local; Prisma's own .env load
    // must not preempt the application's configured datasource precedence.
    const { targetUrl } = await import('../import-jt-homologation.mjs');
    const { PrismaClient } = await import('@prisma/client');
    db = new PrismaClient({ datasources: { db: { url: targetUrl(process.env.DIRECT_URL) } }, log: [] });
    const result = await capture(db);
    console.log(JSON.stringify({ ...result, ...(previous && { comparison: compareSnapshots(previous, result) }) }, null, 2));
  } catch (error) {
    const safeCodes = ['UNSUPPORTED_ARGUMENT', 'HML_CONNECTION_REQUIRED', 'HML_TARGET_REJECTED', 'READ_ONLY_REQUIRED',
      'REFERENCE_ORDER_CHANGED', 'ATTEMPT_CHANGED', 'EVENT_CHANGED', 'SCOPE_CHANGED', 'INVALID_COMPARISON_BASELINE'];
    console.error(JSON.stringify({ ok: false, code: safeCodes.includes(error.message) ? error.message : 'BASELINE_UNRESOLVED', requestAttempted: false,
      processingAttempted: false, instruction: 'Conferir conexao de homologacao e identidade sem alterar pedidos/eventos; nenhum corpo ou segredo foi impresso.' }));
    process.exitCode = 1;
  } finally { await db?.$disconnect(); }
}
