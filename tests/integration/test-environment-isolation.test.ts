import { afterAll, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import prisma, { verifyTestDatabase } from '@/lib/prisma'
import { createFixtureStore, cleanupFixtureStores } from '@/tests/setup/fixture-scope'
import { get } from '@/tests/helpers/request'
import { testServerConfig } from '@/lib/testing/database-policy'

afterAll(async () => { await prisma.$disconnect() })

describe('WF-01: isolamento real do banco e servidor', () => {
  it('o cliente que escreve fixtures verifica banco, papel restrito e sentinela', async () => {
    const identity = await verifyTestDatabase()
    expect(identity.runId).toBe(process.env.TEST_RUN_ID)
    const rows = await prisma.$queryRaw<Array<{ database: string; role: string }>>`
      SELECT current_database() AS database, current_user AS role
    `
    expect(rows[0]).toEqual({ database: identity.database, role: 'ecommerce_test' })
  })

  it('uma DATABASE_URL externa não é usada pelo cliente de fixtures ou serviços', async () => {
    const original = process.env.DATABASE_URL
    let testClient: typeof prisma | undefined
    try {
      process.env.DATABASE_URL = 'postgresql://forbidden:forbidden@production.invalid:5432/production'
      vi.resetModules()
      testClient = (await import('@/lib/prisma')).default
      const rows = await testClient.$queryRaw<Array<{ database: string }>>`SELECT current_database() AS database`
      expect(rows[0].database).toBe(testServerConfig().database)
    } finally {
      process.env.DATABASE_URL = original
      await testClient?.$disconnect()
    }
  })

  it('o papel de aplicação não consegue modificar ou excluir a sentinela', async () => {
    await verifyTestDatabase()
    await expect(prisma.$executeRaw`UPDATE public."_TestDatabaseSentinel" SET run_id = 'changed'`).rejects.toThrow()
    await expect(prisma.$executeRaw`DROP TABLE public."_TestDatabaseSentinel"`).rejects.toThrow()
    await expect(prisma.$executeRaw`DROP SCHEMA public CASCADE`).rejects.toThrow()
    await verifyTestDatabase()
  })

  it('o servidor HTTP confirma o mesmo banco e não aceita um token incorreto', async () => {
    const config = testServerConfig()
    const response = await get('/api/test-environment', { headers: { 'x-test-environment-token': config.token } })
    expect(response).toEqual({ status: 200, body: { runId: config.runId, database: config.database } })
    expect((await get('/api/test-environment', { headers: { 'x-test-environment-token': 'incorrect' } })).status).toBe(404)
  })

  it('cleanup é atômico e não apaga registros de uma loja fora do escopo', async () => {
    await verifyTestDatabase()
    const owned = await createFixtureStore()
    const other = await prisma.loja.create({ data: {
      name: 'Fora do escopo', slug: `outside-${randomUUID()}`, description: '', coverImageUrl: '',
    } })
    const actor = await prisma.user.create({ data: { lojaID: owned, name: 'Actor', email: 'actor@fixture.test', password: '', role: 'ADMIN' } })
    const buyer = await prisma.user.create({ data: { lojaID: other.id, name: 'Buyer', email: 'buyer@fixture.test', password: '' } })
    const orderData = { status: 'PENDING' as const, deliveryType: 'PICKUP' as const, subtotal: 10, total: 10 }
    const ownedOrder = await prisma.order.create({ data: { ...orderData, lojaID: owned, userID: actor.id } })
    const otherOrder = await prisma.order.create({ data: { ...orderData, lojaID: other.id, userID: buyer.id } })
    const externalHistory = await prisma.orderStatusHistory.create({ data: { orderId: otherOrder.id, performedById: actor.id, status: 'PENDING' } })
    try {
      // External FK intentionally causes the final user delete to fail. Earlier
      // owned order deletes must roll back instead of leaving half a fixture.
      await expect(cleanupFixtureStores()).rejects.toThrow()
      expect(await prisma.order.findUnique({ where: { id: ownedOrder.id } })).not.toBeNull()
      expect(await prisma.user.findUnique({ where: { id: actor.id } })).not.toBeNull()
      await prisma.orderStatusHistory.delete({ where: { id: externalHistory.id } })
      await cleanupFixtureStores()
      expect(await prisma.loja.findUnique({ where: { id: owned } })).toBeNull()
      expect(await prisma.order.findUnique({ where: { id: otherOrder.id } })).not.toBeNull()
      await verifyTestDatabase()
    } finally {
      await prisma.orderStatusHistory.deleteMany({ where: { orderId: otherOrder.id } })
      await cleanupFixtureStores()
      await prisma.order.delete({ where: { id: otherOrder.id } })
      await prisma.user.delete({ where: { id: buyer.id } })
      await prisma.loja.delete({ where: { id: other.id } })
    }
  })
})
