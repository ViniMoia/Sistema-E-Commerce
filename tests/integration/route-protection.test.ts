import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTestDb, seedTestData, cleanupTestDb } from '@/tests/setup/db'
import { createAuthHeaders } from '@/tests/setup/auth'
import { get, patch, post, del } from '@/tests/helpers/request'

const LOJA_A = 'LOJA_A'
const LOJA_B = 'LOJA_B'

interface SeedData {
  adminUser: { id: string; lojaID: string; token: string }
  customers: Array<{ id: string; name: string; email: string }>
  orders: Array<{ id: string; status: string; userID: string }>
}

describe('Proteção de rotas admin', () => {
  let lojaA: SeedData
  let lojaB: SeedData
  let headersA: Record<string, string>
  let headersB: Record<string, string>
  let routes: Array<[string, string]> = []

  beforeAll(async () => {
    await setupTestDb()
    lojaA = await seedTestData(LOJA_A)
    lojaB = await seedTestData(LOJA_B)
    headersA = { Cookie: `session_id=${lojaA.adminUser.token}` }
    headersB = { Cookie: `session_id=${lojaB.adminUser.token}` }
    
    routes = [
      ['GET', '/api/admin/orders'],
      ['GET', `/api/admin/orders/${lojaA.orders[0].id}`],
      ['PATCH', `/api/admin/orders/${lojaA.orders[0].id}/status`],
      ['PATCH', `/api/admin/orders/${lojaA.orders[0].id}/notes`],
      ['GET', '/api/admin/freight'],
      ['POST', '/api/admin/freight'],
      ['GET', '/api/admin/customers'],
      ['GET', `/api/admin/customers/${lojaA.customers[0].id}`],
      ['GET', 
       `/api/admin/customers/${lojaA.customers[0].id}/metrics`],
    ]
  })

  afterAll(async () => {
    await cleanupTestDb()
  })

  async function testRoute(
    method: 'get' | 'patch' | 'post' | 'delete',
    path: string,
    body?: unknown,
    opts?: { headers?: Record<string, string> }
  ) {
    const baseUrl = (() => { const u = process.env.TEST_BASE_URL; if (!u) throw new Error('TEST_BASE_URL env var is required'); return u })()
    const url = new URL(path, baseUrl)

    const res = await fetch(url.toString(), {
      method: method.toUpperCase(),
      headers: { 'Content-Type': 'application/json', ...opts?.headers },
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include'
    })

    let responseBody: unknown
    try { responseBody = await res.json() } catch { responseBody = null }
    return { status: res.status, body: responseBody }
  }

   describe('Proteção de rotas — cenários por rota', () => {
     it('sem token → 401 em todas as rotas', async () => {
       for (const [method, path] of routes) {
         const res = await testRoute(
           method.toLowerCase() as 'get' | 'patch' | 'post',
           path,
           undefined,
           {}
         )
         expect(res.status, `${method} ${path} sem token`).toBe(401)
       }
     })

     it('token inválido → 401 em todas as rotas', async () => {
       for (const [method, path] of routes) {
         const res = await testRoute(
           method.toLowerCase() as 'get' | 'patch' | 'post',
           path,
           undefined,
           { headers: { Cookie: 'session_id=invalid' } }
         )
         expect(res.status, `${method} ${path} token inválido`)
           .toBe(401)
       }
     })

     it('recurso de outra loja → 404 em todas as rotas', 
       async () => {
        const crossRoutes: Array<[string, string]> = [
          ['GET', `/api/admin/orders/${lojaB.orders[0].id}`],
          ['PATCH', 
           `/api/admin/orders/${lojaB.orders[0].id}/status`],
          ['PATCH', 
           `/api/admin/orders/${lojaB.orders[0].id}/notes`],
          ['GET', `/api/admin/customers/${lojaB.customers[0].id}`],
          ['GET', 
           `/api/admin/customers/${lojaB.customers[0].id}/metrics`],
        ]
       for (const [method, path] of crossRoutes) {
         const res = await testRoute(
           method.toLowerCase() as 'get' | 'patch' | 'post',
           path,
           undefined,
           { headers: headersA }
         )
         expect(res.status, `${method} ${path} cross-store`)
           .toBe(404)
       }
     })

     it('recurso da própria loja → 200 em todas as rotas',
       async () => {
       for (const [method, path] of routes) {
         const res = await testRoute(
           method.toLowerCase() as 'get' | 'patch' | 'post',
           path,
           undefined,
           { headers: headersA }
         )
         expect(res.status, `${method} ${path} própria loja`)
           .toBe(200)
       }
     })
   })

   describe('Testes de vazamento de dados', () => {
     it('listCustomers não retorna clientes de outra loja', async () => {
       const res = await testRoute('get', '/api/admin/customers', undefined, { headers: headersA })
       expect(res.status).toBe(200)
       const data = res.body as { data?: Array<{ id: string }> }
       expect(data.data?.length).toBe(10)
       const allFromLojaA = data.data?.every(c => !lojaB.customers.find(cb => cb.id === c.id))
       expect(allFromLojaA).toBe(true)
     })

     it('listOrders não retorna pedidos de outra loja', async () => {
       const res = await testRoute('get', '/api/admin/orders', undefined, { headers: headersA })
       expect(res.status).toBe(200)
       const data = res.body as Array<{ lojaID?: string }>
       const allFromLojaA = data.every(o => o.lojaID === LOJA_A)
       expect(allFromLojaA).toBe(true)
     })

it('getCustomerMetrics não vaza dados de outra loja', async () => {
        const customerId = lojaA.customers[0]?.id
        expect(customerId).toBeDefined()
        const resA = await testRoute('get', `/api/admin/customers/${customerId}/metrics`, undefined, { headers: headersA })
        expect(resA.status).toBe(200)
        const resB = await testRoute('get', `/api/admin/customers/${customerId}/metrics`, undefined, { headers: headersB })
        expect(resB.status).toBe(404)
      })

      it('Nenhuma rota expõe lojaID no corpo de erro', async () => {
        const allRoutes = [
          ['get', '/api/admin/orders'],
          ['get', `/api/admin/orders/${lojaA.orders[0].id}`],
          ['patch', 
           `/api/admin/orders/${lojaA.orders[0].id}/status`],
          ['patch', 
           `/api/admin/orders/${lojaA.orders[0].id}/notes`],
          ['get', '/api/admin/freight'],
          ['post', '/api/admin/freight'],
          ['get', '/api/admin/customers'],
          ['get', `/api/admin/customers/${lojaA.customers[0].id}`],
          ['get', 
           `/api/admin/customers/${lojaA.customers[0].id}/metrics`],
        ]
        for (const [method, path] of allRoutes) {
          const res = await testRoute(method as 'get', path, undefined, {})
          const bodyStr = JSON.stringify(res.body)
          expect(bodyStr).not.toContain('lojaID')
          expect(bodyStr).not.toContain(LOJA_A)
          expect(bodyStr).not.toContain(LOJA_B)
        }
      })
   })
})