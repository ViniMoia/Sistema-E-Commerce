import prisma from '@/lib/prisma'
import { Prisma, DeliveryType } from '@prisma/client'
import {
  simulatePointsRedemption,
  calculatePointsEarned,
  debitRedeemedPoints,
} from '@/services/loyalty.service'

export interface CheckoutCartItem {
  productId?: string
  variantId?: string
  name?: string
  quantity: number
  price?: number
  color?: string
  size?: string
}

export interface CheckoutCustomerData {
  name: string
  email: string
  phone: string
  userId?: string
}

export interface CheckoutAddressData {
  state: string
  city: string
  neighborhood: string
  street: string
  number: string
  complement?: string
  cep: string
}

export interface CreateOrderParams {
  lojaID: string
  customer: CheckoutCustomerData
  items: CheckoutCartItem[]
  address?: CheckoutAddressData
  deliveryType: 'DELIVERY' | 'PICKUP' | 'NONE'
  freightValue?: number
  shippingCost?: number
  shippingProvider?: string
  shippingServiceName?: string
  shippingEstimatedDays?: number
  pixKey?: string
  idempotencyKey?: string
  pointsToRedeem?: number // Pontos a resgatar como desconto
}

export interface CreateOrderResult {
  success: true
  order: {
    id: string
    orderNumber: number
    total: number
    subtotal: number
    freightValue: number | null
    shippingCost: number
    shippingProvider: string | null
    shippingServiceName: string | null
    shippingEstimatedDays: number | null
    pixKey: string | null
    pointsEarned: number
    pointsRedeemed: number
    pointsDiscountValue: number
    customer: { name: string; phone: string }
    items: Array<{
      productId?: string
      name: string
      quantity: number
      price: number
      color?: string
      size?: string
    }>
    deliveryType: string
  }
}

/**
 * Pipeline Canônico de Checkout Autoritativo com Idempotência Transacional,
 * Controle de Estoque e Motor de Fidelidade (Loyalty Engine) (DB-002, SEC-002).
 */
export async function createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
  if (!params.items || params.items.length === 0) {
    throw new Error('O pedido deve conter pelo menos um item.')
  }

  return await prisma.$transaction(async (tx) => {
    // 0. Verificar idempotência se chave fornecida (DB-002)
    if (params.idempotencyKey) {
      const existingOrder = await tx.order.findUnique({
        where: { idempotencyKey: params.idempotencyKey },
        include: {
          user: { select: { name: true, phone: true } },
          items: {
            select: {
              productId: true,
              name: true,
              quantity: true,
              price: true,
              color: true,
              size: true,
            },
          },
        },
      })

      if (existingOrder) {
        return {
          success: true,
          order: {
            id: existingOrder.id,
            orderNumber: existingOrder.orderNumber,
            total: Number(existingOrder.total),
            subtotal: Number(existingOrder.subtotal),
            freightValue: existingOrder.freightValue ? Number(existingOrder.freightValue) : null,
            shippingCost: Number(existingOrder.shippingCost),
            shippingProvider: existingOrder.shippingProvider,
            shippingServiceName: existingOrder.shippingServiceName,
            shippingEstimatedDays: existingOrder.shippingEstimatedDays,
            pixKey: existingOrder.pixKeyUsed,
            pointsEarned: existingOrder.pointsEarned,
            pointsRedeemed: existingOrder.pointsRedeemed,
            pointsDiscountValue: Number(existingOrder.pointsDiscountValue),
            customer: { name: existingOrder.user.name, phone: existingOrder.user.phone },
            items: existingOrder.items.map((i) => ({
              productId: i.productId ?? undefined,
              name: i.name,
              quantity: i.quantity,
              price: Number(i.price),
              color: i.color ?? undefined,
              size: i.size ?? undefined,
            })),
            deliveryType: existingOrder.deliveryType,
          },
        }
      }
    }

    // 1. Validar loja
    const loja = await tx.loja.findUnique({
      where: { id: params.lojaID },
    })
    if (!loja) {
      throw new Error('Loja não encontrada.')
    }

    // 2. Resolver preços e itens autoritativamente do banco de dados
    const validatedItems: Array<{
      productId: string
      name: string
      quantity: number
      price: Prisma.Decimal
      color?: string
      size?: string
      variantId?: string
    }> = []

    let subtotal = new Prisma.Decimal(0)

    for (const item of params.items) {
      if (!item.productId) {
        throw new Error('Identificador do produto (productId) é obrigatório.')
      }

      const product = await tx.product.findUnique({
        where: { id: item.productId },
        include: { productVariants: true },
      })

      if (!product || product.lojaID !== params.lojaID) {
        throw new Error(`Produto ${item.productId} inválido ou não pertence a esta loja.`)
      }

      const quantity = Math.max(1, Math.floor(item.quantity))

      if (product.stock < quantity) {
        throw new Error(`Estoque insuficiente para o produto ${product.name}.`)
      }

      // Se informou variante, valida estoque da variante
      let matchedVariantId: string | undefined = undefined
      if (item.variantId) {
        const variant = product.productVariants.find((v) => v.id === item.variantId)
        if (!variant) {
          throw new Error(`Variação de produto não encontrada.`)
        }
        if (variant.stock < quantity) {
          throw new Error(`Estoque insuficiente para a variação selecionada (${product.name}).`)
        }
        matchedVariantId = variant.id
      }

      const authoritativePrice = product.price
      const itemTotal = authoritativePrice.mul(quantity)
      subtotal = subtotal.add(itemTotal)

      validatedItems.push({
        productId: product.id,
        name: product.name,
        quantity,
        price: authoritativePrice,
        color: item.color,
        size: item.size,
        variantId: matchedVariantId,
      })
    }

    // 3. Decremento atômico de estoque (DB-002)
    for (const item of validatedItems) {
      await tx.product.update({
        where: { id: item.productId },
        data: {
          stock: {
            decrement: item.quantity,
          },
        },
      })

      if (item.variantId) {
        await tx.productVariants.update({
          where: { id: item.variantId },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        })
      }
    }

    // 4. Resolver ou criar usuário cliente
    let resolvedUserId: string
    if (params.customer.userId) {
      resolvedUserId = params.customer.userId
    } else {
      const upserted = await tx.user.upsert({
        where: {
          email_lojaID: {
            email: params.customer.email.toLowerCase().trim(),
            lojaID: params.lojaID,
          },
        },
        update: {},
        create: {
          name: params.customer.name.trim(),
          email: params.customer.email.toLowerCase().trim(),
          phone: params.customer.phone.trim(),
          password: '',
          role: 'CUSTOMER',
          status: 'ACTIVE',
          lojaID: params.lojaID,
        },
      })
      resolvedUserId = upserted.id
    }

    // 5. Motor de Fidelidade: Cálculo autoritativo de pontos e desconto
    let pointsEarned = 0
    let pointsRedeemed = 0
    let pointsDiscountValue = new Prisma.Decimal(0)

    if (params.pointsToRedeem && params.pointsToRedeem > 0) {
      if (!loja.loyaltyEnabled) {
        throw new Error('Programa de pontos desativado nesta loja.')
      }

      const sim = await simulatePointsRedemption({
        lojaID: params.lojaID,
        userID: resolvedUserId,
        subtotal: Number(subtotal),
        requestedPoints: params.pointsToRedeem,
      })

      if (!sim.eligible || sim.pointsToRedeem <= 0) {
        throw new Error(sim.reason || 'Saldo de pontos insuficiente ou resgate não elegível.')
      }

      pointsRedeemed = sim.pointsToRedeem
      pointsDiscountValue = new Prisma.Decimal(sim.discountValue)
      pointsEarned = sim.projectedEarnedPoints
    } else {
      pointsEarned = loja.loyaltyEnabled
        ? calculatePointsEarned(subtotal, loja.loyaltyEarnRate)
        : 0
    }

    const subtotalAfterDiscount = Prisma.Decimal.max(0, subtotal.sub(pointsDiscountValue))

    // 6. Resolver frete autoritativamente do servidor (SEC-002)
    let calculatedFreight = new Prisma.Decimal(0)
    let shippingProvider = params.shippingProvider || null
    let shippingServiceName = params.shippingServiceName || null
    let shippingEstimatedDays = params.shippingEstimatedDays || null

    if (params.deliveryType === 'PICKUP') {
      calculatedFreight = new Prisma.Decimal(0)
      shippingProvider = 'STORE_PICKUP'
      shippingServiceName = 'Retirada na Loja'
      shippingEstimatedDays = 0
    } else if (params.deliveryType === 'NONE') {
      calculatedFreight = new Prisma.Decimal(0)
      shippingProvider = 'NONE'
      shippingServiceName = 'A Combinar via WhatsApp'
      shippingEstimatedDays = 0
    } else if (params.deliveryType === 'DELIVERY') {
      if (!params.address || !params.address.city) {
        throw new Error('Endereço e cidade são obrigatórios para modalidade de entrega.')
      }

      const freightRule = await tx.freightRule.findFirst({
        where: {
          lojaID: params.lojaID,
          cityName: {
            equals: params.address.city.trim(),
            mode: 'insensitive',
          },
        },
      })

      if (freightRule) {
        calculatedFreight = freightRule.value
        shippingProvider = 'LOCAL_TABLE'
        shippingServiceName = `Entrega Local (${freightRule.cityName})`
      } else if (params.shippingCost !== undefined && params.shippingCost >= 0) {
        calculatedFreight = new Prisma.Decimal(params.shippingCost)
      } else if (params.freightValue !== undefined && params.freightValue > 0) {
        calculatedFreight = new Prisma.Decimal(params.freightValue)
      } else {
        calculatedFreight = new Prisma.Decimal(0)
      }
    }

    // 7. Calcular total final autoritativo
    const total = subtotalAfterDiscount.add(calculatedFreight)

    // 8. Criar endereço se for entrega
    let addressConnect: { connect: { id: string } } | undefined = undefined
    if (params.deliveryType === 'DELIVERY' && params.address) {
      const createdAddress = await tx.address.create({
        data: {
          user: { connect: { id: resolvedUserId } },
          cep: params.address.cep.trim(),
          state: params.address.state.trim(),
          city: params.address.city.trim(),
          district: params.address.neighborhood.trim(),
          street: params.address.street.trim(),
          number: params.address.number.trim(),
          complement: params.address.complement?.trim(),
        },
      })
      addressConnect = { connect: { id: createdAddress.id } }
    }

    // 9. Criar pedido com dados autoritativos e auditoria de fidelidade
    const created = await tx.order.create({
      data: {
        loja: { connect: { id: params.lojaID } },
        user: { connect: { id: resolvedUserId } },
        address: addressConnect,
        status: 'PENDING',
        paymentMethod: 'WHATSAPP_PIX',
        pixKeyUsed: params.pixKey ?? loja.pixKey ?? null,
        freightValue: calculatedFreight.equals(0) ? null : calculatedFreight,
        subtotal: subtotal,
        shippingCost: calculatedFreight,
        shippingProvider: shippingProvider,
        shippingServiceName: shippingServiceName,
        shippingEstimatedDays: shippingEstimatedDays,
        pointsEarned,
        pointsRedeemed,
        pointsDiscountValue,
        total: total,
        deliveryType: params.deliveryType as DeliveryType,
        idempotencyKey: params.idempotencyKey ?? null,
        items: {
          create: validatedItems.map((item) => ({
            product: { connect: { id: item.productId } },
            productVariantsId: item.variantId,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            color: item.color,
            size: item.size,
          })),
        },
      },
      include: {
        user: { select: { name: true, phone: true } },
        items: { select: { productId: true, name: true, quantity: true, price: true, color: true, size: true } },
      },
    })

    // 10. Se houve resgate de pontos, efetivar o débito atômico no Ledger
    if (pointsRedeemed > 0) {
      await debitRedeemedPoints(
        {
          lojaID: params.lojaID,
          userID: resolvedUserId,
          orderId: created.id,
          points: pointsRedeemed,
          monetaryValue: Number(pointsDiscountValue),
          description: `Desconto de fidelidade aplicado no pedido #${created.orderNumber}`,
        },
        tx
      )
    }

    return {
      success: true,
      order: {
        id: created.id,
        orderNumber: created.orderNumber,
        total: Number(created.total),
        subtotal: Number(created.subtotal),
        freightValue: created.freightValue ? Number(created.freightValue) : null,
        shippingCost: Number(created.shippingCost),
        shippingProvider: created.shippingProvider,
        shippingServiceName: created.shippingServiceName,
        shippingEstimatedDays: created.shippingEstimatedDays,
        pixKey: created.pixKeyUsed,
        pointsEarned: created.pointsEarned,
        pointsRedeemed: created.pointsRedeemed,
        pointsDiscountValue: Number(created.pointsDiscountValue),
        customer: { name: created.user.name, phone: created.user.phone },
        items: created.items.map((i) => ({
          productId: i.productId ?? undefined,
          name: i.name,
          quantity: i.quantity,
          price: Number(i.price),
          color: i.color ?? undefined,
          size: i.size ?? undefined,
        })),
        deliveryType: created.deliveryType,
      },
    }
  })
}
