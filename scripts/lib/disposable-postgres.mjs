import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';

export async function command(file, args, { env = process.env, input, capture = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { env, shell: false, windowsHide: true,
      stdio: ['pipe', capture ? 'pipe' : 'inherit', capture ? 'pipe' : 'inherit'] });
    let output = '';
    if (capture) {
      child.stdout.on('data', data => { output += data.toString(); });
      child.stderr.on('data', data => { output += data.toString(); });
    }
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve(output.trim())
      : reject(new Error(`${file} terminou com código ${code}${capture ? `: ${output.trim()}` : ''}`)));
    child.stdin.end(input);
  });
}

export async function provisionPostgres({ majorVersion = 16 } = {}) {
  if (![16, 18].includes(majorVersion)) throw new Error('Versão PostgreSQL descartável não suportada.');
  const runId = randomBytes(16).toString('hex');
  const name = `logic-audit-pg-${runId}`;
  const database = `ecommerce_test_${runId}`;
  const password = randomBytes(24).toString('hex');
  const bootstrapPassword = randomBytes(24).toString('hex');
  const base = ['exec', '-i', name, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres'];
  let created = false;
  const dispose = async () => {
    if (!created) return;
    const label = await command('docker', ['inspect', '--format', '{{index .Config.Labels "logic-audit.run-id"}}', name], { capture: true });
    if (label !== runId) throw new Error('Container divergente: descarte bloqueado.');
    await command('docker', ['stop', '--time', '5', name], { capture: true });
    created = false;
  };
  try {
    await command('docker', ['run', '--detach', '--rm', '--name', name,
      '--label', `logic-audit.run-id=${runId}`, '--publish', '127.0.0.1::5432',
      '--tmpfs', '/var/lib/postgresql/audit-data', '--env', 'PGDATA=/var/lib/postgresql/audit-data',
      '--env', `POSTGRES_PASSWORD=${bootstrapPassword}`,
      `postgres:${majorVersion}-alpine`], { capture: true });
    created = true;
    for (let attempt = 0; ; attempt++) {
      try {
        // The Docker entrypoint first starts a temporary socket-only server.
        // Wait for TCP so CREATE ROLE cannot race with its shutdown/restart.
        await command('docker', ['exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'], { capture: true });
        break;
      } catch {
        if (attempt >= 30) throw new Error('PostgreSQL descartável não iniciou.');
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    await command('docker', base, { input: `
      CREATE ROLE ecommerce_test LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE;
      CREATE DATABASE "${database}";
      REVOKE ALL ON DATABASE "${database}" FROM PUBLIC;
      GRANT CONNECT ON DATABASE "${database}" TO ecommerce_test;
      REVOKE CONNECT ON DATABASE postgres FROM PUBLIC;
      REVOKE CONNECT ON DATABASE template1 FROM PUBLIC;
    `, capture: true });
    const port = (await command('docker', ['port', name, '5432/tcp'], { capture: true })).split(':').at(-1);
    if (!/^\d+$/.test(port)) throw new Error('Porta descartável inválida.');
    const url = `postgresql://ecommerce_test:${password}@127.0.0.1:${port}/${database}?schema=public`;
    // Values are in memory only. No production .env is passed to a test client.
    const env = { ...process.env, TEST_RUN_ID: runId, TEST_DATABASE_URL: url,
      DATABASE_URL: url, DIRECT_URL: url, TEST_HTTP_TOKEN: randomBytes(32).toString('hex'),
      FREIGHT_QUOTE_SECRET: randomBytes(32).toString('hex'),
      ASAAS_API_KEY: '', ASAAS_WEBHOOK_TOKEN: randomBytes(32).toString('hex'), CRON_SECRET: randomBytes(32).toString('hex'),
      RESEND_API_KEY: '', NUVEMSHOP_ACCESS_TOKEN: '', NUVEMSHOP_STORE_ID: '',
      JTEXPRESS_API_KEY: '', CORREIOS_PASSWORD: '' };
    const sql = input => command('docker', [...base, '-d', database], { input, capture: true });
    await sql('GRANT USAGE, CREATE ON SCHEMA public TO ecommerce_test;');
    const mark = () => sql(`
      CREATE TABLE public."_TestDatabaseSentinel" (id integer PRIMARY KEY CHECK (id = 1), run_id text NOT NULL);
      INSERT INTO public."_TestDatabaseSentinel" VALUES (1, '${runId}');
      REVOKE ALL ON public."_TestDatabaseSentinel" FROM PUBLIC;
      GRANT SELECT ON public."_TestDatabaseSentinel" TO ecommerce_test;
    `);
    return { runId, name, database, env, sql, mark, dispose };
  } catch (error) {
    await dispose();
    // Never propagate output that might echo bootstrap/app credentials.
    throw new Error('Provisionamento do PostgreSQL descartável falhou.', { cause: error instanceof Error ? new Error(error.message.replaceAll(password, '[redacted]').replaceAll(bootstrapPassword, '[redacted]')) : undefined });
  }
}
