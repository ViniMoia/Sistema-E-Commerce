import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'

interface ListCustomersParams {
  lojaID: string
  search?: string
  cursor?: string
  limit?: number
}

interface CustomerRow {
  id: string
  name: string
  email: string
  phone: string | null
  totalOrders: number
  totalSpent: number
  lastOrderAt: string | null
  createdAt: string
}

interface CustomerProfile {
  id: string
  name: string
  email: string
  phone: string | null
  createdAt: string
  addresses: Array<{
    state: string
    city: string
    neighborhood: string
    street: string
    number: string
    complement: string | null
  }>
}

interface CustomerMetrics {
  totalOrders: number
  totalSpent: number
  averageOrderValue: number
  firstOrderAt: string | null
  lastOrderAt: string | null
  mostBoughtProduct: string | null
  preferredDeliveryType: 'DELIVERY' | 'PICKUP' | null
  cancelledOrders: number
}

interface GetCustomerParams {
  customerId: string
  lojaID: string
}

export async function listCustomers(
  params: ListCustomersParams
): Promise<{ data: CustomerRow[]; nextCursor: string | null }> {
  const { lojaID, search, cursor, limit = 20 } = params
  const take = Math.min(limit, 100)

  const where: Prisma.UserWhereInput = {
    lojaID,
    orders: {
      some: {
        lojaID
      }
    },
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } }
          ]
        }
      : {})
  }

  const users = await prisma.user.findMany({
    where,
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      createdAt: true,
      orders: {
        where: { lojaID },
        select: {
          total: true,
          createdAt: true
        }
      }
    }
  })

  const hasMore = users.length > take
  const results = hasMore ? users.slice(0, -1) : users

  const data: CustomerRow[] = results.map(user => {
    const totalOrders = user.orders.length
    const totalSpent = user.orders.reduce(
      (sum, order) => sum + Number(order.total),
      0
    )
    const sortedOrders = [...user.orders].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    const lastOrderAt = sortedOrders[0]?.createdAt.toISOString() || null

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      totalOrders,
      totalSpent: totalSpent,
      lastOrderAt,
      createdAt: user.createdAt.toISOString()
    }
  })

  return {
    data,
    nextCursor: hasMore ? results[results.length - 1].id : null
  }
}

export async function getCustomerProfile(
  params: GetCustomerParams
): Promise<CustomerProfile | null> {
  const { customerId, lojaID } = params

  const user = await prisma.user.findFirst({
    where: {
      id: customerId,
      orders: {
        some: {
          lojaID
        }
      }
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      createdAt: true,
      addresses: {
        select: {
          state: true,
          city: true,
          district: true,
          street: true,
          number: true,
          complement: true
        }
      }
    }
  })

  if (!user) {
    return null
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    createdAt: user.createdAt.toISOString(),
    addresses: user.addresses.map(addr => ({
      state: addr.state,
      city: addr.city,
      neighborhood: addr.district,
      street: addr.street,
      number: addr.number,
      complement: addr.complement
    }))
  }
}

export async function getCustomerMetrics(
  params: GetCustomerParams
): Promise<CustomerMetrics> {
  const { customerId, lojaID } = params

  const [orders, firstOrder] = await Promise.all([
    prisma.order.findMany({
      where: {
        userID: customerId,
        lojaID
      },
      select: {
        total: true,
        deliveryType: true,
        status: true,
        createdAt: true,
        items: {
          select: {
            name: true,
            quantity: true
          }
        }
      }
    }),
    prisma.order.findFirst({
      where: {
        userID: customerId,
        lojaID
      },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true }
    })
  ])

  if (orders.length === 0) {
    throw new Error('Cliente não encontrado.')
  }

  const totalOrders = orders.length
  const totalSpent = orders.reduce(
    (sum, order) => sum + Number(order.total),
    0
  )
  const averageOrderValue = totalSpent / totalOrders

  const sortedOrders = [...orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
  const lastOrderAt = sortedOrders[0]?.createdAt.toISOString() || null
  const firstOrderAt = firstOrder?.createdAt.toISOString() || null

  const productCount: Record<string, number> = {}
  orders.forEach(order => {
    order.items.forEach(item => {
      productCount[item.name] = (productCount[item.name] || 0) + item.quantity
    })
  })
  const mostBoughtProduct =
    Object.entries(productCount).sort((a, b) => b[1] - a[1])[0]?.[0] || null

  const deliveryCount: Record<string, number> = {}
  orders.forEach(order => {
    deliveryCount[order.deliveryType] = (deliveryCount[order.deliveryType] || 0) + 1
  })
  const preferredDeliveryType = (
    Object.entries(deliveryCount).sort((a, b) => b[1] - a[1])[0]?.[0] as
      | 'DELIVERY'
      | 'PICKUP'
      | undefined
  ) || null

  const cancelledOrders = orders.filter(o => o.status === 'CANCELLED').length

  return {
    totalOrders,
    totalSpent,
    averageOrderValue,
    firstOrderAt,
    lastOrderAt,
    mostBoughtProduct,
    preferredDeliveryType,
    cancelledOrders
  }
}