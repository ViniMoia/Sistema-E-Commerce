import { logger } from '@/lib/logger'
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/auth/guards'
import { updateOrderStatus } from '@/services/order.service'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(req: Request, context: RouteContext) {
  const guard = await requireAuth(req)
  if (guard instanceof NextResponse) return guard

  const { id: orderId } = await context.params

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
    })

    if (!order) {
      return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })
    }
    if (order.userID !== guard.user.id) {
      return NextResponse.json(
        { error: 'Acesso negado: este pedido não pertence à sua conta.' },
        { status: 403 }
      )
    }
    if (order.lojaID !== guard.user.lojaID) {
      return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })
    }
    if (order.status === 'DELIVERED') {
      return NextResponse.json(
        { error: 'Este pedido já foi confirmado como entregue anteriormente.' },
        { status: 400 }
      )
    }
    if (order.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Não é possível confirmar a entrega de um pedido cancelado.' },
        { status: 400 }
      )
    }

    const isPickup = order.deliveryType === 'PICKUP' || order.deliveryType === 'NONE'
    const isEligible = isPickup
      ? order.status === 'PAID' || order.status === 'SHIPPED'
      : order.status === 'SHIPPED'

    if (!isEligible) {
      return NextResponse.json(
        {
          error: isPickup
            ? 'O pedido precisa estar pago para que a retirada seja confirmada.'
            : 'O pedido precisa ter sido enviado (despachado) para confirmar o recebimento.',
        },
        { status: 400 }
      )
    }

    const result = await updateOrderStatus({
      orderId: order.id,
      newStatus: 'DELIVERED',
      performedById: guard.user.id,
      deliveredConfirmedById: guard.user.id,
      expectedUserID: guard.user.id,
      lojaID: guard.user.lojaID,
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown',
    })

    if (result.success === false) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        {
          status:
            result.code === 'NOT_FOUND'
              ? 404
              : result.code === 'CONFLICT'
                ? 409
                : 422,
        }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Recebimento confirmado com sucesso!',
      order: { ...result.order, orderNumber: order.orderNumber },
    })
  } catch (error) {
    logger.error('Erro ao confirmar recebimento do pedido:', error);
    return NextResponse.json(
      { error: 'Erro interno ao confirmar recebimento do pedido.' },
      { status: 500 }
    )
  }
}
