import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InventoryService, InventoryError } from '@/services/inventory.service'
import { updateOrderStatus } from '@/services/order.service'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'

vi.mock('@/lib/prisma', () => {
  return {
    default: {
      $transaction: vi.fn(async (cb) => {
        if (typeof cb === 'function') {
          return await cb(prisma)
        }
        return cb
      }),
      product: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      productVariants: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      order: {
        findUnique: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      loyaltyWallet: {
        findUnique: vi.fn(),
        update: vi.fn(),
        upsert: vi.fn(),
      },
      loyaltyTransaction: {
        create: vi.fn(),
      },
      loja: {
        findUnique: vi.fn(),
      },
    },
  }
})

describe('Ciclo de Vida de Inventário e Autoridade de Estoque (REV-001)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('InventoryService.reserveStock', () => {
    it('deve reservar estoque com sucesso decrementando produto e variante de forma atômica', async () => {
      vi.mocked(prisma.product.update).mockResolvedValueOnce({ id: 'prod-1', stock: 3 } as any)
      vi.mocked(prisma.productVariants.update).mockResolvedValueOnce({ id: 'var-1', stock: 3 } as any)

      await expect(
        InventoryService.reserveStock(
          [{ productId: 'prod-1', variantId: 'var-1', quantity: 2 }],
          prisma as any
        )
      ).resolves.toBeUndefined()

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { stock: { decrement: 2 } },
      })

      expect(prisma.productVariants.update).toHaveBeenCalledWith({
        where: { id: 'var-1' },
        data: { stock: { decrement: 2 } },
      })
    })

    it('deve lançar INVALID_INPUT se o productId não for informado', async () => {
      await expect(
        InventoryService.reserveStock(
          [{ productId: '', variantId: 'var-1', quantity: 2 }],
          prisma as any
        )
      ).rejects.toThrow('productId')
    })
  })

  describe('InventoryService.restoreStock', () => {
    it('deve estornar estoque simetricamente incrementando produto pai e variante', async () => {
      vi.mocked(prisma.product.update).mockResolvedValueOnce({ id: 'prod-1', stock: 5 } as any)
      vi.mocked(prisma.productVariants.update).mockResolvedValueOnce({ id: 'var-1', stock: 5 } as any)

      await InventoryService.restoreStock(
        [{ productId: 'prod-1', variantId: 'var-1', quantity: 2 }],
        prisma as any
      )

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { stock: { increment: 2 } },
      })

      expect(prisma.productVariants.update).toHaveBeenCalledWith({
        where: { id: 'var-1' },
        data: { stock: { increment: 2 } },
      })
    })
  })

  describe('updateOrderStatus (Eliminação do Duplo Decremento e Estorno)', () => {
    it('deve transicionar pedido para PAID sem tentar decrementar estoque novamente (mesmo com estoque pós-reserva = 0)', async () => {
      // Simula o caso crítico: item com 1 unidade que ficou com estoque 0 após o checkout
      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
        id: 'ord-zero-stock',
        status: 'PENDING',
        userID: 'user-1',
        lojaID: 'loja-1',
        subtotal: new Prisma.Decimal('150.00'),
        pointsEarned: 15,
        pointsRedeemed: 0,
        pointsDiscountValue: new Prisma.Decimal('0'),
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            productVariantsId: 'var-1',
            quantity: 1,
          },
        ],
      } as any)

      vi.mocked(prisma.order.update).mockResolvedValueOnce({
        id: 'ord-zero-stock',
        status: 'PAID',
      } as any)

      // Simula loja com pontos desativados para simplificar o teste de status
      vi.mocked(prisma.loja.findUnique).mockResolvedValueOnce({
        id: 'loja-1',
        loyaltyEnabled: false,
        loyaltyEarnRate: new Prisma.Decimal('1'),
        loyaltyPointValue: new Prisma.Decimal('0.05'),
        loyaltyMinPointsRedeem: 100,
        loyaltyMaxDiscountPct: 50,
      } as any)

      const result = await updateOrderStatus({
        orderId: 'ord-zero-stock',
        newStatus: 'PAID',
        performedById: 'ASAAS_GATEWAY',
        lojaID: 'loja-1',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.order?.status).toBe('PAID')
      }

      // Garante que o estoque NÃO foi tocado durante a transição para PAID
      expect(prisma.product.update).not.toHaveBeenCalled()
      expect(prisma.productVariants.update).not.toHaveBeenCalled()
    })

    it('deve estornar estoque quando um pedido PENDING for cancelado', async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
        id: 'ord-pending-cancel',
        status: 'PENDING',
        userID: 'user-1',
        lojaID: 'loja-1',
        subtotal: new Prisma.Decimal('200.00'),
        items: [
          {
            id: 'item-2',
            productId: 'prod-2',
            productVariantsId: 'var-2',
            quantity: 3,
          },
        ],
      } as any)

      vi.mocked(prisma.order.update).mockResolvedValueOnce({
        id: 'ord-pending-cancel',
        status: 'CANCELLED',
      } as any)

      const result = await updateOrderStatus({
        orderId: 'ord-pending-cancel',
        newStatus: 'CANCELLED',
        performedById: 'admin-1',
        lojaID: 'loja-1',
      })

      expect(result.success).toBe(true)

      // Garante que o estoque do produto pai e da variante foi estornado
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-2' },
        data: { stock: { increment: 3 } },
      })
      expect(prisma.productVariants.update).toHaveBeenCalledWith({
        where: { id: 'var-2' },
        data: { stock: { increment: 3 } },
      })
    })

    it('deve estornar estoque quando um pedido PAID for cancelado', async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
        id: 'ord-paid-cancel',
        status: 'PAID',
        userID: 'user-1',
        lojaID: 'loja-1',
        subtotal: new Prisma.Decimal('100.00'),
        items: [
          {
            id: 'item-3',
            productId: 'prod-3',
            productVariantsId: 'var-3',
            quantity: 1,
          },
        ],
      } as any)

      // Na busca interna do refundOrderPoints
      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
        id: 'ord-paid-cancel',
        orderNumber: 1003,
        lojaID: 'loja-1',
        userID: 'user-1',
        loyaltyTransactions: [],
      } as any)

      vi.mocked(prisma.order.update).mockResolvedValueOnce({
        id: 'ord-paid-cancel',
        status: 'CANCELLED',
      } as any)

      const result = await updateOrderStatus({
        orderId: 'ord-paid-cancel',
        newStatus: 'CANCELLED',
        performedById: 'admin-1',
        lojaID: 'loja-1',
      })

      expect(result.success).toBe(true)

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-3' },
        data: { stock: { increment: 1 } },
      })
      expect(prisma.productVariants.update).toHaveBeenCalledWith({
        where: { id: 'var-3' },
        data: { stock: { increment: 1 } },
      })
    })
  })
})
