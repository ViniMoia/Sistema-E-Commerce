import { UserStatus, OrderStatus, DeliveryType } from '@prisma/client'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'

interface SeededData {
  adminUser: { id: string; lojaID: string; token: string }
  customers: Array<{ id: string; name: string; email: string }>
  orders: Array<{ id: string; status: string; userID: string }>
}

export async function setupTestDb(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error('DATABASE_URL não configurada.')
  }

  await prisma.$connect()
}

export async function seedTestData(lojaID: string): Promise<SeededData> {
  const hashedPassword = await bcrypt.hash('test123456', 10)

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

  const session = await prisma.session.create({
    data: {
      id: `session-${adminUser.id}`,
      userId: adminUser.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
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

    const orderNumber = i + 1
    const status = statuses[i % statuses.length]
    const deliveryType = deliveryTypes[i % deliveryTypes.length]
    const baseTotal = 50 + (i * 10) % 200

    const order = await prisma.order.create({
      data: {
        orderNumber,
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
        productId: '00000000-0000-0000-0000-000000000001',
        name: `Produto ${i + 1}`,
        quantity: 1 + (i % 3),
        price: baseTotal
      }
    })

    orders.push({ id: order.id, status, userID: customer.id })
  }

  return {
    adminUser: { id: adminUser.id, lojaID: adminUser.lojaID, token: session.id },
    customers,
    orders
  }
}

export async function cleanupTestDb(): Promise<void> {
  await prisma.session.deleteMany({})
  await prisma.orderStatusHistory.deleteMany({})
  await prisma.orderItem.deleteMany({})

  const orders = await prisma.order.findMany({ select: { id: true } })
  for (const order of orders) {
    await prisma.address.deleteMany({ where: { orderId: order.id } })
  }

  await prisma.order.deleteMany({})

  const addressUserIds = await prisma.address.findMany({
    where: { orderId: null },
    select: { userID: true }
  })
  const userIdsWithAddresses = Array.from(new Set(addressUserIds.map(a => a.userID)))

  await prisma.address.deleteMany({
    where: { orderId: null, userID: { in: userIdsWithAddresses } }
  })

  await prisma.user.deleteMany({
    where: {
      id: { not: '' }
    }
  })
  await prisma.loja.deleteMany({})

  await prisma.$disconnect()
}