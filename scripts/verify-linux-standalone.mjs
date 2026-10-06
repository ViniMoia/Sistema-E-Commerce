import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomBytes } from 'node:crypto';
import { command, provisionPostgres } from './lib/disposable-postgres.mjs';
import { copyIsolatedProject, discardIsolatedProject } from './lib/isolated-project.mjs';
import { inspectStandalonePackage } from './lib/standalone-package.mjs';

if (process.argv.length !== 2) throw new Error('O ensaio Linux não aceita URLs, segredos ou comandos externos.');
const pg = await provisionPostgres();
const startedAt = new Date().toISOString();
const image = `logic-audit-linux:${pg.runId}`;
const containers = [];
const directories = [];
let imageCreated = false;
let phase = 'preparation';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function removeContainer(name) {
  const identity = await command('docker', ['inspect', '--format', '{{index .Config.Labels "logic-audit.run-id"}}', name], { capture: true });
  if (identity !== pg.runId) throw new Error('LINUX_CONTAINER_OWNERSHIP_MISMATCH');
  await command('docker', ['rm', '--force', name], { capture: true });
  containers.splice(containers.indexOf(name), 1);
}
async function fingerprint(directory) {
  const hash = createHash('sha256');
  async function visit(root, prefix = '') {
    for (const item of (await readdir(root, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      if (item.isSymbolicLink()) throw new Error('LINUX_SOURCE_LINK_FORBIDDEN');
      const label = prefix + item.name;
      if (item.isDirectory()) await visit(path.join(root, item.name), label + '/');
      else {
        const contents = await readFile(path.join(root, item.name));
        hash.update(label + '\0' + contents.length + '\0'); hash.update(contents);
      }
    }
  }
  await visit(directory); return hash.digest('hex');
}
const httpProbe = `
  const fs = require('node:fs');
  const origin = 'http://127.0.0.1:' + process.env.PORT;
  const headers = { Host: 'linux-' + process.env.TEST_RUN_ID + '.plataforma.com' };
  async function get(route, extra = {}) {
    return fetch(origin + route, { headers: { ...headers, ...extra },
      redirect: 'error', signal: AbortSignal.timeout(5000), cache: 'no-store' });
  }
  (async () => {
    const noToken = await get('/api/test-environment');
    if (noToken.status !== 404) throw Error('HANDSHAKE_EXPOSED');
    const response = await get('/api/test-environment', { 'x-test-environment-token': process.env.TEST_HTTP_TOKEN });
    if (!response.ok) throw Error('HANDSHAKE_UNAVAILABLE');
    const identity = await response.json();
    if (identity.runId !== process.env.TEST_RUN_ID || identity.database !== 'ecommerce_test_' + process.env.TEST_RUN_ID) throw Error('IDENTITY_MISMATCH');
    const page = await get('/login');
    if (page.status !== 200) throw Error('LOGIN_UNAVAILABLE');
    const script = (await page.text()).match(/src="(\\/_next\\/static\\/[^"<>]+\\.js(?:\\?[^"<>]*)?)"/);
    if (!script) throw Error('COMPILED_SCRIPT_MISSING');
    const js = await get(script[1].replaceAll('&amp;', '&'));
    if (js.status !== 200 || !/javascript/.test(js.headers.get('content-type') ?? '') || (await js.text()).length < 100) throw Error('COMPILED_SCRIPT_INVALID');
    const svg = await get('/brands/wap.svg');
    if (svg.status !== 200 || !svg.headers.get('content-type')?.includes('image/svg+xml')
      || await svg.text() !== fs.readFileSync('public/brands/wap.svg', 'utf8')) throw Error('PUBLIC_ASSET_INVALID');
    console.log(JSON.stringify({ prismaSentinel: true, login: true, javascript: true, publicSvg: true, protectedHandshake: true }));
  })().catch(() => { console.error('LINUX_HTTP_PROBE_FAILED'); process.exitCode = 1; });
`;
try {
  const dockerOS = await command('docker', ['info', '--format', '{{.OSType}}'], { capture: true });
  if (dockerOS !== 'linux') throw new Error('LINUX_DOCKER_REQUIRED');
  console.log('[linux-standalone] Criando imagem Node22/Debian com OpenSSL, sem fontes ou segredos.');
  const context = await mkdtemp(path.join(os.tmpdir(), 'logic-audit-server-')); directories.push(context);
  await writeFile(path.join(context, 'Dockerfile'), 'FROM node:22.15.0-bookworm-slim\nRUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*\n');
  phase = 'linux-image';
  await command('docker', ['build', '--label', `logic-audit.run-id=${pg.runId}`, '--tag', image, context], { capture: true });
  imageCreated = true;
  const source = await copyIsolatedProject({ linkDependencies: false }); directories.push(source);
  const sourceSHA256 = await fingerprint(source);
  // Only these explicit disposable values cross into Docker; never process.env.
  const internalURL = new URL(pg.env.TEST_DATABASE_URL); internalURL.port = '5432';
  const env = { DATABASE_URL: internalURL.toString(), DIRECT_URL: internalURL.toString(),
    TEST_DATABASE_URL: internalURL.toString(), TEST_RUN_ID: pg.runId,
    TEST_HTTP_TOKEN: pg.env.TEST_HTTP_TOKEN, FREIGHT_QUOTE_SECRET: pg.env.FREIGHT_QUOTE_SECRET,
    SESSION_SECRET: randomBytes(32).toString('hex'), CRON_SECRET: pg.env.CRON_SECRET,
    ASAAS_API_KEY: '', ASAAS_WEBHOOK_TOKEN: '', RESEND_API_KEY: '', NODE_PATH: '',
    NEXT_TELEMETRY_DISABLED: '1', PAYMENT_REMOTE_ENABLED: 'false',
    PAYMENT_WORKER_ENABLED: 'false', PAYMENT_EXPIRATION_ENABLED: 'false', NODE_ENV: 'production' };
  async function create(name, workdir, port, entry) {
    await command('docker', ['create', '--name', name, '--label', `logic-audit.run-id=${pg.runId}`,
      '--network', `container:${pg.name}`, '--workdir', workdir,
      ...Object.entries({ ...env, PORT: String(port), HOSTNAME: '127.0.0.1' }).flatMap(([key, value]) => ['--env', `${key}=${value}`]),
      image, ...entry], { capture: true });
    containers.push(name);
  }
  const builder = `logic-audit-builder-${pg.runId}`;
  await create(builder, '/build', 3000, ['node', '-e', 'setInterval(() => {}, 1000)']);
  await command('docker', ['start', builder], { capture: true });
  await command('docker', ['cp', source + path.sep + '.', `${builder}:/build`], { capture: true });
  const exec = args => command('docker', ['exec', builder, ...args], { capture: true });
  console.log('[linux-standalone] npm ci e geração Prisma exclusivamente no container descartável.');
  phase = 'fresh-install';
  await exec(['npm', 'ci', '--include=dev', '--no-audit', '--no-fund']);
  await exec(['node', 'node_modules/prisma/build/index.js', 'generate']);
  phase = 'migrations';
  await exec(['node', 'node_modules/prisma/build/index.js', 'migrate', 'deploy']);
  await pg.mark();
  await pg.sql(`INSERT INTO "Loja" (id, name, slug, description, "coverImageUrl", "updatedAt")
    VALUES ('${pg.runId}', 'Fixture Linux', 'linux-${pg.runId}', '', '', now());`);
  console.log('[linux-standalone] Compilando standalone em Linux; banco/sentinela próprios.');
  phase = 'linux-build';
  await exec(['node', 'node_modules/next/dist/bin/next', 'build', '--webpack']);
  const versions = JSON.parse(await exec(['node', '-e', "console.log(JSON.stringify({node:process.version,next:require('next/package.json').version,prisma:require('@prisma/client/package.json').version,platform:process.platform,architecture:process.arch}))"]));
  const staging = await mkdtemp(path.join(os.tmpdir(), 'logic-audit-server-')); directories.push(staging);
  // Linux-side staging uses the same audited inspector as the host runner.
  for (const file of ['isolated-project.mjs', 'standalone-package.mjs']) {
    await command('docker', ['cp', path.resolve('scripts/lib', file), `${builder}:/build/${file}`], { capture: true });
  }
  const packaged = JSON.parse(await exec(['node', '--input-type=module', '-e',
    "import { stageStandalonePackage } from './standalone-package.mjs'; console.log(JSON.stringify(await stageStandalonePackage('/build')));" ]));
  if (!/^\/tmp\/logic-audit-server-[a-zA-Z0-9_-]+$/.test(packaged.directory)) throw new Error('LINUX_STAGE_PATH_INVALID');
  await command('docker', ['cp', `${builder}:${packaged.directory}/.`, staging], { capture: true });
  const manifest = await inspectStandalonePackage(staging);
  if (manifest.sha256 !== packaged.manifest.sha256) throw new Error('LINUX_PACKAGE_TRANSFER_MISMATCH');
  const runtimeNames = [];
  for (let index = 0; index < 2; index++) {
    const name = `logic-audit-runtime-${index}-${pg.runId}`;
    await create(name, '/runtime', 3000 + index, ['node', 'server.js']);
    await command('docker', ['cp', staging + path.sep + '.', `${name}:/runtime`], { capture: true });
    runtimeNames.push(name);
  }
  // Both source trees and npm-installed builder dependencies are gone first.
  await removeContainer(builder);
  await discardIsolatedProject(source); directories.splice(directories.indexOf(source), 1);
  console.log('[linux-standalone] Fontes/builder removidos; iniciando duas cópias do pacote.');
  phase = 'linux-runtime';
  for (const name of runtimeNames) {
    await command('docker', ['start', name], { capture: true });
    let ready = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        await command('docker', ['exec', name, 'node', '-e', httpProbe], { capture: true });
        ready = true; break;
      } catch { await pause(500); }
    }
    if (!ready) throw new Error('LINUX_RUNTIME_PROBE_FAILED');
  }
  await command('docker', ['restart', '--time', '5', runtimeNames[1]], { capture: true });
  let restarted = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try { await command('docker', ['exec', runtimeNames[1], 'node', '-e', httpProbe], { capture: true }); restarted = true; break; }
    catch { await pause(500); }
  }
  if (!restarted) throw new Error('LINUX_RESTART_PROBE_FAILED');
  console.log('[linux-standalone] Evidência ' + JSON.stringify({ startedAt, finishedAt: new Date().toISOString(),
    runId: pg.runId, ...versions, sourceSHA256, packageManifest: manifest, instances: 2, postgres: 16,
    baseImage: 'node:22.15.0-bookworm-slim', freshInstall: true, sourcesRemovedBeforeRuntime: true,
    prismaSentinel: true, login: true, compiledJavaScript: true, publicSvg: true, restart: true,
    fullRegression: false, externalProviders: false, productionReady: false }));
} catch {
  // Subprocess logs can contain disposable connection credentials; do not echo them.
  console.error(`[linux-standalone] Falha na fase ${phase}; nenhuma aprovação de runtime ou produção.`);
  process.exitCode = 1;
} finally {
  for (const name of [...containers].reverse()) await removeContainer(name);
  await pg.dispose();
  if (imageCreated) {
    const identity = await command('docker', ['image', 'inspect', '--format', '{{index .Config.Labels "logic-audit.run-id"}}', image], { capture: true });
    if (identity !== pg.runId) throw new Error('LINUX_IMAGE_OWNERSHIP_MISMATCH');
    await command('docker', ['image', 'rm', image], { capture: true });
  }
  for (const directory of directories) await discardIsolatedProject(directory);
}
