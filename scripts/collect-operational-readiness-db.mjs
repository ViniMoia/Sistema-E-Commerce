// HML allowlist + read-only transaction. Never calls financial services.
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { PrismaClient } from '@prisma/client';

const env = parseEnv(await fs.readFile('.env.homologacao', 'utf8'));
const url = new URL(env.DIRECT_URL);
if (env.PAYMENT_DEPLOYMENT_ENVIRONMENT !== 'SANDBOX'
  || !['postgres:', 'postgresql:'].includes(url.protocol)
  || url.hostname !== 'ep-blue-feather-b6l24gbu.c-2.sa-east-1.aws.neon.tech' || url.pathname !== '/neondb') throw new Error('HML_REQUIRED');
const client = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } }, log: [] });
const result = { startedAt: new Date().toISOString(), host: url.hostname, readOnly: true };
try {
  result.snapshot = await client.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout='10s'");
    const store = await tx.loja.findUnique({ where: { id: '3a82b33c-3646-4272-9a89-80bb1ba327a5' }, select: { slug: true } });
    if (store?.slug !== 'continental-homologacao') throw new Error('TENANT_MISMATCH');
    const identity = await tx.$queryRawUnsafe(`SELECT current_database() AS database,
      current_setting('transaction_read_only') AS read_only,
      current_setting('max_connections')::int AS max_connections,
      current_setting('superuser_reserved_connections')::int AS reserved,
      pg_has_role(current_user,'pg_read_all_stats','MEMBER') AS all_stats_visible`);
    const role = await tx.$queryRawUnsafe(`SELECT rolsuper,rolcreatedb,rolcreaterole,rolbypassrls FROM pg_roles WHERE rolname=current_user`);
    const tables = await tx.$queryRawUnsafe(`SELECT count(*)::int AS total,
      count(*) FILTER (WHERE relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user))::int AS owned,
      count(*) FILTER (WHERE relrowsecurity)::int AS rls FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r'`);
    const sessions = await tx.$queryRawUnsafe(`SELECT state,backend_type,count(*)::int AS count FROM pg_stat_activity
      WHERE datname=current_database() AND pid<>pg_backend_pid() GROUP BY state,backend_type`);
    const queues = {}, leases = {};
    for (const table of ['PaymentInbox', 'CommerceOutbox', 'PaymentOperation']) queues[table] =
      await tx.$queryRawUnsafe(`SELECT status,count(*)::int AS count FROM "${table}" GROUP BY status ORDER BY status`);
    for (const table of ['PaymentInbox', 'CommerceOutbox', 'PaymentAttempt']) leases[table] =
      (await tx.$queryRawUnsafe(`SELECT count(*) FILTER (WHERE "leaseOwner" IS NOT NULL)::int AS held,
        count(*) FILTER (WHERE "leaseExpiresAt">now())::int AS live FROM "${table}"`))[0];
    return { identity: identity[0], role: role[0], tables: tables[0], sessions, queues, leases };
  }, { timeout: 30000, maxWait: 10000 });
  result.ok = true;
} catch (error) { result.ok = false; result.error = error.code || 'READ_ONLY_COLLECTION_FAILED'; process.exitCode = 1; }
finally { await client.$disconnect(); }
result.finishedAt = new Date().toISOString();
const directory = path.resolve('artifacts/operational-readiness/inventory');
await fs.mkdir(directory, { recursive: true });
const target = path.join(directory, 'database-' + result.startedAt.replace(/[:.]/g, '-') + '.json');
await fs.writeFile(target, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ ok: result.ok, path: target }));
