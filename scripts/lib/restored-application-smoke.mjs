// HTTP read smoke of the restored/sanitized clone, never a shared datasource.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { request } from 'node:http';
import { randomUUID } from 'node:crypto';
import { command } from './disposable-postgres.mjs';
import { copyIsolatedProject, discardIsolatedProject } from './isolated-project.mjs';

const quote = text => "'" + text.replaceAll("'", "''") + "'";
const identifier = text => '"' + text.replaceAll('"', '""') + '"';
const check = (value, code) => { if (!value) throw new Error(code); };
const parse = output => JSON.parse(output.split('\n').find(line => line.trim().startsWith('{')));

export function assertSmokeTarget(pg) {
  const u = new URL(pg.env.TEST_DATABASE_URL);
  check(/^[a-f0-9]{32}$/.test(pg.runId) && pg.name === `logic-audit-pg-${pg.runId}` &&
    pg.database === `ecommerce_test_${pg.runId}` && u.hostname === '127.0.0.1' &&
    u.pathname === `/${pg.database}` && u.username === 'ecommerce_test' &&
    u.protocol === 'postgresql:' && Boolean(u.port) && Boolean(u.password) &&
    !u.hash && [...u.searchParams.keys()].every(key => ['schema','connection_limit','connect_timeout'].includes(key)) &&
    pg.env.TEST_RUN_ID === pg.runId && pg.env.DATABASE_URL === pg.env.TEST_DATABASE_URL &&
    pg.env.DIRECT_URL === pg.env.TEST_DATABASE_URL, 'SMOKE_TARGET_REJECTED');
}

export async function smokeRestoredApplication(pg, { excludedProductIds = [], preservedProductIds = [] } = {}) {
  assertSmokeTarget(pg);
  const label = await command('docker', ['inspect', '--format', '{{index .Config.Labels "logic-audit.run-id"}}', pg.name], { capture: true });
  check(label === pg.runId, 'SMOKE_LABEL_MISMATCH');
  // Capture every application table, including empty/new ledger tables. No row
  // contents or authentication cookies are returned in the public evidence.
  async function fingerprint() {
    const { names } = parse(await pg.sql(`SELECT json_build_object('names',json_agg(tablename ORDER BY tablename)) FROM pg_tables WHERE schemaname='public' AND tablename<>'_TestDatabaseSentinel';`));
    const result = {};
    for (const table of names) result[table] = parse(await pg.sql(`SELECT json_build_object('count',count(*),'hash',md5(COALESCE(string_agg(md5(to_jsonb(t)::text),'' ORDER BY to_jsonb(t)::text),''))) FROM public.${identifier(table)} t;`));
    return JSON.stringify(result);
  }
  const baseline = await fingerprint();
  const state = parse(await pg.sql(`SELECT json_build_object(
    'stores',(SELECT json_agg(json_build_object('id',id,'slug',slug)) FROM "Loja"),
    'admins',(SELECT json_agg(json_build_object('id',id,'store',"lojaID")) FROM "User" WHERE role='ADMIN' AND status='ACTIVE'),
    'orders',(SELECT json_agg(json_build_object('id',id,'status',status,'total',total,'items',(SELECT count(*) FROM "OrderItem" i WHERE i."orderId"=o.id))) FROM "Order" o),
    'wallets',(SELECT json_agg(json_build_object('user',w."userID",'balance',w.balance,'accountingReady',w."accountingReady",'active',u.status='ACTIVE')) FROM "LoyaltyWallet" w JOIN "User" u ON u.id=w."userID"),
    'products',(SELECT count(*) FROM "Product" WHERE "retiredAt" IS NULL));`));
  check(state.stores?.length === 1 && state.admins?.length > 0 && state.orders?.length > 0, 'SMOKE_BASELINE_MISSING');
  const store = state.stores[0];
  const admin = state.admins.find(a => a.store === store.id);
  check(admin && state.wallets?.every(w => w.active), 'SMOKE_ACTOR_UNAVAILABLE');
  const host = store.slug + '.plataforma.com';
  const sessions = [];
  let server, project;
  const startedAt = new Date().toISOString();
  const report = { startedAt, cloneRunId: pg.runId, cases: [], productionReady: false };
  const record = (name, count = 1) => report.cases.push({ name, count, passed: true });
  try {
    await pg.mark();
    // The server has a read-only database default; bootstrap sessions exist
    // only in this clone and are removed before comparing all data again.
    await pg.sql('ALTER ROLE ecommerce_test SET default_transaction_read_only=on;');
    async function session(user) {
      const id = randomUUID(); sessions.push(id);
      await pg.sql(`INSERT INTO "Session" (id,"userId","expiresAt") VALUES (${quote(id)},${quote(user)},now()+interval '1 hour');`);
      return id;
    }
    const adminSession = await session(admin.id);
    const walletSessions = [];
    for (const wallet of state.wallets) walletSessions.push({ ...wallet, session: await session(wallet.user) });
    const port = await new Promise((resolve, reject) => {
      const probe = createServer(); probe.on('error', reject);
      probe.listen(0, '127.0.0.1', () => { const port = probe.address().port; probe.close(() => resolve(port)); });
    });
    project = await copyIsolatedProject();
    // Allow only OS bootstrap values and explicitly isolated application values.
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
      /^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|LOCALAPPDATA|APPDATA|USERPROFILE|COMSPEC|PATHEXT|NUMBER_OF_PROCESSORS)$/i.test(key)));
    for (const key of ['TEST_RUN_ID','TEST_DATABASE_URL','DATABASE_URL','DIRECT_URL','TEST_HTTP_TOKEN','FREIGHT_QUOTE_SECRET']) env[key] = pg.env[key];
    Object.assign(env, { NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1',
      PLATFORM_DOMAIN: 'plataforma.com', DEFAULT_LOJA_SLUG: store.slug,
      TEST_BASE_URL: `http://127.0.0.1:${port}`, NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${port}`,
      PAYMENT_REMOTE_ENABLED: 'false', PAYMENT_WORKER_ENABLED: 'false', PAYMENT_EXPIRATION_ENABLED: 'false',
      ASAAS_API_KEY: '', ASAAS_WEBHOOK_TOKEN: '', RESEND_API_KEY: '', NUVEMSHOP_ACCESS_TOKEN: '', CRON_SECRET: '' });
    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(port)],
      { cwd: project, env, shell: false, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore','pipe','pipe'] });
    let failure = false;
    server.on('error', () => { failure = true; });
    server.on('exit', () => { failure = true; });
    server.stdout.resume(); server.stderr.resume();
    function get(route, cookie, requestHost = host, extra = {}) {
      return new Promise((resolve, reject) => {
        const req = request({ hostname: '127.0.0.1', port, path: route, method: 'GET',
          headers: { Host: requestHost, ...(cookie ? { Cookie: 'session_id=' + cookie } : {}), ...extra } }, res => {
          let body = ''; res.setEncoding('utf8');
          res.on('data', chunk => { body += chunk; if (body.length > 8 * 1024 * 1024) req.destroy(new Error('SMOKE_RESPONSE_LIMIT')); });
          res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(body) }); } catch { reject(new Error('SMOKE_NON_JSON')); } });
        });
        req.setTimeout(60000, () => req.destroy(new Error('SMOKE_TIMEOUT')));
        req.on('error', () => reject(new Error('SMOKE_HTTP_UNRESOLVED'))); req.end();
      });
    }
    let ready = false;
    for (let attempt = 0; attempt < 60 && !failure; attempt++) {
      try {
        const r = await get('/api/test-environment', null, host, { 'x-test-environment-token': env.TEST_HTTP_TOKEN });
        if (r.status === 200) {
          check(r.body.runId === pg.runId && r.body.database === pg.database, 'SMOKE_IDENTITY_MISMATCH');
          ready = true; break;
        }
      } catch (error) { if (error.message === 'SMOKE_IDENTITY_MISMATCH') throw error; }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    check(ready, 'SMOKE_SERVER_NOT_READY'); record('server_database_identity');
    const products = new Set();
    for (let page = 1; page <= Math.ceil(state.products / 100); page++) {
      const r = await get(`/api/products?limit=100&page=${page}`);
      check(r.status === 200 && Array.isArray(r.body), 'SMOKE_CATALOG_FAILED');
      for (const p of r.body) {
        check(p.lojaID === store.id && Number.isInteger(p.inventoryVersion) && Array.isArray(p.productVariants), 'SMOKE_PRODUCT_SHAPE');
        products.add(p.id);
      }
    }
    check(products.size === state.products, 'SMOKE_CATALOG_COUNT'); record('catalog_read', products.size);
    check(excludedProductIds.every(id => !products.has(id)) && preservedProductIds.every(id => products.has(id)), 'SMOKE_CATALOG_RETIREMENT_SCOPE');
    if (excludedProductIds.length) record('test_products_absent_from_catalog', excludedProductIds.length);
    if (preservedProductIds.length) record('commercial_vacuums_and_accessories_preserved', preservedProductIds.length);
    for (const order of state.orders) {
      const r = await get('/api/admin/orders/' + order.id, adminSession);
      check(r.status === 200 && r.body.success === true && r.body.data.id === order.id &&
        r.body.data.status === order.status && Number(r.body.data.total) === Number(order.total) &&
        r.body.data.items.length === order.items, 'SMOKE_ORDER_READ');
    }
    record('legacy_admin_order_read', state.orders.length);
    const denied = await get('/api/admin/orders/' + state.orders[0].id);
    check(denied.status === 401, 'SMOKE_UNAUTHENTICATED_ACCESS'); record('unauthenticated_order_denied');
    const wrongHost = await get('/api/admin/orders/' + state.orders[0].id, adminSession, 'missing-clone-store.plataforma.com');
    check(wrongHost.status === 404, 'SMOKE_UNKNOWN_TENANT_ACCESS'); record('unknown_tenant_denied');
    for (const wallet of walletSessions) {
      const r = await get('/api/loyalty/wallet', wallet.session);
      check(r.status === 200 && r.body.success === true && r.body.data.wallet.balance === wallet.balance &&
        r.body.data.wallet.accountingReady === wallet.accountingReady, 'SMOKE_LEGACY_WALLET');
    }
    record(walletSessions.every(w=>w.accountingReady) ? 'opening_wallet_read' : 'legacy_wallet_read_unreconciled', walletSessions.length);
    const capabilities = await get('/api/payment/capabilities');
    check(capabilities.status === 200 && Array.isArray(capabilities.body.methods) && capabilities.body.methods.length === 0, 'SMOKE_METHOD_ACTIVATION');
    record('methods_remain_disabled');
  } finally {
    if (server && server.exitCode === null) {
      if (process.platform === 'win32') await command('taskkill', ['/PID', String(server.pid), '/T', '/F'], { capture: true });
      else process.kill(-server.pid, 'SIGTERM');
    }
    if (sessions.length) await pg.sql(`DELETE FROM "Session" WHERE id IN (${sessions.map(quote).join(',')});`);
    if (project) await discardIsolatedProject(project);
  }
  check(await fingerprint() === baseline, 'SMOKE_DATA_CHANGED');
  report.allApplicationTablesPreserved = true;
  report.sessionBootstrapOnly = true;
  report.applicationDatabaseReadOnly = true;
  report.finishedAt = new Date().toISOString();
  return report;
}
