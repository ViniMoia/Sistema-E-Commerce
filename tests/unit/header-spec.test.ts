import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect, vi } from 'vitest'
import { Header } from '@/components/Header'
import { ConditionalHeader } from '@/components/ConditionalHeader'
import { getCurrentUser } from '@/lib/session'
import { usePathname } from 'next/navigation'

vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }))
vi.mock('next/navigation', () => ({ usePathname: vi.fn() }))
vi.mock('@/components/cart/CartButton', () => ({ CartButton: () => React.createElement('a', { href: '/cart' }, 'Cart') }))
vi.mock('@/components/MobileMenu', () => ({ MobileMenu: () => null }))
vi.mock('@/components/brand/ContinentalLogo', () => ({ ContinentalLogo: () => null }))

describe('Rendered header navigation', () => {
  it('renders cart, login and registration in order for guests', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    const html = renderToStaticMarkup(await Header())
    const nav = html.slice(html.indexOf('<nav'))
    expect(nav.indexOf('href="/cart"')).toBeLessThan(nav.indexOf('href="/login"'))
    expect(nav.indexOf('href="/login"')).toBeLessThan(nav.indexOf('href="/register"'))
    expect(nav).not.toContain('href="/admin"')
  })
  it.each(['CUSTOMER', 'ADMIN'])('renders authorized navigation for %s', async role => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'fixture', name: 'Fixture', role } as Awaited<ReturnType<typeof getCurrentUser>>)
    const html = renderToStaticMarkup(await Header())
    expect(html).toContain('href="/profile"')
    expect(html).toContain('action="/api/auth/logout"')
    expect(html.includes('href="/admin"')).toBe(role === 'ADMIN')
    expect(html).not.toContain('href="/login"')
  })
  it.each([['/', true], ['/cart', true], ['/admin/orders', false]])('renders header visibility for %s', (path, visible) => {
    vi.mocked(usePathname).mockReturnValue(path as string)
    const html = renderToStaticMarkup(React.createElement(ConditionalHeader, null, 'HEADER_FIXTURE'))
    expect(html.includes('HEADER_FIXTURE')).toBe(visible)
  })
})
