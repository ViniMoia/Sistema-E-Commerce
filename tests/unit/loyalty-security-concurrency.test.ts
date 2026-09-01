import { describe, it, expect, vi, beforeEach } from 'vitest'
import { debitRedeemedPoints, simulatePointsRedemption, LoyaltyError } from '@/services/loyalty.service'
import { createOrder } from '@/services/checkout.service'
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
    },
  }
})

describe('Segurança, Concorrência e Isolamento Multi-Tenant do Sistema de Pontos (Fase 6)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.productVariants.findMany).mockResolvedValue([])
  })

  describe('1. Prevenção de Concorrência & Double-Spending', () => {
    it('deve bloquear double-spending em requisições concorrentes de débito com rollback', async () => {
      let currentBalance = 500

      // Simulação de execução concorrente atômica no banco
      ;(prisma.loyaltyWallet.findUnique as any).mockImplementation(async () => {
        return {
          id: 'wal-1',
          lojaID: 'loja-1',
          userID: 'usr-1',
          balance: currentBalance,
          pending: 0,
          lifetimeEarn: 500,
          version: 1,
        }
      })

      ;(prisma.loyaltyWallet.update as any).mockImplementation(async ({ data }: any) => {
        const decrementAmount = data.balance.decrement
        if (currentBalance < decrementAmount) {
          throw new LoyaltyError('INSUFFICIENT_POINTS', 'Saldo insuficiente para resgate.')
        }
        currentBalance -= decrementAmount
        return {
          id: 'wal-1',
          balance: currentBalance,
          version: 2,
        }
      })

      vi.mocked(prisma.loyaltyTransaction.create).mockResolvedValue({
        id: 'tx-1',
      } as any)

      // Primeira requisição: consome 500 pontos
      const req1 = debitRedeemedPoints({
        lojaID: 'loja-1',
        userID: 'usr-1',
        orderId: 'ord-1',
        points: 500,
        monetaryValue: 25.0,
      })

      // Segunda requisição (aba concorrente tentando gastar os mesmos 500 pontos)
      const req2 = debitRedeemedPoints({
        lojaID: 'loja-1',
        userID: 'usr-1',
        orderId: 'ord-2',
        points: 500,
        monetaryValue: 25.0,
      })

      const [res1, res2] = await Promise.allSettled([req1, req2])

      // Assert: Exatamente uma requisição é aprovada e a concorrente é rejeitada
      expect(res1.status).toBe('fulfilled')
      expect(res2.status).toBe('rejected')
      if (res2.status === 'rejected') {
        expect(res2.reason.message).toContain('Saldo insuficiente')
      }
      expect(currentBalance).toBe(0)
    })
  })

  describe('2. Isolamento Multi-Tenant Estrito (Cross-Tenant)', () => {
    const lojaA = 'loja-alpha'
    const lojaB = 'loja-beta'
    const userId = 'usr-comum'

    it('não deve permitir que pontos da Loja A sejam consultados ou resgatados na Loja B', async () => {
      // Configuração das duas lojas
      ;(prisma.loja.findUnique as any).mockImplementation(async ({ where }: any) => {
        if (where.id === lojaA) {
          return {
            id: lojaA,
            name: 'Loja Alpha',
            loyaltyEnabled: true,
            loyaltyEarnRate: new Prisma.Decimal('0.5'),
            loyaltyPointValue: new Prisma.Decimal('0.05'),
            loyaltyMinPointsRedeem: 100,
            loyaltyMaxDiscountPct: new Prisma.Decimal('50.0'),
          }
        }
        if (where.id === lojaB) {
          return {
            id: lojaB,
            name: 'Loja Beta',
            loyaltyEnabled: true,
            loyaltyEarnRate: new Prisma.Decimal('0.5'),
            loyaltyPointValue: new Prisma.Decimal('0.05'),
            loyaltyMinPointsRedeem: 100,
            loyaltyMaxDiscountPct: new Prisma.Decimal('50.0'),
          }
        }
        return null
      })

      // Usuário tem 1000 pontos na Loja A e 0 pontos na Loja B
      ;(prisma.loyaltyWallet.upsert as any).mockImplementation(async ({ where }: any) => {
        if (where.lojaID_userID.lojaID === lojaA) {
          return { id: 'wal-a', lojaID: lojaA, userID: userId, balance: 1000 }
        }
        return { id: 'wal-b', lojaID: lojaB, userID: userId, balance: 0 }
      })

      // Simulação na Loja A: Deve ser elegível
      const simLojaA = await simulatePointsRedemption({
        lojaID: lojaA,
        userID: userId,
        subtotal: 500,
        requestedPoints: 500,
      })
      expect(simLojaA.eligible).toBe(true)
      expect(simLojaA.pointsToRedeem).toBe(500)
      expect(simLojaA.discountValue).toBe(25)

      // Simulação na Loja B com os mesmos pontos: Deve ser rejeitado por saldo insuficiente
      const simLojaB = await simulatePointsRedemption({
        lojaID: lojaB,
        userID: userId,
        subtotal: 500,
        requestedPoints: 500,
      })
      expect(simLojaB.eligible).toBe(false)
      expect(simLojaB.pointsToRedeem).toBe(0)
      expect(simLojaB.reason).toContain('Saldo mínimo')
    })
  })

  describe('3. Invariantes Contábeis & Segurança Financeira', () => {
    it('deve limitar o desconto ao teto máximo percentual configurado pelo lojista', async () => {
      // Loja com teto máximo de 20%
      vi.mocked(prisma.loja.findUnique).mockResolvedValueOnce({
        id: 'loja-1',
        loyaltyEnabled: true,
        loyaltyEarnRate: new Prisma.Decimal('0.5'),
        loyaltyPointValue: new Prisma.Decimal('0.05'),
        loyaltyMinPointsRedeem: 50,
        loyaltyMaxDiscountPct: new Prisma.Decimal('20.0'), // Max 20%
      } as any)

      vi.mocked(prisma.loyaltyWallet.upsert).mockResolvedValueOnce({
        id: 'wal-1',
        balance: 5000, // Cliente tem muitos pontos (R$ 250 em descontos)
      } as any)

      // Subtotal R$ 100,00 -> Teto de 20% é R$ 20,00 (400 pontos)
      const sim = await simulatePointsRedemption({
        lojaID: 'loja-1',
        userID: 'usr-1',
        subtotal: 100,
        requestedPoints: 5000,
      })

      expect(sim.eligible).toBe(true)
      expect(sim.discountValue).toBe(20.0) // Limitado a R$ 20,00
      expect(sim.pointsToRedeem).toBe(400) // Consome apenas 400 pontos
      expect(sim.subtotalAfterDiscount).toBe(80.0)
    })

    it('não deve abater desconto de pontos sobre o valor do frete', async () => {
      vi.mocked(prisma.loja.findUnique).mockResolvedValue({
        id: 'loja-1',
        name: 'Loja Teste',
        loyaltyEnabled: true,
        loyaltyEarnRate: new Prisma.Decimal('0.5'),
        loyaltyPointValue: new Prisma.Decimal('0.05'),
        loyaltyMinPointsRedeem: 50,
        loyaltyMaxDiscountPct: new Prisma.Decimal('100.0'),
        pixKey: 'pix-key',
      } as any)

      // Produto: R$ 50,00
      vi.mocked(prisma.product.findUnique).mockResolvedValueOnce({
        id: 'prod-1',
        name: 'Camisa',
        price: new Prisma.Decimal('50.00'),
        stock: 5,
        lojaID: 'loja-1',
        productVariants: [],
      } as any)

      vi.mocked(prisma.user.upsert).mockResolvedValueOnce({
        id: 'usr-1',
        name: 'Cliente',
        phone: '11999999999',
      } as any)

      vi.mocked(prisma.address.create).mockResolvedValue({
        id: 'addr-1',
      } as any)

      // Frete de R$ 30,00
      vi.mocked(prisma.freightRule.findFirst).mockResolvedValueOnce({
        id: 'fr-1',
        value: new Prisma.Decimal('30.00'),
        cityName: 'São Paulo',
      } as any)

      // Carteira do cliente com 1000 pontos (R$ 50,00)
      vi.mocked(prisma.loyaltyWallet.findUnique).mockResolvedValue({
        id: 'wal-1',
        balance: 1000,
      } as any)
      vi.mocked(prisma.loyaltyWallet.upsert).mockResolvedValue({
        id: 'wal-1',
        balance: 1000,
      } as any)
      vi.mocked(prisma.loyaltyWallet.update).mockResolvedValue({
        id: 'wal-1',
        balance: 0,
      } as any)
      vi.mocked(prisma.loyaltyTransaction.create).mockResolvedValue({
        id: 'tx-1',
      } as any)

      ;(prisma.order.create as any).mockImplementationOnce(async ({ data }: any) => {
        return {
          id: 'ord-10',
          orderNumber: 7001,
          total: data.total,
          subtotal: data.subtotal,
          freightValue: data.freightValue,
          shippingCost: data.shippingCost,
          shippingProvider: data.shippingProvider,
          shippingServiceName: data.shippingServiceName,
          shippingEstimatedDays: 3,
          pixKeyUsed: data.pixKeyUsed,
          pointsEarned: data.pointsEarned,
          pointsRedeemed: data.pointsRedeemed,
          pointsDiscountValue: data.pointsDiscountValue,
          deliveryType: data.deliveryType,
          user: { name: 'Cliente', phone: '11999999999' },
          items: [{ productId: 'prod-1', name: 'Camisa', quantity: 1, price: 50 }],
        }
      })

      // Cliente usa 1000 pontos para zerar o subtotal de R$ 50,00
      const result = await createOrder({
        lojaID: 'loja-1',
        customer: { name: 'Cliente', email: 'c@teste.com', phone: '11999999999', userId: 'usr-1' },
        items: [{ productId: 'prod-1', quantity: 1 }],
        deliveryType: 'DELIVERY',
        address: {
          cep: '01001-000',
          state: 'SP',
          city: 'São Paulo',
          neighborhood: 'Sé',
          street: 'Praça da Sé',
          number: '1',
        },
        shippingCost: 30.0,
        pointsToRedeem: 1000,
      })

      // Subtotal de produtos: 50.00
      // Desconto de fidelidade: -50.00 -> Subtotal após desconto: 0.00
      // Frete: 30.00
      // Total a pagar: R$ 30,00 (frete mantido integralmente)
      expect(result.order.subtotal).toBe(50)
      expect(result.order.pointsDiscountValue).toBe(50)
      expect(result.order.shippingCost).toBe(30)
      expect(result.order.total).toBe(30)
    })
  })
})
