import { beforeEach, describe, expect, it, vi } from 'vitest'
import prisma from '@/lib/prisma'
import { GET as liveness } from '@/app/api/health/live/route'
import { GET as readiness } from '@/app/api/health/ready/route'
import { GET as metricsEndpoint } from '@/app/api/internal/metrics/route'
import {
  incrementMetric,
  resetMetricsForTests,
} from '@/lib/observability/metrics'

vi.mock('@/lib/prisma', () => ({
  default: {
    $queryRaw: vi.fn(),
    paymentReconciliation: {
      groupBy: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    refundIntent: {
      groupBy: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}))

describe('health checks e métricas operacionais (OBS-009/OBS-011)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMetricsForTests()
    process.env.OBSERVABILITY_TOKEN = 'observability-token-test-123'
  })

  it('liveness não depende do banco e não é cacheável', async () => {
    const response = await liveness()
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(await response.json()).toEqual({ status: 'UP' })
    expect(prisma.$queryRaw).not.toHaveBeenCalled()
  })

  it('readiness prova acesso ao banco e não vaza a falha', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ ready: 1 }])
    expect((await readiness()).status).toBe(200)

    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(
      new Error('postgres://usuario:fixture-not-a-secret@host-interno/base')
    )
    const response = await readiness()
    expect(response.status).toBe(503)
    expect(JSON.stringify(await response.json())).not.toContain('senha')
  })

  it('expõe somente métricas protegidas e rejeita label de alta cardinalidade', async () => {
    incrementMetric('checkout_requests_total', { result: 'success' })
    expect(() => incrementMetric('checkout_requests_total', {
      orderId: 'order-high-cardinality',
    } as any)).toThrow('METRIC_LABEL_NOT_ALLOWED')

    const unauthorized = await metricsEndpoint(new Request('http://localhost/api/internal/metrics'))
    expect(unauthorized.status).toBe(401)

    const response = await metricsEndpoint(new Request('http://localhost/api/internal/metrics', {
      headers: { Authorization: 'Bearer observability-token-test-123' },
    }))
    expect(response.status).toBe(200)
    const body = await response.text()
    expect(body).toContain('checkout_requests_total{result="success"} 1')
    expect(body).toContain('refund_reconciliation_over_sla 0')
    expect(body).toContain('refund_confirmed_effects_pending 0')
    expect(body).not.toContain('order-high-cardinality')
  })
})
