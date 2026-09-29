import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { incrementMetric } from '@/lib/observability/metrics'

export const dynamic = 'force-dynamic'

function readinessTimeoutMs(): number {
  const configured = Number(process.env.READINESS_TIMEOUT_MS || 2000)
  if (!Number.isFinite(configured)) return 2000
  return Math.min(10000, Math.max(100, Math.trunc(configured)))
}

export async function GET() {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1 AS ready`,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error('READINESS_TIMEOUT')), readinessTimeoutMs())
        timeout.unref?.()
      }),
    ])
    incrementMetric('readiness_checks_total', { result: 'success' })
    return Response.json(
      { status: 'READY' },
      { headers: { 'cache-control': 'no-store' } }
    )
  } catch (error) {
    incrementMetric('readiness_checks_total', { result: 'failure' })
    logger.error('Readiness check falhou', error, { action: 'READINESS_CHECK_FAILED' })
    return Response.json(
      { status: 'NOT_READY' },
      { status: 503, headers: { 'cache-control': 'no-store' } }
    )
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}
