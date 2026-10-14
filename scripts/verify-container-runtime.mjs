import { randomBytes } from 'node:crypto';
import { command, provisionPostgres } from './lib/disposable-postgres.mjs';

if (process.argv.length !== 3 || !/^continental-vanderlei:[a-zA-Z0-9._-]+$/.test(process.argv[2])) {
  throw new Error('Usage: node scripts/verify-container-runtime.mjs continental-vanderlei:tag');
}
const image = process.argv[2];
const imageInfo = JSON.parse(await command('docker', ['image', 'inspect', image], { capture: true }))[0];
if (imageInfo.Os !== 'linux' || imageInfo.Config.User !== 'node') throw new Error('CONTAINER_RUNTIME_POLICY_INVALID');
const pg = await provisionPostgres();
const containers = [];
const startedAt = new Date().toISOString();
let phase = 'migrations';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const probe = `
(async () => {
 const origin = 'http://127.0.0.1:' + process.env.PORT;
 const headers = {Host:'container-' + process.env.TEST_RUN_ID + '.plataforma.com'};
 // Node fetch may discard an explicit Host. Preserve the fixture virtual host
 // at the HTTP socket boundary, as the existing isolated request harness does.
 const get = (path, extra={}) => new Promise((resolve,reject) => {
   const req = require('http').request({hostname:'127.0.0.1',port:process.env.PORT,path,headers:{...headers,...extra}}, res => {
     let body=''; res.setEncoding('utf8'); res.on('data',part => body+=part);
     res.on('end',() => resolve({status:res.statusCode,ok:res.statusCode>=200 && res.statusCode<300,text:async()=>body,json:async()=>JSON.parse(body)}));
   });
   req.setTimeout(5000,()=>req.destroy(new Error('TIMEOUT'))); req.on('error',reject); req.end();
 });
 if ((await get('/api/test-environment')).status !== 404) throw Error('HANDSHAKE_PUBLIC');
 const response = await get('/api/test-environment', {'x-test-environment-token':process.env.TEST_HTTP_TOKEN});
 const data = await response.json();
 if (!response.ok || data.runId !== process.env.TEST_RUN_ID || data.database !== 'ecommerce_test_' + process.env.TEST_RUN_ID) throw Error('IDENTITY');
 const home = await get('/'); if (!home.ok || !(await home.text()).includes('Explorar Catálogo')) throw Error('HOME');
 const login = await get('/login'); const html = await login.text();
 const js = html.match(/src="(\\/_next\\/static\\/[^"<>]+\\.js(?:\\?[^"<>]*)?)"/);
 if (!login.ok || !js || !(await get(js[1].replaceAll('&amp;','&'))).ok || !(await get('/brands/wap.svg')).ok) throw Error('ASSETS');
 const unauthorized = await fetch(origin + '/api/cron/payments'); if (unauthorized.status !== 401) throw Error('CRON_AUTH');
 console.log(JSON.stringify({sentinel:true,home:true,assets:true,cronAuth:true,uid:process.getuid(),buildId:require('fs').readFileSync('.next/BUILD_ID','utf8').trim()}));
})().catch(error => { console.error('CONTAINER_PROBE_' + (['HANDSHAKE_PUBLIC','IDENTITY','HOME','ASSETS','CRON_AUTH'].includes(error.message) ? error.message : 'FAILED')); process.exitCode=1; });`;
try {
  await command(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env: pg.env, capture: true });
  await pg.mark();
  await pg.sql(`INSERT INTO "Loja" (id,name,slug,description,"coverImageUrl","updatedAt") VALUES ('${pg.runId}','Fixture Docker','container-${pg.runId}','','',now());`);
  const url = new URL(pg.env.TEST_DATABASE_URL); url.port = '5432';
  const env = { NODE_ENV: 'production', TEST_RUN_ID: pg.runId, TEST_DATABASE_URL: url.toString(), DATABASE_URL: url.toString(),
    DIRECT_URL: url.toString(), TEST_HTTP_TOKEN: pg.env.TEST_HTTP_TOKEN, FREIGHT_QUOTE_SECRET: pg.env.FREIGHT_QUOTE_SECRET,
    CRON_SECRET: pg.env.CRON_SECRET, SESSION_SECRET: randomBytes(32).toString('hex'),
    ASAAS_API_KEY: '', ASAAS_WEBHOOK_TOKEN: '', RESEND_API_KEY: '', PAYMENT_REMOTE_ENABLED: 'false', PAYMENT_WORKER_ENABLED: 'true',
    PAYMENT_EXPIRATION_ENABLED: 'false', PAYMENT_DEPLOYMENT_ENVIRONMENT: 'SANDBOX', ASAAS_ACCOUNT_SCOPE: 'container-test',
    HOSTNAME: '127.0.0.1' };
  const waitReady = async name => {
    let lastCode = '';
    for (let i = 0; i < 40; i++) {
      try { return JSON.parse(await command('docker', ['exec', name, 'node', '-e', probe], { capture: true })); }
      catch (error) { lastCode = error.message.match(/CONTAINER_PROBE_[A-Z_]+/)?.[0] ?? 'CONTAINER_PROBE_UNAVAILABLE'; await pause(500); }
    }
    throw new Error(lastCode);
  };
  const results = [];
  phase = 'runtime';
  for (let i = 0; i < 2; i++) {
    const name = `continental-runtime-${pg.runId}-${i}`;
    const launchStarted = performance.now();
    await command('docker', ['run', '--detach', '--rm', '--name', name, '--label', `logic-audit.run-id=${pg.runId}`,
      '--network', `container:${pg.name}`, ...Object.entries({ ...env, PORT: String(8080 + i) }).flatMap(([key, val]) => ['--env', `${key}=${val}`]), image], { capture: true });
    containers.push(name);
    results.push({ ...await waitReady(name), launchToReadyMs: performance.now() - launchStarted });
  }
  if (results[0].buildId !== results[1].buildId) throw new Error('CONTAINER_BUILD_MISMATCH');
  await command('docker', ['restart', '--time', '5', containers[1]], { capture: true });
  await waitReady(containers[1]);
  phase = 'consumer';
  // A real consumer process calls real app endpoints against this sentinel-guarded
  // empty database. No gateway/email credentials are available to either process.
  const consumer = await command('docker', ['exec', '--env', 'CONSUMER_ORIGIN=http://127.0.0.1:8080', '--env', 'CONSUMER_ALLOW_LOCAL=true',
    containers[0], 'node', 'scripts/cloudrun-consumer.mjs'], { capture: true });
  const events = consumer.split('\n').filter(Boolean).map(line => JSON.parse(line));
  if (!events.some(e => e.event === 'consumer_completed' && e.outcome === 'idle')) throw new Error('CONTAINER_CONSUMER_FAILED');
  console.log('[container-runtime] ' + JSON.stringify({ startedAt, finishedAt: new Date().toISOString(), imageId: imageInfo.Id,
    runId: pg.runId, results, instances: 2, restart: true, consumerAuthenticated: true, externalProviders: false, productionReady: false }));
} catch (error) {
  const code = /^CONTAINER_[A-Z_]+$/.test(error.message) ? error.message : 'CONTAINER_VERIFICATION_FAILED';
  console.error(JSON.stringify({ phase, code })); process.exitCode = 1;
} finally {
  for (const name of containers.reverse()) {
    const identity = await command('docker', ['inspect', '--format', '{{index .Config.Labels "logic-audit.run-id"}}', name], { capture: true });
    if (identity !== pg.runId) throw new Error('CONTAINER_CLEANUP_SCOPE_INVALID');
    await command('docker', ['stop', '--time', '5', name], { capture: true });
  }
  await pg.dispose();
}
