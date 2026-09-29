import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('limites do monólito modular (ARCH-010)', () => {
  it('serviços migrados não dependem de módulos de apresentação em app/', () => {
    const offenders = ['services/order.service.ts', 'services/loja.service.ts']
      .filter((file) => /from\s+['"]@\/app\//.test(source(file)))

    expect(offenders).toEqual([])
  })

  it('usa um único módulo de serviço para pedidos', () => {
    expect(existsSync(resolve(process.cwd(), 'services/orders.service.ts'))).toBe(false)
    expect(source('app/profile/page.tsx')).toContain('@/services/order.service')
  })

  it('o serviço de loja não importa APIs do framework Next', () => {
    expect(source('services/loja.service.ts')).not.toMatch(/from\s+['"]next\//)
  })

  it('a borda HTTP usa a tag canônica e a assinatura atual do Next', () => {
    const route = source('app/api/loja/settings/route.ts')
    expect(route).toContain('TENANT_SETTINGS_CACHE_TAG')
    expect(route).toContain("revalidateTag(TENANT_SETTINGS_CACHE_TAG, 'max')")
  })

  it('o layout administrativo consulta a loja pelo serviço, não pelo Prisma', () => {
    const layout = source('app/admin/layout.tsx')
    expect(layout).toContain('@/services/loja.service')
    expect(layout).not.toContain('@/lib/prisma')
  })

  it('provider e drawer do carrinho dependem do contexto sem ciclo entre si', () => {
    const provider = source('components/providers/CartProvider.tsx')
    const drawer = source('components/cart/CartDrawer.tsx')

    expect(provider).toContain('@/components/providers/cart-context')
    expect(provider).toContain('@/components/cart/CartDrawer')
    expect(drawer).toContain('@/components/providers/cart-context')
    expect(drawer).not.toContain('@/components/providers/CartProvider')
  })

  it('handlers de cron usam o mesmo guard de autenticação', () => {
    for (const route of [
      'app/api/cron/orders-timeout/route.ts',
      'app/api/cron/loyalty-expiration/route.ts',
    ]) {
      expect(source(route)).toContain('@/lib/cron-auth')
      expect(source(route)).not.toContain('function validateCronAuth')
    }
  })

  it('perfil distingue erro de consulta de histórico do estado vazio', () => {
    const service = source('services/order.service.ts')
    const boundary = source('app/profile/error.tsx')

    expect(service).toContain('ORDER_HISTORY_UNAVAILABLE')
    expect(service).not.toContain('Error fetching user orders:')
    expect(boundary).toContain('Tentar novamente')
    expect(boundary).toContain('retry()')
  })
})
