import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { command, provisionPostgres } from './lib/disposable-postgres.mjs';
import { copyIsolatedProject, discardIsolatedProject } from './lib/isolated-project.mjs';

const args = process.argv.slice(2);
if (args.some(arg => arg.startsWith('--'))) throw new Error('Passe somente paths de testes; configuração livre não é aceita.');
const files = args.length ? args : ['tests/integration'];
if (files.some(file => !/^tests\/(integration|load)\/[a-zA-Z0-9_./-]+$/.test(file)
  && !['tests/integration', 'tests/load'].includes(file)) || files.some(file => file.includes('..'))) {
  throw new Error('A suite deve estar dentro de tests/integration ou tests/load.');
}
const fixture = await provisionPostgres();
let server;
let serverProject;
try {
  console.log(`[isolated] PostgreSQL descartável ${fixture.database}; sem conexão com o banco da aplicação.`);
  await command(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env: fixture.env });
  await fixture.mark();
  const port = await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      probe.close(() => resolve(address.port));
    });
  });
  const env = { ...fixture.env, TEST_BASE_URL: `http://127.0.0.1:${port}`, NODE_ENV: 'development', PAYMENT_WORKER_ENABLED: 'true', PAYMENT_EXPIRATION_ENABLED: 'false' };
  // A running developer server must keep its .next lock, generated types and
  // next-env.d.ts. Copy source into a temporary project; never copy .env files.
  serverProject = await copyIsolatedProject();
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(port)], {
    env, cwd: serverProject, shell: false, windowsHide: true, detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  // Avoid dumping provider config or DB URLs from framework startup diagnostics.
  let serverFailure;
  server.on('error', error => { serverFailure = error; });
  server.on('exit', code => { serverFailure = new Error(`Servidor de teste encerrou (${code}).`); });
  server.stdout.resume();
  server.stderr.resume();
  let ready = false;
  for (let attempt = 0; attempt < 90; attempt++) {
    if (serverFailure) throw serverFailure;
    try {
      const response = await fetch(`${env.TEST_BASE_URL}/api/test-environment`, {
        headers: { 'x-test-environment-token': env.TEST_HTTP_TOKEN },
        signal: AbortSignal.timeout(5000), redirect: 'error',
      });
      if (response.ok) {
        const identity = await response.json();
        if (identity.runId !== fixture.runId || identity.database !== fixture.database) {
          throw new Error('Servidor iniciou com outro banco.');
        }
        ready = true;
        break;
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'Servidor iniciou com outro banco.') throw error;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error('Servidor descartável não confirmou identidade/sentinela.');
  console.log('[isolated] Servidor e fixtures confirmaram a mesma identidade.');
  await command(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', ...files], { env: { ...env, NODE_ENV: 'test' } });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (server && server.exitCode === null) {
    // taskkill targets only the PID we launched, including its Next child.
    if (process.platform === 'win32') {
      await command('taskkill', ['/PID', String(server.pid), '/T', '/F'], { capture: true }).catch(() => {});
    } else {
      try { process.kill(-server.pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
    }
  }
  await fixture.dispose();
  if (serverProject) await discardIsolatedProject(serverProject);
}
