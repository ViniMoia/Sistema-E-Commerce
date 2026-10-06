import { beforeEach, describe, expect, it, vi } from 'vitest'
import prisma from '@/lib/prisma'
import { tenantCache } from '@/lib/cache'
import { getLojaBySlug, getLojaSettings, updateLojaSettings } from '@/services/loja.service'
import { GET as publicGet } from '@/app/api/loja/[slug]/route'
import { GET as adminGet, PUT as adminPut } from '@/app/api/loja/settings/route'
import { correiosCredentialChanges } from '@/lib/loja-dto'

vi.mock('@/lib/prisma', () => ({ default: { loja: { findUnique: vi.fn(), update: vi.fn() } } }))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))
vi.mock('@/lib/auth/guards', () => ({ requireAdmin: vi.fn(async () => ({ user: { lojaID: 'store' } })) }))

const row = {
  id: 'store', name: 'Loja', slug: 'loja', description: '', coverImageUrl: '',
  pixKey: 'public-pix', pixKeyType: 'EMAIL', whatsappNumber: '11999999999',
  primaryColor: '#000000', secondaryColor: '#ffffff', customDomain: null,
  originCep: '01001000', originState: 'SP', originCity: 'São Paulo', originDistrict: 'Centro',
  originStreet: 'Rua', originNumber: '1', originComplement: null,
  enableCorreios: true, enablePickup: true, enableNoFreight: false, additionalDays: 1,
  correiosContractCode: 'CANARY_CORREIOS_CONTRACT', correiosPassword: 'CANARY_CORREIOS_PASSWORD',
  nuvemshopAccessToken: 'CANARY_ERP_TOKEN', futureSecret: 'CANARY_FUTURE_SECRET',
}
function assertNoSecrets(data: unknown) {
  const serialized = JSON.stringify(data)
  expect(serialized).not.toContain('CANARY_')
  expect(data).not.toHaveProperty('correiosPassword')
  expect(data).not.toHaveProperty('correiosContractCode')
}
beforeEach(() => {
  vi.clearAllMocks()
  tenantCache.clear()
  vi.mocked(prisma.loja.findUnique).mockResolvedValue(row as never)
  vi.mocked(prisma.loja.update).mockResolvedValue(row as never)
})

describe('LA-038: contratos de configurações da loja', () => {
  it('não consulta credenciais na busca pública e serializa uma whitelist', async () => {
    const result = await getLojaBySlug('loja')
    assertNoSecrets(result)
    expect(result).toMatchObject({ id: 'store', pixKey: 'public-pix', enablePickup: true })
    const query = vi.mocked(prisma.loja.findUnique).mock.calls[0][0]
    expect(query.select).not.toHaveProperty('correiosPassword')
    expect(query.select).not.toHaveProperty('correiosContractCode')
    const response = await publicGet(new Request('http://localhost/api/loja/loja'), { params: Promise.resolve({ slug: 'loja' }) })
    expect(response.status).toBe(200)
    assertNoSecrets(await response.json())
  })
  it('consulta configuração atual em cada leitura administrativa e expõe apenas indicadores de credenciais', async () => {
    const first = await getLojaSettings('store')
    vi.mocked(prisma.loja.findUnique).mockResolvedValue({ ...row, enablePickup: false } as never)
    const current = await getLojaSettings('store')
    expect(prisma.loja.findUnique).toHaveBeenCalledTimes(2)
    expect(first).toMatchObject({ enablePickup: true })
    expect(current).toMatchObject({ enablePickup: false })
    for (const value of [first, current]) {
      assertNoSecrets(value)
      expect(value).toMatchObject({ hasCorreiosPassword: true, hasCorreiosContractCode: true })
    }
    const response = await adminGet(new Request('http://localhost/api/loja/settings'))
    assertNoSecrets(await response.json())
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
  it('não sobrescreve a senha ao editar apenas dados comuns e não ecoa segredo no PUT', async () => {
    const response = await adminPut(new Request('http://localhost/api/loja/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Loja nova' }),
    }))
    expect(response.status).toBe(200)
    assertNoSecrets(await response.json())
    expect(vi.mocked(prisma.loja.update).mock.calls[0][0].data).not.toHaveProperty('correiosPassword')
  })
  it('permite substituição e remoção explícitas sem revelar o valor anterior', async () => {
    assertNoSecrets(await updateLojaSettings('store', { correiosPassword: 'replacement' }))
    expect(vi.mocked(prisma.loja.update).mock.calls[0][0].data.correiosPassword).toBe('replacement')
    await updateLojaSettings('store', { correiosPassword: null, correiosContractCode: null })
    expect(vi.mocked(prisma.loja.update).mock.calls[1][0].data.correiosPassword).toBeNull()
  })
  it('rejeita senha vazia ou placeholder e não persiste o marcador', async () => {
    for (const correiosPassword of ['', '********']) {
      const response = await adminPut(new Request('http://localhost/api/loja/settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correiosPassword }),
      }))
      expect(response.status).toBe(422)
    }
    expect(prisma.loja.update).not.toHaveBeenCalled()
  })
  it('o formulário envia somente alterações explícitas de credenciais', () => {
    expect(correiosCredentialChanges('', '', false)).toEqual({})
    expect(correiosCredentialChanges(' new-contract ', 'new-password', false)).toEqual({ correiosContractCode: 'new-contract', correiosPassword: 'new-password' })
    expect(correiosCredentialChanges('', '', true)).toEqual({ correiosContractCode: null, correiosPassword: null })
  })
  it('falha de persistência não escreve credenciais no log de aplicação', async () => {
    vi.mocked(prisma.loja.update).mockRejectedValue(new Error('CANARY_CORREIOS_PASSWORD'))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(await updateLojaSettings('store', { correiosPassword: 'replacement' })).toBeNull()
      expect(JSON.stringify(log.mock.calls)).not.toContain('CANARY_')
    } finally { log.mockRestore() }
  })
})
