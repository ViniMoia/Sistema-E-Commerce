import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DeliveryType, OrderStatus, Prisma } from '@prisma/client'

vi.mock('@/lib/prisma', () => ({
  default: {
    order: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    orderItem: {
      groupBy: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}))

import prisma from '@/lib/prisma'
import { getCustomerMetrics, listCustomers } from '@/services/customer.service'

describe('PERF-007: métricas agregadas de clientes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calcula o perfil em duas consultas agregadas sem materializar pedidos ou itens', async () => {
    ;(prisma.order.groupBy as any).mockResolvedValueOnce([
      {
        deliveryType: DeliveryType.DELIVERY,
        status: OrderStatus.PAID,
        _count: { _all: 3 },
        _sum: { total: new Prisma.Decimal('360.00') },
        _min: { createdAt: new Date('2026-01-02T10:00:00.000Z') },
        _max: { createdAt: new Date('2026-03-02T10:00:00.000Z') },
      },
      {
        deliveryType: DeliveryType.PICKUP,
        status: OrderStatus.CANCELLED,
        _count: { _all: 1 },
        _sum: { total: new Prisma.Decimal('40.00') },
        _min: { createdAt: new Date('2026-02-02T10:00:00.000Z') },
        _max: { createdAt: new Date('2026-02-02T10:00:00.000Z') },
      },
    ] as never)
    ;(prisma.orderItem.groupBy as any).mockResolvedValueOnce([
      { name: 'Produto recorrente', _sum: { quantity: 8 } },
    ] as never)

    const result = await getCustomerMetrics({ customerId: 'customer-a', lojaID: 'store-a' })

    expect(result).toEqual({
      totalOrders: 4,
      totalSpent: 400,
      averageOrderValue: 100,
      firstOrderAt: '2026-01-02T10:00:00.000Z',
      lastOrderAt: '2026-03-02T10:00:00.000Z',
      mostBoughtProduct: 'Produto recorrente',
      preferredDeliveryType: DeliveryType.DELIVERY,
      cancelledOrders: 1,
    })
    expect(prisma.order.groupBy).toHaveBeenCalledTimes(1)
    expect(prisma.orderItem.groupBy).toHaveBeenCalledTimes(1)
    expect(prisma.order.findMany).not.toHaveBeenCalled()
    expect(prisma.order.findFirst).not.toHaveBeenCalled()
  })

  it('lista uma página com uma agregação restrita aos IDs retornados', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
      {
        id: 'customer-a',
        name: 'Cliente A',
        email: 'a@example.test',
        phone: null,
        cpfCnpj: null,
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
      },
    ] as never)
    ;(prisma.order.groupBy as any).mockResolvedValueOnce([
      {
        userID: 'customer-a',
        _count: { _all: 1000 },
        _sum: { total: new Prisma.Decimal('12345.67') },
        _max: { createdAt: new Date('2026-09-01T00:00:00.000Z') },
      },
    ] as never)

    const result = await listCustomers({ lojaID: 'store-a', limit: 20 })

    expect(result.data[0]).toMatchObject({
      id: 'customer-a',
      totalOrders: 1000,
      totalSpent: 12345.67,
      lastOrderAt: '2026-09-01T00:00:00.000Z',
    })
    expect(prisma.order.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: { lojaID: 'store-a', userID: { in: ['customer-a'] } },
    }))
  })
})
