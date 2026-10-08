import { beforeEach, describe, expect, it, vi } from 'vitest'
import prisma from '@/lib/prisma'
import { tenantCache } from '@/lib/cache'
import { getLojaBySlug, getLojaSettings, updateLojaSettings } from '@/services/loja.service'
import { GET as publicGet } from '@/app/api/loja/[slug]/route'
import { GET as adminGet, PUT as adminPut } from '@/app/api/loja/settings/route'
import { correiosCredentialChanges, lojaSettingsFormChanges } from '@/lib/loja-dto'
import { requirePurchaseAdmin } from '@/lib/auth/guards'

vi.mock('@/lib/prisma', () => {
  const loja = { findUnique: vi.fn(), update: vi.fn() }
  return { default: { loja, $transaction: vi.fn(async (work: (tx: unknown) => Promise<unknown>) => work({
    loja, $queryRaw: vi.fn(), user: { findUnique: vi.fn(async () => ({ id: 'admin', lojaID: 'store', role: 'ADMIN', status: 'ACTIVE' })) },
  })) } }
})
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))
vi.mock('@/lib/auth/guards', () => ({
  requireAdmin: vi.fn(async () => ({ user: { id: 'admin', lojaID: 'store' } })),
  requirePurchaseAdmin: vi.fn(async () => ({ user: { id: 'admin', lojaID: 'store' } })),
}))

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
  it('salva Pix automático a partir da leitura administrativa sem imagem, cores ou chave manual', async () => {
    vi.mocked(prisma.loja.findUnique).mockResolvedValue({ ...row, pixKey: null, pixKeyType: null,
      whatsappNumber: null, primaryColor: null, secondaryColor: null } as never)
    const settings = await (await adminGet(new Request('http://localhost/api/loja/settings'))).json()
    const response = await adminPut(new Request('http://localhost/api/loja/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...settings, enablePix: true }),
    }))
    expect(response.status).toBe(200)
    expect(requirePurchaseAdmin).toHaveBeenCalledOnce()
    expect(prisma.$transaction).toHaveBeenCalledOnce()
    expect(vi.mocked(prisma.loja.update).mock.calls[0][0].data).toMatchObject({
      enablePix: true, coverImageUrl: '', primaryColor: null, secondaryColor: null, pixKey: null, pixKeyType: null,
    })
    expect(vi.mocked(prisma.loja.update).mock.calls[0][0].data).not.toHaveProperty('correiosPassword')
    assertNoSecrets(await response.json())
  })
  it('continua rejeitando imagem preenchida inválida e cores fora do formato permitido', async () => {
    const response = await adminPut(new Request('http://localhost/api/loja/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coverImageUrl: 'imagem-invalida', primaryColor: 'vermelho', secondaryColor: '#123' }),
    }))
    expect(response.status).toBe(422)
    const { details } = await response.json()
    expect(Object.keys(details.fieldErrors)).toEqual(['coverImageUrl', 'primaryColor', 'secondaryColor'])
    expect(prisma.loja.update).not.toHaveBeenCalled()
  })
  it('o formulário salva o Pix sem reenviar imagem ou identidade visual que não podem ser editadas nessa tela', async () => {
    vi.mocked(prisma.loja.findUnique).mockResolvedValue({ ...row, coverImageUrl: '/images/logo.svg',
      primaryColor: '#abc', enableManualPix: false, enablePix: false, enableCreditCard: false, enableBoleto: false } as never)
    const settings = await (await adminGet(new Request('http://localhost/api/loja/settings'))).json()
    const body = { ...lojaSettingsFormChanges({ ...settings, enablePix: true }), ...correiosCredentialChanges('', '', false) }
    for (const field of ['coverImageUrl', 'primaryColor', 'secondaryColor', 'description', 'customDomain', 'id', 'hasCorreiosPassword', 'correiosPassword']) {
      expect(body).not.toHaveProperty(field)
    }
    const response = await adminPut(new Request('http://localhost/api/loja/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }))
    expect(response.status).toBe(200)
    const data = vi.mocked(prisma.loja.update).mock.calls[0][0].data
    expect(data).toMatchObject({ enablePix: true, enableManualPix: false })
    expect(data).not.toHaveProperty('coverImageUrl')
    expect(data).not.toHaveProperty('primaryColor')
    expect(data).not.toHaveProperty('correiosPassword')
    assertNoSecrets(await response.json())
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
