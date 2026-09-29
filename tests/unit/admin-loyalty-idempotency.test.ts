import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'

vi.mock('@/lib/prisma', () => ({
  default: {
    $transaction: vi.fn(async (callback) => callback(prisma)),
    user: { findFirst: vi.fn() },
    loja: { findUnique: vi.fn() },
    loyaltyWallet: { upsert: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    loyaltyTransaction: { findUnique: vi.fn(), create: vi.fn() },
  },
}))

import prisma from '@/lib/prisma'
import { adjustPointsManually, LoyaltyError } from '@/services/loyalty.service'

const input = {
  lojaID: 'loja-1',
  userID: 'user-1',
  points: 250,
  description: 'Correção autorizada',
  adminUserId: 'admin-1',
  idempotencyKey: '11111111-1111-4111-8111-111111111111',
}

describe('idempotência de ajuste administrativo (ADM-003)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'user-1', lojaID: 'loja-1' } as any)
    vi.mocked(prisma.loja.findUnique).mockResolvedValue({
      loyaltyEnabled: true,
      loyaltyEarnRate: new Prisma.Decimal('1'),
      loyaltyPointValue: new Prisma.Decimal('0.05'),
      loyaltyMinPointsRedeem: 100,
      loyaltyMaxDiscountPct: new Prisma.Decimal('50'),
      loyaltyPointsExpiryDays: 365,
    } as any)
    vi.mocked(prisma.loyaltyWallet.upsert).mockResolvedValue({ id: 'wallet-1', balance: 100 } as any)
    vi.mocked(prisma.loyaltyWallet.update).mockResolvedValue({ id: 'wallet-1', balance: 350 } as any)
  })

  it('aplica duas requisições idênticas exatamente uma vez', async () => {
    const transaction = {
      id: 'tx-1', lojaID: 'loja-1', userID: 'user-1', points: 250,
      description: '[Ajuste Admin admin-1] Correção autorizada',
      operationKey: 'admin-adjust:loja-1:11111111-1111-4111-8111-111111111111',
    }
    vi.mocked(prisma.loyaltyTransaction.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(transaction as any)
    vi.mocked(prisma.loyaltyTransaction.create).mockResolvedValue(transaction as any)
    vi.mocked(prisma.loyaltyWallet.findUnique).mockResolvedValue({ id: 'wallet-1', balance: 350 } as any)

    const first = await adjustPointsManually(input)
    const replay = await adjustPointsManually(input)

    expect(first.idempotentReplay).toBe(false)
    expect(replay.idempotentReplay).toBe(true)
    expect(prisma.loyaltyWallet.update).toHaveBeenCalledTimes(1)
    expect(prisma.loyaltyTransaction.create).toHaveBeenCalledTimes(1)
  })

  it('rejeita reutilização da chave com argumentos diferentes sem atualizar saldo', async () => {
    vi.mocked(prisma.loyaltyTransaction.findUnique).mockResolvedValue({
      lojaID: 'loja-1', userID: 'user-1', points: 250,
      description: '[Ajuste Admin admin-1] Correção autorizada',
    } as any)

    await expect(adjustPointsManually({ ...input, points: 300 })).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
    } satisfies Partial<LoyaltyError>)
    expect(prisma.loyaltyWallet.update).not.toHaveBeenCalled()
    expect(prisma.loyaltyTransaction.create).not.toHaveBeenCalled()
  })

  it('converge para o lançamento vencedor quando a constraint arbitra uma corrida', async () => {
    const transaction = {
      id: 'tx-winner', lojaID: 'loja-1', userID: 'user-1', points: 250,
      description: '[Ajuste Admin admin-1] Correção autorizada',
    }
    vi.mocked(prisma.$transaction).mockRejectedValueOnce({ code: 'P2002' } as any)
    vi.mocked(prisma.loyaltyTransaction.findUnique).mockResolvedValue(transaction as any)
    vi.mocked(prisma.loyaltyWallet.findUnique).mockResolvedValue({ id: 'wallet-1', balance: 350 } as any)

    const result = await adjustPointsManually(input)

    expect(result.idempotentReplay).toBe(true)
    expect(result.transaction.id).toBe('tx-winner')
  })
})
