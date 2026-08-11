import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { User, Order, OrderItem, Address, OrderStatusHistory, UserStatus, OrderStatus, DeliveryType } from '@prisma/client'

interface UserInput {
  name: string
  email: string
  password?: string
  phone?: string
  role?: string
  status?: UserStatus
  lojaID: string
}

export async function createTestCustomer(data?: Partial<UserInput>): Promise<User> {
  const hashedPassword = await bcrypt.hash(data?.password || 'test123456', 10)

  return prisma.user.create({
    data: {
      name: data?.name || 'Cliente Teste',
      email: data?.email || `customer-${Date.now()}@test.com`,
      password: hashedPassword,
      phone: data?.phone || null,
      role: data?.role || 'CUSTOMER',
      status: data?.status || UserStatus.ACTIVE,
      lojaID: data?.lojaID || ''
    }
  })
}

interface OrderInput {
  userID: string
  lojaID: string
  status?: OrderStatus
  total?: number
  deliveryType?: DeliveryType
}

export async function createTestOrder(data: OrderInput): Promise<Order> {
  const address = await prisma.address.create({
    data: {
      cep: '12345-678',
      state: 'SP',
      city: 'São Paulo',
      district: 'Centro',
      street: 'Rua Teste',
      number: '100',
      userID: data.userID
    }
  })

  const subtotal = data.total || 100
  const shippingCost = data.deliveryType === DeliveryType.DELIVERY ? 15 : 0

  return prisma.order.create({
    data: {
      userID: data.userID,
      addressID: address.id,
      lojaID: data.lojaID,
      status: data.status || OrderStatus.PENDING,
      deliveryType: data.deliveryType || DeliveryType.DELIVERY,
      subtotal: subtotal,
      shippingCost: shippingCost,
      total: subtotal + shippingCost,
      paymentMethod: 'credit_card'
    }
  })
}

interface OrderItemInput {
  orderId: string
  name: string
  quantity: number
  price: number
}

export async function createTestOrderItem(data: OrderItemInput): Promise<OrderItem> {
  const product = await prisma.product.findFirst()
  const variant = await prisma.productVariants.findFirst()

  return prisma.orderItem.create({
    data: {
      orderId: data.orderId,
      productId: product?.id || '00000000-0000-0000-0000-000000000001',
      name: data.name,
      quantity: data.quantity,
      price: data.price,
      productVariantsId: variant?.id || null
    }
  })
}

interface AddressInput {
  userId: string
  state: string
  city: string
}

export async function createTestAddress(data: AddressInput): Promise<Address> {
  return prisma.address.create({
    data: {
      cep: '12345-678',
      state: data.state,
      city: data.city,
      district: 'Bairro Teste',
      street: 'Rua Teste',
      number: '100',
      userID: data.userId
    }
  })
}

interface OrderStatusHistoryInput {
  orderId: string
  fromStatus: string
  toStatus: string
}

export async function createOrderStatusHistory(
  data: OrderStatusHistoryInput
): Promise<OrderStatusHistory> {
  const order = await prisma.order.findUnique({ where: { id: data.orderId } })
  if (!order) {
    throw new Error('Pedido não encontrado.')
  }

  const user = await prisma.user.findFirst({ where: { role: 'ADMIN' } })
  if (!user) {
    throw new Error('Usuário admin não encontrado para registro de histórico.')
  }

  return prisma.orderStatusHistory.create({
    data: {
      orderId: data.orderId,
      status: data.toStatus as OrderStatus,
      performedById: user.id
    }
  })
}