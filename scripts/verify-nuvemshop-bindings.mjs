import { command, provisionPostgres } from './lib/disposable-postgres.mjs';

// No Next server or .env loader. Synthetic fixtures only, PostgreSQL 18 in Docker.
let fixture;
try {
  fixture = await provisionPostgres({ majorVersion: 18 });
  console.log('[nuvemshop-binding] PostgreSQL 18 descartavel provisionado; nenhuma conexao externa.');
  await command(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env: fixture.env, capture: true });
  await fixture.mark();
  await command(process.execPath, ['node_modules/vitest/vitest.mjs', 'run',
    'tests/integration/nuvemshop-binding.test.ts',
    'tests/unit/nuvemshop-variant-mapping.test.ts',
    'tests/unit/nuvemshop-catalog-reader.test.ts'], { env: { ...fixture.env, NODE_ENV: 'test' } });
} catch {
  console.error('[nuvemshop-binding] Validacao isolada falhou. Nenhum banco remoto foi utilizado.');
  process.exitCode = 1;
} finally { await fixture?.dispose(); }
