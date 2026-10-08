import { afterAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import prisma, { verifyTestDatabase } from '@/lib/prisma'
import { createFixtureStore, cleanupFixtureStores } from '@/tests/setup/fixture-scope'
import { get, put } from '@/tests/helpers/request'
import { lojaSettingsFormChanges, correiosCredentialChanges, type AdminLojaDTO } from '@/lib/loja-dto'

afterAll(async () => { await cleanupFixtureStores(); await prisma.$disconnect() })

describe('WF-02: credenciais-canário no banco e no servidor HTTP', () => {
  it('salva o payload do painel preservando imagem relativa, tema e credenciais armazenadas', async () => {
    await verifyTestDatabase()
    const lojaID = await createFixtureStore()
    const host = `pix-form-${lojaID}.example.test`
    await prisma.loja.update({ where: { id: lojaID }, data: {
      customDomain: host, coverImageUrl: '/images/logo.svg', primaryColor: '#abc',
      enableManualPix: false, pixKey: null, pixKeyType: null, whatsappNumber: null,
      correiosPassword: 'CANARY_FORM_PASSWORD', correiosContractCode: 'CANARY_FORM_CONTRACT',
    } })
    const user = await prisma.user.create({ data: { lojaID, name: 'Admin', email: 'pix-form@fixture.test', password: '', role: 'ADMIN' } })
    const session = await prisma.session.create({ data: { id: randomUUID(), userId: user.id, expiresAt: new Date(Date.now() + 60000) } })
    const options = { headers: { Host: host, Cookie: `session_id=${session.id}` } }
    const current = await get('/api/loja/settings', options)
    expect(current.status).toBe(200)
    const body = {
      ...lojaSettingsFormChanges({ ...(current.body as AdminLojaDTO), enablePix: true }),
      ...correiosCredentialChanges('', '', false),
    }
    const result = await put('/api/loja/settings', body, options)
    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({ enablePix: true, coverImageUrl: '/images/logo.svg', primaryColor: '#abc',
      pixKey: null, hasCorreiosPassword: true, hasCorreiosContractCode: true })
    expect(JSON.stringify(result.body)).not.toContain('CANARY_')
    expect(await prisma.loja.findUniqueOrThrow({ where: { id: lojaID } })).toMatchObject({
      enablePix: true, coverImageUrl: '/images/logo.svg', primaryColor: '#abc', customDomain: host,
      correiosPassword: 'CANARY_FORM_PASSWORD', correiosContractCode: 'CANARY_FORM_CONTRACT',
    })
    expect((await get('/api/loja/settings', options)).body).toMatchObject({ enablePix: true })
  })
  it('persiste Pix automático no formulário completo com imagem vazia e cores nulas, preservando credenciais', async () => {
    await verifyTestDatabase()
    const lojaID = await createFixtureStore()
    const host = `pix-${lojaID}.example.test`
    await prisma.loja.update({ where: { id: lojaID }, data: {
      customDomain: host,
      coverImageUrl: '', primaryColor: null, secondaryColor: null,
      enableManualPix: false, pixKey: null, pixKeyType: null, whatsappNumber: null,
      correiosPassword: 'CANARY_UNCHANGED_PASSWORD', correiosContractCode: 'CANARY_UNCHANGED_CONTRACT',
    } })
    const user = await prisma.user.create({ data: { lojaID, name: 'Admin', email: 'pix@fixture.test', password: '', role: 'ADMIN' } })
    const session = await prisma.session.create({ data: { id: randomUUID(), userId: user.id, expiresAt: new Date(Date.now() + 60000) } })
    const options = { headers: { Host: host, Cookie: `session_id=${session.id}` } }
    const current = await get('/api/loja/settings', options)
    expect(current.status).toBe(200)
    const result = await put('/api/loja/settings', { ...(current.body as Record<string, unknown>), enablePix: true }, options)
    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({ enablePix: true, coverImageUrl: '', primaryColor: null, secondaryColor: null,
      pixKey: null, pixKeyType: null, hasCorreiosPassword: true, hasCorreiosContractCode: true })
    expect(JSON.stringify(result.body)).not.toContain('CANARY_')
    const stored = await prisma.loja.findUniqueOrThrow({ where: { id: lojaID } })
    expect(stored).toMatchObject({ enablePix: true, correiosPassword: 'CANARY_UNCHANGED_PASSWORD', correiosContractCode: 'CANARY_UNCHANGED_CONTRACT' })
    expect((await get('/api/loja/settings', options)).body).toMatchObject({ enablePix: true })
  })
  it('não entrega segredos; edição comum preserva, substituição e remoção são explícitas', async () => {
    await verifyTestDatabase()
    const lojaID = await createFixtureStore()
    const store = await prisma.loja.update({ where: { id: lojaID }, data: {
      correiosContractCode: 'CANARY_CONTRACT_REAL_DB', correiosPassword: 'CANARY_PASSWORD_REAL_DB',
      nuvemshopAccessToken: 'CANARY_ERP_REAL_DB',
    } })
    const user = await prisma.user.create({ data: { lojaID, name: 'Admin', email: 'admin@fixture.test', password: '', role: 'ADMIN' } })
    const session = await prisma.session.create({ data: { id: randomUUID(), userId: user.id, expiresAt: new Date(Date.now() + 60000) } })
    const options = { headers: { Cookie: `session_id=${session.id}` } }
    const assertSafe = (response: { status: number; body: unknown }) => {
      expect(response.status).toBe(200)
      expect(JSON.stringify(response.body)).not.toContain('CANARY_')
      expect(response.body).not.toHaveProperty('correiosPassword')
      expect(response.body).not.toHaveProperty('correiosContractCode')
    }
    assertSafe(await get(`/api/loja/${store.slug}`))
    const admin = await get('/api/loja/settings', options)
    assertSafe(admin)
    expect(admin.body).toMatchObject({ hasCorreiosPassword: true, hasCorreiosContractCode: true })
    assertSafe(await put('/api/loja/settings', { name: 'Loja atualizada' }, options))
    expect((await prisma.loja.findUniqueOrThrow({ where: { id: lojaID } })).correiosPassword).toBe('CANARY_PASSWORD_REAL_DB')
    assertSafe(await put('/api/loja/settings', { correiosPassword: 'CANARY_REPLACEMENT' }, options))
    expect((await prisma.loja.findUniqueOrThrow({ where: { id: lojaID } })).correiosPassword).toBe('CANARY_REPLACEMENT')
    assertSafe(await put('/api/loja/settings', { correiosPassword: null, correiosContractCode: null }, options))
    expect((await prisma.loja.findUniqueOrThrow({ where: { id: lojaID } })).correiosPassword).toBeNull()
    expect((await get('/api/loja/settings', options)).body).toMatchObject({ hasCorreiosPassword: false, hasCorreiosContractCode: false })
  })
})
