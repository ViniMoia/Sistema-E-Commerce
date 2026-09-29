import { NextResponse } from 'next/server'

import { err, ok } from '@/lib/api-response'
import { requireAdmin } from '@/lib/auth/guards'
import { requestRefundBodySchema } from '@/lib/validators/order.validators'
import { RefundError, requestOrderRefund } from '@/services/refund.service'

export async function POST(
  request: Request,
  props: { params: Promise<{ orderId: string }> }
) {
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth

  const operationKey = request.headers.get('idempotency-key')?.trim()
  if (!operationKey || operationKey.length < 8 || operationKey.length > 200) {
    return err('Cabecalho Idempotency-Key obrigatorio.', 400, 'IDEMPOTENCY_KEY_REQUIRED')
  }
  const parsed = requestRefundBodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return err('Parametros de estorno invalidos.', 422, 'VALIDATION_ERROR')

  const { orderId } = await props.params
  try {
    const intent = await requestOrderRefund({
      orderId,
      lojaID: auth.user.lojaID,
      requestedById: auth.user.id,
      operationKey,
      amount: parsed.data.amount,
      reason: parsed.data.reason,
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown',
    })
    // 202 deliberado: o aceite do comando nunca e apresentado como estorno concluido.
    return ok(intent, intent.status === 'CONFIRMED' ? 200 : 202)
  } catch (error) {
    if (!(error instanceof RefundError)) throw error
    const status = error.code === 'ORDER_NOT_FOUND'
      ? 404
      : error.code === 'IDEMPOTENCY_CONFLICT' || error.code === 'REFUND_AMOUNT_EXCEEDS_REMAINING'
        ? 409
        : 422
    return err(error.message, status, error.code)
  }
}
