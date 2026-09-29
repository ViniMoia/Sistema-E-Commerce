import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PaymentGateway } from '@/types/payment-gateway.types'

const orderTransition = vi.hoisted(() => vi.fn())
vi.mock('@/services/order.service', () => ({ updateOrderStatus: orderTransition }))

import {
  classifyRefundObservation,
  reconcileRefundsForOrder,
  requestOrderRefund,
  runRefundReconciliation,
} from '@/services/refund.service'

function gateway(): PaymentGateway {
  return {
    createPixCharge: vi.fn(),
    createCreditCardCharge: vi.fn(),
    createBoletoCharge: vi.fn(),
    getPaymentStatus: vi.fn(),
    findPaymentsByReference: vi.fn(),
    requestRefund: vi.fn().mockResolvedValue({ paymentId: 'pay-1', status: 'REFUND_IN_PROGRESS' }),
    listPaymentRefunds: vi.fn().mockResolvedValue([]),
  }
}

function database(params: {
  total?: string
  pointsEarned?: number
  pointsRedeemed?: number
  balance?: number
  paymentMethod?: 'PIX' | 'CREDIT_CARD'
  asaasPaymentStatus?: string
} = {}) {
  const intents: any[] = []
  const order: any = {
    id: 'order-1', lojaID: 'store-1', userID: 'customer-1', status: 'PAID',
    total: params.total ?? '100.00', paymentMethod: params.paymentMethod ?? 'PIX', paymentWorkflowStatus: 'CONFIRMED',
    asaasPaymentId: 'pay-1', asaasPaymentStatus: params.asaasPaymentStatus ?? 'RECEIVED',
    pointsEarned: params.pointsEarned ?? 0, pointsRedeemed: params.pointsRedeemed ?? 0,
  }
  const refundIntent = {
    findUnique: vi.fn(async ({ where, include }: any) => {
      const item = intents.find((candidate) => candidate.id === where.id || candidate.operationKey === where.operationKey)
      return item && include?.order ? { ...item, order: { ...order } } : (item ?? null)
    }),
    findMany: vi.fn(async ({ where }: any) => intents.filter((item) => {
      if (where.orderID && item.orderID !== where.orderID) return false
      if (where.status === 'CONFIRMED' && item.status !== 'CONFIRMED') return false
      if (where.status?.in && !where.status.in.includes(item.status)) return false
      return true
    }).map((item) => where.select ? { amount: item.amount } : { ...item })),
    create: vi.fn(async ({ data }: any) => {
      const created = { ...data, status: 'REFUND_REQUESTED', attempts: 0, maxAttempts: 8, createdAt: new Date() }
      intents.push(created)
      return created
    }),
    updateMany: vi.fn(async ({ where, data }: any) => {
      const targets = intents.filter((item) => {
        if (where.id && item.id !== where.id) return false
        if (where.orderID && item.orderID !== where.orderID) return false
        if (typeof where.status === 'string' && item.status !== where.status) return false
        if (where.status?.not && item.status === where.status.not) return false
        if (where.status?.in && !where.status.in.includes(item.status)) return false
        if (where.effectAppliedAt === null && item.effectAppliedAt) return false
        if (where.gatewayCalledAt === null && item.gatewayCalledAt) return false
        if (where.OR && item.lockedAt) return false
        return true
      })
      for (const item of targets) {
        Object.assign(item, data, {
          attempts: data.attempts?.increment ? item.attempts + data.attempts.increment : (data.attempts ?? item.attempts),
        })
      }
      return { count: targets.length }
    }),
    update: vi.fn(async ({ where, data }: any) => {
      const item = intents.find((candidate) => candidate.id === where.id)
      if (!item) throw new Error('INTENT_NOT_FOUND')
      Object.assign(item, data)
      return item
    }),
  }
  const db: any = {
    refundIntent,
    order: {
      findFirst: vi.fn(async ({ where }: any) => where.id === order.id && where.lojaID === order.lojaID ? { ...order } : null),
      findUnique: vi.fn(async ({ where }: any) => where.id === order.id ? { ...order } : null),
      update: vi.fn(async ({ data }: any) => Object.assign(order, data)),
    },
    loyaltyWallet: {
      findUnique: vi.fn(async () => ({ balance: params.balance ?? 0 })),
    },
    auditLog: { create: vi.fn(async () => ({})) },
    $transaction: vi.fn(async (arg: any) => typeof arg === 'function' ? arg(db) : Promise.all(arg)),
  }
  return { db, intents, order }
}

describe('refund workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    orderTransition.mockReset().mockResolvedValue({ success: true, order: { id: 'order-1', status: 'CANCELLED' } })
  })

  it('somente considera concluido o estorno DONE com referencia e valor exatos', () => {
    const refunds = [
      { status: 'DONE', value: 25, description: 'refund:outra-operacao' },
      { status: 'PENDING', value: 50, description: 'refund:intent-1' },
    ]

    expect(classifyRefundObservation(refunds, 'refund:intent-1', 50)).toEqual({
      kind: 'PROCESSING',
      providerStatus: 'PENDING',
    })
    expect(classifyRefundObservation(
      [{ status: 'DONE', value: 50, description: 'refund:intent-1' }],
      'refund:intent-1',
      50
    )).toEqual({ kind: 'CONFIRMED', providerStatus: 'DONE' })
    expect(classifyRefundObservation(
      [{ status: 'DONE', value: 49.99, description: 'refund:intent-1' }],
      'refund:intent-1',
      50
    )).toEqual({ kind: 'NOT_FOUND' })
  })

  it('persiste antes do POST e retry com a mesma chave nao duplica o estorno ambiguo', async () => {
    const { db, intents } = database()
    const fake = gateway()

    const first = await requestOrderRefund({
      orderId: 'order-1', lojaID: 'store-1', requestedById: 'admin-1',
      operationKey: 'operation-1', amount: 100, reason: 'Cancelamento integral',
    }, {
      prismaClient: db,
      paymentGateway: fake,
      afterGatewayAccepted: async () => { throw new Error('process stopped after provider response') },
    })
    const second = await requestOrderRefund({
      orderId: 'order-1', lojaID: 'store-1', requestedById: 'admin-1',
      operationKey: 'operation-1', amount: 100, reason: 'Cancelamento integral',
    }, { prismaClient: db, paymentGateway: fake })

    expect(first.status).toBe('RECONCILIATION_REQUIRED')
    expect(second.id).toBe(first.id)
    expect(intents).toHaveLength(1)
    expect(fake.requestRefund).toHaveBeenCalledTimes(1)
    expect(intents[0].gatewayCalledAt).toBeInstanceOf(Date)
  })

  it('rejeita reuso da chave de idempotencia com payload diferente', async () => {
    const { db } = database()
    const fake = gateway()
    await requestOrderRefund({
      orderId: 'order-1', lojaID: 'store-1', requestedById: 'admin-1',
      operationKey: 'same-operation', amount: 40, reason: 'Ajuste parcial A',
    }, { prismaClient: db, paymentGateway: fake })

    await expect(requestOrderRefund({
      orderId: 'order-1', lojaID: 'store-1', requestedById: 'admin-1',
      operationKey: 'same-operation', amount: 50, reason: 'Ajuste parcial A',
    }, { prismaClient: db, paymentGateway: fake })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' })
    await expect(requestOrderRefund({
      orderId: 'order-1', lojaID: 'store-1', requestedById: 'admin-1',
      operationKey: 'same-operation', amount: 40, reason: 'Outro motivo',
    }, { prismaClient: db, paymentGateway: fake })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' })
    expect(fake.requestRefund).toHaveBeenCalledTimes(1)
  })

  it('reserva o saldo entre dois parciais e impede ultrapassar o total sob retry', async () => {
    const { db, intents } = database()
    const fake = gateway()

    await requestOrderRefund({
      orderId: 'order-1', lojaID: 'store-1', requestedById: 'admin-1',
      operationKey: 'partial-1', amount: 40, reason: 'Ajuste parcial',
    }, { prismaClient: db, paymentGateway: fake })
    await requestOrderRefund({
      orderId: 'order-1', lojaID: 'store-1', requestedById: 'admin-1',
      operationKey: 'partial-2', amount: 60, reason: 'Complemento',
    }, { prismaClient: db, paymentGateway: fake })

    await expect(requestOrderRefund({
      orderId: 'order-1', lojaID: 'store-1', requestedById: 'admin-1',
      operationKey: 'partial-3', amount: 0.01, reason: 'Excesso',
    }, { prismaClient: db, paymentGateway: fake })).rejects.toMatchObject({
      code: 'REFUND_AMOUNT_EXCEEDS_REMAINING',
    })
    expect(intents).toHaveLength(2)
    expect(fake.requestRefund).toHaveBeenCalledTimes(2)
  })

  it('bloqueia antes do gateway quando o cashback ganho ja foi gasto', async () => {
    const { db, intents } = database({ pointsEarned: 20, balance: 5 })
    const fake = gateway()

    await expect(requestOrderRefund({
      orderId: 'order-1', lojaID: 'store-1', requestedById: 'admin-1',
      operationKey: 'full-with-spent-cashback', reason: 'Cancelamento integral',
    }, { prismaClient: db, paymentGateway: fake })).rejects.toMatchObject({
      code: 'LOYALTY_CLAWBACK_POLICY_REQUIRED',
    })
    expect(intents).toHaveLength(0)
    expect(fake.requestRefund).not.toHaveBeenCalled()
  })

  it('isola segundo estorno parcial de cartao ate existir politica aprovada', async () => {
    const { db } = database({ paymentMethod: 'CREDIT_CARD' })
    const fake = gateway()
    await requestOrderRefund({
      orderId: 'order-1', lojaID: 'store-1', requestedById: 'admin-1',
      operationKey: 'card-partial-1', amount: 40, reason: 'Primeiro ajuste parcial',
    }, { prismaClient: db, paymentGateway: fake })

    await expect(requestOrderRefund({
      orderId: 'order-1', lojaID: 'store-1', requestedById: 'admin-1',
      operationKey: 'card-partial-2', amount: 10, reason: 'Segundo ajuste parcial',
    }, { prismaClient: db, paymentGateway: fake })).rejects.toMatchObject({
      code: 'MULTIPLE_CARD_REFUND_POLICY_REQUIRED',
    })
    expect(fake.requestRefund).toHaveBeenCalledTimes(1)
  })

  it('mantem pedido pago apos parcial DONE e so exibe estado parcialmente estornado', async () => {
    const { db, intents, order } = database()
    const fake = gateway()
    const requested = await requestOrderRefund({
      orderId: 'order-1', lojaID: 'store-1', requestedById: 'admin-1',
      operationKey: 'partial-done', amount: 40, reason: 'Ajuste parcial',
    }, { prismaClient: db, paymentGateway: fake })
    vi.mocked(fake.listPaymentRefunds).mockResolvedValueOnce([{
      status: 'DONE', value: 40, description: intents[0].operationReference,
    }])

    const result = await reconcileRefundsForOrder('order-1', {
      prismaClient: db, paymentGateway: fake,
    })

    expect(result).toEqual({ matched: 1, confirmed: 1, unmatched: 0 })
    expect(intents[0]).toMatchObject({ id: requested.id, status: 'CONFIRMED' })
    expect(intents[0].effectAppliedAt).toBeInstanceOf(Date)
    expect(order).toMatchObject({ status: 'PAID', paymentWorkflowStatus: 'PARTIALLY_REFUNDED' })
    expect(orderTransition).not.toHaveBeenCalled()
  })

  it('duas instancias conciliam dois parciais sem aplicar cancelamento duas vezes', async () => {
    const { db, intents, order } = database()
    const fake = gateway()
    await requestOrderRefund({
      orderId: 'order-1', lojaID: 'store-1', requestedById: 'admin-1',
      operationKey: 'partial-a', amount: 40, reason: 'Parcial A',
    }, { prismaClient: db, paymentGateway: fake })
    await requestOrderRefund({
      orderId: 'order-1', lojaID: 'store-1', requestedById: 'admin-1',
      operationKey: 'partial-b', amount: 60, reason: 'Parcial B',
    }, { prismaClient: db, paymentGateway: fake })
    vi.mocked(fake.listPaymentRefunds).mockResolvedValue(intents.map((intent) => ({
      status: 'DONE', value: Number(intent.amount), description: intent.operationReference,
    })))
    let appliedTransitions = 0
    orderTransition.mockImplementation(async ({ newStatus }: any) => {
      if (order.status === newStatus) return { success: false, code: 'CONFLICT', error: 'already' }
      order.status = newStatus
      appliedTransitions += 1
      return { success: true, order: { id: order.id, status: newStatus } }
    })

    const [one, two] = await Promise.all([
      runRefundReconciliation({ prismaClient: db, paymentGateway: fake, workerId: 'worker-a' }),
      runRefundReconciliation({ prismaClient: db, paymentGateway: fake, workerId: 'worker-b' }),
    ])

    expect(one.claimed + two.claimed).toBe(2)
    expect(order).toMatchObject({ status: 'CANCELLED', paymentWorkflowStatus: 'REFUNDED' })
    expect(intents.every((intent) => intent.status === 'CONFIRMED' && intent.effectAppliedAt)).toBe(true)
    expect(appliedTransitions).toBe(1)
  })

  it('mantem confirmacao financeira e exige reconciliacao se restaurar estoque falhar', async () => {
    const { db, intents, order } = database()
    const fake = gateway()
    await requestOrderRefund({
      orderId: 'order-1', lojaID: 'store-1', requestedById: 'admin-1',
      operationKey: 'full-stock-failure', reason: 'Cancelamento integral',
    }, { prismaClient: db, paymentGateway: fake })
    vi.mocked(fake.listPaymentRefunds).mockResolvedValueOnce([{
      status: 'DONE', value: 100, description: intents[0].operationReference,
    }])
    orderTransition.mockRejectedValueOnce(new Error('inventory restore unavailable'))

    await expect(reconcileRefundsForOrder('order-1', {
      prismaClient: db, paymentGateway: fake,
    })).rejects.toThrow('inventory restore unavailable')

    expect(intents[0]).toMatchObject({
      status: 'CONFIRMED', lastErrorCode: 'REFUND_EFFECTS_COMMIT_FAILED',
    })
    expect(intents[0].effectAppliedAt ?? null).toBeNull()
    expect(order).toMatchObject({ status: 'PAID', paymentWorkflowStatus: 'RECONCILIATION_REQUIRED' })
  })

  it('preserva confirmacao financeira sem aplicar efeitos locais durante chargeback concorrente', async () => {
    const { db, intents, order } = database()
    const fake = gateway()
    await requestOrderRefund({
      orderId: 'order-1', lojaID: 'store-1', requestedById: 'admin-1',
      operationKey: 'refund-before-chargeback', reason: 'Cancelamento integral',
    }, { prismaClient: db, paymentGateway: fake })
    order.asaasPaymentStatus = 'CHARGEBACK_REQUESTED'
    order.paymentWorkflowStatus = 'RECONCILIATION_REQUIRED'
    vi.mocked(fake.listPaymentRefunds).mockResolvedValueOnce([{
      status: 'DONE', value: 100, description: intents[0].operationReference,
    }])

    await expect(reconcileRefundsForOrder('order-1', {
      prismaClient: db, paymentGateway: fake,
    })).rejects.toMatchObject({ code: 'CHARGEBACK_POLICY_REQUIRED' })
    expect(intents[0]).toMatchObject({ status: 'CONFIRMED', lastErrorCode: 'CHARGEBACK_POLICY_REQUIRED' })
    expect(intents[0].effectAppliedAt ?? null).toBeNull()
    expect(order).toMatchObject({ status: 'PAID', paymentWorkflowStatus: 'RECONCILIATION_REQUIRED' })
    expect(orderTransition).not.toHaveBeenCalled()
  })

  it('webhook duplicado de estorno concluido nao regride o pedido', async () => {
    const { db, intents, order } = database()
    const fake = gateway()
    await requestOrderRefund({
      orderId: 'order-1', lojaID: 'store-1', requestedById: 'admin-1',
      operationKey: 'partial-duplicate-event', amount: 40, reason: 'Ajuste parcial',
    }, { prismaClient: db, paymentGateway: fake })
    vi.mocked(fake.listPaymentRefunds).mockResolvedValue([{
      status: 'DONE', value: 40, description: intents[0].operationReference,
    }])
    await reconcileRefundsForOrder('order-1', { prismaClient: db, paymentGateway: fake })
    const duplicate = await reconcileRefundsForOrder('order-1', { prismaClient: db, paymentGateway: fake })

    expect(duplicate).toEqual({ matched: 1, confirmed: 1, unmatched: 0 })
    expect(order).toMatchObject({ status: 'PAID', paymentWorkflowStatus: 'PARTIALLY_REFUNDED' })
  })

  it('detecta estorno externo sem intent mesmo quando existe estorno local conhecido', async () => {
    const { db, intents, order } = database()
    const fake = gateway()
    await requestOrderRefund({
      orderId: 'order-1', lojaID: 'store-1', requestedById: 'admin-1',
      operationKey: 'known-partial', amount: 40, reason: 'Ajuste conhecido',
    }, { prismaClient: db, paymentGateway: fake })
    vi.mocked(fake.listPaymentRefunds).mockResolvedValueOnce([
      { status: 'DONE', value: 40, description: intents[0].operationReference },
      { status: 'DONE', value: 10, description: 'operacao-externa' },
    ])

    const result = await reconcileRefundsForOrder('order-1', { prismaClient: db, paymentGateway: fake })

    expect(result).toEqual({ matched: 1, confirmed: 1, unmatched: 1 })
    expect(order).toMatchObject({ status: 'PAID', paymentWorkflowStatus: 'RECONCILIATION_REQUIRED' })
  })

  it('falha de rede na consulta nunca reenvia o POST e deixa o intent reconciliavel', async () => {
    const { db, intents } = database()
    const fake = gateway()
    await requestOrderRefund({
      orderId: 'order-1', lojaID: 'store-1', requestedById: 'admin-1',
      operationKey: 'network-failure', reason: 'Cancelamento integral',
    }, { prismaClient: db, paymentGateway: fake })
    vi.mocked(fake.listPaymentRefunds).mockRejectedValueOnce(new Error('gateway timeout'))

    const summary = await runRefundReconciliation({
      prismaClient: db, paymentGateway: fake, workerId: 'worker-network',
    })

    expect(summary).toMatchObject({ claimed: 1, errors: 1, reconciliationRequired: 1 })
    expect(intents[0].status).toBe('RECONCILIATION_REQUIRED')
    expect(fake.requestRefund).toHaveBeenCalledTimes(1)
  })

  it('move processamento pendente para reconciliacao manual ao esgotar tentativas', async () => {
    const { db, intents } = database()
    const fake = gateway()
    await requestOrderRefund({
      orderId: 'order-1', lojaID: 'store-1', requestedById: 'admin-1',
      operationKey: 'pending-exhaustion', reason: 'Cancelamento integral',
    }, { prismaClient: db, paymentGateway: fake })
    intents[0].maxAttempts = 2
    vi.mocked(fake.listPaymentRefunds).mockResolvedValueOnce([{
      status: 'PENDING', value: 100, description: intents[0].operationReference,
    }])

    await runRefundReconciliation({ prismaClient: db, paymentGateway: fake, workerId: 'worker-exhaustion' })

    expect(intents[0]).toMatchObject({
      status: 'RECONCILIATION_REQUIRED',
      lastErrorCode: 'REFUND_RECONCILIATION_ATTEMPTS_EXHAUSTED',
    })
    expect(fake.requestRefund).toHaveBeenCalledTimes(1)
  })
})
