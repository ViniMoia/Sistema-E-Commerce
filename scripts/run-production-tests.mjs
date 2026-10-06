import { spawn } from 'node:child_process';
import { cp, readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import path from 'node:path';
import { command, provisionPostgres } from './lib/disposable-postgres.mjs';
import { copyIsolatedProject, discardIsolatedProject } from './lib/isolated-project.mjs';
import { homologationSuites } from './lib/homologation-suites.mjs';
import { stageStandalonePackage } from './lib/standalone-package.mjs';

const args = process.argv.slice(2);
// One fixed, audited entrypoint option; never arbitrary commands/env/URLs.
const standalone = args[0] === '--standalone';
if (standalone) args.shift();
const capacity = args[0] === '--capacity';
if (capacity) {
  args.shift();
  if (standalone || args.length) throw new Error('O perfil de capacidade não aceita seleção, flags ou configuração livre.');
}
const files = capacity ? ['tests/load/storefront-capacity.test.ts', 'tests/production']
  : args.length ? args : [...homologationSuites, 'tests/production'];
if (files.some(file => !(capacity && file === 'tests/load/storefront-capacity.test.ts')
  && !/^tests\/(integration|production)(\/[a-zA-Z0-9_./-]+)?$/.test(file)
  || file.includes('..') || file.startsWith('--'))) throw new Error('Passe somente paths de integração/homologação; configuração livre não é aceita.');

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const listen = server => new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => resolve(server.address().port));
});
const freePort = async () => {
  const probe = createServer(); const port = await listen(probe);
  await new Promise(resolve => probe.close(resolve)); return port;
};
const pg = await provisionPostgres();
const startedAt = new Date().toISOString();
const projects = [];
const instances = [];
let packageManifest;
let control;
async function fingerprint(root) {
  const hash = createHash('sha256');
  async function visit(directory, prefix = '') {
    const entries = (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'));
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.isSymbolicLink()) continue;
      const label = prefix + entry.name;
      if (entry.isDirectory()) await visit(path.join(directory, entry.name), label + '/');
      else if (entry.isFile()) {
        const content = await readFile(path.join(directory, entry.name));
        hash.update(label + '\0' + content.length + '\0'); hash.update(content);
      }
    }
  }
  await visit(root); return hash.digest('hex');
}
async function stop(instance) {
  const child = instance?.child;
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === 'win32') {
    await command('taskkill', ['/PID', String(child.pid), '/T', '/F'], { capture: true });
  } else {
    try { process.kill(-child.pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
  }
  for (let i = 0; i < 50 && child.exitCode === null && child.signalCode === null; i++) await pause(100);
  if (child.exitCode === null && child.signalCode === null) {
    if (process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL');
    else throw new Error('Servidor isolado não encerrou; descarte bloqueado.');
  }
}
async function start(instance) {
  instance.failure = undefined;
  const entrypoint = standalone ? ['server.js'] : ['node_modules/next/dist/bin/next', 'start',
    '--hostname', '127.0.0.1', '--port', String(instance.port)];
  const child = instance.child = spawn(process.execPath, entrypoint, {
    cwd: instance.project, env: { ...pg.env, TEST_BASE_URL: instance.origin, NODE_ENV: 'production',
      PORT: String(instance.port), HOSTNAME: '127.0.0.1', NODE_PATH: '',
      PAYMENT_WORKER_ENABLED: 'true', PAYMENT_EXPIRATION_ENABLED: 'false' },
    shell: false, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.on('error', () => { instance.failure = new Error('Falha ao iniciar servidor isolado.'); });
  child.on('exit', code => { instance.failure = new Error(`Servidor isolado encerrou (${code}).`); });
  child.stdout.resume(); child.stderr.resume();
  for (let i = 0; i < 90; i++) {
    if (instance.failure) throw instance.failure;
    try {
      const response = await fetch(instance.origin + '/api/test-environment', {
        headers: { 'x-test-environment-token': pg.env.TEST_HTTP_TOKEN },
        redirect: 'error', signal: AbortSignal.timeout(3000), cache: 'no-store',
      });
      if (response.ok) {
        const identity = await response.json();
        if (identity.runId !== pg.runId || identity.database !== pg.database) throw new Error('PRODUCTION_TEST_IDENTITY_MISMATCH');
        return;
      }
    } catch (error) { if (error.message === 'PRODUCTION_TEST_IDENTITY_MISMATCH') throw error; }
    await pause(500);
  }
  throw new Error('Servidor production não confirmou a sentinela.');
}
try {
  await command(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env: pg.env, capture: true });
  await pg.mark();
  console.log(standalone ? '[production-test] Materializando dependências para um pacote sem junctions do workspace.' : '[production-test] Preparando fontes isolados.');
  projects.push(await copyIsolatedProject({ copyDependencies: standalone }));
  const sourceSHA256 = await fingerprint(projects[0]);
  const testsSHA256 = await fingerprint(path.resolve('tests'));
  const scriptsSHA256 = await fingerprint(path.resolve('scripts'));
  console.log('[production-test] Build em cópia sem .env; PostgreSQL e integrações exclusivamente descartáveis.');
  await new Promise((resolve, reject) => {
    const build = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'build', '--webpack'], {
      cwd: projects[0], env: { ...pg.env, NODE_ENV: 'production' }, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    for (const stream of [build.stdout, build.stderr]) stream.on('data', data => {
      process.stdout.write(data.toString().replaceAll(pg.env.DATABASE_URL, '[isolated-database]'));
    });
    build.on('error', reject);
    build.on('close', code => code === 0 ? resolve() : reject(new Error(`Build isolado terminou (${code}).`)));
  });
  let runtimeProjects;
  if (standalone) {
    const first = await stageStandalonePackage(projects[0]); projects.push(first.directory);
    const second = await stageStandalonePackage(projects[0]); projects.push(second.directory);
    if (first.manifest.sha256 !== second.manifest.sha256) throw new Error('Pacotes standalone divergentes.');
    packageManifest = first.manifest;
    runtimeProjects = [first.directory, second.directory];
    // Make the build source/dependency tree unavailable before starting either
    // relocated package. Node cannot fall back to a build-time workspace link.
    await discardIsolatedProject(projects[0]); projects.shift();
  } else {
    projects.push(await copyIsolatedProject());
    // Separate filesystems/caches, identical compiled artifact and Server Action key.
    const compiled = path.join(projects[0], '.next');
    // next start consumes the full build, separately from the minimal package.
    await cp(compiled, path.join(projects[1], '.next'), { recursive: true,
      filter: source => !['standalone', 'cache'].includes(path.relative(compiled, source).split(path.sep)[0]),
    });
    runtimeProjects = projects;
  }
  const buildIDs = await Promise.all(runtimeProjects.map(project => readFile(path.join(project, '.next/BUILD_ID'), 'utf8')));
  if (!buildIDs[0].trim() || buildIDs[0] !== buildIDs[1]) throw new Error('Builds das instâncias divergentes.');
  for (const project of runtimeProjects) {
    const port = await freePort();
    const instance = { project, port, origin: `http://127.0.0.1:${port}` };
    instances.push(instance); await start(instance);
  }
  // Fixture controller lives in this harness, never in the application/build.
  let restarting = false;
  control = createServer(async (request, response) => {
    if (request.method !== 'POST' || request.url !== '/restart-secondary'
      || request.headers['x-test-environment-token'] !== pg.env.TEST_HTTP_TOKEN) { response.writeHead(404); response.end(); return; }
    if (restarting) { response.writeHead(409); response.end(); return; }
    restarting = true;
    try {
      await stop(instances[1]); await start(instances[1]);
      response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify({ runId: pg.runId, database: pg.database }));
    } catch { response.writeHead(503); response.end(); }
    finally { restarting = false; }
  });
  const controlPort = await listen(control);
  console.log(`[production-test] Duas instâncias ${standalone ? 'standalone/server.js' : 'next start'}, mesmo build/banco/sentinela; caches separados.`);
  // Vitest auto-selects the agent reporter, which hides passing console output.
  // The capacity profile needs its diagnostic measurements even when tests pass.
  await command(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', ...files,
    ...(capacity ? ['--reporter=default'] : [])], { env: {
    ...pg.env, NODE_ENV: 'test', TEST_BASE_URL: instances[0].origin, TEST_SECONDARY_BASE_URL: instances[1].origin,
    TEST_PROCESS_CONTROL_URL: `http://127.0.0.1:${controlPort}`, TEST_APP_RUNTIME: 'production',
    PAYMENT_WORKER_ENABLED: 'true', PAYMENT_EXPIRATION_ENABLED: 'false',
    TEST_CAPACITY_RUN: capacity ? 'true' : '',
  } });
  if (testsSHA256 !== await fingerprint(path.resolve('tests'))
    || scriptsSHA256 !== await fingerprint(path.resolve('scripts'))) {
    throw new Error('Inputs de testes/scripts mudaram durante o ensaio; gerar nova evidência.');
  }
  console.log('[production-test] Evidência ' + JSON.stringify({ startedAt, finishedAt: new Date().toISOString(),
    runId: pg.runId, database: pg.database, node: process.version, sourceSHA256, testsSHA256, scriptsSHA256,
    buildId: buildIDs[0].trim(), runtime: standalone ? 'standalone/server.js' : 'next start', packageManifest,
    platform: process.platform, architecture: process.arch, instances: 2, postgres: 16, files,
    capacity, externalProviders: false, productionReady: false }));
} catch (error) {
  console.error(error.message.replaceAll(pg.env.DATABASE_URL, '[redacted]'));
  process.exitCode = 1;
} finally {
  if (control) { control.closeAllConnections(); await new Promise(resolve => control.close(resolve)); }
  // Never tear down PostgreSQL/files while a launched application still runs.
  for (const instance of instances) await stop(instance);
  await pg.dispose();
  for (const project of projects) await discardIsolatedProject(project);
}
