import { afterAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import prisma, { verifyTestDatabase } from '@/lib/prisma'
import { createFixtureStore, cleanupFixtureStores } from '@/tests/setup/fixture-scope'
import { get, put } from '@/tests/helpers/request'

afterAll(async () => { await cleanupFixtureStores(); await prisma.$disconnect() })

describe('WF-02: credenciais-canário no banco e no servidor HTTP', () => {
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
