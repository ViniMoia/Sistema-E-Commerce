import { randomBytes, randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { performance } from 'node:perf_hooks';
import { PrismaClient } from '@prisma/client';
import { expect, it } from 'vitest';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { testDatabaseConfig } from '@/lib/testing/database-policy';
import { createOrder } from '@/tests/setup/checkout-fixture';
import { receivePaymentEvent } from '@/services/payment/payment-inbox.service';
import { drainPaymentInbox, reconcilePaymentAttempts } from '@/services/payment/payment-worker.service';
import { drainPaymentOutbox } from '@/services/payment/payment-outbox.service';
import { processExpiredOrders } from '@/services/order-timeout.service';
import type { PaymentGateway, RemoteCharge } from '@/types/payment-gateway.types';
import { runConsumer } from '../../scripts/cloudrun-consumer.mjs';
import { poolBudget } from '../../scripts/lib/operational-readiness.mjs';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const future = new Date('2099-01-01T00:00:00Z');
const status = { schemaVersion: 1, accountScope: 'primary', uncertain: 0, overdue: 0,
  abandonedLeases: 0, inbox: [], outbox: [], untrackedLegacyOrders: 0, oldestUnresolvedInboxAt: null,
  supervision: { schemaVersion: 1, reviewAttempts: 0, chargebackReviews: 0, physicalReturnReviews: 0,
    heldOperations: 0, emailDeadLetters: 0, expiredQueueLeases: 0, foreignAccountAttempts: 0,
    oldestUnresolvedOutboxAt: null, oldestPendingEmailAt: null, oldestDueReconciliationAt: null } };

// Opt-in only. The regular unit suite never creates a database or touches .env.
it.skipIf(process.env.OPERATIONAL_READINESS !== 'true')('measures disposable operational readiness', async () => {
  const config = testDatabaseConfig();
  const migratorUrl = new URL(process.env.TEST_MIGRATOR_URL!);
  const expected = new URL(config.url); expected.username = 'ecommerce_migrator'; expected.password = migratorUrl.password;
  expect(migratorUrl.toString()).toBe(expected.toString());
  const setup = new PrismaClient({ datasources: { db: { url: migratorUrl.toString() } }, log: [] });
  const measurements: Record<string, any> = { startedAt: new Date().toISOString(), timings: [],
    scope: 'real services / synthetic providers / disposable PostgreSQL only', samplesPerCombination: 1 };
  const remote = new Map<string, RemoteCharge>();
  let latency = 0, inspectCalls = 0, emailCalls = 0;
  const gateway: PaymentGateway = {
    capabilities: async () => ({ configured: true, methods: ['PIX'], maximumInstallments: 1 }),
    createPixCharge: async input => {
      const row: RemoteCharge = { paymentId: randomUUID(), externalReference: input.orderId, method: 'PIX',
        ordinal: 1, value: input.value, status: 'PENDING', instructions: { pixPayload: 'synthetic',
          pixQrCodeBase64: 'synthetic', expiresAt: future.toISOString() } };
      remote.set(input.orderId, row);
      return { ...row, pixPayload: 'synthetic', pixQrCodeBase64: 'synthetic', expirationDate: future.toISOString() };
    },
    inspectAttempt: async input => {
      inspectCalls++; await sleep(latency);
      const rows = [...remote.values()].filter(row => input.paymentIds.includes(row.paymentId));
      if (!rows.length) throw new Error('UNEXPECTED_SYNTHETIC_INSPECTION');
      return { complete: true, charges: structuredClone(rows) };
    },
    createBoletoCharge: async () => { throw new Error('UNEXPECTED_PROVIDER_COMMAND'); },
    createCreditCardCharge: async () => { throw new Error('UNEXPECTED_PROVIDER_COMMAND'); },
    cancelPayment: async () => { throw new Error('UNEXPECTED_PROVIDER_COMMAND'); },
    refundPayment: async () => { throw new Error('UNEXPECTED_PROVIDER_COMMAND'); },
    getPaymentStatus: async () => { throw new Error('UNEXPECTED_PROVIDER_COMMAND'); },
  };
  const send = async () => { emailCalls++; await sleep(latency); return { success: true, messageId: randomUUID() }; };
  const leases = async () => {
    const results: Record<string, any> = {};
    for (const table of ['PaymentInbox', 'PaymentAttempt', 'CommerceOutbox']) {
      results[table] = (await setup.$queryRawUnsafe<any[]>(`SELECT count(*) FILTER (WHERE "leaseOwner" IS NOT NULL)::int AS held,
        count(*) FILTER (WHERE "leaseExpiresAt" > clock_timestamp())::int AS live,
        max(extract(epoch FROM "leaseExpiresAt" - clock_timestamp()))::float8 AS remaining_seconds FROM "${table}"`))[0];
    }
    return results;
  };
  let lojaID: string, adminID: string;
  const purchase = async (manual = false) => {
    const product = await setup.product.create({ data: { lojaID, userID: adminID, name: 'Synthetic operational item',
      description: '', imageUrl: '', price: 100, stock: 5,
      productVariants: { create: { size: 'Único', color: 'Padrão', stock: 5 } } }, include: { productVariants: true } });
    const result = await createOrder({ lojaID, customer: { name: 'Synthetic buyer', email: randomUUID() + '@example.invalid',
      phone: '11999999999', cpfCnpj: '52998224725' },
      items: [{ productId: product.id, variantId: product.productVariants[0].id, quantity: 1 }],
      deliveryType: 'PICKUP', paymentMethod: manual ? 'WHATSAPP_PIX' : 'PIX',
      freightOwnerKey: 'g:' + randomBytes(32).toString('hex'), paymentGateway: gateway });
    await setup.paymentAttempt.updateMany({ where: { orderId: result.order.id }, data: { reconcileAfter: future,
      ...(manual ? { reservationExpiresAt: new Date(0) } : {}) } });
    return result.order.id;
  };
  const enqueue = async (id: string) => {
    const charge = remote.get(id)!; charge.status = 'RECEIVED';
    await receivePaymentEvent({ id: randomUUID(), event: 'PAYMENT_RECEIVED', payment: {
      id: charge.paymentId, externalReference: id, billingType: 'PIX', value: 100, status: 'RECEIVED' } });
  };
  const drain = async () => {
    for (let i = 0; i < 20; i++) { const result = await drainPaymentOutbox(100, send); expect(result.retried + result.review).toBe(0); if (!result.claimed) return; }
    throw new Error('SYNTHETIC_OUTBOX_DID_NOT_DRAIN');
  };
  try {
    await verifyTestDatabase();
    const identity = await setup.$queryRawUnsafe<any[]>('SELECT current_user AS role, s.run_id FROM "_TestDatabaseSentinel" s WHERE id=1');
    expect(identity).toEqual([{ role: 'ecommerce_migrator', run_id: config.runId }]);
    measurements.permissions = { runtime: (await prisma.$queryRaw<any[]>`SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls
      FROM pg_roles WHERE rolname=current_user`)[0],
      ownedTables: (await prisma.$queryRaw<any[]>`SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='public' AND tableowner=current_user`)[0].count,
      grants: await setup.$queryRaw`SELECT table_name, privilege_type FROM information_schema.role_table_grants WHERE grantee='ecommerce_test' ORDER BY table_name,privilege_type`,
      denied: [] };
    expect(measurements.permissions.runtime).toMatchObject({ rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolbypassrls: false });
    expect(measurements.permissions.ownedTables).toBe(0);
    for (const [name, sql] of Object.entries({ ddl: 'CREATE TABLE forbidden_runtime_ddl(id int)',
      truncate: 'TRUNCATE TABLE "AuditLog"', createRole: 'CREATE ROLE forbidden_runtime_role',
      migrations: 'SELECT * FROM "_prisma_migrations"', changeRole: 'SET ROLE ecommerce_migrator' })) {
      let denied = false;
      try { await prisma.$transaction(async tx => { await tx.$executeRawUnsafe(sql); throw new Error('UNEXPECTED_PRIVILEGE'); }); }
      catch (error: any) { denied = error?.meta?.code === '42501'; }
      expect(denied, name).toBe(true); measurements.permissions.denied.push(name);
    }
    const store = await setup.loja.create({ data: { slug: 'fixture-' + randomUUID(), name: 'Disposable operations',
      description: '', coverImageUrl: '', enablePix: true, enablePickup: true, enableManualPix: true,
      pixKey: 'fixture@example.invalid', whatsappNumber: '11999999999' } }); lojaID = store.id;
    adminID = (await setup.user.create({ data: { lojaID, name: 'Synthetic admin', email: randomUUID() + '@example.invalid', password: '', role: 'ADMIN' } })).id;

    // Exercised invariants include deferred checkout triggers and transactional rollback.
    const protectedOrder = await purchase();
    const attempt = await setup.paymentAttempt.findFirstOrThrow({ where: { orderId: protectedOrder } });
    await expect(prisma.$transaction(async tx => {
      await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { failureCode: 'rollback-sentinel' } });
      throw new Error('ROLLBACK_PROBE');
    })).rejects.toThrow('ROLLBACK_PROBE');
    expect((await setup.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).failureCode).not.toBe('rollback-sentinel');
    await expect(prisma.$executeRaw`UPDATE "CheckoutIntent" SET "contentHash"='invalid' WHERE id=(SELECT "checkoutIntentID" FROM "Order" WHERE id=${protectedOrder})`)
      .rejects.toMatchObject({ meta: { code: '23514' } });
    measurements.permissions.transactionsAndImmutableTrigger = true;
    await drain();

    for (const mode of ['separate', 'combined']) for (const limit of [1, 5]) for (const concurrency of [1, 2]) for (const delayMs of [0, 80]) {
      latency = 0;
      await setup.paymentAttempt.updateMany({ data: { reconcileAfter: future } });
      const inboxOrders: string[] = [], reconciliationOrders: string[] = [], manualOrders: string[] = [];
      for (let i = 0; i < limit * concurrency; i++) {
        inboxOrders.push(await purchase()); reconciliationOrders.push(await purchase()); manualOrders.push(await purchase(true));
      }
      await drain();
      for (const id of inboxOrders) await enqueue(id);
      for (const id of reconciliationOrders) remote.get(id)!.status = 'RECEIVED';
      await setup.paymentAttempt.updateMany({ where: { orderId: { in: reconciliationOrders } }, data: { reconcileAfter: new Date(0) } });
      latency = delayMs;
      const record: any = { mode, limit, concurrency, providerLatencyMs: delayMs, stages: [],
        leasesBefore: await leases(), inspectCallsBefore: inspectCalls };
      const timed = async (name: string, work: () => Promise<any>, worker: number) => {
        const start = performance.now(); const result = await work();
        record.stages.push({ name, worker, durationMs: +(performance.now() - start).toFixed(2), result });
        if (name === 'expiration') expect(result.errorCount).toBe(0); else expect(result.retried + result.review).toBe(0);
        return result;
      };
      const stages: [string, () => Promise<any>][] = [ ['inbox', () => drainPaymentInbox(limit, gateway)],
        ['reconciliation', () => reconcilePaymentAttempts(limit, gateway)],
        ['expiration', () => processExpiredOrders({ batchSize: limit, dryRun: false, gateway })],
        ['outbox', () => drainPaymentOutbox(limit, send)] ];
      const start = performance.now();
      if (mode === 'combined') await Promise.all(Array.from({ length: concurrency }, async (_, worker) => {
        for (const [name, work] of stages) await timed(name, work, worker);
      }));
      else for (const [name, work] of stages) await Promise.all(Array.from({ length: concurrency }, (_, worker) => timed(name, work, worker)));
      record.durationMs = +(performance.now() - start).toFixed(2);
      record.leasesAfter = await leases(); record.inspectCalls = inspectCalls - record.inspectCallsBefore;
      for (const stage of ['inbox', 'reconciliation', 'expiration', 'outbox']) expect(record.stages.filter((s: any) => s.name === stage)
        .reduce((sum: number, s: any) => sum + (s.result.claimed ?? s.result.processedCount), 0), stage).toBeGreaterThan(0);
      measurements.timings.push(record);
      latency = 0;
      // Finish only synthetic leftovers outside the measured interval. Two expiry workers
      // can select the same candidates; order locks prevent duplicated cancellation.
      await processExpiredOrders({ batchSize: 100, gateway }); await drain();
      const orders = await setup.order.findMany({ where: { id: { in: [...inboxOrders, ...reconciliationOrders] } } });
      expect(orders.every(order => order.status === 'PAID' && order.version === 1)).toBe(true);
      expect(await setup.order.count({ where: { id: { in: manualOrders }, status: 'CANCELLED', version: 1 } })).toBe(manualOrders.length);
      expect(await setup.orderStatusHistory.count({ where: { orderId: { in: [...inboxOrders, ...reconciliationOrders, ...manualOrders] } } }))
        .toBe(inboxOrders.length + reconciliationOrders.length + manualOrders.length);
    }

    // Real loopback HTTP cancellation while real database work continues.
    await setup.paymentAttempt.updateMany({ data: { reconcileAfter: future } });
    const uncertainOrder = await purchase(); await drain(); await enqueue(uncertainOrder); latency = 600;
    let posts = 0;
    let finish!: (result: any) => void;
    const completed = new Promise<any>(resolve => { finish = resolve; });
    const server = createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json');
      if (req.method === 'GET' && req.url === '/api/cron/payments/status') { res.end(JSON.stringify(status)); return; }
      if (req.method !== 'POST' || req.url !== '/api/cron/payments?limit=5') { res.statusCode = 404; res.end('{}'); return; }
      posts++;
      void (async () => {
        const inbox = await drainPaymentInbox(1, gateway);
        const reconciliation = await reconcilePaymentAttempts(1, gateway);
        const expiration = await processExpiredOrders({ batchSize: 1, gateway });
        const outbox = await drainPaymentOutbox(1, send);
        const result = { inbox, reconciliation, expiration, outbox }; res.end(JSON.stringify(result)); finish(result);
      })().catch(() => { finish({ failed: true }); res.destroy(); });
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const address = server.address() as { port: number };
      const logs: any[] = [];
      const start = performance.now();
      await expect(runConsumer({ ...process.env, CONSUMER_ORIGIN: `http://127.0.0.1:${address.port}`,
        CONSUMER_ALLOW_LOCAL: 'true', CONSUMER_REQUEST_TIMEOUT_MS: '150', CONSUMER_MAX_BATCHES: '5' },
      { log: (entry: any) => logs.push(entry) })).rejects.toThrow('CONSUMER_TRANSPORT_UNCERTAIN');
      const abortedAfterMs = performance.now() - start;
      const leasesAtAbort = await leases();
      expect(leasesAtAbort.PaymentInbox.live).toBeGreaterThan(0);
      const result = await completed; expect(result.inbox.completed).toBe(1);
      expect(posts).toBe(1);
      expect((await setup.order.findUniqueOrThrow({ where: { id: uncertainOrder } })).status).toBe('PAID');
      measurements.interruption = { clientTimeoutMs: 150, providerLatencyMs: 600, abortedAfterMs,
        serverFinishedAfterMs: performance.now() - start, posts, logs, leasesAtAbort, leasesAfter: await leases(),
        orderAfter: 'PAID', noAutomaticPostRetry: true, clientResult: 'CONSUMER_TRANSPORT_UNCERTAIN',
        note: 'Loopback adapter invokes real stages; not a deployed Next/Cloud Run request.' };
    } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }

    const clients: PrismaClient[] = [];
    measurements.pool = { experiments: [], proposal: poolBudget() };
    await prisma.$disconnect();
    try {
      for (const topology of [{ revisions: 1, instances: 1 }, { revisions: 1, instances: 2 }, { revisions: 2, instances: 1 }]) {
        const ids = new Set<number>();
        for (let i = 0; i < topology.revisions * topology.instances; i++) clients.push(new PrismaClient({ datasources: { db: { url: config.url } }, log: [] }));
        await Promise.all(clients.flatMap(client => Array.from({ length: 4 }, () => client.$transaction(async tx => {
          const rows = await tx.$queryRaw<any[]>`SELECT pg_backend_pid() AS pid`;
          ids.add(rows[0].pid); await tx.$executeRawUnsafe('SELECT pg_sleep(0.25)');
        }, { timeout: 10000 }))));
        expect(ids.size).toBe(4 * topology.revisions * topology.instances);
        measurements.pool.experiments.push({ ...topology, clients: clients.length, connectionLimit: 4, uniqueBackendPids: ids.size,
          model: 'independent Prisma clients model processes; revisions are labels, not Cloud Run deployments' });
        await Promise.all(clients.splice(0).map(client => client.$disconnect()));
      }
    } finally { await Promise.all(clients.map(client => client.$disconnect())); }
    measurements.syntheticEmailCalls = emailCalls;
    measurements.passed = true;
  } finally {
    measurements.finishedAt = new Date().toISOString();
    await writeFile(process.env.OPERATIONAL_RESULT!, JSON.stringify(measurements, null, 2) + '\n');
    await prisma.$disconnect(); await setup.$disconnect();
  }
}, 240000);
