import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomUUID, randomBytes } from 'node:crypto'
import prisma from '@/lib/prisma'
import { hashSessionToken } from '@/lib/session-token'
import { setupTestDb, seedTestData, cleanupTestDb, testStoreHost } from '@/tests/setup/db'
import { get, patch, post } from '@/tests/helpers/request'

describe('HTTP authorization with persisted session hashes', () => {
  const storeA = 'http-a-' + randomUUID()
  const storeB = 'http-b-' + randomUUID()
  let a: Awaited<ReturnType<typeof seedTestData>>
  let b: typeof a
  let headersA: Record<string, string>
  let headersB: Record<string, string>
  let customerHeaders: Record<string, string>
  type Route = { method: 'GET' | 'PATCH' | 'POST'; path: string; body?: unknown; status: number }
  let routes: Route[]
  const request = (route: Route, headers: Record<string, string>) => route.method === 'GET'
    ? get(route.path, { headers }) : route.method === 'PATCH'
      ? patch(route.path, route.body, { headers }) : post(route.path, route.body, { headers })

  beforeAll(async () => {
    await setupTestDb()
    a = await seedTestData(storeA)
    b = await seedTestData(storeB)
    headersA = { Host: testStoreHost(storeA), Cookie: 'session_id=' + a.adminUser.token }
    headersB = { Host: testStoreHost(storeB), Cookie: 'session_id=' + b.adminUser.token }
    const raw = randomBytes(32).toString('hex')
    await prisma.session.create({ data: { id: hashSessionToken(raw), userId: a.customers[0].id, expiresAt: new Date(Date.now() + 600000) } })
    customerHeaders = { Host: testStoreHost(storeA), Cookie: 'session_id=' + raw }
    const order = '/api/admin/orders/' + a.orders[0].id
    const customer = '/api/admin/customers/' + a.customers[0].id
    routes = [
      { method: 'GET', path: '/api/admin/orders', status: 200 },
      { method: 'GET', path: order, status: 200 },
      { method: 'PATCH', path: order + '/status', body: { newStatus: 'CANCELLED' }, status: 200 },
      { method: 'PATCH', path: order + '/notes', body: { adminNotes: 'Isolated HTTP fixture' }, status: 200 },
      { method: 'GET', path: '/api/admin/freight', status: 200 },
      { method: 'POST', path: '/api/admin/freight', body: { cityName: 'Fixture City', value: 12.5 }, status: 201 },
      { method: 'GET', path: '/api/admin/customers', status: 200 },
      { method: 'GET', path: customer, status: 200 },
      { method: 'GET', path: customer + '/metrics', status: 200 },
    ]
  })
  afterAll(cleanupTestDb)

  for (const scenario of ['anonymous', 'invalid', 'customer', 'foreign session'] as const) {
    it(scenario + ' cannot administer the selected tenant', async () => {
      const headers = scenario === 'customer' ? customerHeaders : {
        Host: testStoreHost(storeA),
        ...(scenario === 'invalid' ? { Cookie: 'session_id=invalid' } : {}),
        ...(scenario === 'foreign session' ? { Cookie: headersB.Cookie } : {}),
      }
      for (const route of routes) {
        const res = await request(route, headers)
        expect(res.status, route.method + ' ' + route.path).toBe(scenario === 'customer' ? 403 : 401)
        expect(JSON.stringify(res.body)).not.toContain(storeB)
      }
    })
  }
  it('valid payloads have endpoint-specific success statuses', async () => {
    for (const route of routes) expect((await request(route, headersA)).status, route.path).toBe(route.status)
  })
  it('cross-tenant resources are hidden even with valid payloads', async () => {
    for (const route of routes.filter(r => r.path.includes(a.orders[0].id) || r.path.includes(a.customers[0].id))) {
      expect((await request(route, headersB)).status, route.path).toBe(404)
    }
  })
  it('paginated lists contain only this tenant', async () => {
    const customers = await get('/api/admin/customers', { headers: headersA })
    expect(customers.status).toBe(200)
    const rows = (customers.body as { data: { data: { id: string }[] } }).data.data
    expect(rows).toHaveLength(10)
    expect(rows.every(row => a.customers.some(customer => customer.id === row.id))).toBe(true)
    const orders = await get('/api/admin/orders', { headers: headersA })
    expect(orders.status).toBe(200)
    const orderRows = (orders.body as { data: { data: { id: string }[] } }).data.data
    expect(orderRows.length).toBeGreaterThan(0)
    expect(orderRows.every(row => a.orders.some(order => order.id === row.id))).toBe(true)
  })
  it('malformed payloads do not change orders', async () => {
    const id = a.orders[1].id
    const before = await prisma.order.findUniqueOrThrow({ where: { id } })
    expect((await patch('/api/admin/orders/' + id + '/status', { newStatus: 'INVALID' }, { headers: headersA })).status).toBe(422)
    expect((await prisma.order.findUniqueOrThrow({ where: { id } })).status).toBe(before.status)
  })
  it('enforces ownership on the public order endpoint without unauthorized mutations', async () => {
    const own = '/api/orders/' + a.orders[0].id
    const other = '/api/orders/' + a.orders[1].id
    expect((await get(own, { headers: { Host: testStoreHost(storeA) } })).status).toBe(401)
    expect((await get(own, { headers: customerHeaders })).status).toBe(200)
    expect((await get(other, { headers: customerHeaders })).status).toBe(403)
    expect((await get(own, { headers: headersA })).status).toBe(200)
    expect((await get(own, { headers: headersB })).status).toBe(404)
    const before = await prisma.order.findUniqueOrThrow({ where: { id: a.orders[1].id } })
    expect((await patch(other, { status: 'CANCELLED' }, { headers: customerHeaders })).status).toBe(403)
    expect((await prisma.order.findUniqueOrThrow({ where: { id: before.id } })).status).toBe(before.status)
  })
})
