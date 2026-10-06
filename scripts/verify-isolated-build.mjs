import { command, provisionPostgres } from './lib/disposable-postgres.mjs';
import { copyIsolatedProject, discardIsolatedProject } from './lib/isolated-project.mjs';
import { spawn } from 'node:child_process';

const pg = await provisionPostgres({ majorVersion: 18 });
let project;
try {
  await command(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env: pg.env, capture: true });
  await pg.mark();
  project = await copyIsolatedProject();
  console.log('[build] Next production em cópia temporária sem .env, banco descartável e integrações sem credenciais.');
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'build', '--webpack'], {
      cwd: project, env: { ...pg.env, NODE_ENV: 'production' }, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    for (const stream of [child.stdout, child.stderr]) stream.on('data', data => {
      // Only disposable credentials can appear; scrub even those from diagnostics.
      process.stdout.write(data.toString().replaceAll(pg.env.DATABASE_URL, '[isolated-database]'));
    });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`Build terminou com código ${code}.`)));
  });
  console.log('[build] Build de produção aprovado; next-env.d.ts e .next do workspace preservados.');
} catch (error) {
  console.error(error.message.replaceAll(pg.env.DATABASE_URL, '[redacted]'));
  process.exitCode = 1;
} finally {
  await pg.dispose();
  if (project) await discardIsolatedProject(project);
}
