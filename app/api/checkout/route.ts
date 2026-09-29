import { ok, err } from '@/lib/api-response'
import { CheckoutError, createOrder } from '@/services/checkout.service'
import { createOrderSchema, type CreateOrderInput } from '@/lib/validators/checkout.validators'
import { checkRateLimit } from '@/lib/rate-limit'
import { getLojaFromHeaders } from '@/lib/tenant'
import { getCurrentUser } from '@/lib/session'
import { logger } from '@/lib/logger'
import {
  attachRequestId,
  createRequestLogContext,
  enrichLogContext,
  runWithLogContext,
} from '@/lib/observability/request-context'
import { incrementMetric } from '@/lib/observability/metrics'

export async function POST(request: Request) {
  const requestContext = createRequestLogContext(request.headers)
  return runWithLogContext(requestContext, async () => {
    const response = await handleCheckout(request, requestContext.correlationId)
    return attachRequestId(response, requestContext.requestId)
  })
}

async function handleCheckout(request: Request, correlationId: string) {

  // Proteção contra spam/DoS de pedidos: 15 tentativas por minuto por IP (SEC-005)
  const rateLimitResponse = checkRateLimit(request, "order_checkout", 15, 60000);
  if (rateLimitResponse) return rateLimitResponse;

  let body: unknown
  try {
    body = await request.json()
  } catch {
    logger.warn('Tentativa de checkout com JSON inválido', {
      action: 'CHECKOUT_BAD_JSON',
      correlationId,
    })
    return err('JSON inválido.', 400)
  }

  const parseResult = createOrderSchema.safeParse(body)
  if (!parseResult.success) {
    incrementMetric('checkout_requests_total', { result: 'validation_failure' })
    const errorMsg = parseResult.error.issues[0]?.message || 'Dados de checkout inválidos.'
    logger.warn('Validação de checkout rejeitada', {
      action: 'CHECKOUT_VALIDATION_FAILED',
      correlationId,
      error: errorMsg,
      issues: parseResult.error.issues.map((i) => ({ path: i.path, message: i.message })),
    })
    return err(errorMsg, 400)
  }
  const data = parseResult.data as CreateOrderInput

  if (data.deliveryType === 'DELIVERY' && !data.address) {
    return err('Endereço obrigatório para entrega.', 400)
  }

  // Resolução e Isolamento Estrito Multi-Tenant (AUD-004 / ACT-003):
  const activeLoja = await getLojaFromHeaders();
  if (!activeLoja) {
    logger.warn('Checkout bloqueado: Loja não identificada pelo cabeçalho do domínio', {
      action: 'CHECKOUT_TENANT_NOT_FOUND',
      correlationId,
    })
    return err('Loja não encontrada para este domínio.', 404);
  }

  // Prevenção contra spoofing de lojaID: se fornecido no body, deve ser idêntico ao domínio
  if (data.lojaID && data.lojaID !== activeLoja.id) {
    logger.error('Tentativa de spoofing multi-tenant detectada no checkout', undefined, {
      action: 'CHECKOUT_TENANT_SPOOFING_BLOCKED',
      correlationId,
      bodyLojaID: data.lojaID,
      activeLojaID: activeLoja.id,
    })
    return err('Violação de isolamento multi-tenant: lojaID não corresponde ao domínio da loja.', 403);
  }
  data.lojaID = activeLoja.id;
  enrichLogContext({ tenantId: activeLoja.id })

  // Resolução de usuário com validação de sessão (AUD2-001 / BOLA):
  // Se houver sessão autenticada ativa no cookie, o usuário autoritativo é vinculado à sessão.
  // Se for visitante (guest), qualquer userId enviado no payload é descartado para prevenir sequestro de contas/pontos.
  const currentUser = await getCurrentUser();
  if (currentUser) {
    if (currentUser.lojaID === activeLoja.id) {
      data.customer.userId = currentUser.id;
      if (!data.cartId) {
        return err(
          'Identificador do carrinho é obrigatório para o checkout autenticado.',
          400,
          'CART_ID_REQUIRED'
        )
      }
    } else {
      delete data.customer.userId;
      delete data.cartId;
    }
  } else {
    delete data.customer.userId;
    delete data.cartId;
  }

  // Extrair chave de idempotência dos headers ou body (DB-002)
  const idempotencyKey =
    request.headers.get('idempotency-key') ||
    request.headers.get('x-idempotency-key') ||
    (typeof (body as any)?.idempotencyKey === 'string' ? (body as any).idempotencyKey : undefined)

  if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 200) {
    return err(
      'Idempotency-Key válido é obrigatório para criar um pedido.',
      400,
      'IDEMPOTENCY_KEY_REQUIRED'
    )
  }

  try {
    const result = await createOrder({
      ...data,
      idempotencyKey,
    })
    enrichLogContext({
      orderId: result.order.id,
      orderNumber: result.order.orderNumber,
      asaasPaymentId: result.order.asaasPaymentId || undefined,
    })

    logger.info('Pedido e cobrança processados com sucesso no checkout', {
      action: 'CHECKOUT_ORDER_SUCCESS',
      correlationId,
      tenantId: activeLoja.id,
      orderId: result.order.id,
      orderNumber: result.order.orderNumber,
      asaasPaymentId: result.order.asaasPaymentId || undefined,
      total: result.order.total,
    })
    incrementMetric('checkout_requests_total', {
      result: 'success',
      payment_method: data.paymentMethod || 'PIX',
    })

    return ok(result.order)
  } catch (error: any) {
    incrementMetric('checkout_requests_total', {
      result: error instanceof CheckoutError ? 'domain_failure' : 'internal_failure',
      payment_method: data.paymentMethod || 'PIX',
    })
    logger.error('Erro na criação de pedido no checkout', error, {
      action: 'CHECKOUT_ORDER_ERROR',
      correlationId,
      tenantId: activeLoja?.id,
      customer: {
        cpfCnpj: data.customer?.cpfCnpj,
        email: data.customer?.email,
      },
    })
    if (error instanceof CheckoutError) {
      const publicMessage = error.code === 'PAYMENT_DECLINED'
        ? 'Pagamento recusado pelo provedor. Revise os dados ou escolha outro meio de pagamento.'
        : error.message
      return err(publicMessage, error.statusCode, error.code)
    }
    return err('Erro interno do servidor ao criar pedido.', 500, 'CHECKOUT_INTERNAL_ERROR')
  }
}
