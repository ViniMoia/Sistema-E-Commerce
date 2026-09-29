import { beforeEach, describe, expect, it, vi } from 'vitest'
import prisma from '@/lib/prisma'
import { updateOrderNotes, updateOrderTracking } from '@/services/order.service'

vi.mock('@/lib/prisma', () => ({
  default: {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(async (callback: any) => callback(prisma)),
  },
}))

describe('auditoria de mutacoes administrativas do pedido (ADM-008)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('atualiza notas da propria loja e audita somente metadados redigidos', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
      id: 'order-1',
      lojaID: 'loja-1',
      userID: 'customer-1',
      adminNotes: 'nota anterior confidencial',
    } as any)
    vi.mocked(prisma.order.update).mockResolvedValueOnce({ id: 'order-1' } as any)

    const result = await updateOrderNotes({
      orderId: 'order-1',
      lojaID: 'loja-1',
      actorId: 'admin-1',
      adminNotes: 'nova nota confidencial',
      ipAddress: '127.0.0.1',
    })

    expect(result).toEqual({ id: 'order-1' })
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { adminNotes: 'nova nota confidencial' },
    })
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'ORDER_ADMIN_NOTES_UPDATED',
        actorId: 'admin-1',
        targetId: 'customer-1',
        previousValue: { present: true, length: 26 },
        newValue: { present: true, length: 22 },
        metadata: { lojaID: 'loja-1', contentRedacted: true },
      }),
    })
    expect(JSON.stringify(vi.mocked(prisma.auditLog.create).mock.calls)).not.toContain('confidencial')
  })

  it('nega rastreio de outra loja sem atualizacao nem auditoria parcial', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
      id: 'order-2',
      lojaID: 'loja-b',
      userID: 'customer-2',
      trackingCode: null,
    } as any)

    const result = await updateOrderTracking({
      orderId: 'order-2',
      lojaID: 'loja-a',
      actorId: 'admin-a',
      trackingCode: 'AA123456789BR',
    })

    expect(result).toBeNull()
    expect(prisma.order.update).not.toHaveBeenCalled()
    expect(prisma.auditLog.create).not.toHaveBeenCalled()
  })

  it('persiste rastreio e auditoria na mesma transacao', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
      id: 'order-3',
      lojaID: 'loja-1',
      userID: 'customer-3',
      trackingCode: null,
    } as any)
    vi.mocked(prisma.order.update).mockResolvedValueOnce({ id: 'order-3' } as any)

    await updateOrderTracking({
      orderId: 'order-3',
      lojaID: 'loja-1',
      actorId: 'admin-1',
      trackingCode: 'AA123456789BR',
    })

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'ORDER_TRACKING_UPDATED',
        previousValue: { trackingCode: null },
        newValue: { trackingCode: 'AA123456789BR' },
      }),
    })
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
  })
})
