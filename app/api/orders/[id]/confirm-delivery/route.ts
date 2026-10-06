import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/guards';
import { getLojaFromHeaders } from '@/lib/tenant';
import { updateOrderStatus } from '@/services/order.service';
import { isValidTransition } from '@/lib/order-transitions';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  const guard = await requireAuth(req);
  if (guard instanceof NextResponse) return guard;

  const { id: orderId } = await context.params;

  try {
    const tenant = await getLojaFromHeaders();
    if (!tenant) return NextResponse.json({ error: 'Loja não encontrada.' }, { status: 404 });
    if (tenant.id !== guard.user.lojaID) return NextResponse.json({ error: 'Sessão não autorizada para esta loja.' }, { status: 403 });
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        userID: true,
        lojaID: true,
        status: true,
        deliveryType: true,
        version: true,
      },
    });

    if (!order || order.lojaID !== tenant.id) {
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
    const isEligible = isValidTransition(order.status, 'DELIVERED', order.deliveryType);

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
    const result = await updateOrderStatus({
      orderId: order.id, lojaID: tenant.id, newStatus: 'DELIVERED', performedById: guard.user.id,
      actor: { type: 'USER', userId: guard.user.id, lojaID: tenant.id }, confirmReceipt: true,
      expectedVersion: order.version,
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0].trim(),
    });
    if (result.success === false) return NextResponse.json({ error: result.error }, { status: result.code === 'FORBIDDEN' ? 403 : 409 });
    const updatedOrder = result.order;

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
