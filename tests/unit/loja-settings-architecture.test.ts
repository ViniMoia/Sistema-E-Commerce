import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { PUT } from '@/app/api/loja/settings/route'
import { requireAdmin } from '@/lib/auth/guards'
import { TENANT_SETTINGS_CACHE_TAG } from '@/lib/cache-tags'
import { updateLojaSettings } from '@/services/loja.service'

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))
vi.mock('@/lib/auth/guards', () => ({ requireAdmin: vi.fn() }))
vi.mock('@/services/loja.service', () => ({
  getLojaSettings: vi.fn(),
  updateLojaSettings: vi.fn(),
}))

describe('fronteira arquitetural das configurações da loja (ARCH-010)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAdmin).mockResolvedValue({
      user: { id: 'admin-a', role: 'ADMIN', status: 'ACTIVE', lojaID: 'loja-a' },
    } as any)
  })

  it('persiste pelo caso de uso e revalida o cache Next apenas na borda HTTP', async () => {
    vi.mocked(updateLojaSettings).mockResolvedValueOnce({
      id: 'loja-a',
      name: 'Loja Nova',
    } as any)

    const response = await PUT(new Request('https://loja-a.test/api/loja/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Loja Nova' }),
    }))

    expect(response.status).toBe(200)
    expect(updateLojaSettings).toHaveBeenCalledWith('loja-a', { name: 'Loja Nova' }, 'admin-a')
    expect(revalidateTag).toHaveBeenCalledWith(TENANT_SETTINGS_CACHE_TAG, 'max')
  })

  it('não revalida o cache do framework quando a persistência falha', async () => {
    vi.mocked(updateLojaSettings).mockResolvedValueOnce(null)

    const response = await PUT(new Request('https://loja-a.test/api/loja/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Loja Nova' }),
    }))

    expect(response.status).toBe(500)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('interrompe antes do caso de uso quando o guard rejeita', async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    )

    const response = await PUT(new Request('https://loja-a.test/api/loja/settings', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Loja Nova' }),
    }))

    expect(response.status).toBe(401)
    expect(updateLojaSettings).not.toHaveBeenCalled()
    expect(revalidateTag).not.toHaveBeenCalled()
  })
})
