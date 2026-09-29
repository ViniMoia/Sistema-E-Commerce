import { describe, expect, it } from 'vitest'
import prisma from '@/lib/prisma'
import { startQueryProfiler } from '@/tests/helpers/query-profiler'

describe('PERF-010: query profiler', () => {
  it('observa queries reais do Prisma e encerra a assinatura', async () => {
    const firstProfiler = startQueryProfiler()
    await prisma.loja.count()
    const firstReport = firstProfiler.stop()

    expect(firstReport.queryCount).toBeGreaterThanOrEqual(1)
    expect(firstReport.queries.some(query => query.query.includes('Loja'))).toBe(true)

    const secondProfiler = startQueryProfiler()
    await prisma.loja.count()
    const secondReport = secondProfiler.stop()

    expect(secondReport.queryCount).toBeGreaterThanOrEqual(1)
    expect(firstReport.queryCount).toBe(1)
  })
})
