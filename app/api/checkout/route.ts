import { ok, err } from '@/lib/api-response'
import { createOrder } from '@/lib/services/checkout.service'
import { createOrderSchema, type CreateOrderInput } from '@/lib/validators/checkout.validators'
import { checkRateLimit } from '@/lib/rate-limit'
import { getLojaFromHeaders } from '@/lib/tenant'
import { getCurrentUser } from '@/lib/session'
import { logger } from '@/lib/logger'
import crypto from 'crypto'

export async function POST(request: Request) {
  const correlationId =
    request.headers.get('x-correlation-id') ||
    request.headers.get('x-request-id') ||
    crypto.randomUUID()

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

  // Resolução de usuário com validação de sessão (AUD2-001 / BOLA):
  // Se houver sessão autenticada ativa no cookie, o usuário autoritativo é vinculado à sessão.
  // Se for visitante (guest), qualquer userId enviado no payload é descartado para prevenir sequestro de contas/pontos.
  const currentUser = await getCurrentUser();
  if (currentUser) {
    if (currentUser.lojaID === activeLoja.id) {
      data.customer.userId = currentUser.id;
    } else {
      delete data.customer.userId;
    }
  } else {
    delete data.customer.userId;
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

    logger.info('Pedido e cobrança processados com sucesso no checkout', {
      action: 'CHECKOUT_ORDER_SUCCESS',
      correlationId,
      tenantId: activeLoja.id,
      orderId: result.order.id,
      orderNumber: result.order.orderNumber,
      asaasPaymentId: result.order.asaasPaymentId || undefined,
      total: result.order.total,
    })

    return ok(result)
  } catch (error: any) {
    logger.error('Erro na criação de pedido no checkout', error, {
      action: 'CHECKOUT_ORDER_ERROR',
      correlationId,
      tenantId: activeLoja?.id,
      customer: {
        cpfCnpj: data.customer?.cpfCnpj,
        email: data.customer?.email,
      },
    })
    return err(error?.message || "Erro interno do servidor ao criar pedido", 400)
  }
}
