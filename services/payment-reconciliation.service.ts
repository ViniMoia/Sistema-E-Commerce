import crypto from 'node:crypto'
import { Prisma, type OrderStatus } from '@prisma/client'

import prisma from '@/lib/prisma'
import { logger, sanitizeLogText } from '@/lib/logger'
import { incrementMetric } from '@/lib/observability/metrics'
import { asaasPaymentAdapter } from '@/services/asaas/asaas.adapter'
import { updateOrderStatus } from '@/services/order.service'
import { reconcileRefundsForOrder } from '@/services/refund.service'
import type { PaymentGateway, PaymentStatusResult } from '@/types/payment-gateway.types'

const DEFAULT_BATCH_SIZE = 25
const DEFAULT_LEASE_MS = 5 * 60 * 1000
const DEFAULT_BASE_BACKOFF_MS = 30 * 1000
const DEFAULT_MAX_BACKOFF_MS = 6 * 60 * 60 * 1000

type ClassifiedPayment =
  | { kind: 'NOT_FOUND' }
  | { kind: 'DUPLICATE'; paymentIds: string[] }
  | { kind: 'CONFIRMED' | 'REFUNDED' | 'PENDING' | 'UNPAID_TERMINAL' | 'REVIEW'; payment: PaymentStatusResult }

export interface PaymentReconciliationSummary {
  workerId: string
  claimed: number
  resolved: number
  retried: number
  manualReview: number
  deadLetter: number
  errors: number
  executionTimeMs: number
}

export interface RunPaymentReconciliationOptions {
  batchSize?: number
  leaseMs?: number
  baseBackoffMs?: number
  maxBackoffMs?: number
  now?: Date
  workerId?: string
  paymentGateway?: PaymentGateway
  /** Test-only failure point used to prove restart convergence after effects commit. */
  afterEffectsCommitted?: (orderId: string) => Promise<void>
}

export function computeReconciliationBackoffMs(
  attempt: number,
  baseMs = DEFAULT_BASE_BACKOFF_MS,
  maxMs = DEFAULT_MAX_BACKOFF_MS
): number {
  const safeAttempt = Math.max(1, Math.floor(attempt))
  return Math.min(maxMs, baseMs * (2 ** (safeAttempt - 1)))
}

export function classifyGatewayPayments(payments: PaymentStatusResult[]): ClassifiedPayment {
  if (payments.length === 0) return { kind: 'NOT_FOUND' }
  if (payments.length > 1) {
    return {
      kind: 'DUPLICATE',
      paymentIds: payments.map((payment) => payment.paymentId).sort(),
    }
  }

  const payment = payments[0]
  const status = payment.status.toUpperCase()
  if (['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'].includes(status)) {
    return { kind: 'CONFIRMED', payment }
  }
  if (['REFUNDED', 'REFUND_REQUESTED'].includes(status)) {
    return { kind: 'REFUNDED', payment }
  }
  if (['PENDING', 'AWAITING_RISK_ANALYSIS'].includes(status)) {
    return { kind: 'PENDING', payment }
  }
  if (['OVERDUE', 'DELETED'].includes(status)) {
    return { kind: 'UNPAID_TERMINAL', payment }
  }
  return { kind: 'REVIEW', payment }
}

function expectedBillingType(paymentMethod: string | null): string | undefined {
  return paymentMethod && ['PIX', 'CREDIT_CARD', 'BOLETO'].includes(paymentMethod)
    ? paymentMethod
    : undefined
}

async function ensureTransition(params: {
  orderId: string
  lojaID: string
  currentStatus: OrderStatus
  targetStatus: Extract<OrderStatus, 'PAID' | 'CANCELLED'>
  paidAt?: Date
  paymentRefundConfirmed?: boolean
  reason: string
}): Promise<'TRANSITIONED' | 'ALREADY_TARGET'> {
  if (params.currentStatus === params.targetStatus) return 'ALREADY_TARGET'

  const result = await updateOrderStatus({
    orderId: params.orderId,
    newStatus: params.targetStatus,
    performedById: 'SYSTEM_PAYMENT_RECONCILIATION',
    lojaID: params.lojaID,
    paidAt: params.paidAt,
    paymentRefundConfirmed: params.paymentRefundConfirmed,
    reason: params.reason,
  })
  if (result.success === true) return 'TRANSITIONED'

  const current = await prisma.order.findUnique({
    where: { id: params.orderId },
    select: { status: true },
  })
  if (current?.status === params.targetStatus) return 'ALREADY_TARGET'
  throw new Error(`ORDER_TRANSITION_FAILED:${result.code}`)
}

async function finishClaim(
  id: string,
  workerId: string,
  data: Prisma.PaymentReconciliationUpdateManyMutationInput
): Promise<void> {
  const result = await prisma.paymentReconciliation.updateMany({
    where: { id, status: 'PROCESSING', leaseOwner: workerId },
    data: { ...data, lockedAt: null, leaseOwner: null },
  })
  if (result.count !== 1) throw new Error('RECONCILIATION_LEASE_LOST')
}

async function retryClaim(params: {
  id: string
  workerId: string
  attempts: number
  maxAttempts: number
  now: Date
  code: string
  message: string
  baseBackoffMs: number
  maxBackoffMs: number
}): Promise<'RETRY' | 'DEAD_LETTER'> {
  const terminal = params.attempts >= params.maxAttempts
  const sanitized = sanitizeLogText(params.message).slice(0, 1000)
  await finishClaim(params.id, params.workerId, {
    status: terminal ? 'DEAD_LETTER' : 'RETRY_SCHEDULED',
    nextAttemptAt: terminal
      ? params.now
      : new Date(params.now.getTime() + computeReconciliationBackoffMs(
          params.attempts,
          params.baseBackoffMs,
          params.maxBackoffMs
        )),
    lastErrorCode: params.code,
    lastErrorMessage: sanitized,
  })
  incrementMetric('payment_reconciliation_attempts_total', {
    result: terminal ? 'dead_letter' : 'retry',
  })
  return terminal ? 'DEAD_LETTER' : 'RETRY'
}

async function manualReviewClaim(
  id: string,
  workerId: string,
  code: string,
  message: string,
  gatewayPaymentId?: string,
  gatewayStatus?: string
): Promise<void> {
  await finishClaim(id, workerId, {
    status: 'MANUAL_REVIEW',
    gatewayPaymentId,
    gatewayStatus,
    lastErrorCode: code,
    lastErrorMessage: sanitizeLogText(message).slice(0, 1000),
  })
  incrementMetric('payment_reconciliation_attempts_total', { result: 'manual_review' })
}

export async function runPaymentReconciliation(
  options: RunPaymentReconciliationOptions = {}
): Promise<PaymentReconciliationSummary> {
  const startedAt = Date.now()
  const now = options.now ?? new Date()
  const workerId = options.workerId ?? crypto.randomUUID()
  const batchSize = Math.min(Math.max(options.batchSize ?? DEFAULT_BATCH_SIZE, 1), 100)
  const leaseMs = Math.max(options.leaseMs ?? DEFAULT_LEASE_MS, 1_000)
  const baseBackoffMs = Math.max(options.baseBackoffMs ?? DEFAULT_BASE_BACKOFF_MS, 1)
  const maxBackoffMs = Math.max(options.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS, baseBackoffMs)
  const gateway = options.paymentGateway ?? asaasPaymentAdapter
  const staleBefore = new Date(now.getTime() - leaseMs)
  const summary: PaymentReconciliationSummary = {
    workerId,
    claimed: 0,
    resolved: 0,
    retried: 0,
    manualReview: 0,
    deadLetter: 0,
    errors: 0,
    executionTimeMs: 0,
  }

  const candidates = await prisma.paymentReconciliation.findMany({
    where: {
      OR: [
        { status: { in: ['PENDING', 'RETRY_SCHEDULED'] }, nextAttemptAt: { lte: now } },
        { status: 'PROCESSING', lockedAt: { lt: staleBefore } },
      ],
    },
    orderBy: [{ nextAttemptAt: 'asc' }, { createdAt: 'asc' }],
    take: batchSize * 3,
    select: { id: true },
  })

  for (const candidate of candidates) {
    if (summary.claimed >= batchSize) break
    const claim = await prisma.paymentReconciliation.updateMany({
      where: {
        id: candidate.id,
        OR: [
          { status: { in: ['PENDING', 'RETRY_SCHEDULED'] }, nextAttemptAt: { lte: now } },
          { status: 'PROCESSING', lockedAt: { lt: staleBefore } },
        ],
      },
      data: {
        status: 'PROCESSING',
        attempts: { increment: 1 },
        lastAttemptAt: now,
        lockedAt: now,
        leaseOwner: workerId,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    })
    if (claim.count !== 1) continue
    summary.claimed += 1

    const reconciliation = await prisma.paymentReconciliation.findUnique({
      where: { id: candidate.id },
      include: {
        order: {
          select: {
            id: true,
            lojaID: true,
            status: true,
            total: true,
            paymentMethod: true,
            paymentReference: true,
            asaasPaymentId: true,
          },
        },
      },
    })
    if (!reconciliation) continue

    try {
      const payments = await gateway.findPaymentsByReference(reconciliation.paymentReference)
      const classified = classifyGatewayPayments(payments)

      if (classified.kind === 'NOT_FOUND') {
        const result = await retryClaim({
          id: reconciliation.id,
          workerId,
          attempts: reconciliation.attempts,
          maxAttempts: reconciliation.maxAttempts,
          now,
          code: 'PAYMENT_NOT_FOUND',
          message: 'Nenhuma cobrança localizada pela referência persistida; nova cobrança não foi criada.',
          baseBackoffMs,
          maxBackoffMs,
        })
        if (result === 'RETRY') summary.retried += 1
        else summary.deadLetter += 1
        continue
      }

      if (classified.kind === 'DUPLICATE') {
        await manualReviewClaim(
          reconciliation.id,
          workerId,
          'DUPLICATE_PAYMENT_REFERENCE',
          `Mais de uma cobrança foi localizada para a mesma referência (${classified.paymentIds.length}).`
        )
        await prisma.order.update({
          where: { id: reconciliation.order.id },
          data: {
            paymentWorkflowStatus: 'RECONCILIATION_REQUIRED',
            paymentLastError: 'Referência associada a múltiplas cobranças no gateway.',
          },
        })
        summary.manualReview += 1
        continue
      }

      const payment = classified.payment
      const expectedType = expectedBillingType(reconciliation.order.paymentMethod)
      const identityMismatch =
        payment.externalReference !== reconciliation.paymentReference ||
        (reconciliation.order.asaasPaymentId !== null &&
          reconciliation.order.asaasPaymentId !== payment.paymentId) ||
        (payment.value !== undefined &&
          !new Prisma.Decimal(payment.value).equals(reconciliation.order.total)) ||
        (expectedType !== undefined &&
          payment.billingType !== undefined &&
          payment.billingType !== expectedType)

      if (identityMismatch) {
        await manualReviewClaim(
          reconciliation.id,
          workerId,
          'PAYMENT_IDENTITY_MISMATCH',
          'A cobrança encontrada não corresponde à referência, ao valor ou ao método esperado.',
          payment.paymentId,
          payment.status
        )
        await prisma.order.update({
          where: { id: reconciliation.order.id },
          data: {
            paymentWorkflowStatus: 'RECONCILIATION_REQUIRED',
            paymentLastError: 'Cobrança divergente da tentativa persistida.',
          },
        })
        summary.manualReview += 1
        continue
      }

      await prisma.order.update({
        where: { id: reconciliation.order.id },
        data: {
          asaasPaymentId: payment.paymentId,
          asaasPaymentStatus: payment.status,
        },
      })

      if (classified.kind === 'PENDING') {
        await prisma.$transaction([
          prisma.order.update({
            where: { id: reconciliation.order.id },
            data: {
              paymentWorkflowStatus: 'AWAITING_PAYMENT',
              paymentLastError: null,
              paymentReconciledAt: now,
            },
          }),
          prisma.paymentReconciliation.updateMany({
            where: { id: reconciliation.id, status: 'PROCESSING', leaseOwner: workerId },
            data: {
              status: 'RESOLVED',
              gatewayPaymentId: payment.paymentId,
              gatewayStatus: payment.status,
              resolvedAt: now,
              lockedAt: null,
              leaseOwner: null,
              lastErrorCode: null,
              lastErrorMessage: null,
            },
          }),
        ])
      } else if (classified.kind === 'CONFIRMED') {
        if (reconciliation.order.status === 'CANCELLED') {
          await manualReviewClaim(
            reconciliation.id,
            workerId,
            'PAYMENT_CONFIRMED_AFTER_CANCELLATION',
            'Pagamento confirmado para pedido já cancelado.',
            payment.paymentId,
            payment.status
          )
          await prisma.order.update({
            where: { id: reconciliation.order.id },
            data: {
              paymentWorkflowStatus: 'RECONCILIATION_REQUIRED',
              paymentLastError: 'Pagamento confirmado após cancelamento.',
            },
          })
          summary.manualReview += 1
          continue
        }
        if (!['PENDING', 'PAID', 'SHIPPED', 'DELIVERED'].includes(reconciliation.order.status)) {
          throw new Error('ORDER_STATUS_UNSUPPORTED_FOR_CONFIRMATION')
        }
        if (reconciliation.order.status === 'PENDING') {
          await ensureTransition({
            orderId: reconciliation.order.id,
            lojaID: reconciliation.order.lojaID,
            currentStatus: reconciliation.order.status,
            targetStatus: 'PAID',
            paidAt: payment.paidAt,
            reason: 'Pagamento confirmado durante reconciliação durável.',
          })
          await options.afterEffectsCommitted?.(reconciliation.order.id)
        }
        await prisma.$transaction([
          prisma.order.update({
            where: { id: reconciliation.order.id },
            data: {
              paymentWorkflowStatus: 'CONFIRMED',
              paymentLastError: null,
              paymentReconciledAt: now,
            },
          }),
          prisma.paymentReconciliation.updateMany({
            where: { id: reconciliation.id, status: 'PROCESSING', leaseOwner: workerId },
            data: {
              status: 'RESOLVED',
              gatewayPaymentId: payment.paymentId,
              gatewayStatus: payment.status,
              resolvedAt: now,
              lockedAt: null,
              leaseOwner: null,
              lastErrorCode: null,
              lastErrorMessage: null,
            },
          }),
        ])
      } else if (classified.kind === 'REFUNDED') {
        const refundResult = await reconcileRefundsForOrder(reconciliation.order.id, {
          paymentGateway: gateway,
          now,
        })
        if (refundResult.matched === 0) {
          await manualReviewClaim(
            reconciliation.id,
            workerId,
            'UNTRACKED_PROVIDER_REFUND',
            'Estorno no gateway sem intencao local correspondente.',
            payment.paymentId,
            payment.status
          )
          summary.manualReview += 1
          continue
        }
        await finishClaim(reconciliation.id, workerId, {
          status: 'RESOLVED',
          gatewayPaymentId: payment.paymentId,
          gatewayStatus: payment.status,
          resolvedAt: now,
          lastErrorCode: null,
          lastErrorMessage: null,
        })
      } else if (classified.kind === 'UNPAID_TERMINAL') {
        if (reconciliation.order.status === 'PENDING') {
          await ensureTransition({
            orderId: reconciliation.order.id,
            lojaID: reconciliation.order.lojaID,
            currentStatus: reconciliation.order.status,
            targetStatus: 'CANCELLED',
            reason: `Cobrança encerrada no gateway com status ${payment.status}.`,
          })
          await options.afterEffectsCommitted?.(reconciliation.order.id)
        } else if (reconciliation.order.status !== 'CANCELLED') {
          await manualReviewClaim(
            reconciliation.id,
            workerId,
            'UNPAID_STATUS_AFTER_FULFILLMENT',
            `Cobrança ${payment.status} para pedido ${reconciliation.order.status}.`,
            payment.paymentId,
            payment.status
          )
          summary.manualReview += 1
          continue
        }
        await prisma.$transaction([
          prisma.order.update({
            where: { id: reconciliation.order.id },
            data: {
              paymentWorkflowStatus: 'DECLINED',
              paymentLastError: `Cobrança encerrada pelo gateway: ${payment.status}.`,
              paymentReconciledAt: now,
            },
          }),
          prisma.paymentReconciliation.updateMany({
            where: { id: reconciliation.id, status: 'PROCESSING', leaseOwner: workerId },
            data: {
              status: 'RESOLVED', gatewayPaymentId: payment.paymentId,
              gatewayStatus: payment.status, resolvedAt: now, lockedAt: null,
              leaseOwner: null, lastErrorCode: null, lastErrorMessage: null,
            },
          }),
        ])
      } else {
        await manualReviewClaim(
          reconciliation.id,
          workerId,
          'GATEWAY_STATUS_REQUIRES_REVIEW',
          `Status financeiro exige revisão: ${payment.status}.`,
          payment.paymentId,
          payment.status
        )
        await prisma.order.update({
          where: { id: reconciliation.order.id },
          data: {
            paymentWorkflowStatus: 'RECONCILIATION_REQUIRED',
            paymentLastError: `Status financeiro exige revisão: ${payment.status}.`,
          },
        })
        summary.manualReview += 1
        continue
      }

      summary.resolved += 1
      incrementMetric('payment_reconciliation_attempts_total', { result: 'resolved' })
    } catch (error) {
      summary.errors += 1
      const message = error instanceof Error ? error.message : 'PAYMENT_RECONCILIATION_FAILED'
      logger.error('Falha ao reconciliar pagamento', error, {
        action: 'PAYMENT_RECONCILIATION_FAILED',
        orderId: reconciliation.order.id,
        tenantId: reconciliation.order.lojaID,
        attempt: reconciliation.attempts,
      })
      const result = await retryClaim({
        id: reconciliation.id,
        workerId,
        attempts: reconciliation.attempts,
        maxAttempts: reconciliation.maxAttempts,
        now,
        code: 'GATEWAY_OR_COMMIT_UNAVAILABLE',
        message,
        baseBackoffMs,
        maxBackoffMs,
      }).catch(() => null)
      if (result === 'RETRY') summary.retried += 1
      if (result === 'DEAD_LETTER') summary.deadLetter += 1
    }
  }

  summary.executionTimeMs = Date.now() - startedAt
  incrementMetric('cron_runs_total', {
    job: 'payment_reconciliation_v1',
    result: summary.errors === 0 ? 'success' : summary.resolved > 0 ? 'partial' : 'failed',
  })
  return summary
}
