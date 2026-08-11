import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTestDb, seedTestData, cleanupTestDb } from '@/tests/setup/db'
import { createTestCustomer, createTestOrder, createTestOrderItem } from '@/tests/setup/factories'
import { startQueryProfiler } from '@/tests/helpers/query-profiler'
import { listCustomers, getCustomerMetrics } from '@/lib/services/customer.service'
import { listOrdersForAdmin } from '@/lib/services/order.service'
import { Prisma, Role, UserStatus, OrderStatus, DeliveryType } from '@prisma/client'

const TARGETS = {
  listCustomers: 100,
  listCustomersWithSearch: 150,
  listCustomersCursor: 100,
  metricsSmall: 200,
  metricsLarge: 500,
  listOrders: 150,
}

describe('Performance de queries de métricas', () => {
  let TEST_LOJA_ID: string
  let testCustomers: Array<{ id: string; name: string; email: string }>
  let customerWith100Orders: string
  let customerWith1000Orders: string
  let allCustomerIds: string[]

  beforeAll(async () => {
    await setupTestDb()

    const seeded = await seedTestData('PERF-LOJA')
    TEST_LOJA_ID = seeded.adminUser.lojaID

    const hashedPassword = 'hashedpasswordplaceholder'
    const createdUsers = []
    const batchSize = 100
    const totalCustomers = 1000
    const ordersPerCustomer = 50

    for (let batchStart = 0; batchStart < totalCustomers; batchStart += batchSize) {
      const batchUsers = []
      for (let i = batchStart; i < batchStart + batchSize && i < totalCustomers; i++) {
        const user = await createTestCustomer({
          name: `Cliente ${i}`,
          email: `cliente-perf-${i}@test.com`,
          password: 'test123456',
          role: Role.CUSTOMER,
          status: UserStatus.ACTIVE,
          lojaID: TEST_LOJA_ID
        })
        batchUsers.push(user)
      }
      createdUsers.push(...batchUsers)
    }

    testCustomers = createdUsers.map(u => ({ id: u.id, name: u.name, email: u.email }))
    allCustomerIds = testCustomers.map(c => c.id)

    customerWith100Orders = testCustomers[0].id
    for (let i = 0; i < 100; i++) {
      const order = await createTestOrder({
        userID: customerWith100Orders,
        lojaID: TEST_LOJA_ID,
        status: i < 50 ? OrderStatus.PAID : OrderStatus.DELIVERED,
        total: 50 + (i * 5),
        deliveryType: i % 2 === 0 ? DeliveryType.DELIVERY : DeliveryType.PICKUP
      })
      await createTestOrderItem({
        orderId: order.id,
        name: `Produto ${i}`,
        quantity: 1 + (i % 3),
        price: 50 + (i * 5)
      })
    }

    customerWith1000Orders = testCustomers[1].id
    for (let i = 0; i < 1000; i++) {
      const order = await createTestOrder({
        userID: customerWith1000Orders,
        lojaID: TEST_LOJA_ID,
        status: i < 300 ? OrderStatus.PAID : i < 700 ? OrderStatus.DELIVERED : OrderStatus.CANCELLED,
        total: 30 + (i % 100),
        deliveryType: i % 3 === 0 ? DeliveryType.DELIVERY : DeliveryType.PICKUP
      })
      await createTestOrderItem({
        orderId: order.id,
        name: `Produto ${i % 50}`,
        quantity: 1 + (i % 4),
        price: 30 + (i % 100)
      })
    }

    let createdOrdersCount = 0
    const targetOrders = 500
    for (const customer of testCustomers.slice(2)) {
      if (createdOrdersCount >= targetOrders) break
      for (let i = 0; i < 10 && createdOrdersCount < targetOrders; i++) {
        await createTestOrder({
          userID: customer.id,
          lojaID: TEST_LOJA_ID,
          status: OrderStatus.PAID,
          total: 80 + (i * 10),
          deliveryType: DeliveryType.DELIVERY
        })
        createdOrdersCount++
      }
    }
  })

  afterAll(async () => {
    await cleanupTestDb()
  })

  describe('Grupo 1 — Performance de listCustomers', () => {
    it('listCustomers com 1000 clientes termina em menos de 100ms', async () => {
      const profiler = startQueryProfiler()
      const result = await listCustomers({ lojaID: TEST_LOJA_ID, limit: 20 })
      const report = profiler.stop()

      expect(result.data.length).toBeGreaterThan(0)
      expect(report.totalDuration).toBeLessThan(TARGETS.listCustomers)
    })

    it('listCustomers com search termina em menos de 150ms', async () => {
      const profiler = startQueryProfiler()
      const result = await listCustomers({
        lojaID: TEST_LOJA_ID,
        limit: 20,
        search: 'Cliente'
      })
      const report = profiler.stop()

      expect(result.data.length).toBeGreaterThan(0)
      expect(report.totalDuration).toBeLessThan(TARGETS.listCustomersWithSearch)
    })

    it('listCustomers paginação cursor não degrada na página 5', async () => {
      const pageDurations: number[] = []
      let currentCursor: string | null = null

      for (let page = 0; page < 5; page++) {
        const profiler = startQueryProfiler()
        const result = await listCustomers({
          lojaID: TEST_LOJA_ID,
          limit: 20,
          cursor: currentCursor || undefined
        })
        const report = profiler.stop()

        pageDurations.push(report.totalDuration)
        currentCursor = result.nextCursor

        expect(report.totalDuration).toBeLessThan(TARGETS.listCustomersCursor)
      }

      const firstPageDuration = pageDurations[0]
      const lastPageDuration = pageDurations[pageDurations.length - 1]
      const maxAllowedDegradation = firstPageDuration * 1.10

      expect(lastPageDuration).toBeLessThan(maxAllowedDegradation)
    })
  })

  describe('Grupo 2 — Performance de getCustomerMetrics', () => {
    it('getCustomerMetrics com 100 pedidos termina em menos de 200ms', async () => {
      const profiler = startQueryProfiler()
      const metrics = await getCustomerMetrics({
        customerId: customerWith100Orders,
        lojaID: TEST_LOJA_ID
      })
      const report = profiler.stop()

      expect(metrics.totalOrders).toBe(100)
      expect(report.totalDuration).toBeLessThan(TARGETS.metricsSmall)
      expect(report.queryCount).toBeLessThanOrEqual(3)
    })

    it('getCustomerMetrics com 1000 pedidos termina em menos de 500ms', async () => {
      const profiler = startQueryProfiler()
      const metrics = await getCustomerMetrics({
        customerId: customerWith1000Orders,
        lojaID: TEST_LOJA_ID
      })
      const report = profiler.stop()

      expect(metrics.totalOrders).toBe(1000)
      expect(report.totalDuration).toBeLessThan(TARGETS.metricsLarge)
    })

    it('getCustomerMetrics usa Promise.all — máximo 3 queries paralelas', async () => {
      const profiler = startQueryProfiler()
      await getCustomerMetrics({
        customerId: customerWith100Orders,
        lojaID: TEST_LOJA_ID
      })
      const report = profiler.stop()

      expect(report.queryCount).toBeLessThanOrEqual(3)
    })
  })

  describe('Grupo 3 — Performance de listOrders', () => {
    it('listOrders com 500 pedidos termina em menos de 150ms', async () => {
      const profiler = startQueryProfiler()
      const orders = await listOrdersForAdmin({ lojaID: TEST_LOJA_ID })
      const report = profiler.stop()

      expect(orders.length).toBeGreaterThan(0)
      expect(report.totalDuration).toBeLessThan(TARGETS.listOrders)
    })
  })

  describe('Grupo 4 — Carga Concorrente', () => {
    it('getCustomerMetrics suporta 10 requisições concorrentes', async () => {
      const sampleCustomerIds = allCustomerIds.slice(2, 12)

      const startTime = Date.now()
      const results = await Promise.all(
        sampleCustomerIds.map(customerId =>
          getCustomerMetrics({ customerId, lojaID: TEST_LOJA_ID })
        )
      )
      const totalTime = Date.now() - startTime

      expect(results).toHaveLength(10)
      results.forEach(metrics => {
        expect(metrics.totalOrders).toBeGreaterThan(0)
      })

      const maxAllowedTime = TARGETS.metricsSmall * 3
      expect(totalTime).toBeLessThan(maxAllowedTime)
    })
  })
})