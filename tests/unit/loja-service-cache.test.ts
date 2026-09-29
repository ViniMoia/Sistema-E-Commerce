import { beforeEach, describe, expect, it, vi } from 'vitest'
import prisma from '@/lib/prisma'
import { tenantCache } from '@/lib/cache'
import { updateLojaSettings } from '@/services/loja.service'

vi.mock('@/lib/prisma', () => ({
  default: { loja: { update: vi.fn() } },
}))
vi.mock('@/services/store-settings-audit.service', () => ({
  persistAuditedSettings: vi.fn((_loja, _actor, _action, _fields, mutate) => mutate(prisma)),
}))

vi.mock('@/lib/cache', () => ({
  tenantCache: {
    invalidateTenant: vi.fn(),
    getOrSet: vi.fn(),
  },
}))

describe('cache de aplicação do serviço de loja', () => {
  beforeEach(() => vi.clearAllMocks())

  it('invalida somente o escopo settings do tenant depois de persistir', async () => {
    vi.mocked(prisma.loja.update).mockResolvedValueOnce({ id: 'loja-a', name: 'Nova' } as any)

    const result = await updateLojaSettings('loja-a', { name: 'Nova' }, 'admin-a')

    expect(result).toMatchObject({ id: 'loja-a', name: 'Nova' })
    expect(tenantCache.invalidateTenant).toHaveBeenCalledWith('loja-a', 'settings')
  })

  it('não invalida cache quando a persistência falha', async () => {
    vi.mocked(prisma.loja.update).mockRejectedValueOnce(new Error('db unavailable'))

    await expect(updateLojaSettings('loja-a', { name: 'Nova' }, 'admin-a')).resolves.toBeNull()

    expect(tenantCache.invalidateTenant).not.toHaveBeenCalled()
  })
})
