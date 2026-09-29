import crypto from 'node:crypto'
import { NextResponse } from 'next/server'

import { validateCronAuth } from '@/lib/cron-auth'
import { logger } from '@/lib/logger'
import { runPaymentReconciliation } from '@/services/payment-reconciliation.service'
import { runRefundReconciliation } from '@/services/refund.service'

export const dynamic = 'force-dynamic'

async function handle(request: Request) {
  const auth = validateCronAuth(request, 'payment-reconciliation-v1')
  if ('response' in auth) return auth.response

  const runId = crypto.randomUUID()
  try {
    const url = new URL(request.url)
    const parsedBatchSize = Number(url.searchParams.get('batchSize') ?? 25)
    const batchSize = Number.isInteger(parsedBatchSize) ? parsedBatchSize : 25
    const [summary, refunds] = await Promise.all([
      runPaymentReconciliation({ batchSize }),
      runRefundReconciliation({ batchSize }),
    ])
    const incomplete = summary.errors > 0 || summary.deadLetter > 0 || summary.manualReview > 0 ||
      refunds.errors > 0 || refunds.reconciliationRequired > 0
    return NextResponse.json({
      success: !incomplete,
      status: incomplete ? 'PARTIAL' : 'SUCCESS',
      runId,
      claimed: summary.claimed,
      resolved: summary.resolved,
      retried: summary.retried,
      manualReview: summary.manualReview,
      deadLetter: summary.deadLetter,
      errors: summary.errors,
      executionTimeMs: summary.executionTimeMs,
      refunds: {
        claimed: refunds.claimed,
        confirmed: refunds.confirmed,
        processing: refunds.processing,
        failed: refunds.failed,
        reconciliationRequired: refunds.reconciliationRequired,
        errors: refunds.errors,
        executionTimeMs: refunds.executionTimeMs,
      },
    }, { status: incomplete ? 503 : 200 })
  } catch (error) {
    logger.error('Falha no acionamento da reconciliação de pagamentos', error, {
      action: 'PAYMENT_RECONCILIATION_CRON_FAILED',
      runId,
    })
    return NextResponse.json(
      { success: false, status: 'FAILED', runId, error: 'Falha interna na reconciliação.' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  return handle(request)
}

export async function POST(request: Request) {
  return handle(request)
}
