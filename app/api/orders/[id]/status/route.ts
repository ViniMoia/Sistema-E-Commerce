import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import { getLojaFromHeaders } from '@/lib/tenant';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Consulta pública de status de um pedido específico (para a tela de checkout / confirmação).
 * Retorna apenas status, número do pedido e metadados de pagamento sem expor dados sensíveis.
 * Protegido por rate limiting e isolamento multi-tenant (AUD-006).
 */
export async function GET(req: Request, context: RouteContext) {
  // Proteção contra brute force / DoS / enumeração: 60 requisições por minuto por IP (AUD-006)
  const rateLimitResponse = checkRateLimit(req, "order_status_poll", 60, 60000);
  if (rateLimitResponse) return rateLimitResponse;

  const { id } = await context.params;

  try {
    const activeLoja = await getLojaFromHeaders();

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        lojaID: true,
        total: true,
        asaasPaymentStatus: true,
        deliveredConfirmedAt: true,
        updatedAt: true,
      },
    });

    // Isolamento Multi-Tenant Estrito (Fail-Closed - AUD2-006):
    // Se o domínio da loja não for resolvido, ou o pedido não pertencer a este tenant, retorna 404
    if (!activeLoja || !order || order.lojaID !== activeLoja.id) {
      return NextResponse.json(
        { error: 'Pedido não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: Number(order.total),
        asaasPaymentStatus: order.asaasPaymentStatus,
        deliveredConfirmedAt: order.deliveredConfirmedAt,
        updatedAt: order.updatedAt,
      },
    });
  } catch (error) {
    console.error('[ORDER_STATUS_POLL_ERROR]', error);
    return NextResponse.json(
      { error: 'Erro ao consultar status do pedido' },
      { status: 500 }
    );
  }
}
