import { UserStatus, OrderStatus, DeliveryType } from '@prisma/client'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { hashSessionToken } from '@/lib/session-token'

interface SeededData {
  adminUser: { id: string; lojaID: string; token: string }
  customers: Array<{ id: string; name: string; email: string }>
  orders: Array<{ id: string; status: string; userID: string }>
}

const seededStoreIds = new Set<string>()
export function registerTestStore(id: string): void { seededStoreIds.add(id) }
export function testStoreHost(id: string): string { return 'test-' + id.toLowerCase().replace(/[^a-z0-9-]/g, '-') + '.audit.invalid' }

function isLocalDisposableDatabase(url: URL): boolean {
  const allowedHosts = new Set(['localhost', '127.0.0.1', '[::1]'])
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''))
  return (
    ['postgres:', 'postgresql:'].includes(url.protocol) &&
    allowedHosts.has(url.hostname.toLowerCase()) &&
    database === 'ecommerce_test' &&
    (url.searchParams.get('schema') ?? 'public') === 'public'
  )
}

export function validateTestEnvironment(): string {
  const testDbUrl = process.env.TEST_DATABASE_URL
  const applicationDbUrl = process.env.DATABASE_URL
  let parsedUrl: URL | undefined

  try {
    parsedUrl = testDbUrl ? new URL(testDbUrl) : undefined
  } catch {
    parsedUrl = undefined
  }

  if (
    process.env.NODE_ENV !== 'test' ||
    !testDbUrl ||
    !applicationDbUrl ||
    testDbUrl !== applicationDbUrl ||
    !parsedUrl ||
    !isLocalDisposableDatabase(parsedUrl)
  ) {
    throw new Error(
      '[TEST_DATABASE_BLOCKED] TEST_DATABASE_URL e DATABASE_URL devem ser idênticas e apontar ' +
      'para PostgreSQL local, banco ecommerce_test, schema public, com NODE_ENV=test.'
    )
  }
  return testDbUrl
}

export async function setupTestDb(): Promise<void> {
  validateTestEnvironment()
  await prisma.$connect()
}

export async function seedTestData(lojaID: string): Promise<SeededData> {
  validateTestEnvironment()
  seededStoreIds.add(lojaID)
  const hashedPassword = await bcrypt.hash('test123456', 10)

  await prisma.loja.upsert({
    where: { id: lojaID },
    update: {},
    create: {
      id: lojaID,
      name: `Loja de teste ${lojaID}`,
      slug: `test-${lojaID.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`,
      description: 'Fixture local descartável',
      coverImageUrl: '/test-cover.jpg'
    }
  })

  const adminUser = await prisma.user.create({
    data: {
      name: 'Admin Test',
      email: `admin-${lojaID.substring(0, 8)}@test.com`,
      password: hashedPassword,
      role: 'ADMIN',
      status: UserStatus.ACTIVE,
      lojaID
    }
  })

  const token = randomBytes(32).toString('hex')
  await prisma.session.create({
    data: {
      id: hashSessionToken(token),
      userId: adminUser.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  })

  const seedProduct = await prisma.product.create({
    data: {
      name: 'Produto fixture',
      description: 'Produto local para integridade referencial dos pedidos de teste',
      price: 100,
      imageUrl: '/test-product.jpg',
      stock: 100000,
      lojaID,
      userID: adminUser.id
    }
  })

  const customers: Array<{ id: string; name: string; email: string }> = []
  const customerNames = [
    'João Silva', 'Maria Santos', 'Pedro Costa', 'Ana Oliveira', 'Carlos Rodrigues',
    'Juliana Alves', 'Fernando Lima', 'Carolina Souza', 'Bruno Pereira', 'Larissa Ferreira'
  ]

  for (let i = 0; i < 10; i++) {
    const customer = await prisma.user.create({
      data: {
        name: customerNames[i],
        email: `customer${i + 1}-${lojaID.substring(0, 8)}@test.com`,
        password: hashedPassword,
        role: 'CUSTOMER',
        status: UserStatus.ACTIVE,
        lojaID
      }
    })
    customers.push({ id: customer.id, name: customer.name, email: customer.email })
  }

  const orders: Array<{ id: string; status: string; userID: string }> = []
  const statuses = [
    OrderStatus.PENDING, OrderStatus.PENDING, OrderStatus.PENDING,
    OrderStatus.PAID, OrderStatus.PAID, OrderStatus.PAID,
    OrderStatus.SHIPPED, OrderStatus.SHIPPED,
    OrderStatus.DELIVERED, OrderStatus.DELIVERED
  ]
  const deliveryTypes = [DeliveryType.DELIVERY, DeliveryType.PICKUP]

  for (let i = 0; i < 50; i++) {
    const customerIndex = i % 10
    const customer = customers[customerIndex]

    const address = await prisma.address.create({
      data: {
        cep: '12345-678',
        state: 'SP',
        city: 'São Paulo',
        district: 'Centro',
        street: 'Rua Test',
        number: `${100 + i}`,
        userID: customer.id
      }
    })

    const status = statuses[i % statuses.length]
    const deliveryType = deliveryTypes[i % deliveryTypes.length]
    const baseTotal = 50 + (i * 10) % 200

    const order = await prisma.order.create({
      data: {
        userID: customer.id,
        addressID: address.id,
        lojaID,
        status,
        deliveryType,
        subtotal: baseTotal,
        shippingCost: deliveryType === DeliveryType.DELIVERY ? 15 : 0,
        total: deliveryType === DeliveryType.DELIVERY ? baseTotal + 15 : baseTotal,
        paymentMethod: 'credit_card'
      }
    })

    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: seedProduct.id,
        name: `Produto ${i + 1}`,
        quantity: 1 + (i % 3),
        price: baseTotal
      }
    })

    orders.push({ id: order.id, status, userID: customer.id })
  }

  return {
    adminUser: { id: adminUser.id, lojaID: adminUser.lojaID, token },
    customers,
    orders
  }
}

export async function cleanupTestDb(): Promise<void> {
  validateTestEnvironment()
  const lojaIDs = [...seededStoreIds]
  if (lojaIDs.length === 0) return

  const userFilter = { lojaID: { in: lojaIDs } }
  const orderFilter = { lojaID: { in: lojaIDs } }

  await prisma.auditLog.deleteMany({ where: { OR: [{ actor: userFilter }, { target: userFilter }] } })
  await prisma.loyaltyTransaction.deleteMany({ where: { lojaID: { in: lojaIDs } } })
  await prisma.loyaltyWallet.deleteMany({ where: { lojaID: { in: lojaIDs } } })
  await prisma.freightRule.deleteMany({ where: { lojaID: { in: lojaIDs } } })
  await prisma.session.deleteMany({ where: { user: userFilter } })
  await prisma.orderStatusHistory.deleteMany({ where: { order: orderFilter } })
  await prisma.orderItem.deleteMany({ where: { order: orderFilter } })
  await prisma.address.deleteMany({
    where: { OR: [{ orders: { some: orderFilter } }, { user: userFilter }] },
  })
  await prisma.order.deleteMany({ where: orderFilter })
  await prisma.product.deleteMany({ where: { lojaID: { in: lojaIDs } } })
  await prisma.user.deleteMany({ where: userFilter })
  await prisma.loja.deleteMany({ where: { id: { in: lojaIDs } } })

  seededStoreIds.clear()
  await prisma.$disconnect()
}
