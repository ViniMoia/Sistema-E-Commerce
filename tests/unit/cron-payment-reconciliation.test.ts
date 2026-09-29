import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GET, POST } from '@/app/api/cron/payment-reconciliation/v1/route'
import { runPaymentReconciliation } from '@/services/payment-reconciliation.service'
import { runRefundReconciliation } from '@/services/refund.service'

vi.mock('@/services/payment-reconciliation.service', () => ({
  runPaymentReconciliation: vi.fn(),
}))
vi.mock('@/services/refund.service', () => ({
  runRefundReconciliation: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

describe('versioned payment reconciliation trigger', () => {
  const originalEnv = process.env
  const secret = 'payment-reconciliation-cron-secret'

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv, CRON_SECRET: secret }
    vi.mocked(runRefundReconciliation).mockResolvedValue({
      workerId: 'refund-worker-private', claimed: 0, confirmed: 0, processing: 0,
      failed: 0, reconciliationRequired: 0, errors: 0, executionTimeMs: 1,
    })
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('fails closed before invoking the worker', async () => {
    delete process.env.CRON_SECRET
    const response = await GET(new Request('http://localhost/api/cron/payment-reconciliation/v1'))
    expect(response.status).toBe(500)
    expect(runPaymentReconciliation).not.toHaveBeenCalled()
    expect(runRefundReconciliation).not.toHaveBeenCalled()
  })

  it('rejects invalid credentials', async () => {
    const response = await POST(new Request(
      'http://localhost/api/cron/payment-reconciliation/v1',
      { method: 'POST', headers: { Authorization: 'Bearer invalid' } }
    ))
    expect(response.status).toBe(401)
    expect(runPaymentReconciliation).not.toHaveBeenCalled()
    expect(runRefundReconciliation).not.toHaveBeenCalled()
  })

  it('runs a bounded batch and returns aggregate evidence without identifiers', async () => {
    vi.mocked(runPaymentReconciliation).mockResolvedValueOnce({
      workerId: 'worker-private', claimed: 2, resolved: 1, retried: 1,
      manualReview: 0, deadLetter: 0, errors: 0, executionTimeMs: 12,
    })
    const response = await POST(new Request(
      'http://localhost/api/cron/payment-reconciliation/v1?batchSize=12',
      { method: 'POST', headers: { Authorization: `Bearer ${secret}` } }
    ))
    expect(response.status).toBe(200)
    expect(runPaymentReconciliation).toHaveBeenCalledWith({ batchSize: 12 })
    expect(runRefundReconciliation).toHaveBeenCalledWith({ batchSize: 12 })
    const body = await response.json()
    expect(body).toMatchObject({ claimed: 2, resolved: 1, retried: 1 })
    expect(body).not.toHaveProperty('workerId')
    expect(JSON.stringify(body)).not.toContain('order')
  })

  it('returns 503 for manual review so the scheduler and alerting cannot hide it', async () => {
    vi.mocked(runPaymentReconciliation).mockResolvedValueOnce({
      workerId: 'worker-private', claimed: 1, resolved: 0, retried: 0,
      manualReview: 1, deadLetter: 0, errors: 0, executionTimeMs: 8,
    })
    const response = await GET(new Request(
      'http://localhost/api/cron/payment-reconciliation/v1',
      { headers: { Authorization: `Bearer ${secret}` } }
    ))
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ success: false, status: 'PARTIAL' })
  })
})
