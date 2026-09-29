import { beforeEach, describe, expect, it, vi } from 'vitest'
import prisma from '@/lib/prisma'
import { updateOrderStatus } from '@/services/order.service'
import { updateOrderStatusBodySchema } from '@/lib/validators/order.validators'
import { getValidTransitions } from '@/lib/order-transitions'

vi.mock('@/lib/prisma', () => ({
  default: {
    order: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    orderStatusHistory: { create: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(async (callback: any) => callback(prisma)),
  },
}))

vi.mock('@/services/loyalty.service', () => ({
  creditEarnedPoints: vi.fn(),
  refundOrderPoints: vi.fn(),
}))

vi.mock('@/services/inventory.service', () => ({
  InventoryService: { restoreStock: vi.fn() },
}))

vi.mock('@/services/dashboard.service', () => ({
  invalidateDashboardCache: vi.fn(),
}))

function storedOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    status: 'PAID',
    userID: 'customer-1',
    lojaID: 'loja-1',
    deliveryType: 'PICKUP',
    subtotal: 100,
    pointsEarned: 0,
    pointsRedeemed: 0,
    pointsDiscountValue: 0,
    items: [],
    ...overrides,
  }
}

describe('Contratos da máquina de estados de pedidos (BE-013 / ARCH-008)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 1 })
  })

  it('permite PAID → DELIVERED para retirada e grava confirmação e histórico', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(storedOrder() as any)

    const result = await updateOrderStatus({
      orderId: 'order-1',
      newStatus: 'DELIVERED',
      performedById: 'customer-1',
      deliveredConfirmedById: 'customer-1',
      expectedUserID: 'customer-1',
      lojaID: 'loja-1',
    })

    expect(result.success).toBe(true)
    expect(prisma.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userID: 'customer-1', status: 'PAID' }),
      data: expect.objectContaining({
        status: 'DELIVERED',
        deliveredConfirmedBy: 'customer-1',
        deliveredConfirmedAt: expect.any(Date),
      }),
    }))
    expect(prisma.orderStatusHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: 'order-1',
        status: 'DELIVERED',
        performedById: 'customer-1',
      }),
    })
  })

  it('rejeita PAID → DELIVERED para entrega normal', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(
      storedOrder({ deliveryType: 'DELIVERY' }) as any
    )

    const result = await updateOrderStatus({
      orderId: 'order-1',
      newStatus: 'DELIVERED',
      performedById: 'admin-1',
      lojaID: 'loja-1',
    })

    expect(result).toMatchObject({ success: false, code: 'INVALID_TRANSITION' })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('persiste rastreio e histórico ao despachar', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(
      storedOrder({ deliveryType: 'DELIVERY' }) as any
    )

    await updateOrderStatus({
      orderId: 'order-1',
      newStatus: 'SHIPPED',
      performedById: 'admin-1',
      lojaID: 'loja-1',
      trackingCode: 'AA123456789BR',
    })

    expect(prisma.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'SHIPPED',
        trackingCode: 'AA123456789BR',
      }),
    }))
    expect(prisma.orderStatusHistory.create).toHaveBeenCalledTimes(1)
  })

  it('usa a mesma lista de transições no domínio e rejeita campos fora do contrato', () => {
    expect(getValidTransitions('PAID', 'PICKUP')).toEqual([
      'SHIPPED',
      'DELIVERED',
      'CANCELLED',
    ])
    expect(updateOrderStatusBodySchema.safeParse({
      newStatus: 'PAID',
      trackingCode: 'não permitido',
      role: 'ADMIN',
    }).success).toBe(false)
  })
})
