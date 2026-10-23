import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { provisionPostgres } from './lib/disposable-postgres.mjs';
import { copyIsolatedProject, discardIsolatedProject } from './lib/isolated-project.mjs';
import { grantSql, runtimeGrants, routines, lockColumnGrants, systemEnvironment } from './lib/operational-readiness.mjs';

// No URL/host overrides: this command always provisions its own local database.
if (process.argv.length > 2) throw new Error('NO_DATABASE_OR_DESTINATION_ARGUMENTS_ACCEPTED');
const startedAt = new Date().toISOString();
let fixture, directory;
const report = { schemaVersion: 1, startedAt, state: 'RUNNING', postgresMajor: 18,
  remoteMutations: false, providers: 'synthetic', runtimeGrants, lockColumnGrants, routines,
  sequenceGrants: { Order_orderNumber_seq: ['USAGE', 'SELECT'] } };
const output = path.resolve('artifacts/operational-readiness', startedAt.replace(/[:.]/g, '-'));
await fs.mkdir(output, { recursive: true });
const clean = systemEnvironment();
const run = (args, env) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, args, { cwd: directory, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  child.stdout.on('data', value => { log += value; }); child.stderr.on('data', value => { log += value; });
  const timer = setTimeout(() => child.kill(), 240000);
  child.on('error', () => { clearTimeout(timer); reject(new Error('LOCAL_CHILD_START_FAILED')); });
  child.on('close', async code => {
    clearTimeout(timer);
    // The child only sees synthetic credentials, still redact them before saving.
    log = log.replace(/postgres(?:ql)?:\/\/[^\s'"<>]+/g, '[LOCAL_DATABASE_URL]');
    for (const [key, value] of Object.entries(env)) if (/PASSWORD|SECRET|TOKEN/.test(key) && value) log = log.replaceAll(value, '[REDACTED]');
    await fs.appendFile(path.join(output, 'local-tests.log'), log);
    code === 0 ? resolve() : reject(new Error('LOCAL_CHILD_FAILED_SEE_SANITIZED_LOG'));
  });
});
try {
  fixture = await provisionPostgres({ majorVersion: 18 });
  directory = await copyIsolatedProject();
  for (const entry of ['tests', 'scripts', 'vitest.config.ts']) await fs.cp(path.resolve(entry), path.join(directory, entry), { recursive: true });
  const password = randomBytes(24).toString('hex');
  const migratorUrl = new URL(fixture.env.TEST_DATABASE_URL);
  migratorUrl.username = 'ecommerce_migrator'; migratorUrl.password = password;
  await fixture.sql(`CREATE ROLE ecommerce_migrator LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
    GRANT CONNECT ON DATABASE "${fixture.database}" TO ecommerce_migrator;
    GRANT USAGE, CREATE ON SCHEMA public TO ecommerce_migrator;`);
  const env = { ...clean, NODE_ENV: 'test', OPERATIONAL_READINESS: 'true',
    TEST_RUN_ID: fixture.runId, TEST_DATABASE_URL: fixture.env.TEST_DATABASE_URL,
    DATABASE_URL: fixture.env.TEST_DATABASE_URL, DIRECT_URL: fixture.env.TEST_DATABASE_URL,
    TEST_MIGRATOR_URL: migratorUrl.toString(), OPERATIONAL_RESULT: path.join(output, 'measurements.json'),
    PAYMENT_DEPLOYMENT_ENVIRONMENT: 'SANDBOX', ASAAS_ACCOUNT_SCOPE: 'primary',
    CRON_SECRET: fixture.env.CRON_SECRET, FREIGHT_QUOTE_SECRET: fixture.env.FREIGHT_QUOTE_SECRET,
    ASAAS_WEBHOOK_TOKEN: fixture.env.ASAAS_WEBHOOK_TOKEN,
    PAYMENT_WORKER_ENABLED: 'true', PAYMENT_REMOTE_ENABLED: 'false', PAYMENT_EXPIRATION_ENABLED: 'true' };
  await run(['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
    { ...clean, DATABASE_URL: migratorUrl.toString(), DIRECT_URL: migratorUrl.toString() });
  await fixture.mark(); await fixture.sql(grantSql());
  await fixture.sql('GRANT SELECT ON "_TestDatabaseSentinel" TO ecommerce_migrator;');
  report.runId = fixture.runId;
  report.isolatedCopyWithoutDotEnv = true;
  console.log('PostgreSQL 18 pronto; executando permissões, ciclos, interrupção e pools locais.');
  await run(['node_modules/vitest/vitest.mjs', 'run', 'tests/operational/readiness.test.ts'], env);
  report.measurements = JSON.parse(await fs.readFile(env.OPERATIONAL_RESULT, 'utf8'));
  const storesBefore = await fixture.sql('SELECT count(*) FROM "Loja";');
  await fixture.sql("UPDATE \"_TestDatabaseSentinel\" SET run_id='incorrect-run';");
  await run(['node_modules/vitest/vitest.mjs', 'run', 'tests/integration/database-guard-negative.test.ts',
    'tests/unit/test-database-policy.test.ts'], { ...env, TEST_INVALID_SENTINEL: 'mismatched' });
  if (storesBefore !== await fixture.sql('SELECT count(*) FROM "Loja";')) throw new Error('SENTINEL_ALLOWED_WRITE');
  report.negativeIsolation = { incorrectSentinel: 'REJECTED_BEFORE_WRITES', nonlocalDestination: 'REJECTED_BY_DATABASE_POLICY' };
  report.state = 'PASSED';
} catch (error) {
  report.state = 'FAILED'; report.error = ['LOCAL_CHILD_FAILED_SEE_SANITIZED_LOG', 'LOCAL_CHILD_START_FAILED'].includes(error.message) ? error.message : 'LOCAL_LAB_FAILED';
  process.exitCode = 1;
} finally {
  try { if (directory) await discardIsolatedProject(directory); } catch { report.copyCleanup = 'FAILED'; process.exitCode = 1; }
  try { if (fixture) await fixture.dispose(); } catch { report.containerCleanup = 'FAILED'; process.exitCode = 1; }
  if (report.copyCleanup || report.containerCleanup) report.state = 'FAILED_CLEANUP';
  report.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ state: report.state, output, cleanupFailed: Boolean(report.copyCleanup || report.containerCleanup) }));
}
