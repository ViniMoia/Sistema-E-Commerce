import { describe, it, expect, vi } from 'vitest'
import prisma from '@/lib/prisma'
import { processLoyaltyExpirations, calculateExpiredPointsForUser } from '@/services/loyalty.service'

vi.mock('@/lib/prisma', () => ({ default: {
  loyaltyWallet: { findMany: vi.fn() },
  loyaltyTransaction: { findMany: vi.fn() },
} }))

describe('bounded expiration scan', () => {
  it('preserves FIFO across ledger pages and stops after covering the balance', async () => {
    const rows = Array.from({ length: 250 }, (_, i) => ({
      id: String(i), points: 1, expiresAt: i < 100 ? null : new Date('2025-01-01'),
    }))
    vi.mocked(prisma.loyaltyTransaction.findMany).mockImplementation((async (args: { cursor?: { id: string }; take: number }) => {
      const start = args.cursor ? Number(args.cursor.id) + 1 : 0
      return rows.slice(start, start + args.take)
    }) as never)
    expect(await calculateExpiredPointsForUser('fixture', 'user', 150, new Date('2026-09-29'))).toBe(50)
    expect(prisma.loyaltyTransaction.findMany).toHaveBeenCalledTimes(2)
    vi.mocked(prisma.loyaltyTransaction.findMany).mockReset()
  })
  it('visits more than one batch and continues after an individual ledger failure', async () => {
    const rows = Array.from({ length: 205 }, (_, i) => ({
      id: String(i).padStart(4, '0'), userID: 'user-' + i, lojaID: 'fixture', balance: 10,
    }))
    vi.mocked(prisma.loyaltyWallet.findMany).mockImplementation((async (args: {
      where: { id?: { gt: string } }; take: number
    }) => rows.filter(row => !args.where.id || row.id > args.where.id.gt).slice(0, args.take)) as never)
    vi.mocked(prisma.loyaltyTransaction.findMany).mockRejectedValueOnce(new Error('fixture ledger unavailable')).mockResolvedValue([{ points: 10, expiresAt: null }] as never)
    const result = await processLoyaltyExpirations({ lojaID: 'fixture', now: new Date('2026-09-29') })
    expect(result.processedWallets).toBe(205)
    expect(result.errors).toHaveLength(1)
    expect(prisma.loyaltyWallet.findMany).toHaveBeenCalledTimes(3)
    expect(prisma.loyaltyTransaction.findMany).toHaveBeenCalledTimes(205)
    expect(result.expiredCount).toBe(0)
  })
})
