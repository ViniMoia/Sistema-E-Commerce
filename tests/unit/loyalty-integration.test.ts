import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createOrder } from '@/services/checkout.service'
import { updateOrderStatus } from '@/services/order.service'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'

vi.mock('@/lib/prisma', () => {
  return {
    default: {
      $transaction: vi.fn((cb) => (typeof cb === 'function' ? cb(prisma) : cb)),
      loja: {
        findUnique: vi.fn(),
      },
      product: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      productVariants: {
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
      },
      freightRule: {
        findFirst: vi.fn(),
      },
      user: {
        upsert: vi.fn(),
      },
      address: {
        create: vi.fn(),
      },
      order: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      loyaltyWallet: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        update: vi.fn(),
      },
      loyaltyTransaction: {
        create: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
    },
  }
})

describe('Integração Transacional de Fidelidade (Checkout & Order FSM)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.productVariants.findMany).mockResolvedValue([])
  })

  describe('Checkout com Resgate de Pontos', () => {
    it('deve aplicar desconto de pontos no subtotal e gravar auditoria no pedido', async () => {
      // Loja com fidelidade ativa: 1 pt = R$ 0,05, earnRate = 0.5, min 100 pts
      vi.mocked(prisma.loja.findUnique).mockResolvedValue({
        id: 'loja-1',
        name: 'Loja Teste',
        loyaltyEnabled: true,
        loyaltyEarnRate: new Prisma.Decimal('0.5'),
        loyaltyPointValue: new Prisma.Decimal('0.05'),
        loyaltyMinPointsRedeem: 100,
        loyaltyMaxDiscountPct: new Prisma.Decimal('50.0'),
        loyaltyPointsExpiryDays: 365,
        pixKey: 'minha-chave',
      } as any)

      // Produto: R$ 1000,00
      vi.mocked(prisma.product.findUnique).mockResolvedValueOnce({
        id: 'prod-1',
        name: 'Smartphone Pro',
        price: new Prisma.Decimal('1000.00'),
        stock: 5,
        lojaID: 'loja-1',
        productVariants: [],
      } as any)

      // Usuário
      vi.mocked(prisma.user.upsert).mockResolvedValueOnce({
        id: 'user-1',
        name: 'Cliente VIP',
        phone: '11999999999',
      } as any)

      // Carteira do cliente com 500 pontos
      vi.mocked(prisma.loyaltyWallet.findUnique).mockResolvedValue({
        id: 'wallet-1',
        lojaID: 'loja-1',
        userID: 'user-1',
        balance: 500,
        pending: 0,
        lifetimeEarn: 500,
        version: 1,
      } as any)

      vi.mocked(prisma.loyaltyWallet.upsert).mockResolvedValue({
        id: 'wallet-1',
        lojaID: 'loja-1',
        userID: 'user-1',
        balance: 500,
        pending: 0,
        lifetimeEarn: 500,
        version: 1,
      } as any)

      vi.mocked(prisma.loyaltyWallet.update).mockResolvedValue({
        id: 'wallet-1',
        balance: 0,
        version: 2,
      } as any)

      vi.mocked(prisma.loyaltyTransaction.create).mockResolvedValue({
        id: 'tx-loyalty-1',
      } as any)

      ;(prisma.order.create as any).mockImplementationOnce(async ({ data }: any) => {
        return {
          id: 'ord-100',
          orderNumber: 5001,
          total: data.total,
          subtotal: data.subtotal,
          freightValue: data.freightValue,
          shippingCost: data.shippingCost,
          shippingProvider: data.shippingProvider,
          shippingServiceName: data.shippingServiceName,
          shippingEstimatedDays: data.shippingEstimatedDays,
          pixKeyUsed: data.pixKeyUsed,
          pointsEarned: data.pointsEarned,
          pointsRedeemed: data.pointsRedeemed,
          pointsDiscountValue: data.pointsDiscountValue,
          deliveryType: data.deliveryType,
          user: { name: 'Cliente VIP', phone: '11999999999' },
          items: [
            { productId: 'prod-1', name: 'Smartphone Pro', quantity: 1, price: 1000 },
          ],
        }
      })

      const result = await createOrder({
        lojaID: 'loja-1',
        customer: {
          name: 'Cliente VIP',
          email: 'vip@teste.com',
          phone: '11999999999',
          userId: 'user-1',
        },
        items: [{ productId: 'prod-1', quantity: 1 }],
        deliveryType: 'PICKUP',
        pointsToRedeem: 500, // 500 pts * 0.05 = R$ 25,00 de desconto
      })

      // Subtotal: 1000.00
      // Desconto de fidelidade: 25.00
      // Total a pagar: 975.00
      expect(result.order.subtotal).toBe(1000)
      expect(result.order.pointsRedeemed).toBe(500)
      expect(result.order.pointsDiscountValue).toBe(25)
      expect(result.order.total).toBe(975)
      // Projeção de pontos a ganhar sobre o subtotal restante (975 * 0.5 = 487 pts)
      expect(result.order.pointsEarned).toBe(487)

      // Garante que debitou da carteira no Ledger
      expect(prisma.loyaltyTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'REDEEM',
            points: -500,
            monetaryValue: expect.any(Object),
          }),
        })
      )
    })

    it('deve rejeitar resgate se a loja estiver com o programa de fidelidade desativado', async () => {
      vi.mocked(prisma.loja.findUnique).mockResolvedValue({
        id: 'loja-2',
        name: 'Loja Sem Fidelidade',
        loyaltyEnabled: false,
      } as any)

      vi.mocked(prisma.product.findUnique).mockResolvedValueOnce({
        id: 'prod-2',
        name: 'Item X',
        price: new Prisma.Decimal('100.00'),
        stock: 5,
        lojaID: 'loja-2',
        productVariants: [],
      } as any)

      vi.mocked(prisma.user.upsert).mockResolvedValueOnce({
        id: 'user-2',
        name: 'Cliente',
        phone: '11999999999',
      } as any)

      await expect(
        createOrder({
          lojaID: 'loja-2',
          customer: { name: 'Cliente', email: 'c@teste.com', phone: '11999999999' },
          items: [{ productId: 'prod-2', quantity: 1 }],
          deliveryType: 'PICKUP',
          pointsToRedeem: 100,
        })
      ).rejects.toThrow('desativado')
    })
  })

  describe('FSM de Pedidos: Crédito e Estorno de Pontos', () => {
    it('deve creditar pontos na carteira quando o pedido transitar para PAID', async () => {
      // Pedido PENDING na loja-1, subtotal R$ 1.000,00
      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
        id: 'ord-101',
        status: 'PENDING',
        userID: 'user-1',
        lojaID: 'loja-1',
        subtotal: new Prisma.Decimal('1000.00'),
        pointsEarned: 500,
        pointsRedeemed: 0,
        items: [],
      } as any)

      vi.mocked(prisma.loja.findUnique).mockResolvedValue({
        id: 'loja-1',
        loyaltyEnabled: true,
        loyaltyEarnRate: new Prisma.Decimal('0.5'),
        loyaltyPointValue: new Prisma.Decimal('0.05'),
        loyaltyMinPointsRedeem: 100,
        loyaltyMaxDiscountPct: new Prisma.Decimal('50.0'),
        loyaltyPointsExpiryDays: 365,
      } as any)

      vi.mocked(prisma.loyaltyWallet.upsert).mockResolvedValue({
        id: 'wallet-1',
        balance: 500,
        pending: 0,
        lifetimeEarn: 500,
        version: 1,
      } as any)

      vi.mocked(prisma.order.update).mockResolvedValueOnce({
        id: 'ord-101',
        status: 'PAID',
      } as any)

      const result = await updateOrderStatus({
        orderId: 'ord-101',
        newStatus: 'PAID',
        performedById: 'admin-1',
        lojaID: 'loja-1',
      })

      expect(result.success).toBe(true)
      expect(prisma.loyaltyTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'EARN',
            points: 500,
          }),
        })
      )
    })

    it('deve estornar pontos no cancelamento de pedido PAID', async () => {
      // Pedido pago que acumulou 500 pontos
      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
        id: 'ord-102',
        status: 'PAID',
        userID: 'user-1',
        lojaID: 'loja-1',
        subtotal: new Prisma.Decimal('1000.00'),
        items: [],
      } as any)

      // Na busca interna do refundOrderPoints
      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
        id: 'ord-102',
        orderNumber: 1002,
        lojaID: 'loja-1',
        userID: 'user-1',
        loyaltyTransactions: [
          {
            type: 'EARN',
            points: 500,
            monetaryValue: new Prisma.Decimal('25.00'),
          },
        ],
      } as any)

      vi.mocked(prisma.loyaltyWallet.update).mockResolvedValue({
        id: 'wallet-1',
        balance: 0,
        version: 2,
      } as any)

      vi.mocked(prisma.order.update).mockResolvedValueOnce({
        id: 'ord-102',
        status: 'CANCELLED',
      } as any)

      const result = await updateOrderStatus({
        orderId: 'ord-102',
        newStatus: 'CANCELLED',
        performedById: 'admin-1',
        lojaID: 'loja-1',
      })

      expect(result.success).toBe(true)
      expect(prisma.loyaltyTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'REFUND_EARN',
            points: -500,
          }),
        })
      )
    })
  })
})
