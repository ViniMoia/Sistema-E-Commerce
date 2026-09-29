import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireAdminMock, createFreightRuleMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  createFreightRuleMock: vi.fn(),
}))

vi.mock('@/lib/auth/guards', () => ({ requireAdmin: requireAdminMock }))
vi.mock('@/services/freight.service', () => ({
  listFreightRules: vi.fn(),
  createFreightRule: createFreightRuleMock,
}))

import { POST } from '@/app/api/admin/freight/route'
import { createFreightRuleSchema } from '@/lib/validators/admin-freight'

describe('admin freight mutation boundary (ADM-002)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdminMock.mockResolvedValue({ user: { id: 'admin-1', lojaID: 'loja-1' } })
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejeita número não finito %s no schema do servidor',
    (value) => {
      expect(createFreightRuleSchema.safeParse({ cityName: 'São Paulo', value }).success).toBe(false)
    }
  )

  it.each([
    ['negativo', { cityName: 'São Paulo', value: -0.01 }],
    ['string', { cityName: 'São Paulo', value: '10.00' }],
    ['ausente', { cityName: 'São Paulo' }],
    ['campo extra', { cityName: 'São Paulo', value: 10, lojaID: 'loja-atacante' }],
  ])('rejeita %s sem chamar o serviço nem persistir', async (_label, payload) => {
    const response = await POST(new Request('http://local/api/admin/freight', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }))

    expect(response.status).toBe(422)
    expect(createFreightRuleMock).not.toHaveBeenCalled()
  })

  it('usa tenant autenticado e persiste payload válido normalizado', async () => {
    createFreightRuleMock.mockResolvedValue({ id: 'freight-1', cityName: 'São Paulo', value: 12.5 })
    const response = await POST(new Request('http://local/api/admin/freight', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cityName: '  São Paulo  ', value: 12.5 }),
    }))

    expect(response.status).toBe(201)
    expect(createFreightRuleMock).toHaveBeenCalledWith({
      lojaID: 'loja-1',
      actorId: 'admin-1',
      cityName: 'São Paulo',
      value: 12.5,
    })
  })
})
