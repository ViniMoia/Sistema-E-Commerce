import { command, provisionPostgres } from './lib/disposable-postgres.mjs';

for (const mode of ['missing', 'mismatched']) {
  const pg = await provisionPostgres();
  try {
    await command(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env: pg.env, capture: true });
    if (mode === 'mismatched') {
      await pg.mark();
      await pg.sql(`UPDATE public."_TestDatabaseSentinel" SET run_id = 'another-run';`);
    }
    console.log(`[isolation] Validando sentinela ${mode}; nenhuma fixture pode ser escrita.`);
    await command(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'tests/integration/database-guard-negative.test.ts'], {
      env: { ...pg.env, NODE_ENV: 'test', TEST_INVALID_SENTINEL: mode },
    });
    // Privileged observer is the provisioner, not the guarded app client.
    const state = await pg.sql('SELECT count(*) AS must_be_zero FROM "Loja";');
    if (!/must_be_zero\s*-+\s*0\s*\(1 row\)/.test(state)) {
      throw new Error('Uma escrita proibida chegou ao banco descartável.');
    }
    console.log(`[isolation] ${mode}: zero lojas; seed/cleanup/create bloqueados.`);
  } finally { await pg.dispose(); }
}
