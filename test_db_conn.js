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
  const directUrl = 'postgresql://postgres.hzewcqjjiglwpohdsjmq:AWDsxf%401423@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require';
  const poolerUrl = 'postgresql://postgres.hzewcqjjiglwpohdsjmq:AWDsxf%401423@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require';
  const d = await test(directUrl, 'DIRECT (port 5432)');
  const p = await test(poolerUrl, 'POOLER (port 6543)');
  console.log(`\n=== FINAL: Direct=${d ? 'OK' : 'FAIL'} | Pooler=${p ? 'OK' : 'FAIL'} ===`);
  process.exit(d || p ? 0 : 1);
}
main();
