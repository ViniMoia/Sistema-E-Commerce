import { describe, it, expect, beforeEach } from 'vitest'
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
})
