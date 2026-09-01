import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET as getWalletRoute } from '@/app/api/loyalty/wallet/route'
import { POST as simulateRoute } from '@/app/api/loyalty/simulate/route'
import { GET as getAdminConfigRoute, PUT as putAdminConfigRoute } from '@/app/api/admin/loyalty/config/route'
import { POST as adjustAdminRoute } from '@/app/api/admin/loyalty/adjust/route'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { Prisma } from '@prisma/client'

vi.mock('@/lib/prisma', () => {
  return {
    default: {
      $transaction: vi.fn((cb) => (typeof cb === 'function' ? cb(prisma) : cb)),
      loja: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      loyaltyWallet: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        update: vi.fn(),
      },
      loyaltyTransaction: {
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
      },
    },
  }
})

vi.mock('@/lib/session', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockReturnValue(null),
}))

describe('Route Handlers de Fidelidade (APIs & Guards)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/loyalty/wallet', () => {
    it('deve retornar 401 se usuário não estiver autenticado', async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce(null)

      const req = new Request('http://localhost/api/loyalty/wallet')
      const res = await getWalletRoute(req)
      expect(res.status).toBe(401)
    })

    it('deve retornar extrato e saldo consolidado para usuário autenticado', async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({
        id: 'usr-1',
        name: 'Cliente VIP',
        email: 'vip@teste.com',
        role: 'CUSTOMER',
        status: 'ACTIVE',
        lojaID: 'loja-1',
      } as any)

      vi.mocked(prisma.loja.findUnique).mockResolvedValueOnce({
        id: 'loja-1',
        loyaltyEnabled: true,
        loyaltyEarnRate: new Prisma.Decimal('0.5'),
        loyaltyPointValue: new Prisma.Decimal('0.05'),
        loyaltyMinPointsRedeem: 100,
        loyaltyMaxDiscountPct: new Prisma.Decimal('50.0'),
        loyaltyPointsExpiryDays: 365,
      } as any)

      vi.mocked(prisma.loyaltyWallet.upsert).mockResolvedValueOnce({
        id: 'wal-1',
        lojaID: 'loja-1',
        userID: 'usr-1',
        balance: 300,
        pending: 50,
        lifetimeEarn: 400,
        version: 1,
      } as any)

      vi.mocked(prisma.loyaltyTransaction.findMany).mockResolvedValueOnce([
        {
          id: 'tx-1',
          type: 'EARN',
          points: 300,
          balanceAfter: 300,
          monetaryValue: new Prisma.Decimal('15.00'),
          description: 'Compra #1001',
          orderId: 'ord-1',
          createdAt: new Date(),
          expiresAt: null,
        } as any,
      ])
      vi.mocked(prisma.loyaltyTransaction.count).mockResolvedValueOnce(1)

      const req = new Request('http://localhost/api/loyalty/wallet?page=1&limit=10')
      const res = await getWalletRoute(req)
      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.wallet.balance).toBe(300)
      expect(json.data.wallet.monetaryBalance).toBe(15)
      expect(json.data.items).toHaveLength(1)
    })
  })

  describe('POST /api/loyalty/simulate', () => {
    it('deve simular resgate e retornar projeção de desconto', async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce(null)

      vi.mocked(prisma.loja.findUnique).mockResolvedValueOnce({
        id: 'loja-1',
        loyaltyEnabled: true,
        loyaltyEarnRate: new Prisma.Decimal('0.5'),
        loyaltyPointValue: new Prisma.Decimal('0.05'),
        loyaltyMinPointsRedeem: 100,
        loyaltyMaxDiscountPct: new Prisma.Decimal('50.0'),
        loyaltyPointsExpiryDays: 365,
      } as any)

      const req = new Request('http://localhost/api/loyalty/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lojaID: 'loja-1',
          subtotal: 500,
          requestedPoints: 200,
        }),
      })

      const res = await simulateRoute(req)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.eligible).toBe(true)
      expect(json.data.pointsToRedeem).toBe(200)
      expect(json.data.discountValue).toBe(10) // 200 * 0.05 = R$ 10,00
      expect(json.data.subtotalAfterDiscount).toBe(490)
    })
  })

  describe('GET & PUT /api/admin/loyalty/config', () => {
    it('deve barrar acesso de cliente comum (403)', async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({
        id: 'usr-1',
        role: 'CUSTOMER',
        status: 'ACTIVE',
        lojaID: 'loja-1',
      } as any)

      const req = new Request('http://localhost/api/admin/loyalty/config')
      const res = await getAdminConfigRoute(req)
      expect(res.status).toBe(403)
    })

    it('deve atualizar parâmetros com sucesso para usuário ADMIN', async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({
        id: 'adm-1',
        role: 'ADMIN',
        status: 'ACTIVE',
        lojaID: 'loja-1',
      } as any)

      vi.mocked(prisma.loja.update).mockResolvedValueOnce({
        loyaltyEnabled: true,
        loyaltyEarnRate: new Prisma.Decimal('0.8'),
        loyaltyPointValue: new Prisma.Decimal('0.06'),
        loyaltyMinPointsRedeem: 150,
        loyaltyMaxDiscountPct: new Prisma.Decimal('40.0'),
        loyaltyPointsExpiryDays: 180,
      } as any)

      const req = new Request('http://localhost/api/admin/loyalty/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loyaltyEnabled: true,
          loyaltyEarnRate: 0.8,
          loyaltyPointValue: 0.06,
          loyaltyMinPointsRedeem: 150,
          loyaltyMaxDiscountPct: 40.0,
          loyaltyPointsExpiryDays: 180,
        }),
      })

      const res = await putAdminConfigRoute(req)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.loyaltyEarnRate).toBe(0.8)
      expect(json.data.loyaltyPointValue).toBe(0.06)
    })
  })

  describe('POST /api/admin/loyalty/adjust', () => {
    it('deve processar ajuste manual auditado', async () => {
      vi.mocked(getCurrentUser).mockResolvedValueOnce({
        id: 'adm-1',
        role: 'ADMIN',
        status: 'ACTIVE',
        lojaID: 'loja-1',
      } as any)

      vi.mocked(prisma.loja.findUnique).mockResolvedValueOnce({
        id: 'loja-1',
        loyaltyPointValue: new Prisma.Decimal('0.05'),
        loyaltyEarnRate: new Prisma.Decimal('0.5'),
        loyaltyMinPointsRedeem: 100,
        loyaltyMaxDiscountPct: new Prisma.Decimal('50.0'),
        loyaltyEnabled: true,
      } as any)

      vi.mocked(prisma.loyaltyWallet.upsert).mockResolvedValueOnce({
        id: 'wal-1',
        balance: 100,
        version: 1,
      } as any)

      vi.mocked(prisma.loyaltyWallet.update).mockResolvedValueOnce({
        id: 'wal-1',
        balance: 200,
        version: 2,
      } as any)

      vi.mocked(prisma.loyaltyTransaction.create).mockResolvedValueOnce({
        id: 'tx-adj-1',
      } as any)

      const req = new Request('http://localhost/api/admin/loyalty/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userID: 'usr-1',
          points: 100,
          description: 'Crédito cortesia de aniversário',
        }),
      })

      const res = await adjustAdminRoute(req)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.newBalance).toBe(200)
    })
  })
})
