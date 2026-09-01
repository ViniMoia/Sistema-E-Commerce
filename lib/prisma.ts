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

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton> | undefined
} & typeof global

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma
}
