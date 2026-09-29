import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/guards'
import { getOrdersByUser } from '@/services/order.service'
import { handleOrderError } from '@/lib/order-errors'
import { getLojaFromHeaders } from '@/lib/tenant'

/**
 * A criação por carrinho não participa do workflow financeiro e foi encerrada.
 * Todo pedido novo deve atravessar a mesma fronteira transacional do checkout.
 */
export async function POST(_req?: Request) {
  return NextResponse.json(
    {
      error: 'Criação de pedido movida para o checkout canônico.',
      code: 'CHECKOUT_ROUTE_REQUIRED',
      checkoutPath: '/api/checkout',
    },
    { status: 410 }
  )
}

export async function GET(req?: Request) {
  const guard = await requireAuth(req)
  if (guard instanceof NextResponse) return guard

  try {
    const activeLoja = await getLojaFromHeaders()
    const lojaID = activeLoja?.id || guard.user.lojaID

    if (!lojaID) {
      return NextResponse.json(
        { error: 'Contexto de loja não identificado.' },
        { status: 400 }
      )
    }

    const orders = await getOrdersByUser({
      userID: guard.user.id,
      lojaID,
    })
    return NextResponse.json(orders, { status: 200 })
  } catch (error) {
    return handleOrderError(error)
  }
}
