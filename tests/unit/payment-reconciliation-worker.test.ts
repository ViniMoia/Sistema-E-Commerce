import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PaymentGateway, PaymentStatusResult } from '@/types/payment-gateway.types'

const harness = vi.hoisted(() => {
  const reconciliations = new Map<string, any>()
  const orders = new Map<string, any>()

  const apply = (target: any, data: any) => {
    for (const [key, value] of Object.entries(data)) {
      target[key] = value && typeof value === 'object' && 'increment' in value
        ? (target[key] ?? 0) + (value as any).increment
        : value
    }
  }

  const paymentReconciliation = {
    findMany: vi.fn(async ({ where, take }: any) => {
      const dueAt = where.OR[0].nextAttemptAt.lte as Date
      const staleBefore = where.OR[1].lockedAt.lt as Date
      return [...reconciliations.values()]
        .filter((item) =>
          (['PENDING', 'RETRY_SCHEDULED'].includes(item.status) && item.nextAttemptAt <= dueAt) ||
          (item.status === 'PROCESSING' && item.lockedAt < staleBefore)
        )
        .slice(0, take)
        .map(({ id }) => ({ id }))
    }),
    updateMany: vi.fn(async ({ where, data }: any) => {
      const item = reconciliations.get(where.id)
      if (!item) return { count: 0 }
      if (data.status === 'PROCESSING' && data.attempts?.increment) {
        const dueAt = where.OR[0].nextAttemptAt.lte as Date
        const staleBefore = where.OR[1].lockedAt.lt as Date
        const claimable =
          (['PENDING', 'RETRY_SCHEDULED'].includes(item.status) && item.nextAttemptAt <= dueAt) ||
          (item.status === 'PROCESSING' && item.lockedAt < staleBefore)
        if (!claimable) return { count: 0 }
      } else if (
        item.status !== where.status ||
        (where.leaseOwner !== undefined && item.leaseOwner !== where.leaseOwner)
      ) {
        return { count: 0 }
      }
      apply(item, data)
      return { count: 1 }
    }),
    findUnique: vi.fn(async ({ where }: any) => {
      const item = reconciliations.get(where.id)
      return item ? { ...item, order: { ...orders.get(item.orderID) } } : null
    }),
  }

  const order = {
    update: vi.fn(async ({ where, data }: any) => {
      const item = orders.get(where.id)
      if (!item) throw new Error('ORDER_NOT_FOUND')
      apply(item, data)
      return { ...item }
    }),
    findUnique: vi.fn(async ({ where }: any) => {
      const item = orders.get(where.id)
      return item ? { ...item } : null
    }),
  }

  const prisma = {
    paymentReconciliation,
    order,
    $transaction: vi.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
  }

  const updateOrderStatus = vi.fn(async (input: any) => {
    const current = orders.get(input.orderId)
    if (!current) return { success: false, code: 'NOT_FOUND' }
    if (current.status === input.newStatus) return { success: false, code: 'CONFLICT' }
    current.status = input.newStatus
    return { success: true, order: { id: input.orderId, status: input.newStatus } }
  })

  return { reconciliations, orders, prisma, updateOrderStatus }
})

vi.mock('@/lib/prisma', () => ({ default: harness.prisma }))
vi.mock('@/services/order.service', () => ({ updateOrderStatus: harness.updateOrderStatus }))
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  sanitizeLogText: (value: string) => value,
}))
vi.mock('@/lib/observability/metrics', () => ({ incrementMetric: vi.fn() }))

import { runPaymentReconciliation } from '@/services/payment-reconciliation.service'

const NOW = new Date('2026-09-29T12:00:00.000Z')

function seed(status = 'PENDING', orderStatus = 'PENDING') {
  harness.orders.set('order-1', {
    id: 'order-1', lojaID: 'store-1', status: orderStatus,
    total: '100.00', paymentMethod: 'PIX', paymentReference: 'ref-1',
    asaasPaymentId: null,
  })
  harness.reconciliations.set('recon-1', {
    id: 'recon-1', orderID: 'order-1', paymentReference: 'ref-1',
    status, attempts: 0, maxAttempts: 3,
    nextAttemptAt: new Date(NOW.getTime() - 1),
    firstDetectedAt: new Date(NOW.getTime() - 60_000),
    lockedAt: status === 'PROCESSING' ? new Date(NOW.getTime() - 600_000) : null,
    leaseOwner: status === 'PROCESSING' ? 'dead-process' : null,
  })
}

function gateway(result: PaymentStatusResult[] | Error): PaymentGateway {
  return {
    createPixCharge: vi.fn(),
    createCreditCardCharge: vi.fn(),
    createBoletoCharge: vi.fn(),
    getPaymentStatus: vi.fn(),
    requestRefund: vi.fn(),
    listPaymentRefunds: vi.fn().mockResolvedValue([]),
    findPaymentsByReference: result instanceof Error
      ? vi.fn().mockRejectedValue(result)
      : vi.fn().mockResolvedValue(result),
  }
}

describe('durable payment reconciliation worker', () => {
  beforeEach(() => {
    harness.reconciliations.clear()
    harness.orders.clear()
    vi.clearAllMocks()
  })

  it('backs off on timeout and never calls a charge-creation operation', async () => {
    seed()
    const fake = gateway(new Error('gateway timeout'))

    const summary = await runPaymentReconciliation({
      now: NOW, paymentGateway: fake, baseBackoffMs: 1_000,
    })

    expect(summary).toMatchObject({ claimed: 1, retried: 1, errors: 1 })
    expect(harness.reconciliations.get('recon-1')).toMatchObject({
      status: 'RETRY_SCHEDULED', attempts: 1,
      lastErrorCode: 'GATEWAY_OR_COMMIT_UNAVAILABLE',
    })
    expect(fake.createPixCharge).not.toHaveBeenCalled()
    expect(fake.createCreditCardCharge).not.toHaveBeenCalled()
    expect(fake.createBoletoCharge).not.toHaveBeenCalled()
  })

  it('dead-letters a repeatedly nonexistent charge without blind recreation', async () => {
    seed()
    harness.reconciliations.get('recon-1').attempts = 2
    const fake = gateway([])

    const summary = await runPaymentReconciliation({ now: NOW, paymentGateway: fake })

    expect(summary.deadLetter).toBe(1)
    expect(harness.reconciliations.get('recon-1')).toMatchObject({
      status: 'DEAD_LETTER', attempts: 3, lastErrorCode: 'PAYMENT_NOT_FOUND',
    })
    expect(fake.createPixCharge).not.toHaveBeenCalled()
  })

  it('persists duplicate references as manual review', async () => {
    seed()
    const fake = gateway([
      { paymentId: 'pay-1', status: 'PENDING', externalReference: 'ref-1' },
      { paymentId: 'pay-2', status: 'CONFIRMED', externalReference: 'ref-1' },
    ])

    const summary = await runPaymentReconciliation({ now: NOW, paymentGateway: fake })

    expect(summary.manualReview).toBe(1)
    expect(harness.reconciliations.get('recon-1')).toMatchObject({
      status: 'MANUAL_REVIEW', lastErrorCode: 'DUPLICATE_PAYMENT_REFERENCE',
    })
  })

  it('reclaims a stale lease after restart and resolves a persisted reference', async () => {
    seed('PROCESSING')
    const fake = gateway([{
      paymentId: 'pay-1', status: 'CONFIRMED', externalReference: 'ref-1',
      billingType: 'PIX', value: 100,
    }])

    const summary = await runPaymentReconciliation({ now: NOW, paymentGateway: fake })

    expect(summary).toMatchObject({ claimed: 1, resolved: 1 })
    expect(harness.orders.get('order-1')).toMatchObject({
      status: 'PAID', paymentWorkflowStatus: 'CONFIRMED', asaasPaymentId: 'pay-1',
    })
    expect(harness.reconciliations.get('recon-1')).toMatchObject({
      status: 'RESOLVED', attempts: 1, leaseOwner: null,
    })
  })

  it('allows only one of two worker instances to claim the same intent', async () => {
    seed()
    const fake = gateway([{
      paymentId: 'pay-1', status: 'PENDING', externalReference: 'ref-1',
      billingType: 'PIX', value: 100,
    }])

    const [one, two] = await Promise.all([
      runPaymentReconciliation({ now: NOW, workerId: 'worker-1', paymentGateway: fake }),
      runPaymentReconciliation({ now: NOW, workerId: 'worker-2', paymentGateway: fake }),
    ])

    expect(one.claimed + two.claimed).toBe(1)
    expect(fake.findPaymentsByReference).toHaveBeenCalledTimes(1)
    expect(harness.reconciliations.get('recon-1').status).toBe('RESOLVED')
  })

  it('converges after a crash between payment effects and reconciliation commit', async () => {
    seed()
    const fake = gateway([{
      paymentId: 'pay-1', status: 'CONFIRMED', externalReference: 'ref-1',
      billingType: 'PIX', value: 100,
    }])

    const first = await runPaymentReconciliation({
      now: NOW,
      paymentGateway: fake,
      baseBackoffMs: 10,
      afterEffectsCommitted: async () => { throw new Error('process terminated') },
    })
    expect(first.retried).toBe(1)
    expect(harness.orders.get('order-1').status).toBe('PAID')

    const second = await runPaymentReconciliation({
      now: new Date(NOW.getTime() + 20),
      paymentGateway: fake,
      baseBackoffMs: 10,
    })
    expect(second.resolved).toBe(1)
    expect(harness.updateOrderStatus).toHaveBeenCalledTimes(1)
    expect(harness.reconciliations.get('recon-1').status).toBe('RESOLVED')
  })

  it('does not regress an out-of-order confirmed event after cancellation', async () => {
    seed('PENDING', 'CANCELLED')
    const fake = gateway([{
      paymentId: 'pay-1', status: 'CONFIRMED', externalReference: 'ref-1',
      billingType: 'PIX', value: 100,
    }])

    const summary = await runPaymentReconciliation({ now: NOW, paymentGateway: fake })

    expect(summary.manualReview).toBe(1)
    expect(harness.orders.get('order-1')).toMatchObject({
      status: 'CANCELLED', paymentWorkflowStatus: 'RECONCILIATION_REQUIRED',
    })
    expect(harness.updateOrderStatus).not.toHaveBeenCalled()
  })
})
