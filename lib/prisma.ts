import { PrismaClient } from '@prisma/client'

/**
 * Singleton do Prisma Client para reuso de conexões (Finding SCL-002).
 * Previne connection exhaustion em ambientes Serverless/Node.js e
 * suporta connection pooling do Supabase/PgBouncer.
 */
const prismaClientSingleton = () => {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error'],
  })
}

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: ReturnType<typeof prismaClientSingleton> | undefined
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') {
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
