import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { cleanDigits, validateCpfCnpj } from '@/lib/validators/cpf-cnpj'

export interface ListCustomersParams {
  lojaID: string
  search?: string
  cursor?: string
  limit?: number
}

export interface CustomerRow {
  id: string
  name: string
  email: string
  phone: string | null
  cpfCnpj: string | null
  totalOrders: number
  totalSpent: number
  lastOrderAt: string | null
  createdAt: string
}

export interface CustomerProfile {
  id: string
  name: string
  email: string
  phone: string | null
  cpfCnpj: string | null
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

export interface CustomerMetrics {
  totalOrders: number
  totalSpent: number
  averageOrderValue: number
  firstOrderAt: string | null
  lastOrderAt: string | null
  mostBoughtProduct: string | null
  preferredDeliveryType: 'DELIVERY' | 'PICKUP' | null
  cancelledOrders: number
}

export interface GetCustomerParams {
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
            { email: { contains: search, mode: 'insensitive' } },
            { cpfCnpj: { contains: search, mode: 'insensitive' } }
          ]
        }
      : {})
  }

  const users = await prisma.user.findMany({
    where,
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      cpfCnpj: true,
      createdAt: true
    }
  })

  const hasMore = users.length > take
  const results = hasMore ? users.slice(0, -1) : users
  const orderMetrics = results.length > 0
    ? await prisma.order.groupBy({
        by: ['userID'],
        where: {
          lojaID,
          userID: { in: results.map(user => user.id) }
        },
        _count: { _all: true },
        _sum: { total: true },
        _max: { createdAt: true }
      })
    : []
  const metricsByUserId = new Map(orderMetrics.map(metric => [metric.userID, metric]))

  const data: CustomerRow[] = results.map(user => {
    const metrics = metricsByUserId.get(user.id)
    const totalOrders = metrics?._count._all ?? 0
    const totalSpent = Number(metrics?._sum.total ?? 0)
    const lastOrderAt = metrics?._max.createdAt?.toISOString() ?? null

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      cpfCnpj: user.cpfCnpj,
      totalOrders,
      totalSpent,
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
  paramsOrId: GetCustomerParams | string,
  lojaIDParam?: string
): Promise<CustomerProfile | null> {
  const customerId = typeof paramsOrId === 'string' ? paramsOrId : paramsOrId.customerId
  const lojaID = typeof paramsOrId === 'string' ? lojaIDParam : paramsOrId.lojaID

  const where: Prisma.UserWhereInput = {
    id: customerId,
    ...(lojaID
      ? {
          orders: {
            some: {
              lojaID
            }
          }
        }
      : {})
  }

  const user = await prisma.user.findFirst({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      cpfCnpj: true,
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
    cpfCnpj: user.cpfCnpj,
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

  const [orderGroups, mostBoughtProducts] = await Promise.all([
    prisma.order.groupBy({
      where: {
        userID: customerId,
        lojaID
      },
      by: ['deliveryType', 'status'],
      _count: { _all: true },
      _sum: { total: true },
      _min: { createdAt: true },
      _max: { createdAt: true }
    }),
    prisma.orderItem.groupBy({
      by: ['name'],
      where: {
        order: {
          userID: customerId,
          lojaID
        }
      },
      _sum: { quantity: true },
      orderBy: [
        { _sum: { quantity: 'desc' } },
        { name: 'asc' }
      ],
      take: 1
    })
  ])

  if (orderGroups.length === 0) {
    throw new Error('Cliente não encontrado.')
  }

  const totalOrders = orderGroups.reduce((sum, group) => sum + group._count._all, 0)
  const totalSpent = orderGroups.reduce((sum, group) => sum + Number(group._sum.total ?? 0), 0)
  const averageOrderValue = totalSpent / totalOrders

  const createdDates = orderGroups.flatMap(group => [group._min.createdAt, group._max.createdAt])
    .filter((value): value is Date => value !== null)
  const firstOrderAt = createdDates.length > 0
    ? new Date(Math.min(...createdDates.map(date => date.getTime()))).toISOString()
    : null
  const lastOrderAt = createdDates.length > 0
    ? new Date(Math.max(...createdDates.map(date => date.getTime()))).toISOString()
    : null
  const mostBoughtProduct = mostBoughtProducts[0]?.name ?? null

  const deliveryCount: Record<string, number> = {}
  orderGroups.forEach(group => {
    deliveryCount[group.deliveryType] = (deliveryCount[group.deliveryType] || 0) + group._count._all
  })
  const preferredDeliveryType = (
    Object.entries(deliveryCount).sort((a, b) => b[1] - a[1])[0]?.[0] as
      | 'DELIVERY'
      | 'PICKUP'
      | undefined
  ) || null

  const cancelledOrders = orderGroups
    .filter(group => group.status === 'CANCELLED')
    .reduce((sum, group) => sum + group._count._all, 0)

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

export interface UpdateUserProfileParams {
  userId: string
  lojaID: string
  name: string
  phone?: string | null
  cpfCnpj?: string | null
}

export async function updateUserProfile(params: UpdateUserProfileParams) {
  const { userId, lojaID, name, phone, cpfCnpj } = params

  // 1. Verificar existência do usuário com isolamento multi-tenant
  const existingUser = await prisma.user.findFirst({
    where: { id: userId, lojaID },
    select: { id: true, cpfCnpj: true },
  })

  if (!existingUser) {
    throw new Error('USER_NOT_FOUND')
  }

  // 2. Se houver CPF/CNPJ fornecido, limpar dígitos e verificar unicidade no tenant
  let cleanCpf: string | null | undefined = undefined
  if (cpfCnpj !== undefined) {
    cleanCpf = cpfCnpj ? cleanDigits(cpfCnpj) : null
    if (cleanCpf && cleanCpf !== existingUser.cpfCnpj) {
      if (!validateCpfCnpj(cleanCpf)) {
        throw new Error('INVALID_CPF_CNPJ')
      }

      const conflict = await prisma.user.findFirst({
        where: {
          lojaID,
          cpfCnpj: cleanCpf,
          id: { not: userId },
        },
      })

      if (conflict) {
        throw new Error('CPF_ALREADY_IN_USE')
      }
    }
  }

  // 3. Atualizar dados cadastrais
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      name: name.trim(),
      ...(phone !== undefined ? { phone: phone ? phone.trim() : null } : {}),
      ...(cleanCpf !== undefined ? { cpfCnpj: cleanCpf } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      cpfCnpj: true,
      role: true,
      status: true,
      avatarImageUrl: true,
      lojaID: true,
      createdAt: true,
      updatedAt: true,
      defaultAddressId: true,
    },
  })

  return updatedUser
}

