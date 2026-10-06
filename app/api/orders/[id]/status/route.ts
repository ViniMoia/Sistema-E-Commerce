import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import { getLojaFromHeaders } from '@/lib/tenant';
import { getCurrentUser } from '@/lib/session';
import { validGuestOrderAccess } from '@/lib/commerce/order-buyer';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Consulta de status no tenant correto, autorizada pela sessão ou pelo token
 * específico do pedido convidado. Não basta conhecer o ID do pedido.
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
        userID: true,
        buyer: { select: { recoveryTokenHash: true, recoveryExpiresAt: true } },
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
    const user = await getCurrentUser();
    const authorized = user?.status === 'ACTIVE' && user.lojaID === activeLoja.id
      && (user.id === order.userID || user.role === 'ADMIN');
    if (!authorized && !(order.userID === null && validGuestOrderAccess(req.headers.get('x-order-access-token'), order.buyer))) {
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
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
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[ORDER_STATUS_POLL_ERROR]', error);
    return NextResponse.json(
      { error: 'Erro ao consultar status do pedido' },
      { status: 500 }
    );
  }
}
