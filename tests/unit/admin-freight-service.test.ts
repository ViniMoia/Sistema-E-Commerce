import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'

vi.mock('@/lib/prisma', () => ({
  default: {
    $transaction: vi.fn(async (callback) => callback(prisma)),
    freightRule: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}))

vi.mock('@/lib/cache', () => ({
  tenantCache: { invalidateTenant: vi.fn(), getOrSet: vi.fn() },
}))

import prisma from '@/lib/prisma'
import { createFreightRule, deleteFreightRule, updateFreightRule } from '@/services/freight.service'

const rule = {
  id: 'freight-1', lojaID: 'loja-1', cityName: 'São Paulo',
  value: new Prisma.Decimal('12.50'), createdAt: new Date(), updatedAt: new Date(),
}

describe('auditoria transacional de frete administrativo (ADM-008)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('cria regra e auditoria na mesma transação', async () => {
    vi.mocked(prisma.freightRule.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.freightRule.create).mockResolvedValue(rule as any)

    await createFreightRule({ lojaID: 'loja-1', actorId: 'admin-1', cityName: 'São Paulo', value: 12.5 })

    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'FREIGHT_RULE_CREATED', entityId: 'freight-1' }),
    }))
  })

  it('não altera nem audita regra de outro tenant', async () => {
    vi.mocked(prisma.freightRule.findUnique).mockResolvedValue({ ...rule, lojaID: 'loja-2' } as any)

    const result = await updateFreightRule({
      id: 'freight-1', lojaID: 'loja-1', actorId: 'admin-1', value: 1,
    })

    expect(result).toBeNull()
    expect(prisma.freightRule.update).not.toHaveBeenCalled()
    expect(prisma.auditLog.create).not.toHaveBeenCalled()
  })

  it('audita snapshot antes de excluir a regra autorizada', async () => {
    vi.mocked(prisma.freightRule.findUnique).mockResolvedValue(rule as any)
    vi.mocked(prisma.freightRule.delete).mockResolvedValue(rule as any)

    await deleteFreightRule('freight-1', 'loja-1', 'admin-1')

    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'FREIGHT_RULE_DELETED',
        previousValue: { cityName: 'São Paulo', value: '12.5' },
      }),
    }))
    expect(prisma.freightRule.delete).toHaveBeenCalledWith({ where: { id: 'freight-1' } })
  })
})
