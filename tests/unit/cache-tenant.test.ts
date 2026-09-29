import { describe, it, expect, beforeEach, vi } from 'vitest'
import { tenantCache, buildTenantCacheKey } from '@/lib/cache'

describe('Cache Distribuído Tenant-Aware (SCL-003)', () => {
  beforeEach(() => {
    tenantCache.clear()
  })

  it('deve gerar chave de cache determinística com escopo de tenant', () => {
    const key = buildTenantCacheKey('loja-1', 'settings', 'config')
    expect(key).toBe('tenant:loja-1:settings:config')
  })

  it('deve isolar estritamente dados entre diferentes tenants', async () => {
    const loja1Data = { name: 'Loja Alfa' }
    const loja2Data = { name: 'Loja Beta' }

    tenantCache.set('loja-1', 'settings', 'config', loja1Data)
    tenantCache.set('loja-2', 'settings', 'config', loja2Data)

    const fetched1 = tenantCache.get(buildTenantCacheKey('loja-1', 'settings', 'config'))
    const fetched2 = tenantCache.get(buildTenantCacheKey('loja-2', 'settings', 'config'))

    expect(fetched1).toEqual(loja1Data)
    expect(fetched2).toEqual(loja2Data)
  })

  it('deve invalidar cache apenas do tenant especificado', () => {
    tenantCache.set('loja-1', 'freight', 'rules', [{ city: 'SP', value: 10 }])
    tenantCache.set('loja-2', 'freight', 'rules', [{ city: 'RJ', value: 20 }])

    // Invalida somente loja-1
    tenantCache.invalidateTenant('loja-1', 'freight')

    const loja1After = tenantCache.get(buildTenantCacheKey('loja-1', 'freight', 'rules'))
    const loja2After = tenantCache.get(buildTenantCacheKey('loja-2', 'freight', 'rules'))

    expect(loja1After).toBeNull()
    expect(loja2After).not.toBeNull()
  })

  it('deve respeitar expiração por TTL', async () => {
    tenantCache.set('loja-1', 'promo', 'banner', { active: true }, -1000) // Já expirado
    const expired = tenantCache.get(buildTenantCacheKey('loja-1', 'promo', 'banner'))
    expect(expired).toBeNull()
  })

  it('coalesce misses concorrentes da mesma chave e tenant', async () => {
    const factory = vi.fn(async () => ({ value: 'fresh' }))

    const results = await Promise.all(
      Array.from({ length: 100 }, () =>
        tenantCache.getOrSet('loja-1', 'settings', 'coalesced', factory)
      )
    )

    expect(factory).toHaveBeenCalledTimes(1)
    expect(results.every(result => result.value === 'fresh')).toBe(true)
  })

  it('remove uma promise com falha para permitir tentativa posterior', async () => {
    const factory = vi.fn()
      .mockRejectedValueOnce(new Error('falha transitória'))
      .mockResolvedValueOnce({ recovered: true })

    await expect(
      tenantCache.getOrSet('loja-1', 'settings', 'retry', factory)
    ).rejects.toThrow('falha transitória')
    await expect(
      tenantCache.getOrSet('loja-1', 'settings', 'retry', factory)
    ).resolves.toEqual({ recovered: true })
    expect(factory).toHaveBeenCalledTimes(2)
  })

  it('limita o cache e remove as entradas menos recentes', () => {
    for (let index = 0; index < 1001; index += 1) {
      tenantCache.set('loja-1', 'bounded', String(index), index)
    }

    expect(tenantCache.get(buildTenantCacheKey('loja-1', 'bounded', '0'))).toBeNull()
    expect(tenantCache.get(buildTenantCacheKey('loja-1', 'bounded', '1000'))).toBe(1000)
  })
})
