import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTestDb, seedTestData, cleanupTestDb, testStoreHost } from '@/tests/setup/db'
import { createDifferentStoreAdmin } from '@/tests/setup/auth'
import { createTestOrder, createOrderStatusHistory } from '@/tests/setup/factories'
import { patch } from '@/tests/helpers/request'
import prisma from '@/lib/prisma'

const TEST_LOJA_ID = 'TEST_LOJA_TRANSITIONS'

let adminHeaders: Record<string, string>

beforeAll(async () => {
  await setupTestDb()
  const seed = await seedTestData(TEST_LOJA_ID)
  adminHeaders = { 
    Cookie: `session_id=${seed.adminUser.token}`,
    Host: testStoreHost(TEST_LOJA_ID)
  }
})

afterAll(async () => {
  await cleanupTestDb()
})

describe('Transições válidas', () => {
  it('PENDING → PAID: atualiza status e cria histórico', 
    async () => {
    const order = await createTestOrder({
      lojaID: TEST_LOJA_ID,
      status: 'PENDING',
    })

    const res = await patch(
      `/api/admin/orders/${order.id}/status`,
      { newStatus: 'PAID' },
      { headers: adminHeaders }
    )
    expect(res.status).toBe(200)

    const updated = await prisma.order.findUnique({
      where: { id: order.id }
    })
    expect(updated?.status).toBe('PAID')

    const history = await prisma.orderStatusHistory.findFirst({
      where: { orderId: order.id }
    })
    expect(history?.status).toBe('PAID')
  })

  it('PENDING → CANCELLED: cancela pedido pendente',
    async () => {
    const order = await createTestOrder({
      lojaID: TEST_LOJA_ID,
      status: 'PENDING',
    })

    const res = await patch(
      `/api/admin/orders/${order.id}/status`,
      { newStatus: 'CANCELLED' },
      { headers: adminHeaders }
    )
    expect(res.status).toBe(200)

    const updated = await prisma.order.findUnique({
      where: { id: order.id }
    })
    expect(updated?.status).toBe('CANCELLED')

    const history = await prisma.orderStatusHistory.findFirst({
      where: { orderId: order.id }
    })
    expect(history?.status).toBe('CANCELLED')
  })

  it('PAID → SHIPPED: persiste trackingCode e cria histórico',
    async () => {
    const order = await createTestOrder({
      lojaID: TEST_LOJA_ID,
      status: 'PAID',
    })

    const res = await patch(
      `/api/admin/orders/${order.id}/status`,
      { newStatus: 'SHIPPED', trackingCode: 'BR123456789' },
      { headers: adminHeaders }
    )
    expect(res.status).toBe(200)

    const updated = await prisma.order.findUnique({
      where: { id: order.id }
    })
    expect(updated?.status).toBe('SHIPPED')
    expect(updated?.trackingCode).toBe('BR123456789')

    const history = await prisma.orderStatusHistory.findFirst({
      where: { orderId: order.id }
    })
    expect(history?.status).toBe('SHIPPED')
  })

  it('PAID → CANCELLED: exige estorno confirmado antes de alterar estado',
    async () => {
    const order = await createTestOrder({
      lojaID: TEST_LOJA_ID,
      status: 'PAID',
    })

    const res = await patch(
      `/api/admin/orders/${order.id}/status`,
      { newStatus: 'CANCELLED' },
      { headers: adminHeaders }
    )
    expect(res.status).toBe(409)

    const updated = await prisma.order.findUnique({
      where: { id: order.id }
    })
    expect(updated?.status).toBe('PAID')

    const history = await prisma.orderStatusHistory.findFirst({
      where: { orderId: order.id }
    })
    expect(history).toBeNull()
  })

  it('SHIPPED → DELIVERED: entrega confirmada',
    async () => {
    const order = await createTestOrder({
      lojaID: TEST_LOJA_ID,
      status: 'SHIPPED',
    })

    const res = await patch(
      `/api/admin/orders/${order.id}/status`,
      { newStatus: 'DELIVERED' },
      { headers: adminHeaders }
    )
    expect(res.status).toBe(200)

    const updated = await prisma.order.findUnique({
      where: { id: order.id }
    })
    expect(updated?.status).toBe('DELIVERED')

    const history = await prisma.orderStatusHistory.findFirst({
      where: { orderId: order.id }
    })
    expect(history?.status).toBe('DELIVERED')
  })
})

describe('Transições inválidas', () => {
  it('PENDING → SHIPPED: rejeita transição inválida', async () => {
    const order = await createTestOrder({
      lojaID: TEST_LOJA_ID,
      status: 'PENDING',
    })
    
    const historyCountBefore = await prisma.orderStatusHistory.count({ 
      where: { orderId: order.id } 
    })
    
    const res = await patch(
      `/api/admin/orders/${order.id}/status`,
      { newStatus: 'SHIPPED' },
      { headers: adminHeaders }
    )
    
    expect(res.status).toBe(422)
    
    const body = res.body as { error?: string }
    expect(body.error).toBeDefined()
    expect(typeof body.error).toBe('string')
    expect(body.error!.length).toBeGreaterThan(0)
    
    const updated = await prisma.order.findUnique({
      where: { id: order.id }
    })
    expect(updated?.status).toBe('PENDING')
    
    const historyCountAfter = await prisma.orderStatusHistory.count({ 
      where: { orderId: order.id } 
    })
    expect(historyCountAfter).toBe(historyCountBefore)
  })
  
  it('PENDING → DELIVERED: rejeita transição inválida', async () => {
    const order = await createTestOrder({
      lojaID: TEST_LOJA_ID,
      status: 'PENDING',
    })
    
    const historyCountBefore = await prisma.orderStatusHistory.count({ 
      where: { orderId: order.id } 
    })
    
    const res = await patch(
      `/api/admin/orders/${order.id}/status`,
      { newStatus: 'DELIVERED' },
      { headers: adminHeaders }
    )
    
    expect(res.status).toBe(422)
    
    const body = res.body as { error?: string }
    expect(body.error).toBeDefined()
    expect(typeof body.error).toBe('string')
    expect(body.error!.length).toBeGreaterThan(0)
    
    const updated = await prisma.order.findUnique({
      where: { id: order.id }
    })
    expect(updated?.status).toBe('PENDING')
    
    const historyCountAfter = await prisma.orderStatusHistory.count({ 
      where: { orderId: order.id } 
    })
    expect(historyCountAfter).toBe(historyCountBefore)
  })
  
  it('PAID → PENDING: rejeita retrocesso de status', async () => {
    const order = await createTestOrder({
      lojaID: TEST_LOJA_ID,
      status: 'PAID',
    })
    
    const historyCountBefore = await prisma.orderStatusHistory.count({ 
      where: { orderId: order.id } 
    })
    
    const res = await patch(
      `/api/admin/orders/${order.id}/status`,
      { newStatus: 'PENDING' },
      { headers: adminHeaders }
    )
    
    expect(res.status).toBe(422)
    
    const body = res.body as { error?: string }
    expect(body.error).toBeDefined()
    expect(typeof body.error).toBe('string')
    expect(body.error!.length).toBeGreaterThan(0)
    
    const updated = await prisma.order.findUnique({
      where: { id: order.id }
    })
    expect(updated?.status).toBe('PAID')
    
    const historyCountAfter = await prisma.orderStatusHistory.count({ 
      where: { orderId: order.id } 
    })
    expect(historyCountAfter).toBe(historyCountBefore)
  })
  
  it('PAID → DELIVERED: rejeita salto de status', async () => {
    const order = await createTestOrder({
      lojaID: TEST_LOJA_ID,
      status: 'PAID',
    })
    
    const historyCountBefore = await prisma.orderStatusHistory.count({ 
      where: { orderId: order.id } 
    })
    
    const res = await patch(
      `/api/admin/orders/${order.id}/status`,
      { newStatus: 'DELIVERED' },
      { headers: adminHeaders }
    )
    
    expect(res.status).toBe(422)
    
    const body = res.body as { error?: string }
    expect(body.error).toBeDefined()
    expect(typeof body.error).toBe('string')
    expect(body.error!.length).toBeGreaterThan(0)
    
    const updated = await prisma.order.findUnique({
      where: { id: order.id }
    })
    expect(updated?.status).toBe('PAID')
    
    const historyCountAfter = await prisma.orderStatusHistory.count({ 
      where: { orderId: order.id } 
    })
    expect(historyCountAfter).toBe(historyCountBefore)
  })
  
  it('SHIPPED → CANCELLED: rejeita cancelamento após envio', async () => {
    const order = await createTestOrder({
      lojaID: TEST_LOJA_ID,
      status: 'SHIPPED',
    })
    
    const historyCountBefore = await prisma.orderStatusHistory.count({ 
      where: { orderId: order.id } 
    })
    
    const res = await patch(
      `/api/admin/orders/${order.id}/status`,
      { newStatus: 'CANCELLED' },
      { headers: adminHeaders }
    )
    
    expect(res.status).toBe(422)
    
    const body = res.body as { error?: string }
    expect(body.error).toBeDefined()
    expect(typeof body.error).toBe('string')
    expect(body.error!.length).toBeGreaterThan(0)
    
    const updated = await prisma.order.findUnique({
      where: { id: order.id }
    })
    expect(updated?.status).toBe('SHIPPED')
    
    const historyCountAfter = await prisma.orderStatusHistory.count({ 
      where: { orderId: order.id } 
    })
    expect(historyCountAfter).toBe(historyCountBefore)
  })
  
  it('SHIPPED → PENDING: rejeita retrocesso', async () => {
    const order = await createTestOrder({
      lojaID: TEST_LOJA_ID,
      status: 'SHIPPED',
    })
    
    const historyCountBefore = await prisma.orderStatusHistory.count({ 
      where: { orderId: order.id } 
    })
    
    const res = await patch(
      `/api/admin/orders/${order.id}/status`,
      { newStatus: 'PENDING' },
      { headers: adminHeaders }
    )
    
    expect(res.status).toBe(422)
    
    const body = res.body as { error?: string }
    expect(body.error).toBeDefined()
    expect(typeof body.error).toBe('string')
    expect(body.error!.length).toBeGreaterThan(0)
    
    const updated = await prisma.order.findUnique({
      where: { id: order.id }
    })
    expect(updated?.status).toBe('SHIPPED')
    
    const historyCountAfter = await prisma.orderStatusHistory.count({ 
      where: { orderId: order.id } 
    })
    expect(historyCountAfter).toBe(historyCountBefore)
  })
  
  it('DELIVERED → PAID: rejeita transição de estado final', async () => {
    const order = await createTestOrder({
      lojaID: TEST_LOJA_ID,
      status: 'DELIVERED',
    })
    
    const historyCountBefore = await prisma.orderStatusHistory.count({ 
      where: { orderId: order.id } 
    })
    
    const res = await patch(
      `/api/admin/orders/${order.id}/status`,
      { newStatus: 'PAID' },
      { headers: adminHeaders }
    )
    
    expect(res.status).toBe(422)
    
    const body = res.body as { error?: string }
    expect(body.error).toBeDefined()
    expect(typeof body.error).toBe('string')
    expect(body.error!.length).toBeGreaterThan(0)
    
    const updated = await prisma.order.findUnique({
      where: { id: order.id }
    })
    expect(updated?.status).toBe('DELIVERED')
    
    const historyCountAfter = await prisma.orderStatusHistory.count({ 
      where: { orderId: order.id } 
    })
    expect(historyCountAfter).toBe(historyCountBefore)
  })
  
  it('CANCELLED → PENDING: rejeita transição de estado final', async () => {
    const order = await createTestOrder({
      lojaID: TEST_LOJA_ID,
      status: 'CANCELLED',
    })
    
    const historyCountBefore = await prisma.orderStatusHistory.count({ 
      where: { orderId: order.id } 
    })
    
    const res = await patch(
      `/api/admin/orders/${order.id}/status`,
      { newStatus: 'PENDING' },
      { headers: adminHeaders }
    )
    
    expect(res.status).toBe(422)
    
    const body = res.body as { error?: string }
    expect(body.error).toBeDefined()
    expect(typeof body.error).toBe('string')
    expect(body.error!.length).toBeGreaterThan(0)
    
    const updated = await prisma.order.findUnique({
      where: { id: order.id }
    })
    expect(updated?.status).toBe('CANCELLED')
    
    const historyCountAfter = await prisma.orderStatusHistory.count({ 
      where: { orderId: order.id } 
    })
    expect(historyCountAfter).toBe(historyCountBefore)
  })
})

describe('Segurança das transições', () => {
  it('sem token: retorna 401', async () => {
    const order = await createTestOrder({
      lojaID: TEST_LOJA_ID,
      status: 'PENDING',
    })
    const res = await patch(
      `/api/admin/orders/${order.id}/status`,
      { newStatus: 'PAID' },
      {}
    )
    expect(res.status).toBe(401)
  })
  
  it('token inválido: retorna 401', async () => {
    const order = await createTestOrder({
      lojaID: TEST_LOJA_ID,
      status: 'PENDING',
    })
    const res = await patch(
      `/api/admin/orders/${order.id}/status`,
      { newStatus: 'PAID' },
      { headers: { Cookie: 'session_id=token-invalido' } }
    )
    expect(res.status).toBe(401)
  })
  
  it('token de outra loja: retorna 404 e não altera status',
    async () => {
    const otherStore = await createDifferentStoreAdmin()
    const order = await createTestOrder({
      lojaID: TEST_LOJA_ID,
      status: 'PENDING',
    })

    const historyCountBefore = await prisma.orderStatusHistory.count({
      where: { orderId: order.id },
    })

    const res = await patch(
      `/api/admin/orders/${order.id}/status`,
      { newStatus: 'PAID' },
      { headers: otherStore.headers }
    )
    expect(res.status).toBe(404)

    const unchanged = await prisma.order.findUnique({
      where: { id: order.id }
    })
    expect(unchanged?.status).toBe('PENDING')

    const historyCountAfter = await prisma.orderStatusHistory.count({
      where: { orderId: order.id },
    })
    expect(historyCountAfter).toBe(historyCountBefore)
  })
  
  it('orderId inexistente: retorna 404', async () => {
    const res = await patch(
      '/api/admin/orders/id-que-nao-existe/status',
      { newStatus: 'PAID' },
      { headers: adminHeaders }
    )
    expect(res.status).toBe(404)
  })
})
