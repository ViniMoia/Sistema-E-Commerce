import crypto from 'node:crypto'
import { Prisma } from '@prisma/client'

import prisma from '@/lib/prisma'
import { logger, sanitizeLogText } from '@/lib/logger'
import { incrementMetric } from '@/lib/observability/metrics'
import { asaasPaymentAdapter } from '@/services/asaas/asaas.adapter'
import { updateOrderStatus } from '@/services/order.service'
import type { PaymentGateway, PaymentRefundResult } from '@/types/payment-gateway.types'

const ACTIVE_REFUND_STATUSES = [
  'REFUND_REQUESTED',
  'PROCESSING',
  'RECONCILIATION_REQUIRED',
] as const
const DEFAULT_BATCH_SIZE = 25
const DEFAULT_LEASE_MS = 5 * 60_000
const DEFAULT_BASE_BACKOFF_MS = 30_000
const DEFAULT_MAX_BACKOFF_MS = 6 * 60 * 60_000
const OPERATION_KEY_PATTERN = /^[A-Za-z0-9._:-]+$/
const FINANCIAL_DISPUTE_PATTERN = /CHARGEBACK|DUNNING|RECEIVED_IN_CASH_UNDONE/

type RefundObservation =
  | { kind: 'NOT_FOUND' }
  | { kind: 'PROCESSING' | 'CONFIRMED' | 'FAILED'; providerStatus: string }
  | { kind: 'DUPLICATE'; providerStatus: string }

export class RefundError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message)
    this.name = 'RefundError'
  }
}

export interface RequestOrderRefundInput {
  orderId: string
  lojaID: string
  requestedById: string
  operationKey: string
  amount?: number
  reason: string
  ipAddress?: string
}

export interface RefundDependencies {
  prismaClient?: any
  paymentGateway?: PaymentGateway
  now?: Date
  /** Test-only failure point after the provider accepted the POST. */
  afterGatewayAccepted?: () => Promise<void>
}

export interface RefundReconciliationSummary {
  workerId: string
  claimed: number
  confirmed: number
  processing: number
  failed: number
  reconciliationRequired: number
  errors: number
  executionTimeMs: number
}

export interface RunRefundReconciliationOptions extends RefundDependencies {
  batchSize?: number
  leaseMs?: number
  baseBackoffMs?: number
  maxBackoffMs?: number
  workerId?: string
}

function cents(value: Prisma.Decimal.Value): number {
  return new Prisma.Decimal(value).mul(100).round().toNumber()
}

function publicIntent(intent: any) {
  return {
    id: intent.id,
    orderId: intent.orderID,
    amount: Number(intent.amount),
    kind: intent.kind,
    status: intent.status,
    providerStatus: intent.providerStatus,
    createdAt: intent.createdAt,
    confirmedAt: intent.confirmedAt,
  }
}

export function computeRefundBackoffMs(
  attempt: number,
  baseMs = DEFAULT_BASE_BACKOFF_MS,
  maxMs = DEFAULT_MAX_BACKOFF_MS
): number {
  return Math.min(maxMs, baseMs * (2 ** (Math.max(1, attempt) - 1)))
}

export function classifyRefundObservation(
  refunds: PaymentRefundResult[],
  operationReference: string,
  expectedAmount: Prisma.Decimal.Value
): RefundObservation {
  const matches = refunds.filter((refund) =>
    refund.description === operationReference && cents(refund.value) === cents(expectedAmount)
  )
  if (matches.length === 0) return { kind: 'NOT_FOUND' }
  if (matches.length > 1) {
    return { kind: 'DUPLICATE', providerStatus: matches.map((item) => item.status).join(',') }
  }
  const providerStatus = matches[0].status.toUpperCase()
  if (providerStatus === 'DONE') return { kind: 'CONFIRMED', providerStatus }
  if (providerStatus === 'CANCELLED') return { kind: 'FAILED', providerStatus }
  return { kind: 'PROCESSING', providerStatus }
}

function storageOperationKey(lojaID: string, operationKey: string): string {
  return `refund:${lojaID}:${operationKey}`
}

function assertRefundCommand(input: RequestOrderRefundInput): void {
  const reason = input.reason.trim()
  if (
    input.operationKey.length < 8 ||
    input.operationKey.length > 200 ||
    !OPERATION_KEY_PATTERN.test(input.operationKey)
  ) {
    throw new RefundError('INVALID_IDEMPOTENCY_KEY', 'Chave de idempotencia invalida.')
  }
  if (reason.length < 3 || reason.length > 500) {
    throw new RefundError('INVALID_REFUND_REASON', 'Motivo do estorno invalido.')
  }
}

function assertSameIdempotentCommand(existing: any, input: RequestOrderRefundInput): void {
  const amountChanged = input.amount !== undefined && cents(existing.amount) !== cents(input.amount)
  if (
    existing.orderID !== input.orderId ||
    amountChanged ||
    existing.reason !== input.reason.trim()
  ) {
    throw new RefundError('IDEMPOTENCY_CONFLICT', 'Chave de idempotencia usada com outro estorno.')
  }
}

function isSerializationFailure(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as any).code === 'P2034')
}

async function withSerializableRetry<T>(db: any, operation: (tx: any) => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await db.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    } catch (error) {
      if (!isSerializationFailure(error) || attempt === 3) throw error
    }
  }
  throw new Error('SERIALIZABLE_RETRY_EXHAUSTED')
}

async function financialWorkflowForOrder(db: any, orderID: string): Promise<'CONFIRMED' | 'PARTIALLY_REFUNDED'> {
  const [order, confirmed] = await Promise.all([
    db.order.findUnique({ where: { id: orderID }, select: { total: true } }),
    db.refundIntent.findMany({
      where: { orderID, status: 'CONFIRMED' },
      select: { amount: true },
    }),
  ])
  if (!order) return 'CONFIRMED'
  const total = confirmed.reduce(
    (sum: Prisma.Decimal, item: any) => sum.add(item.amount),
    new Prisma.Decimal(0)
  )
  return total.greaterThan(0) && total.lessThan(order.total) ? 'PARTIALLY_REFUNDED' : 'CONFIRMED'
}

async function markAmbiguous(
  db: any,
  intent: any,
  code: string,
  message: string,
  now: Date
) {
  const safeMessage = sanitizeLogText(message).slice(0, 1000)
  await db.$transaction([
    db.refundIntent.updateMany({
      where: { id: intent.id, status: { in: ['PROCESSING', 'REFUND_REQUESTED'] } },
      data: {
        status: 'RECONCILIATION_REQUIRED',
        nextAttemptAt: now,
        lockedAt: null,
        leaseOwner: null,
        lastErrorCode: code,
        lastErrorMessage: safeMessage,
      },
    }),
    db.order.update({
      where: { id: intent.orderID },
      data: {
        paymentWorkflowStatus: 'RECONCILIATION_REQUIRED',
        paymentLastError: 'Resultado do estorno exige conciliacao com o gateway.',
      },
    }),
  ])
  incrementMetric('refund_reconciliation_attempts_total', { result: 'reconciliation_required' })
}

export async function dispatchRefundIntent(
  intentId: string,
  dependencies: RefundDependencies = {}
) {
  const db = dependencies.prismaClient ?? prisma
  const gateway = dependencies.paymentGateway ?? asaasPaymentAdapter
  const now = dependencies.now ?? new Date()
  const claim = await db.refundIntent.updateMany({
    where: { id: intentId, status: 'REFUND_REQUESTED', gatewayCalledAt: null },
    data: {
      status: 'PROCESSING',
      gatewayCalledAt: now,
      lastAttemptAt: now,
      attempts: { increment: 1 },
      lastErrorCode: null,
      lastErrorMessage: null,
    },
  })
  if (claim.count !== 1) {
    const existing = await db.refundIntent.findUnique({ where: { id: intentId } })
    if (!existing) throw new RefundError('REFUND_NOT_FOUND', 'Solicitacao de estorno nao encontrada.')
    return publicIntent(existing)
  }

  const intent = await db.refundIntent.findUnique({ where: { id: intentId } })
  if (!intent) throw new RefundError('REFUND_NOT_FOUND', 'Solicitacao de estorno nao encontrada.')
  try {
    const result = await gateway.requestRefund({
      paymentId: intent.gatewayPaymentId,
      value: Number(intent.amount),
      description: intent.operationReference,
    })
    await dependencies.afterGatewayAccepted?.()
    const updated = await db.refundIntent.update({
      where: { id: intent.id },
      data: {
        status: 'PROCESSING',
        providerStatus: result.status,
        nextAttemptAt: now,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    })
    incrementMetric('refund_requests_total', { result: 'accepted' })
    return publicIntent(updated)
  } catch (error: any) {
    const statusCode = error?.statusCode as number | undefined
    const definitelyRejected = statusCode !== undefined && [400, 401, 403, 404, 422].includes(statusCode)
    if (definitelyRejected) {
      const workflow = await financialWorkflowForOrder(db, intent.orderID)
      const [, updated] = await db.$transaction([
        db.order.update({
          where: { id: intent.orderID },
          data: {
            paymentWorkflowStatus: workflow,
            paymentLastError: 'Solicitacao de estorno rejeitada pelo gateway.',
          },
        }),
        db.refundIntent.update({
          where: { id: intent.id },
          data: {
            status: 'FAILED',
            lastErrorCode: error?.code || `HTTP_${statusCode}`,
            lastErrorMessage: sanitizeLogText(error?.message || 'REFUND_REJECTED').slice(0, 1000),
          },
        }),
      ])
      incrementMetric('refund_requests_total', { result: 'rejected' })
      return publicIntent(updated)
    }
    await markAmbiguous(
      db,
      intent,
      error?.code || 'AMBIGUOUS_GATEWAY_RESULT',
      error?.message || 'Resposta ambigua ao solicitar estorno.',
      now
    )
    const updated = await db.refundIntent.findUnique({ where: { id: intent.id } })
    return publicIntent(updated)
  }
}

export async function requestOrderRefund(
  input: RequestOrderRefundInput,
  dependencies: RefundDependencies = {}
) {
  assertRefundCommand(input)
  const db = dependencies.prismaClient ?? prisma
  const now = dependencies.now ?? new Date()
  const key = storageOperationKey(input.lojaID, input.operationKey)
  const existing = await db.refundIntent.findUnique({ where: { operationKey: key } })
  if (existing) {
    assertSameIdempotentCommand(existing, input)
    return publicIntent(existing)
  }

  const intent = await withSerializableRetry(db, async (tx) => {
    const repeated = await tx.refundIntent.findUnique({ where: { operationKey: key } })
    if (repeated) return repeated
    const order = await tx.order.findFirst({
      where: { id: input.orderId, lojaID: input.lojaID },
      select: {
        id: true,
        lojaID: true,
        userID: true,
        status: true,
        total: true,
        paymentMethod: true,
        paymentWorkflowStatus: true,
        asaasPaymentId: true,
        asaasPaymentStatus: true,
        pointsEarned: true,
        pointsRedeemed: true,
      },
    })
    if (!order) throw new RefundError('ORDER_NOT_FOUND', 'Pedido nao encontrado.')
    if (order.status !== 'PAID') {
      throw new RefundError('ORDER_NOT_ELIGIBLE', 'Somente pedido pago e nao expedido pode ser estornado automaticamente.')
    }
    if (!order.asaasPaymentId || !['PIX', 'CREDIT_CARD'].includes(order.paymentMethod || '')) {
      throw new RefundError('PAYMENT_METHOD_NOT_SUPPORTED', 'Metodo de pagamento exige fluxo manual especifico.')
    }
    if (
      order.paymentWorkflowStatus === 'RECONCILIATION_REQUIRED' ||
      FINANCIAL_DISPUTE_PATTERN.test(order.asaasPaymentStatus || '')
    ) {
      throw new RefundError('FINANCIAL_REVIEW_REQUIRED', 'Pedido possui evento financeiro pendente de revisao.')
    }

    const reserved = await tx.refundIntent.findMany({
      where: { orderID: order.id, status: { in: [...ACTIVE_REFUND_STATUSES, 'CONFIRMED'] } },
      select: { amount: true },
    })
    const reservedAmount = reserved.reduce(
      (sum: Prisma.Decimal, item: any) => sum.add(item.amount),
      new Prisma.Decimal(0)
    )
    const remaining = new Prisma.Decimal(order.total).sub(reservedAmount)
    const requested = input.amount === undefined ? remaining : new Prisma.Decimal(input.amount)
    if (requested.lessThanOrEqualTo(0) || requested.decimalPlaces() > 2) {
      throw new RefundError('INVALID_REFUND_AMOUNT', 'Valor do estorno deve ser positivo e ter no maximo duas casas.')
    }
    if (requested.greaterThan(remaining)) {
      throw new RefundError('REFUND_AMOUNT_EXCEEDS_REMAINING', 'Valor excede o saldo ainda estornavel.')
    }

    const isOriginalFullRefund = reservedAmount.equals(0) && requested.equals(order.total)
    if (order.paymentMethod === 'CREDIT_CARD' && reservedAmount.greaterThan(0)) {
      throw new RefundError(
        'MULTIPLE_CARD_REFUND_POLICY_REQUIRED',
        'Novo estorno parcial de cartao exige confirmacao da politica do adquirente.'
      )
    }
    if (!isOriginalFullRefund && (order.pointsEarned > 0 || order.pointsRedeemed > 0)) {
      throw new RefundError(
        'PARTIAL_LOYALTY_POLICY_REQUIRED',
        'Estorno parcial com fidelidade requer politica de rateio aprovada.'
      )
    }
    if (isOriginalFullRefund && order.pointsEarned > 0) {
      const wallet = await tx.loyaltyWallet.findUnique({
        where: { lojaID_userID: { lojaID: order.lojaID, userID: order.userID } },
        select: { balance: true },
      })
      if (!wallet || wallet.balance < order.pointsEarned) {
        throw new RefundError(
          'LOYALTY_CLAWBACK_POLICY_REQUIRED',
          'Cashback ganho neste pedido ja foi gasto; decisao manual necessaria.'
        )
      }
    }

    const id = crypto.randomUUID()
    const created = await tx.refundIntent.create({
      data: {
        id,
        orderID: order.id,
        lojaID: order.lojaID,
        operationKey: key,
        operationReference: `refund:${id}`,
        gatewayPaymentId: order.asaasPaymentId,
        kind: isOriginalFullRefund ? 'FULL' : 'PARTIAL',
        amount: requested,
        requestedById: input.requestedById,
        reason: input.reason.trim(),
        nextAttemptAt: now,
      },
    })
    await tx.order.update({
      where: { id: order.id },
      data: {
        paymentWorkflowStatus: 'REFUND_PROCESSING',
        paymentLastError: null,
      },
    })
    await tx.auditLog.create({
      data: {
        actorId: input.requestedById,
        targetId: order.userID,
        action: 'PAYMENT_REFUND_REQUESTED',
        entity: 'Order',
        entityId: order.id,
        previousValue: { paymentWorkflowStatus: order.paymentWorkflowStatus },
        newValue: { refundIntentId: id, status: 'REFUND_REQUESTED', kind: created.kind },
        ipAddress: input.ipAddress ?? null,
        metadata: { lojaID: order.lojaID, amount: requested.toFixed(2) },
      },
    })
    return created
  })

  if (intent.status !== 'REFUND_REQUESTED') return publicIntent(intent)
  return dispatchRefundIntent(intent.id, { ...dependencies, now })
}

async function applyConfirmedRefund(db: any, intent: any, now: Date): Promise<void> {
  await db.refundIntent.updateMany({
    where: { id: intent.id, status: { not: 'CONFIRMED' } },
    data: {
      status: 'CONFIRMED',
      providerStatus: 'DONE',
      confirmedAt: now,
      lockedAt: null,
      leaseOwner: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    },
  })
  const current = await db.refundIntent.findUnique({
    where: { id: intent.id },
    include: { order: true },
  })
  if (!current || current.effectAppliedAt) return
  if (FINANCIAL_DISPUTE_PATTERN.test(current.order.asaasPaymentStatus || '')) {
    throw new RefundError(
      'CHARGEBACK_POLICY_REQUIRED',
      'Estorno confirmado durante chargeback ou cobranca em disputa exige decisao manual.'
    )
  }
  const confirmed = await db.refundIntent.findMany({
    where: { orderID: current.orderID, status: 'CONFIRMED' },
    select: { amount: true },
  })
  const confirmedAmount = confirmed.reduce(
    (sum: Prisma.Decimal, item: any) => sum.add(item.amount),
    new Prisma.Decimal(0)
  )
  if (confirmedAmount.lessThan(current.order.total)) {
    await db.$transaction([
      db.order.update({
        where: { id: current.orderID },
        data: {
          paymentWorkflowStatus: 'PARTIALLY_REFUNDED',
          paymentLastError: null,
          paymentReconciledAt: now,
        },
      }),
      db.refundIntent.update({
        where: { id: current.id },
        data: { effectAppliedAt: now, lockedAt: null, leaseOwner: null },
      }),
    ])
    return
  }

  if (confirmedAmount.greaterThan(current.order.total)) {
    throw new RefundError('CONFIRMED_REFUND_EXCEEDS_ORDER', 'Total confirmado excede o valor do pedido.')
  }
  if (['SHIPPED', 'DELIVERED'].includes(current.order.status)) {
    throw new RefundError('RETURN_POLICY_REQUIRED', 'Estorno confirmado apos expedicao exige tratamento operacional.')
  }
  if (current.order.status !== 'CANCELLED') {
    const result = await updateOrderStatus({
      orderId: current.orderID,
      newStatus: 'CANCELLED',
      performedById: 'SYSTEM_REFUND_RECONCILIATION',
      lojaID: current.order.lojaID,
      paymentRefundConfirmed: true,
      reason: 'Estorno financeiro integral confirmado pelo gateway.',
    })
    if (result.success === false) {
      const fresh = await db.order.findUnique({
        where: { id: current.orderID },
        select: { status: true, asaasPaymentStatus: true },
      })
      if (FINANCIAL_DISPUTE_PATTERN.test(fresh.asaasPaymentStatus || '')) {
        throw new RefundError(
          'CHARGEBACK_POLICY_REQUIRED',
          'Estorno confirmado durante chargeback ou cobranca em disputa exige decisao manual.'
        )
      }
      if (fresh?.status !== 'CANCELLED') throw new Error(`ORDER_TRANSITION_FAILED:${result.code}`)
    }
  }
  await db.$transaction([
    db.order.update({
      where: { id: current.orderID },
      data: {
        paymentWorkflowStatus: 'REFUNDED',
        asaasPaymentStatus: 'REFUNDED',
        paymentLastError: null,
        paymentReconciledAt: now,
      },
    }),
    db.refundIntent.updateMany({
      where: { orderID: current.orderID, status: 'CONFIRMED', effectAppliedAt: null },
      data: { effectAppliedAt: now, lockedAt: null, leaseOwner: null },
    }),
  ])
}

async function applyObservation(db: any, intent: any, observation: RefundObservation, now: Date) {
  if (observation.kind === 'CONFIRMED') {
    try {
      await applyConfirmedRefund(db, intent, now)
      incrementMetric('refund_reconciliation_attempts_total', { result: 'confirmed' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'REFUND_EFFECTS_COMMIT_FAILED'
      const errorCode = error instanceof RefundError ? error.code : 'REFUND_EFFECTS_COMMIT_FAILED'
      await db.$transaction([
        db.refundIntent.update({
          where: { id: intent.id },
          data: {
            status: 'CONFIRMED',
            providerStatus: 'DONE',
            confirmedAt: intent.confirmedAt ?? now,
            lockedAt: null,
            leaseOwner: null,
            lastErrorCode: errorCode,
            lastErrorMessage: sanitizeLogText(message).slice(0, 1000),
          },
        }),
        db.order.update({
          where: { id: intent.orderID },
          data: {
            paymentWorkflowStatus: 'RECONCILIATION_REQUIRED',
            paymentLastError: 'Estorno confirmado; efeitos locais aguardam reconciliacao.',
          },
        }),
      ])
      throw error
    }
    return
  }
  if (observation.kind === 'FAILED') {
    const workflow = await financialWorkflowForOrder(db, intent.orderID)
    await db.$transaction([
      db.refundIntent.update({
        where: { id: intent.id },
        data: {
          status: 'FAILED', providerStatus: observation.providerStatus,
          lockedAt: null, leaseOwner: null,
          lastErrorCode: 'PROVIDER_REFUND_CANCELLED',
          lastErrorMessage: 'O gateway cancelou o estorno.',
        },
      }),
      db.order.update({
        where: { id: intent.orderID },
        data: { paymentWorkflowStatus: workflow, paymentLastError: 'Estorno cancelado pelo gateway.' },
      }),
    ])
    return
  }
  if (observation.kind === 'DUPLICATE') {
    await markAmbiguous(db, intent, 'DUPLICATE_PROVIDER_REFUND', 'Mais de um estorno corresponde a operacao.', now)
    return
  }
  const attempts = intent.attempts ?? 1
  const exhausted = attempts >= intent.maxAttempts
  await db.refundIntent.update({
    where: { id: intent.id },
    data: {
      status: exhausted
        ? 'RECONCILIATION_REQUIRED'
        : observation.kind === 'PROCESSING' ? 'PROCESSING' : 'RECONCILIATION_REQUIRED',
      providerStatus: observation.kind === 'PROCESSING' ? observation.providerStatus : intent.providerStatus,
      nextAttemptAt: new Date(now.getTime() + computeRefundBackoffMs(attempts)),
      lockedAt: null,
      leaseOwner: null,
      lastErrorCode: exhausted ? 'REFUND_RECONCILIATION_ATTEMPTS_EXHAUSTED' :
        observation.kind === 'NOT_FOUND' ? 'REFUND_NOT_FOUND_AT_PROVIDER' : null,
      lastErrorMessage: exhausted
        ? 'Limite de tentativas automaticas atingido.'
        : observation.kind === 'NOT_FOUND'
          ? 'Estorno ainda nao localizado pela referencia persistida.'
          : null,
    },
  })
}

export async function reconcileRefundsForOrder(
  orderID: string,
  dependencies: RefundDependencies = {}
): Promise<{ matched: number; confirmed: number; unmatched: number }> {
  const db = dependencies.prismaClient ?? prisma
  const gateway = dependencies.paymentGateway ?? asaasPaymentAdapter
  const now = dependencies.now ?? new Date()
  const order = await db.order.findUnique({
    where: { id: orderID },
    select: { id: true, asaasPaymentId: true },
  })
  if (!order?.asaasPaymentId) throw new RefundError('PAYMENT_NOT_FOUND', 'Cobranca do pedido nao encontrada.')
  const intents = await db.refundIntent.findMany({ where: { orderID } })
  const refunds = await gateway.listPaymentRefunds(order.asaasPaymentId)
  const observationByIntent = new Map<string, RefundObservation>()
  for (const intent of intents) {
    const observation = classifyRefundObservation(refunds, intent.operationReference, intent.amount)
    observationByIntent.set(intent.id, observation)
  }
  const matched = [...observationByIntent.values()].filter((item) => item.kind !== 'NOT_FOUND').length
  const confirmed = [...observationByIntent.values()].filter((item) => item.kind === 'CONFIRMED').length
  const unmatched = refunds.filter((refund) => !intents.some((intent: any) =>
    intent.operationReference === refund.description && cents(intent.amount) === cents(refund.value)
  )).length

  const actionable = intents.filter((intent: any) =>
    ['PROCESSING', 'RECONCILIATION_REQUIRED'].includes(intent.status) ||
    (intent.status === 'CONFIRMED' && !intent.effectAppliedAt)
  )
  for (const intent of actionable) {
    const observation = observationByIntent.get(intent.id) ?? { kind: 'NOT_FOUND' }
    await applyObservation(db, intent, observation, now)
  }
  if (matched === 0 || unmatched > 0) {
    await db.order.update({
      where: { id: orderID },
      data: {
        paymentWorkflowStatus: 'RECONCILIATION_REQUIRED',
        paymentLastError: unmatched > 0
          ? 'Estorno externo sem intencao local correspondente.'
          : 'Evento de estorno ainda nao corresponde a uma operacao persistida.',
      },
    })
  }
  return { matched, confirmed, unmatched }
}

export async function runRefundReconciliation(
  options: RunRefundReconciliationOptions = {}
): Promise<RefundReconciliationSummary> {
  const startedAt = Date.now()
  const db = options.prismaClient ?? prisma
  const gateway = options.paymentGateway ?? asaasPaymentAdapter
  const now = options.now ?? new Date()
  const workerId = options.workerId ?? crypto.randomUUID()
  const batchSize = Math.min(Math.max(options.batchSize ?? DEFAULT_BATCH_SIZE, 1), 100)
  const staleBefore = new Date(now.getTime() - Math.max(options.leaseMs ?? DEFAULT_LEASE_MS, 1000))
  const summary: RefundReconciliationSummary = {
    workerId, claimed: 0, confirmed: 0, processing: 0,
    failed: 0, reconciliationRequired: 0, errors: 0, executionTimeMs: 0,
  }
  const candidates = await db.refundIntent.findMany({
    where: {
      OR: [
        { status: 'REFUND_REQUESTED', gatewayCalledAt: null },
        {
          status: { in: ['PROCESSING', 'RECONCILIATION_REQUIRED'] },
          nextAttemptAt: { lte: now },
          OR: [{ lockedAt: null }, { lockedAt: { lt: staleBefore } }],
        },
        {
          status: 'CONFIRMED', effectAppliedAt: null,
          OR: [{ lockedAt: null }, { lockedAt: { lt: staleBefore } }],
        },
      ],
    },
    orderBy: [{ nextAttemptAt: 'asc' }, { createdAt: 'asc' }],
    take: batchSize * 3,
  })

  for (const candidate of candidates) {
    if (summary.claimed >= batchSize) break
    if (candidate.attempts >= candidate.maxAttempts && candidate.status !== 'CONFIRMED') continue
    if (candidate.status === 'REFUND_REQUESTED') {
      const before = candidate.gatewayCalledAt
      const result = await dispatchRefundIntent(candidate.id, { ...options, paymentGateway: gateway, now })
      if (!before) summary.claimed += 1
      if (result.status === 'PROCESSING') summary.processing += 1
      else if (result.status === 'RECONCILIATION_REQUIRED') summary.reconciliationRequired += 1
      else if (result.status === 'FAILED') summary.failed += 1
      continue
    }
    const claim = await db.refundIntent.updateMany({
      where: {
        id: candidate.id,
        status: candidate.status,
        OR: [{ lockedAt: null }, { lockedAt: { lt: staleBefore } }],
      },
      data: {
        lockedAt: now, leaseOwner: workerId, lastAttemptAt: now,
        attempts: { increment: 1 },
      },
    })
    if (claim.count !== 1) continue
    summary.claimed += 1
    const intent = await db.refundIntent.findUnique({ where: { id: candidate.id }, include: { order: true } })
    if (!intent) continue
    try {
      if (intent.status === 'CONFIRMED') {
        await applyConfirmedRefund(db, intent, now)
        summary.confirmed += 1
        continue
      }
      const refunds = await gateway.listPaymentRefunds(intent.gatewayPaymentId)
      const observation = classifyRefundObservation(refunds, intent.operationReference, intent.amount)
      await applyObservation(db, intent, observation, now)
      if (observation.kind === 'CONFIRMED') summary.confirmed += 1
      else if (observation.kind === 'FAILED') summary.failed += 1
      else if (observation.kind === 'PROCESSING') summary.processing += 1
      else summary.reconciliationRequired += 1
    } catch (error) {
      summary.errors += 1
      summary.reconciliationRequired += 1
      logger.error('Falha ao reconciliar estorno', error, {
        action: 'REFUND_RECONCILIATION_FAILED',
        orderId: intent.orderID,
        tenantId: intent.lojaID,
        attempt: intent.attempts,
      })
      await markAmbiguous(
        db, intent, 'REFUND_RECONCILIATION_FAILED',
        error instanceof Error ? error.message : 'Falha ao reconciliar estorno.', now
      ).catch(() => undefined)
    }
  }
  summary.executionTimeMs = Date.now() - startedAt
  incrementMetric('cron_runs_total', {
    job: 'refund_reconciliation_v1',
    result: summary.errors === 0 ? 'success' : summary.confirmed > 0 ? 'partial' : 'failed',
  })
  return summary
}
