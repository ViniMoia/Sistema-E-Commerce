import { Prisma, OrderStatus, DeliveryType } from '@prisma/client'
import prisma from '@/lib/prisma'

interface ListOrdersParams {
  lojaID: string
  status?: OrderStatus
  search?: string
}

interface GetOrderDetailParams {
  orderId: string
  lojaID: string
}

interface UpdateOrderStatusParams {
  orderId: string
  lojaID: string
  newStatus: OrderStatus
  performedById: string
  trackingCode?: string
}

interface UpdateOrderNotesParams {
  orderId: string
  lojaID: string
  adminNotes: string
}

type OrderListItem = {
  id: string
  orderNumber: number
  status: OrderStatus
  createdAt: Date
  total: Prisma.Decimal
  freightValue: Prisma.Decimal | null
  deliveryType: DeliveryType
  paymentMethod: string | null
  customer: {
    name: string
    email: string
    phone: string | null
  }
}

type OrderDetail = Prisma.OrderGetPayload<{
  select: {
    id: true
    orderNumber: true
    status: true
    createdAt: true
    updatedAt: true
    total: true
    freightValue: true
    deliveryType: true
    trackingCode: true
    adminNotes: true
    paymentMethod: true
    lojaID: true
    user: { select: {
      id: true
      name: true
      email: true
      phone: true
    } }
    items: {
      include: {
        product: { select: { id: true; name: true } }
      }
    }
    address: { select: {
      state: true
      city: true
      district: true
      street: true
      number: true
      complement: true
    } }
    statusHistory: {
      orderBy: [{ createdAt: 'asc' }]
      include: {
        performedBy: { select: { id: true; name: true } }
      }
    }
  }
}>

type OrderScalar = {
  id: string
  orderNumber: number
  status: OrderStatus
  deliveryType: DeliveryType
  paymentMethod: string | null
  trackingCode: string | null
  adminNotes: string | null
  freightValue: Prisma.Decimal | null
  subtotal: Prisma.Decimal
  shippingCost: Prisma.Decimal
  total: Prisma.Decimal
  createdAt: Date
  updatedAt: Date
}

export async function listOrdersForAdmin(params: ListOrdersParams): Promise<OrderListItem[]> {
  const where: Prisma.OrderWhereInput = {
    lojaID: params.lojaID,
    ...(params.status ? { status: params.status } : {}),
    ...(params.search
      ? {
          OR: [
            { user: { name: { contains: params.search, mode: 'insensitive' } } },
            { user: { email: { contains: params.search, mode: 'insensitive' } } }
          ]
        }
      : {})
  }

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      createdAt: true,
      total: true,
      freightValue: true,
      deliveryType: true,
      paymentMethod: true,
      user: {
        select: {
          name: true,
          email: true,
          phone: true
        }
      }
    }
  })

  return orders.map(o => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    createdAt: o.createdAt,
    total: o.total,
    freightValue: o.freightValue,
    deliveryType: o.deliveryType,
    paymentMethod: o.paymentMethod,
    customer: {
      name: o.user.name,
      email: o.user.email,
      phone: o.user.phone
    }
  }))
}

export async function getOrderDetailForAdmin(
  params: GetOrderDetailParams
): Promise<OrderDetail | null> {
  return prisma.order.findFirst({
    where: { id: params.orderId, lojaID: params.lojaID },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      total: true,
      freightValue: true,
      deliveryType: true,
      trackingCode: true,
      adminNotes: true,
      paymentMethod: true,
      lojaID: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true
        }
      },
      items: {
        include: {
          product: { select: { id: true, name: true } }
        }
      },
      address: {
        select: {
          state: true,
          city: true,
          district: true,
          street: true,
          number: true,
          complement: true
        }
      },
      statusHistory: {
        orderBy: { createdAt: 'asc' },
        include: {
          performedBy: {
            select: { id: true, name: true }
          }
        }
      }
    }
  })
}

export async function updateOrderStatus(params: UpdateOrderStatusParams): Promise<OrderScalar> {
  const existing = await prisma.order.findUnique({ where: { id: params.orderId } })

  if (!existing || existing.lojaID !== params.lojaID) {
    throw new Error('Pedido não encontrado ou loja incompatível.')
  }

  const [updated] = await prisma.$transaction([
    prisma.order.update({
      where: { id: params.orderId },
      data: {
        status: params.newStatus,
        ...(params.trackingCode !== undefined ? { trackingCode: params.trackingCode } : {})
      }
    }),
    prisma.orderStatusHistory.create({
      data: {
        orderId: params.orderId,
        status: params.newStatus,
        performedById: params.performedById
      }
    })
  ])

  return updated
}

export async function updateOrderNotes(params: UpdateOrderNotesParams): Promise<OrderScalar | null> {
  const existing = await prisma.order.findUnique({ where: { id: params.orderId } })

  if (!existing || existing.lojaID !== params.lojaID) {
    return null
  }

  return prisma.order.update({
    where: { id: params.orderId },
    data: { adminNotes: params.adminNotes }
  })
}
