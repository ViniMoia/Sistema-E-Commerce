import { ok, err } from '@/lib/api-response'
import { createOrder } from '@/lib/services/checkout.service'
import { createOrderSchema, type CreateOrderInput } from '@/lib/validators/checkout.validators'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(request: Request) {
  // Proteção contra spam/DoS de pedidos: 15 tentativas por minuto por IP (SEC-005)
  const rateLimitResponse = checkRateLimit(request, "order_checkout", 15, 60000);
  if (rateLimitResponse) return rateLimitResponse;

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return err('JSON inválido.', 400)
  }

  const parseResult = createOrderSchema.safeParse(body)
  if (!parseResult.success) {
    return err('Dados de checkout inválidos.', 400)
  }
  const data = parseResult.data as CreateOrderInput

  if (data.deliveryType === 'DELIVERY' && !data.address) {
    return err('Endereço obrigatório para entrega.', 400)
  }

  // Extrair chave de idempotência dos headers ou body (DB-002)
  const idempotencyKey =
    request.headers.get('idempotency-key') ||
    request.headers.get('x-idempotency-key') ||
    (typeof (body as any)?.idempotencyKey === 'string' ? (body as any).idempotencyKey : undefined)

  try {
    const result = await createOrder({
      ...data,
      idempotencyKey,
    })
    return ok(result)
  } catch (error: any) {
    console.error("[CHECKOUT_ERROR]", error)
    return err(error?.message || "Erro interno do servidor ao criar pedido", 400)
  }
}
