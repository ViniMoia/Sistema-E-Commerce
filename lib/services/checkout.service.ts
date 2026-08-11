import { Decimal } from '@prisma/client/runtime/library'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'

interface CartItem {
  productId?: string
  name: string
  quantity: number
  price: number
  color?: string
  size?: string
}

interface CustomerData {
  name: string
  email: string
  phone: string
  userId?: string
}

interface AddressData {
  state: string
  city: string
  neighborhood: string
  street: string
  number: string
  complement?: string
  cep: string
}

interface CreateOrderParams {
  lojaID: string
  customer: CustomerData
  items: CartItem[]
  address?: AddressData
  deliveryType: 'DELIVERY' | 'PICKUP'
  freightValue?: number
  pixKey?: string
}

interface CreateOrderResult {
  success: true
  order: {
    id: string
    orderNumber: number
    total: number
    freightValue: number | null
    pixKey: string | null
    customer: { name: string; phone: string }
    items: CartItem[]
    deliveryType: string
  }
}

export async function createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
  const subtotal = params.items.reduce((acc, item) => {
    const price = new Decimal(item.price)
    return acc.add(price.mul(item.quantity))
  }, new Decimal(0))
  const freight = params.freightValue ? new Decimal(params.freightValue) : new Decimal(0)
  const total = subtotal.add(freight)

  let userConnect: Prisma.UserWhereUniqueInput
  if (params.customer.userId) {
    userConnect = { id: params.customer.userId }
  } else {
    const upserted = await prisma.user.upsert({
      where: {
        email_lojaID: {
          email: params.customer.email,
          lojaID: params.lojaID,
        }
      },
      update: {},
      create: {
        name: params.customer.name,
        email: params.customer.email,
        phone: params.customer.phone,
        password: '',
        role: 'CUSTOMER',
        status: 'ACTIVE',
        lojaID: params.lojaID,
      },
    })
    userConnect = { id: upserted.id }
  }

   const order = await prisma.$transaction(async (tx) => {
     // Step 1: Create address first (if DELIVERY), then connect to order by ID
     let addressConnect: { connect: { id: string } } | undefined = undefined

     if (params.deliveryType === 'DELIVERY' && params.address) {
       const createdAddress = await tx.address.create({
         data: {
           user: { connect: userConnect },
           cep: params.address.cep,
           state: params.address.state,
           city: params.address.city,
           district: params.address.neighborhood,
           street: params.address.street,
           number: params.address.number,
           complement: params.address.complement,
         },
       })
       addressConnect = { connect: { id: createdAddress.id } }
     }

     // Step 2: Create order connecting to existing address ID
     const created = await tx.order.create({
       data: {
         loja: { connect: { id: params.lojaID } },
         user: { connect: userConnect },
         address: addressConnect,
         status: 'PENDING',
         paymentMethod: 'WHATSAPP_PIX',
         pixKeyUsed: params.pixKey ?? null,
         freightValue: freight.equals(0) ? null : freight,
         subtotal: subtotal,
         shippingCost: new Decimal(0),
         total: total,
         deliveryType: params.deliveryType,
         items: {
           create: params.items.map(item => ({
             product: item.productId ? { connect: { id: item.productId } } : undefined,
             name: item.name,
             quantity: item.quantity,
             price: new Decimal(item.price),
             color: item.color,
             size: item.size,
           })),
         },
       },
       select: {
         id: true,
         orderNumber: true,
         total: true,
         freightValue: true,
         pixKeyUsed: true,
         user: { select: { name: true, phone: true } },
         items: { select: { name: true, quantity: true, price: true, color: true, size: true } },
         deliveryType: true,
       },
     })
     return created
   })

  return {
    success: true,
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      total: Number(order.total),
      freightValue: order.freightValue ? Number(order.freightValue) : null,
      pixKey: params.pixKey ?? null,
      customer: { name: order.user.name, phone: order.user.phone },
      items: order.items.map(i => ({
        productId: undefined,
        name: i.name,
        quantity: i.quantity,
        price: Number(i.price),
        color: i.color,
        size: i.size,
      })),
      deliveryType: order.deliveryType,
    },
  }
}
