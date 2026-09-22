import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Prisma, LoyaltyTxType } from '@prisma/client'
import {
  calculateExpiredPointsForUser,
  expireUserPoints,
  processLoyaltyExpirations,
} from '@/services/loyalty.service'
import { GET, POST } from '@/app/api/cron/loyalty-expiration/route'
import * as loyaltyService from '@/services/loyalty.service'

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('Fase 4 (ACT-P2-05) - Motor Contábil de Expiração de Pontos de Fidelidade', () => {
  const lojaID = 'loja-continental-001'
  const userID = 'user-test-exp-001'
  const fixedNow = new Date('2026-09-22T16:00:00.000Z')

  describe('calculateExpiredPointsForUser (Lógica FIFO de Acúmulo Reverso)', () => {
    it('deve retornar 0 se o saldo atual for zero ou negativo', async () => {
      const mockClient = {
        loyaltyTransaction: { findMany: vi.fn() },
      } as unknown as Prisma.TransactionClient

      const resZero = await calculateExpiredPointsForUser(lojaID, userID, 0, fixedNow, mockClient)
      const resNeg = await calculateExpiredPointsForUser(lojaID, userID, -50, fixedNow, mockClient)

      expect(resZero).toBe(0)
      expect(resNeg).toBe(0)
      expect(mockClient.loyaltyTransaction.findMany).not.toHaveBeenCalled()
    })

    it('deve retornar 0 se todos os pontos que compõem o saldo ainda não expiraram', async () => {
      const mockClient = {
        loyaltyTransaction: {
          findMany: vi.fn().mockResolvedValue([
            {
              points: 200,
              expiresAt: new Date('2026-12-31T23:59:59.000Z'), // Futuro
            },
            {
              points: 300,
              expiresAt: new Date('2027-01-15T23:59:59.000Z'), // Futuro
            },
          ]),
        },
      } as unknown as Prisma.TransactionClient

      // Saldo de 500 composto pelos 200 + 300
      const expired = await calculateExpiredPointsForUser(lojaID, userID, 500, fixedNow, mockClient)
      expect(expired).toBe(0)
    })

    it('deve calcular corretamente pontos expirados quando as transações mais antigas venceram', async () => {
      // Suponha saldo de 300.
      // O histórico de EARN ordenado por createdAt DESC (mais recentes primeiro):
      // 1. Recente: 100 pontos, vence em 2026-12-31 (ativo)
      // 2. Antigo: 300 pontos, venceu em 2026-08-01 (expirado)
      // O saldo de 300 é formado por:
      // - 100 pontos do lote recente (não expirado)
      // - 200 pontos do lote antigo (expirado!)
      // Total expirado esperado: 200 pontos.
      const mockClient = {
        loyaltyTransaction: {
          findMany: vi.fn().mockResolvedValue([
            {
              points: 100,
              expiresAt: new Date('2026-12-31T23:59:59.000Z'), // Ativo
            },
            {
              points: 300,
              expiresAt: new Date('2026-08-01T00:00:00.000Z'), // Vencido
            },
          ]),
        },
      } as unknown as Prisma.TransactionClient

      const expired = await calculateExpiredPointsForUser(lojaID, userID, 300, fixedNow, mockClient)
      expect(expired).toBe(200)
    })

    it('deve expirar a totalidade do saldo se todos os EARNs que o sustentam estiverem vencidos', async () => {
      const mockClient = {
        loyaltyTransaction: {
          findMany: vi.fn().mockResolvedValue([
            {
              points: 150,
              expiresAt: new Date('2026-01-01T00:00:00.000Z'), // Vencido
            },
            {
              points: 200,
              expiresAt: new Date('2025-12-01T00:00:00.000Z'), // Vencido
            },
          ]),
        },
      } as unknown as Prisma.TransactionClient

      const expired = await calculateExpiredPointsForUser(lojaID, userID, 350, fixedNow, mockClient)
      expect(expired).toBe(350)
    })

    it('respeita pontos sem data de expiração (expiresAt === null) como não expirados', async () => {
      const mockClient = {
        loyaltyTransaction: {
          findMany: vi.fn().mockResolvedValue([
            {
              points: 250,
              expiresAt: null, // Vitalício / sem expiração
            },
          ]),
        },
      } as unknown as Prisma.TransactionClient

      const expired = await calculateExpiredPointsForUser(lojaID, userID, 250, fixedNow, mockClient)
      expect(expired).toBe(0)
    })
  })

  describe('expireUserPoints (Baixa Contábil Atômica)', () => {
    it('deve decrementar o saldo e gravar transação de EXPIRATION no ledger', async () => {
      const mockTx = {
        loja: {
          findUnique: vi.fn().mockResolvedValue({
            loyaltyEnabled: true,
            loyaltyEarnRate: new Prisma.Decimal('0.5'),
            loyaltyPointValue: new Prisma.Decimal('0.05'),
            loyaltyMinPointsRedeem: 100,
            loyaltyMaxDiscountPct: new Prisma.Decimal('50'),
            loyaltyPointsExpiryDays: 365,
          }),
        },
        loyaltyWallet: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'wallet-001',
            lojaID,
            userID,
            balance: 500,
          }),
          update: vi.fn().mockResolvedValue({
            id: 'wallet-001',
            lojaID,
            userID,
            balance: 300,
          }),
        },
        loyaltyTransaction: {
          create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'tx-exp-01', ...data })),
        },
      } as unknown as Prisma.TransactionClient

      const result = await expireUserPoints(
        {
          lojaID,
          userID,
          points: 200,
          description: 'Expiração semestral de pontos',
        },
        mockTx
      )

      expect(result).not.toBeNull()
      expect(result?.pointsExpired).toBe(200)
      expect(result?.wallet.balance).toBe(300)
      expect(mockTx.loyaltyWallet.update).toHaveBeenCalledWith({
        where: { id: 'wallet-001' },
        data: {
          balance: { decrement: 200 },
          version: { increment: 1 },
        },
      })
      expect(mockTx.loyaltyTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          lojaID,
          userID,
          type: LoyaltyTxType.EXPIRATION,
          points: -200,
          balanceAfter: 300,
          description: 'Expiração semestral de pontos',
        }),
      })
    })

    it('não deve permitir débito maior do que o saldo atual da carteira', async () => {
      const mockTx = {
        loja: {
          findUnique: vi.fn().mockResolvedValue({
            loyaltyEnabled: true,
            loyaltyEarnRate: new Prisma.Decimal('0.5'),
            loyaltyPointValue: new Prisma.Decimal('0.05'),
            loyaltyMinPointsRedeem: 100,
            loyaltyMaxDiscountPct: new Prisma.Decimal('50'),
            loyaltyPointsExpiryDays: 365,
          }),
        },
        loyaltyWallet: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'wallet-001',
            lojaID,
            userID,
            balance: 80, // Saldo menor que os 100 solicitados
          }),
          update: vi.fn().mockResolvedValue({
            id: 'wallet-001',
            lojaID,
            userID,
            balance: 0,
          }),
        },
        loyaltyTransaction: {
          create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'tx-exp-02', ...data })),
        },
      } as unknown as Prisma.TransactionClient

      const result = await expireUserPoints(
        {
          lojaID,
          userID,
          points: 100,
        },
        mockTx
      )

      expect(result?.pointsExpired).toBe(80)
      expect(mockTx.loyaltyWallet.update).toHaveBeenCalledWith({
        where: { id: 'wallet-001' },
        data: {
          balance: { decrement: 80 },
          version: { increment: 1 },
        },
      })
    })

    it('retorna null se points <= 0', async () => {
      const res = await expireUserPoints({ lojaID, userID, points: 0 })
      expect(res).toBeNull()
    })
  })
})

describe('Endpoint de Cron: /api/cron/loyalty-expiration (Segurança & Execução)', () => {
  const originalEnv = process.env
  const TEST_SECRET = 'cron_secret_loyalty_test_9876543210'

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv, CRON_SECRET: TEST_SECRET }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('deve retornar HTTP 500 Fail-Closed se CRON_SECRET não estiver configurado', async () => {
    delete process.env.CRON_SECRET

    const req = new Request('http://localhost:3000/api/cron/loyalty-expiration', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${TEST_SECRET}`,
      },
    })

    const res = await GET(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('Configuração de segurança do cron não inicializada')
  })

  it('deve retornar HTTP 401 se a requisição não fornecer token', async () => {
    const req = new Request('http://localhost:3000/api/cron/loyalty-expiration', {
      method: 'GET',
    })

    const res = await GET(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toContain('Token de autorização não fornecido')
  })

  it('deve retornar HTTP 401 para token Bearer inválido', async () => {
    const req = new Request('http://localhost:3000/api/cron/loyalty-expiration', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer wrong_token',
      },
    })

    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('deve autenticar com sucesso via header x-cron-secret', async () => {
    const spy = vi.spyOn(loyaltyService, 'processLoyaltyExpirations').mockResolvedValueOnce({
      processedWallets: 10,
      expiredCount: 2,
      totalPointsExpired: 150,
      errors: [],
    })

    const req = new Request('http://localhost:3000/api/cron/loyalty-expiration', {
      method: 'POST',
      headers: {
        'x-cron-secret': TEST_SECRET,
      },
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.processedWallets).toBe(10)
    expect(body.expiredCount).toBe(2)
    expect(body.totalPointsExpired).toBe(150)
    expect(spy).toHaveBeenCalled()
  })

  it('deve executar com sucesso via GET e repassar o filtro de tenant lojaID', async () => {
    const spy = vi.spyOn(loyaltyService, 'processLoyaltyExpirations').mockResolvedValueOnce({
      processedWallets: 1,
      expiredCount: 0,
      totalPointsExpired: 0,
      errors: [],
    })

    const req = new Request(
      'http://localhost:3000/api/cron/loyalty-expiration?lojaID=loja-continental-001',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${TEST_SECRET}`,
        },
      }
    )

    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        lojaID: 'loja-continental-001',
      })
    )
  })
})
