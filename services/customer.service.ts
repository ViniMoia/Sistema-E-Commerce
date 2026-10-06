import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { readCustomerFinancialSummaries } from './customer-financial-metrics.service'
import type { CustomerFinancialSummary } from '@/lib/commerce/customer-metrics-contract'
import { findMostBoughtProduct, calculatePreferredDelivery } from '@/lib/utils/customer-metrics'
import { cleanDigits, validateCpfCnpj } from '@/lib/validators/cpf-cnpj'

export interface ListCustomersParams {
  lojaID: string
  search?: string
  cursor?: string
  limit?: number
}

export interface CustomerRow extends CustomerFinancialSummary {
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

export interface CustomerMetrics extends CustomerFinancialSummary {
  mostBoughtProduct: string | null
  preferredDeliveryType: 'DELIVERY' | 'PICKUP' | 'NONE' | null
}

export interface GetCustomerParams {
  customerId: string
  lojaID: string
}

export async function listCustomers(
  params: ListCustomersParams
): Promise<{ data: CustomerRow[]; nextCursor: string | null }> {
  const { lojaID, search, cursor, limit = 20 } = params
  if (!lojaID) throw new Error('ACCOUNT_ACCESS_DENIED')
  const take = Math.max(1, Math.min(limit, 100))
  return prisma.$transaction(async tx => {
    if (cursor && !await tx.user.findFirst({ where: { id: cursor, lojaID }, select: { id: true } })) throw new Error('CUSTOMER_CURSOR_INVALID')
    const users = await tx.user.findMany({
      where: { lojaID, orders: { some: { lojaID } }, ...(search ? { OR: [
        { name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } },
        { cpfCnpj: { contains: search, mode: 'insensitive' } },
      ] } : {}) },
      take: take + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true, name: true, email: true, phone: true, cpfCnpj: true, createdAt: true },
    })
    const hasMore = users.length > take
    const results = users.slice(0, take)
    const summaries = await readCustomerFinancialSummaries(tx, lojaID, results.map(user => user.id))
    const data: CustomerRow[] = results.map(user => {
      const financial = summaries.get(user.id)
      if (!financial) throw new Error('CUSTOMER_METRICS_MISSING')
      const { recognizedActiveOrderIds: _ids, ...summary } = financial
      return { ...user, ...summary, createdAt: user.createdAt.toISOString() }
    })
    return { data, nextCursor: hasMore ? results[results.length - 1].id : null }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })
}

export async function getCustomerProfile(
  paramsOrId: GetCustomerParams | string,
  lojaIDParam?: string
): Promise<CustomerProfile | null> {
  const customerId = typeof paramsOrId === 'string' ? paramsOrId : paramsOrId.customerId
  const lojaID = typeof paramsOrId === 'string' ? lojaIDParam : paramsOrId.lojaID

  if (!lojaID) throw new Error('ACCOUNT_ACCESS_DENIED')
  const where: Prisma.UserWhereInput = { id: customerId, lojaID }

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
  if (!lojaID) throw new Error('ACCOUNT_ACCESS_DENIED')
  return prisma.$transaction(async tx => {
    const user = await tx.user.findFirst({ where: { id: customerId, lojaID }, select: { id: true } })
    if (!user) throw new Error('Cliente não encontrado.')
    const financial = (await readCustomerFinancialSummaries(tx, lojaID, [user.id], true)).get(user.id)
    if (!financial) throw new Error('CUSTOMER_METRICS_MISSING')
    const { recognizedActiveOrderIds, ...summary } = financial
    const purchases = recognizedActiveOrderIds.length ? await tx.order.findMany({
      where: { id: { in: recognizedActiveOrderIds }, userID: user.id, lojaID },
      select: { deliveryType: true, items: { select: { name: true, quantity: true } } },
    }) : []
    return { ...summary, mostBoughtProduct: findMostBoughtProduct(purchases),
      preferredDeliveryType: calculatePreferredDelivery(purchases) }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })
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

