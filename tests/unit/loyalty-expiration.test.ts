import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Prisma } from '@prisma/client'
import {
  calculateExpiredPointsForUser,
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

describe('WF-09: estimation does not infer expiry from unknown origin', () => {
  const now = new Date('2026-10-05T00:00:00Z')
  it('preserves legacy balance even when EARN entries are expired or absent', async () => {
    const client = { loyaltyWallet: { findUnique: vi.fn().mockResolvedValue({ id: 'wallet', accountingReady: false, balance: 100 }) },
      loyaltyLot: { aggregate: vi.fn() }, loyaltyTransaction: { findMany: vi.fn() } } as unknown as Prisma.TransactionClient
    expect(await calculateExpiredPointsForUser('shop', 'user', 100, now, client)).toBe(0)
    expect(client.loyaltyLot.aggregate).not.toHaveBeenCalled()
    expect(client.loyaltyTransaction.findMany).not.toHaveBeenCalled()
  })
  it('does not classify a missing wallet as expired credit', async () => {
    const client = { loyaltyWallet: { findUnique: vi.fn().mockResolvedValue(null) } } as unknown as Prisma.TransactionClient
    expect(await calculateExpiredPointsForUser('shop', 'user', 100, now, client)).toBe(0)
  })
  it('sums only proven lot remainders; ignores stale caller balance', async () => {
    const client = { loyaltyWallet: { findUnique: vi.fn().mockResolvedValue({ id: 'wallet', accountingReady: true }) },
      loyaltyLot: { aggregate: vi.fn().mockResolvedValue({ _sum: { remaining: 40 } }) } } as unknown as Prisma.TransactionClient
    expect(await calculateExpiredPointsForUser('shop', 'user', 999, now, client)).toBe(40)
    expect(client.loyaltyLot.aggregate).toHaveBeenCalledWith({ where: { walletId: 'wallet', expiresAt: { lte: now } }, _sum: { remaining: true } })
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
  it('reports partial failure as retryable503 instead of success, and exposes preserved legacy count', async () => {
    vi.spyOn(loyaltyService, 'processLoyaltyExpirations').mockResolvedValueOnce({ processedWallets: 2, expiredCount: 1,
      totalPointsExpired: 100, errors: [{ userId: 'user', lojaId: 'shop', error: 'EXPIRATION_FAILED' }], skippedLegacyWallets: 3 })
    const response = await POST(new Request('http://localhost/api/cron/loyalty-expiration', { method: 'POST', headers: { 'x-cron-secret': TEST_SECRET } }))
    expect(response.status).toBe(503); expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toMatchObject({ success: false, expiredCount: 1, skippedLegacyWallets: 3 })
  })
})
