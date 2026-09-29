import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { createOrder, type CreateOrderParams } from '@/services/checkout.service'
import { completeCheckoutCart, getCart } from '@/services/cart.service'
import type { PaymentGateway } from '@/types/payment-gateway.types'

const runId = `tx04-${Date.now()}-${Math.random().toString(16).slice(2)}`
const lojaID = `${runId}-store`
const ownerID = `${runId}-owner`
const userA = `${runId}-user-a`
const userB = `${runId}-user-b`
const productId = `${runId}-product`
const variantId = `${runId}-variant`
const cartProductId = `${runId}-cart-product`
const cartVariantA = `${runId}-cart-variant-a`
const cartVariantB = `${runId}-cart-variant-b`

function gateway(label: string): PaymentGateway {
  return {
    createPixCharge: vi.fn().mockResolvedValue({
      paymentId: `${runId}-payment-${label}`,
      status: 'PENDING',
      pixQrCodeBase64: `qr-${label}`,
      pixPayload: `pix-${label}`,
    }),
    createCreditCardCharge: vi.fn(),
    createBoletoCharge: vi.fn(),
    getPaymentStatus: vi.fn(),
    requestRefund: vi.fn(),
    listPaymentRefunds: vi.fn().mockResolvedValue([]),
    findPaymentsByReference: vi.fn(),
  }
}

function checkout(userId: string, email: string, key: string, paymentGateway: PaymentGateway): CreateOrderParams {
  return {
    lojaID,
    idempotencyKey: key,
    customer: {
      userId,
      name: userId,
      email,
      phone: '11999999999',
      cpfCnpj: '52998224725',
    },
    items: [{ productId, variantId, quantity: 1 }],
    deliveryType: 'PICKUP',
    paymentMethod: 'PIX',
    paymentGateway,
  }
}

describe.sequential('invariantes transacionais da remediação 04', () => {
  beforeAll(async () => {
    await prisma.loja.create({
      data: {
        id: lojaID,
        name: 'Transaction Test Store',
        slug: lojaID,
        description: 'local disposable test',
        coverImageUrl: 'test',
      },
    })
    await prisma.user.createMany({
      data: [
        { id: ownerID, name: 'Owner', email: `${ownerID}@test.local`, password: 'local', lojaID },
        { id: userA, name: 'A', email: `${userA}@test.local`, password: 'local', lojaID },
        { id: userB, name: 'B', email: `${userB}@test.local`, password: 'local', lojaID },
      ],
    })
    await prisma.product.create({
      data: {
        id: productId,
        name: 'Última unidade',
        description: 'test',
        price: new Prisma.Decimal('99.90'),
        imageUrl: 'test',
        stock: 1,
        lojaID,
        userID: ownerID,
        productVariants: {
          create: { id: variantId, size: 'U', color: 'Única', stock: 1 },
        },
      },
    })
    await prisma.product.create({
      data: {
        id: cartProductId,
        name: 'Produto do carrinho',
        description: 'test',
        price: new Prisma.Decimal('25.00'),
        imageUrl: 'test',
        stock: 10,
        lojaID,
        userID: ownerID,
        productVariants: {
          create: [
            { id: cartVariantA, size: 'A', color: 'Preta', stock: 10 },
            { id: cartVariantB, size: 'B', color: 'Azul', stock: 10 },
          ],
        },
      },
    })
  })

  afterAll(async () => {
    await prisma.paymentWebhookEvent.deleteMany({
      where: { eventId: { startsWith: runId } },
    })
    await prisma.auditLog.deleteMany({
      where: { OR: [{ actorId: { in: [ownerID, userA, userB] } }, { targetId: { in: [ownerID, userA, userB] } }] },
    })
    await prisma.loyaltyTransaction.deleteMany({ where: { lojaID } })
    await prisma.loyaltyWallet.deleteMany({ where: { lojaID } })
    await prisma.order.deleteMany({ where: { lojaID } })
    await prisma.product.deleteMany({ where: { lojaID } })
    await prisma.user.deleteMany({ where: { lojaID } })
    await prisma.loja.delete({ where: { id: lojaID } })
    await prisma.$disconnect()
  })

  it('vende a última unidade uma vez e repete a mesma resposta sem nova cobrança', async () => {
    const gatewayA = gateway('a')
    const gatewayB = gateway('b')
    const inputA = checkout(userA, `${userA}@test.local`, `${runId}-idem-a`, gatewayA)
    const inputB = checkout(userB, `${userB}@test.local`, `${runId}-idem-b`, gatewayB)

    const attempts = await Promise.allSettled([createOrder(inputA), createOrder(inputB)])
    const fulfilled = attempts.filter((result) => result.status === 'fulfilled')
    const rejected = attempts.filter((result) => result.status === 'rejected')

    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    expect(String((rejected[0] as PromiseRejectedResult).reason)).toContain('Estoque insuficiente')
    expect((await prisma.product.findUniqueOrThrow({ where: { id: productId } })).stock).toBe(0)
    expect((await prisma.productVariants.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(0)
    expect(await prisma.order.count({ where: { lojaID } })).toBe(1)

    const winnerIsA = attempts[0].status === 'fulfilled'
    const winningInput = winnerIsA ? inputA : inputB
    const winningGateway = winnerIsA ? gatewayA : gatewayB
    const first = (winnerIsA ? attempts[0] : attempts[1]) as PromiseFulfilledResult<Awaited<ReturnType<typeof createOrder>>>
    const repeated = await createOrder(winningInput)

    expect(repeated.order.id).toBe(first.value.order.id)
    expect(repeated.order.asaasPaymentId).toBe(first.value.order.asaasPaymentId)
    expect(winningGateway.createPixCharge).toHaveBeenCalledTimes(1)
    expect(await prisma.order.count({ where: { idempotencyKey: winningInput.idempotencyKey } })).toBe(1)
  })

  it('fecha o carrinho certo, preserva adições de outra aba e mantém retry idempotente', async () => {
    const sourceCart = await prisma.cart.create({
      data: {
        userID: userA,
        items: {
          create: {
            productID: cartProductId,
            variantID: cartVariantA,
            quantity: 2,
            productName: 'Produto do carrinho',
            price: new Prisma.Decimal('25.00'),
            color: 'Preta',
            size: 'A',
            imageUrl: 'test',
          },
        },
      },
    })
    const cartGateway = gateway('cart')
    vi.mocked(cartGateway.createPixCharge).mockImplementationOnce(async () => {
      await prisma.cartItem.update({
        where: { cartID_variantID: { cartID: sourceCart.id, variantID: cartVariantA } },
        data: { quantity: 3 },
      })
      await prisma.cartItem.create({
        data: {
          cartID: sourceCart.id,
          productID: cartProductId,
          variantID: cartVariantB,
          quantity: 1,
          productName: 'Produto de outro checkout',
          price: new Prisma.Decimal('25.00'),
          color: 'Azul',
          size: 'B',
          imageUrl: 'test',
        },
      })
      return {
        paymentId: `${runId}-payment-cart`,
        status: 'PENDING',
        pixQrCodeBase64: 'qr-cart',
        pixPayload: 'pix-cart',
      }
    })
    const input: CreateOrderParams = {
      lojaID,
      cartId: sourceCart.id,
      idempotencyKey: `${runId}-idem-cart`,
      customer: {
        userId: userA,
        name: userA,
        email: `${userA}@test.local`,
        phone: '11999999999',
        cpfCnpj: '52998224725',
      },
      items: [{ productId: cartProductId, variantId: cartVariantA, quantity: 2 }],
      deliveryType: 'PICKUP',
      paymentMethod: 'PIX',
      paymentGateway: cartGateway,
    }

    await expect(createOrder({
      ...input,
      idempotencyKey: `${runId}-idem-wrong-owner`,
      customer: {
        ...input.customer,
        userId: userB,
        name: userB,
        email: `${userB}@test.local`,
      },
      paymentGateway: gateway('wrong-owner'),
    })).rejects.toMatchObject({ code: 'CART_SNAPSHOT_MISMATCH', statusCode: 409 })

    const first = await createOrder(input)
    const reloadedCart = await getCart(userA, lojaID)

    expect(await prisma.cart.findUniqueOrThrow({ where: { id: sourceCart.id } }))
      .toMatchObject({ status: 'COMPLETED' })
    expect(reloadedCart?.id).not.toBe(sourceCart.id)
    expect(reloadedCart?.items.map((item) => [item.variantID, item.quantity]).sort())
      .toEqual([[cartVariantA, 1], [cartVariantB, 1]].sort())
    expect(await prisma.order.findUniqueOrThrow({ where: { id: first.order.id } }))
      .toMatchObject({ sourceCartID: sourceCart.id, userID: userA, lojaID })

    const repeated = await createOrder(input)
    expect(repeated.order.id).toBe(first.order.id)
    expect(cartGateway.createPixCharge).toHaveBeenCalledTimes(1)
    expect((await getCart(userA, lojaID))?.items).toHaveLength(2)

    await expect(completeCheckoutCart(first.order.id, userB, lojaID)).rejects.toMatchObject({
      code: 'CHECKOUT_CART_NOT_FOUND',
    })
  })
})
