import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { command, provisionPostgres } from './lib/disposable-postgres.mjs';
import { copyIsolatedProject, discardIsolatedProject } from './lib/isolated-project.mjs';
import { selectIsolatedSuites } from './lib/homologation-suites.mjs';

const files = selectIsolatedSuites(process.argv.slice(2));
const fixture = await provisionPostgres();
let server;
let serverClosed;
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
  serverClosed = new Promise(resolve => server.once('close', resolve));
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
  await command(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', ...files, '--reporter=default'], { env: { ...env, NODE_ENV: 'test' } });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  let stopped = !server;
  try {
    if (server?.pid && server.exitCode === null && server.signalCode === null) {
      // taskkill targets only the PID we launched, including its Next child.
      if (process.platform === 'win32') {
        await command('taskkill', ['/PID', String(server.pid), '/T', '/F'], { capture: true }).catch(() => {});
      } else {
        try { process.kill(-server.pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
      }
    }
    // SIGTERM is asynchronous: Next may still be flushing its development cache.
    // Wait for the child and its stdio to close before removing the owned project.
    if (serverClosed) {
      let timer;
      try {
        await Promise.race([
          serverClosed,
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('ISOLATED_SERVER_STOP_TIMEOUT: temporary project preserved')), 15000); }),
        ]);
        stopped = true;
      } finally { clearTimeout(timer); }
    }
  } finally {
    try { await fixture.dispose(); }
    finally { if (stopped && serverProject) await discardIsolatedProject(serverProject); }
  }
}
