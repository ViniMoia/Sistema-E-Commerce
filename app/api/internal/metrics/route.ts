import crypto from 'node:crypto'
import { renderPrometheusMetrics } from '@/lib/observability/metrics'
import { renderPaymentReconciliationMetrics } from '@/lib/observability/payment-reconciliation-metrics'
import { renderRefundMetrics } from '@/lib/observability/refund-metrics'

export const dynamic = 'force-dynamic'

function authorized(request: Request): 'ok' | 'missing-config' | 'unauthorized' {
  const expected = process.env.OBSERVABILITY_TOKEN
  if (!expected) return 'missing-config'
  const authorization = request.headers.get('authorization')
  const received = authorization?.startsWith('Bearer ')
    ? authorization.slice(7).trim()
    : ''
  if (!received) return 'unauthorized'
  const receivedBuffer = Buffer.from(received)
  const expectedBuffer = Buffer.from(expected)
  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
  ) return 'unauthorized'
  return 'ok'
}

export async function GET(request: Request) {
  const auth = authorized(request)
  if (auth === 'missing-config') {
    return Response.json({ error: 'Observability endpoint unavailable.' }, { status: 503 })
  }
  if (auth === 'unauthorized') {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 })
  }
  const [persistentMetrics, refundMetrics] = await Promise.all([
    renderPaymentReconciliationMetrics(),
    renderRefundMetrics(),
  ])
  return new Response(`${renderPrometheusMetrics()}${persistentMetrics}${refundMetrics}`, {
    status: 200,
    headers: {
      'content-type': 'text/plain; version=0.0.4; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}
