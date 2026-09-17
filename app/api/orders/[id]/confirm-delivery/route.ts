import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/guards';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  const guard = await requireAuth(req);
  if (guard instanceof NextResponse) return guard;

  const { id: orderId } = await context.params;

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        userID: true,
        lojaID: true,
        status: true,
        deliveryType: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Pedido não encontrado.' },
        { status: 404 }
      );
    }

    // 1. Defesa Anti-IDOR: Garantir que o pedido pertence ao usuário logado
    if (order.userID !== guard.user.id) {
      return NextResponse.json(
        { error: 'Acesso negado: este pedido não pertence à sua conta.' },
        { status: 403 }
      );
    }

    // 2. Validação de estado
    if (order.status === 'DELIVERED') {
      return NextResponse.json(
        { error: 'Este pedido já foi confirmado como entregue anteriormente.' },
        { status: 400 }
      );
    }

    if (order.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Não é possível confirmar a entrega de um pedido cancelado.' },
        { status: 400 }
      );
    }

    // Pedidos de retirada podem ser confirmados se estiverem pagos ou enviados.
    // Pedidos de entrega padrão exigem que o pedido já tenha sido despachado (SHIPPED).
    const isPickup = order.deliveryType === 'PICKUP' || order.deliveryType === 'NONE';
    const isEligible = isPickup
      ? order.status === 'PAID' || order.status === 'SHIPPED'
      : order.status === 'SHIPPED';

    if (!isEligible) {
      return NextResponse.json(
        {
          error: isPickup
            ? 'O pedido precisa estar pago para que a retirada seja confirmada.'
            : 'O pedido precisa ter sido enviado (despachado) para confirmar o recebimento.',
        },
        { status: 400 }
      );
    }

    // 3. Atualização atômica do status para DELIVERED e registro de auditoria
    const [updatedOrder] = await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'DELIVERED',
          deliveredConfirmedAt: new Date(),
          deliveredConfirmedBy: guard.user.id,
        },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          deliveredConfirmedAt: true,
        },
      }),
      prisma.auditLog.create({
        data: {
          actorId: guard.user.id,
          targetId: guard.user.id,
          action: 'ORDER_DELIVERY_CONFIRMED_BY_CUSTOMER',
          entity: 'Order',
          entityId: order.id,
          previousValue: { status: order.status },
          newValue: { status: 'DELIVERED' },
          ipAddress:
            req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null,
          metadata: {
            confirmedByRole: 'CUSTOMER',
            orderNumber: order.orderNumber,
          },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: 'Recebimento confirmado com sucesso!',
      order: updatedOrder,
    });
  } catch (error) {
    console.error('Erro ao confirmar recebimento do pedido:', error);
    return NextResponse.json(
      { error: 'Erro interno ao confirmar recebimento do pedido.' },
      { status: 500 }
    );
  }
}
