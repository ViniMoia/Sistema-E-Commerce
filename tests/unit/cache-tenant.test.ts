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

  it('shares concurrent work only within the same tenant', async () => {
    let release!: (value: string) => void;
    const factory = vi.fn(() => new Promise<string>(resolve => { release = resolve; }));
    const first = tenantCache.getOrSet('A', 'dashboard', 'metrics', factory);
    const second = tenantCache.getOrSet('A', 'dashboard', 'metrics', factory);
    const other = tenantCache.getOrSet('B', 'dashboard', 'metrics', async () => 'B');
    await Promise.resolve();
    expect(factory).toHaveBeenCalledTimes(1);
    release('A');
    expect(await Promise.all([first, second, other])).toEqual(['A', 'A', 'B']);
  });

  it.each(['del', 'invalidateTenant', 'clear', 'set'] as const)('fences an in-flight result after %s', async operation => {
    let release!: (value: string) => void;
    const pending = tenantCache.getOrSet('A', 'dashboard', 'metrics', () => new Promise<string>(resolve => { release = resolve; }));
    await Promise.resolve();
    if (operation === 'del') tenantCache.del('A', 'dashboard', 'metrics');
    if (operation === 'invalidateTenant') tenantCache.invalidateTenant('A', 'dashboard');
    if (operation === 'clear') tenantCache.clear();
    if (operation === 'set') tenantCache.set('A', 'dashboard', 'metrics', 'new');
    else await tenantCache.getOrSet('A', 'dashboard', 'metrics', async () => 'new');
    release('old'); await pending;
    expect(tenantCache.get(buildTenantCacheKey('A', 'dashboard', 'metrics'))).toBe('new');
  });

  it('allows retry after a failed factory', async () => {
    await expect(tenantCache.getOrSet('A', 'dashboard', 'metrics', async () => { throw new Error('offline'); })).rejects.toThrow();
    expect(await tenantCache.getOrSet('A', 'dashboard', 'metrics', async () => 'ok')).toBe('ok');
  });
})
