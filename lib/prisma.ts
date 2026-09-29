import { logger } from '@/lib/logger'
import { Prisma, PrismaClient } from '@prisma/client'

type QueryObserver = (event: Prisma.QueryEvent) => void

const queryProfilingEnabled =
  process.env.NODE_ENV === 'test' || process.env.PRISMA_QUERY_PROFILING === 'true'

function prismaLogConfiguration(): Prisma.LogDefinition[] {
  const logs: Prisma.LogDefinition[] = [{ emit: 'event', level: 'error' }]
  if (process.env.NODE_ENV === 'development') {
    logs.unshift({ emit: 'stdout', level: 'warn' })
  }
  if (queryProfilingEnabled) {
    logs.unshift({ emit: 'event', level: 'query' })
  }
  return logs
}

/**
 * Singleton do Prisma Client para reuso de conexões (Finding SCL-002).
 * Previne connection exhaustion em ambientes Serverless/Node.js e
 * suporta connection pooling nativo (Neon Serverless Connection Pooler).
 */
const prismaClientSingleton = () => {
  const client = new PrismaClient({ log: prismaLogConfiguration() })
  // Prisma's error message can contain the SQL invocation and raw row values.
  // The request boundary records a sanitized error; this event records no payload.
  ;(client as unknown as { $on(event: 'error', callback: () => void): void }).$on('error', () => {
    logger.error('Database operation failed', undefined, { action: 'PRISMA_ERROR' })
  })
  return client
}

declare global {
  var prismaGlobal: ReturnType<typeof prismaClientSingleton> | undefined
  var prismaQueryObservers: Set<QueryObserver> | undefined
  var prismaQueryListenerAttached: boolean | undefined
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma
}

const queryObservers = globalThis.prismaQueryObservers ?? new Set<QueryObserver>()
globalThis.prismaQueryObservers = queryObservers

if (queryProfilingEnabled && !globalThis.prismaQueryListenerAttached) {
  const eventClient = prisma as unknown as {
    $on(event: 'query', callback: QueryObserver): void
  }
  eventClient.$on('query', event => {
    for (const observer of queryObservers) observer(event)
  })
  globalThis.prismaQueryListenerAttached = true
}

export function subscribeToPrismaQueries(observer: QueryObserver): () => void {
  if (!queryProfilingEnabled) {
    throw new Error(
      'Query profiling requer NODE_ENV=test ou PRISMA_QUERY_PROFILING=true antes de carregar o Prisma.'
    )
  }
  queryObservers.add(observer)
  return () => queryObservers.delete(observer)
}

// Hook de encerramento seguro de conexões em processos Node.js locais
if (typeof process !== 'undefined') {
  const cleanDisconnect = async () => {
    await prisma.$disconnect().catch(() => {})
  }
  process.once('beforeExit', cleanDisconnect)
}

export default prisma
