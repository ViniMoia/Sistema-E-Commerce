import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTestDb, seedTestData, cleanupTestDb } from '@/tests/setup/db'
import { createTestCustomer, createTestOrder } from '@/tests/setup/factories'
import { createAuthHeaders } from '@/tests/setup/auth'
import { get } from '@/tests/helpers/request'
import { startQueryProfiler } from '@/tests/helpers/query-profiler'

const TEST_LOJA_ID = 'LOAD_TEST_LOJA'
const SEARCH_TERM = 'Cliente'

describe('Testes de carga — customer endpoints', () => {
  let seed: Awaited<ReturnType<typeof seedTestData>>
  let headers: Record<string, string>
  let customerIds: string[]

  beforeAll(async () => {
    await setupTestDb()
    seed = await seedTestData(TEST_LOJA_ID)
    headers = await createAuthHeaders(TEST_LOJA_ID)

    const allCreated: Array<{ id: string }> = []
    for (let i = 0; i < 10; i++) {
      const batch = await Promise.all(
        Array.from({ length: 100 }, () =>
          createTestCustomer({
            name: `Cliente ${allCreated.length}`,
            email: `cliente-load-${allCreated.length}@test.com`,
            lojaID: TEST_LOJA_ID
          })
        )
      )
      allCreated.push(...batch)
    }
    customerIds = allCreated.map(c => c.id)

    for (let i = 0; i < 50; i++) {
      await Promise.all(
        Array.from({ length: 100 }, (_, j) =>
          createTestOrder({
            userID: customerIds[(i * 100 + j) % customerIds.length],
            lojaID: TEST_LOJA_ID
          })
        )
      )
    }
  }, 120_000)

  afterAll(async () => {
    await cleanupTestDb()
  })

  it('deve retornar lista de clientes em menos de 2s com 1000+ registros', async () => {
    const start = Date.now()
    const res = await get('/api/admin/customers', { headers })
    const elapsed = Date.now() - start
    const data = res.body as { data?: unknown[] }

    expect(res.status).toBe(200)
    expect(elapsed).toBeLessThan(2000)
    expect(data.data?.length).toBeGreaterThan(0)
  })

  it('deve paginar corretamente sem sobreposicao de registros', async () => {
    const page1Res = await get('/api/admin/customers', {
      headers,
      query: { limit: '100', page: '1' }
    })
    const page2Res = await get('/api/admin/customers', {
      headers,
      query: { limit: '100', page: '2' }
    })

    const page1Data = page1Res.body as { data?: Array<{ id: string }> }
    const page2Data = page2Res.body as { data?: Array<{ id: string }> }

    expect(page1Data.data?.length).toBe(100)
    expect(page2Data.data?.length).toBe(100)

    const page1Ids = new Set(page1Data.data?.map(r => r.id) || [])
    page2Data.data?.forEach(r => {
      expect(page1Ids.has(r.id)).toBe(false)
    })
  })

  it('deve executar no maximo 3 queries para listar clientes', async () => {
    const profiler = startQueryProfiler()
    await get('/api/admin/customers', { headers })
    const report = profiler.stop()

    expect(report.queryCount).toBeLessThanOrEqual(3)
    const slowQueries = report.queries.filter(q => q.duration > 100)
    expect(slowQueries.length).toBe(0)
  })

  it('deve retornar metricas de cliente em menos de 1s com volume alto', async () => {
    const customerId = customerIds[0]
    const start = Date.now()
    const res = await get(`/api/admin/customers/${customerId}/metrics`, { headers })
    const elapsed = Date.now() - start
    const data = res.body as Record<string, unknown>

    expect(res.status).toBe(200)
    expect(elapsed).toBeLessThan(1000)
    expect(Number(data.averageOrderValue)).toBeGreaterThan(0)
    expect(data.preferredDeliveryType).not.toBeNull()
  })

  it('deve filtrar clientes por busca e retornar apenas resultados correspondentes', async () => {
    const start = Date.now()
    const res = await get('/api/admin/customers', {
      headers,
      query: { search: SEARCH_TERM }
    })
    const elapsed = Date.now() - start
    const data = res.body as { data?: Array<{ name: string; email: string }> }

    expect(res.status).toBe(200)
    expect(elapsed).toBeLessThan(1500)
    expect(data.data?.length).toBeGreaterThan(0)
    data.data?.forEach(c => {
      const nameMatch = c.name.toLowerCase().includes(SEARCH_TERM.toLowerCase())
      const emailMatch = c.email.toLowerCase().includes(SEARCH_TERM.toLowerCase())
      expect(nameMatch || emailMatch).toBe(true)
    })
  })
})