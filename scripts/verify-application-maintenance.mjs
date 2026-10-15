// Builds one isolated artifact and restarts it closed/open. Never uses .env DBs.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { command, provisionPostgres } from './lib/disposable-postgres.mjs';
import { copyIsolatedProject, discardIsolatedProject } from './lib/isolated-project.mjs';

const pg = await provisionPostgres();
let project, server;
const startedAt = new Date().toISOString();
const parse = output => JSON.parse(output.slice(output.indexOf('{'), output.lastIndexOf('}') + 1));
const identifier = value => '"' + value.replaceAll('"', '""') + '"';
const literal = value => "'" + value.replaceAll("'", "''") + "'";
const jsonSql = async query => parse(await pg.sql('\\pset format unaligned\n\\pset tuples_only on\n' + query));
async function stop() {
  if (server && server.exitCode === null) {
    if (process.platform === 'win32') await command('taskkill', ['/PID', String(server.pid), '/T', '/F'], { capture: true });
    else {
      const exited = new Promise(resolve => server.once('exit', resolve));
      process.kill(-server.pid, 'SIGTERM');
      await exited;
    }
  }
  server = undefined;
}
try {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    /^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|LOCALAPPDATA|APPDATA|USERPROFILE|COMSPEC|PATHEXT|NUMBER_OF_PROCESSORS)$/i.test(key)));
  for (const key of ['TEST_RUN_ID', 'TEST_DATABASE_URL', 'DATABASE_URL', 'DIRECT_URL', 'TEST_HTTP_TOKEN', 'FREIGHT_QUOTE_SECRET', 'ASAAS_WEBHOOK_TOKEN', 'CRON_SECRET']) env[key] = pg.env[key];
  Object.assign(env, { NODE_ENV: 'test', APP_MAINTENANCE_MODE: 'false', CHECKOUT_PAUSED: 'true',
    NEXT_TELEMETRY_DISABLED: '1', PAYMENT_REMOTE_ENABLED: 'false', PAYMENT_WORKER_ENABLED: 'true', PAYMENT_EXPIRATION_ENABLED: 'false',
    ASAAS_API_KEY: '', RESEND_API_KEY: '' });
  await command(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env, capture: true });
  await pg.mark();
  await command(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'tests/integration/application-maintenance.test.ts'], { env });
  const tables = (await jsonSql(`SELECT json_build_object('names',json_agg(tablename ORDER BY tablename)) FROM pg_tables WHERE schemaname='public';`)).names;
  const fingerprint = async () => jsonSql(`SELECT json_build_object('tables',json_agg(t ORDER BY name),
    'sequences',(SELECT md5(COALESCE(string_agg(row_to_json(s)::text,'' ORDER BY sequencename),'')) FROM pg_sequences s WHERE schemaname='public'))
    FROM (${tables.map(name => `SELECT ${literal(name)} AS name,count(*) AS count,md5(COALESCE(string_agg(md5(to_jsonb(r)::text),'' ORDER BY to_jsonb(r)::text),'')) AS hash FROM public.${identifier(name)} r`).join(' UNION ALL ')}) t;`);
  const before = await fingerprint();
  project = await copyIsolatedProject();
  console.log('[maintenance] Building isolated production artifact; no shared database or provider credentials.');
  const build = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'build', '--webpack'], {
    cwd: project, env: { ...env, NODE_ENV: 'production' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (const stream of [build.stdout, build.stderr]) stream.on('data', data => process.stdout.write(data.toString().replaceAll(env.DATABASE_URL, '[isolated-database]')));
  await new Promise((resolve, reject) => { build.on('error', reject); build.on('exit', code => code === 0 ? resolve() : reject(new Error('MAINTENANCE_BUILD_FAILED'))); });

  const port = await new Promise((resolve, reject) => {
    const probe = createServer(); probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => { const port = probe.address().port; probe.close(() => resolve(port)); });
  });
  const origin = `http://127.0.0.1:${port}`;
  const request = (path, options = {}) => fetch(origin + path, { ...options, redirect: 'manual', signal: AbortSignal.timeout(15000) });
  async function start(paused) {
    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
      cwd: project, env: { ...env, NODE_ENV: 'production', APP_MAINTENANCE_MODE: String(paused) },
      windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout.resume(); server.stderr.resume();
    let failure; server.on('error', () => { failure = true; });
    for (let attempt = 0; attempt < 60; attempt++) {
      if (failure || server.exitCode !== null) throw new Error('MAINTENANCE_SERVER_EXITED');
      try {
        const response = await request('/api/test-environment', { headers: { 'x-test-environment-token': env.TEST_HTTP_TOKEN } });
        const data = await response.json();
        if (paused && response.status === 503 && data.error === 'APP_MAINTENANCE') return;
        if (!paused && response.ok && data.runId === pg.runId && data.database === pg.database) return;
      } catch { /* bounded startup polling */ }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error('MAINTENANCE_SERVER_NOT_READY');
  }
  // Handshake before closing establishes actual datasource/run identity.
  await start(false); await stop();
  await start(true);
  const cases = [
    ['GET', '/api/checkout/intents'], ['PATCH', '/api/checkout/intents'], ['POST', '/api/checkout'],
    ['POST', '/api/orders'], ['GET', '/api/cart'], ['POST', '/api/cart'],
    ['POST', '/api/auth/login'], ['POST', '/api/auth/logout'], ['POST', '/api/auth/register'],
    ['GET', '/api/loyalty/wallet'], ['POST', '/api/freight/calculate'], ['POST', '/api/upload'],
    ['PUT', '/api/loja/settings'], ['PATCH', '/api/admin/orders/fixture/status'],
    ['POST', '/api/admin/orders/fixture/payment-operation'], ['DELETE', '/api/products/fixture'],
    ['GET', '/api/cron/payments'], ['POST', '/api/cron/payments'],
    ['GET', '/api/cron/orders-timeout'], ['POST', '/api/cron/loyalty-expiration'],
    ['POST', '/api/webhooks/asaas'], ['POST', '/api/future.png'], ['OPTIONS', '/api/checkout'],
  ];
  for (const [method, path] of cases) {
    const response = await request(path, { method, headers: { authorization: `Bearer ${env.CRON_SECRET}`,
      'asaas-access-token': env.ASAAS_WEBHOOK_TOKEN, 'Content-Type': 'application/json', cookie: 'session_id=expired-session-fixture' },
      ...(!['GET', 'OPTIONS'].includes(method) ? { body: '{}' } : {}) });
    assert.equal(response.status, 503, path);
    assert.equal(response.headers.get('set-cookie'), null, path);
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.deepEqual(await response.json(), { success: false, error: 'APP_MAINTENANCE' });
  }
  for (const [method, path] of [['GET', '/'], ['GET', '/admin'], ['GET', '/checkout'], ['POST', '/profile']]) {
    const response = await request(path, { method, headers: { 'Next-Action': 'fixture' } });
    assert.equal(response.status, 503); assert.match(await response.text(), /Estamos em manutenção/);
  }
  assert.deepEqual(await fingerprint(), before);
  await stop(); await start(false);
  const resumed = await request('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(resumed.status, 503);
  assert.equal((await resumed.json()).error, 'CHECKOUT_PAUSED'); // resume drain, not sales
  assert.equal((await request('/api/orders')).status, 401); // auth still required
  assert.deepEqual(await fingerprint(), before);
  console.log(JSON.stringify({ kind: 'application_maintenance_rehearsal', startedAt, finishedAt: new Date().toISOString(),
    runId: pg.runId, optimizedRuntime: true, sameArtifactRestarted: true, apiChecks: cases.length, pageChecks: 4,
    databasePreserved: true, resumedWithCheckoutPaused: true, externalProviders: false, productionReady: false }));
} catch (error) {
  console.error(error.message.replaceAll(pg.env.DATABASE_URL, '[redacted]'));
  process.exitCode = 1;
} finally {
  try { await stop(); } finally {
    try { await pg.dispose(); } finally { if (project) await discardIsolatedProject(project); }
  }
}
