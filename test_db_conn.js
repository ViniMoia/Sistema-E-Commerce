const { PrismaClient } = require('@prisma/client');

async function test(url, label) {
  console.log(`\n=== Testing ${label} ===`);
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const start = Date.now();
  try {
    const r = await prisma.$queryRawUnsafe('SELECT 1 as connected');
    console.log(`SUCCESS (${Date.now() - start}ms):`, JSON.stringify(r));
    await prisma.$disconnect();
    return true;
  } catch (e) {
    console.log(`FAILED (${Date.now() - start}ms):`, e.message);
    await prisma.$disconnect();
    return false;
  }
}

async function main() {
  const directUrl = process.env.DIRECT_URL;
  const poolerUrl = process.env.DATABASE_URL;

  if (!directUrl && !poolerUrl) {
    console.error('ERRO: Nenhuma variável de conexão configurada (DIRECT_URL ou DATABASE_URL).');
    console.error('Configure as variáveis de ambiente antes de executar este teste.');
    process.exit(1);
  }

  let d = false;
  let p = false;

  if (directUrl) {
    d = await test(directUrl, 'DIRECT (DIRECT_URL)');
  } else {
    console.log('\n=== DIRECT (DIRECT_URL) não configurada, pulando ===');
  }

  if (poolerUrl) {
    p = await test(poolerUrl, 'POOLER (DATABASE_URL)');
  } else {
    console.log('\n=== POOLER (DATABASE_URL) não configurada, pulando ===');
  }

  console.log(`\n=== FINAL: Direct=${d ? 'OK' : (directUrl ? 'FAIL' : 'N/A')} | Pooler=${p ? 'OK' : (poolerUrl ? 'FAIL' : 'N/A')} ===`);
  process.exit(d || p ? 0 : 1);
}
main();

