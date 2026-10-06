import { PrismaClient } from '@prisma/client'
import { AsyncLocalStorage } from 'node:async_hooks'
import { assertTestDatabaseIdentity, testDatabaseConfig, type TestDatabaseIdentity } from './testing/database-policy'

const isTestRun = process.env.NODE_ENV === 'test' || Boolean(process.env.TEST_RUN_ID)
const testConfig = isTestRun ? testDatabaseConfig() : undefined
const verificationContext = new AsyncLocalStorage<boolean>()

/**
 * Singleton do Prisma Client para reuso de conexões (Finding SCL-002).
 * Previne connection exhaustion em ambientes Serverless/Node.js e
 * suporta connection pooling nativo (Neon Serverless Connection Pooler).
 */
const prismaClientSingleton = () => {
  const client = new PrismaClient({
    ...(testConfig && { datasources: { db: { url: testConfig.url } } }),
    log:
      process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error'],
  })
  if (testConfig) {
    // The metadata query uses this very client. No fixture/model/raw write can
    // run before it succeeds, including services imported before setupTestDb.
    let verified: Promise<void> | undefined
    const verify = async () => {
      const rows = await verificationContext.run(true, async () => await client.$queryRaw<TestDatabaseIdentity[]>`
        SELECT current_database() AS database, current_user AS role,
          s.run_id AS "runId", r.rolsuper AS superuser, r.rolcreatedb AS "createDb"
        FROM public."_TestDatabaseSentinel" s
        JOIN pg_roles r ON r.rolname = current_user
        WHERE s.id = 1
      `)
      assertTestDatabaseIdentity(rows.length === 1 ? rows[0] : undefined)
    }
    client.$use(async (params, next) => {
      if (!verificationContext.getStore()) {
        verified ??= verify().catch(error => { verified = undefined; throw error })
        await verified
      }
      return next(params)
    })
  }
  return client
}

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: ReturnType<typeof prismaClientSingleton> | undefined
}

// Test runs never reuse a client created against a different datasource.
const prisma = (!isTestRun && globalThis.prismaGlobal) || prismaClientSingleton()

if (process.env.NODE_ENV !== 'production' && !isTestRun) {
  globalThis.prismaGlobal = prisma
}

// Hook de encerramento seguro de conexões em processos Node.js locais
if (typeof process !== 'undefined') {
  const cleanDisconnect = async () => {
    if (globalThis.prismaGlobal) {
      await globalThis.prismaGlobal.$disconnect().catch(() => {})
    }
  }
  process.once('beforeExit', cleanDisconnect)
}

export default prisma

export async function verifyTestDatabase() {
  testDatabaseConfig()
  const rows = await prisma.$queryRaw<TestDatabaseIdentity[]>`
    SELECT current_database() AS database, current_user AS role,
      s.run_id AS "runId", r.rolsuper AS superuser, r.rolcreatedb AS "createDb"
    FROM public."_TestDatabaseSentinel" s JOIN pg_roles r ON r.rolname = current_user
    WHERE s.id = 1
  `
  return assertTestDatabaseIdentity(rows.length === 1 ? rows[0] : undefined)
}
