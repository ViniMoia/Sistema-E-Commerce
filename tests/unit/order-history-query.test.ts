import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { getUserOrderHistory, getUserOrderHistoryPage } from '@/services/order.service'
import { orderHistoryHref, parseOrderHistoryPage } from '@/lib/order-history-pagination'

vi.mock('@/lib/prisma', () => ({
  default: {
    order: { findMany: vi.fn(), count: vi.fn() },
  },
}))

vi.mock('@/services/loyalty.service', () => ({
  creditEarnedPoints: vi.fn(),
  refundOrderPoints: vi.fn(),
}))
vi.mock('@/services/inventory.service', () => ({ InventoryService: {} }))
vi.mock('@/services/dashboard.service', () => ({ invalidateDashboardCache: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

describe('projeção canônica do histórico de pedidos (ARCH-010)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('preserva tenant, paginação e conversão Decimal do DTO da UI', async () => {
    const createdAt = new Date('2026-09-27T12:00:00Z')
    vi.mocked(prisma.order.findMany).mockResolvedValueOnce([{
      id: 'order-1',
      orderNumber: 42,
      status: 'SHIPPED',
      total: new Prisma.Decimal('109.90'),
      createdAt,
      trackingCode: 'AA123BR',
      deliveryType: 'DELIVERY',
      shippingServiceName: 'Teste',
      deliveredConfirmedAt: null,
      items: [{
        name: 'Produto',
        price: new Prisma.Decimal('54.95'),
        quantity: 2,
        color: 'Preto',
        size: 'U',
        product: { imageUrl: '/produto.png' },
      }],
    }] as any)

    const result = await getUserOrderHistory('user-a', 10, 20, 'loja-a')

    expect(prisma.order.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userID: 'user-a', lojaID: 'loja-a' },
      take: 10,
      skip: 20,
    }))
    expect(result).toEqual([expect.objectContaining({
      id: 'order-1',
      total: 109.9,
      createdAt,
      items: [expect.objectContaining({ price: 54.95, imageUrl: '/produto.png' })],
    })])
  })

  it('propaga indisponibilidade em vez de representar falha como histórico vazio', async () => {
    vi.mocked(prisma.order.findMany).mockRejectedValueOnce(new Error('database unavailable'))

    await expect(getUserOrderHistory('user-a', 10, 0, 'loja-a'))
      .rejects.toThrow('ORDER_HISTORY_UNAVAILABLE')
  })

  it('expõe total e torna o décimo primeiro pedido alcançável por URL', async () => {
    vi.mocked(prisma.order.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.order.count).mockResolvedValueOnce(11)

    const result = await getUserOrderHistoryPage('user-a', 2, 10, 'loja-a')

    expect(prisma.order.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10, skip: 10 }))
    expect(prisma.order.count).toHaveBeenCalledWith({ where: { userID: 'user-a', lojaID: 'loja-a' } })
    expect(result).toMatchObject({ total: 11, page: 2, pageSize: 10, totalPages: 2 })
    expect(orderHistoryHref(2)).toBe('/profile?ordersPage=2#pedidos')
  })

  it.each([
    [undefined, 1],
    ['0', 1],
    ['-1', 1],
    ['abc', 1],
    ['2', 2],
    [['3', '4'], 3],
  ])('normaliza página %j para %i', (value, expected) => {
    expect(parseOrderHistoryPage(value as string | string[] | undefined)).toBe(expected)
  })

  it('limita URL além da última página sem produzir um vazio sem retorno', async () => {
    vi.mocked(prisma.order.count).mockResolvedValueOnce(11)
    vi.mocked(prisma.order.findMany).mockResolvedValueOnce([])

    const result = await getUserOrderHistoryPage('user-a', 99, 10, 'loja-a')

    expect(result.page).toBe(2)
    expect(prisma.order.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10 }))
  })
})
