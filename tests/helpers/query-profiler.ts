import { Prisma } from '@prisma/client'
import { subscribeToPrismaQueries } from '@/lib/prisma'

export interface QueryReport {
  queryCount: number
  totalDuration: number
  queries: Array<{ query: string; duration: number }>
}

export function startQueryProfiler(): { stop(): QueryReport } {
  const queries: Array<{ query: string; duration: number }> = []

  const queryHandler = (event: Prisma.QueryEvent) => {
    queries.push({
      query: event.query,
      duration: event.duration
    })
  }

  const unsubscribe = subscribeToPrismaQueries(queryHandler)

  return {
    stop(): QueryReport {
      unsubscribe()

      const totalDuration = queries.reduce((sum, q) => sum + q.duration, 0)

      return {
        queryCount: queries.length,
        totalDuration,
        queries
      }
    }
  }
}
