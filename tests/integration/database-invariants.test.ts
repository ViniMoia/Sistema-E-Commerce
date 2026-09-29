import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { InventoryService } from '@/services/inventory.service'
import { updateOrderStatus } from '@/services/order.service'
import { creditEarnedPoints } from '@/services/loyalty.service'

const runId = `db03-${Date.now()}-${Math.random().toString(16).slice(2)}`
const lojaA = `${runId}-store-a`
const lojaB = `${runId}-store-b`
const userA = `${runId}-user-a`
const userB = `${runId}-user-b`
const sharedEmail = `${runId}@test.local`
const productId = `${runId}-product`
const variantA = `${runId}-variant-a`
const variantB = `${runId}-variant-b`

describe.sequential('invariantes de banco da remediação 03', () => {
  beforeAll(async () => {
    await prisma.loja.createMany({
      data: [
        { id: lojaA, name: 'DB Test A', slug: `${runId}-a`, description: 'test', coverImageUrl: 'test' },
        { id: lojaB, name: 'DB Test B', slug: `${runId}-b`, description: 'test', coverImageUrl: 'test' },
      ],
    })
    await prisma.user.createMany({
      data: [
        { id: userA, name: 'User A', email: sharedEmail, password: 'local-test', lojaID: lojaA },
        { id: userB, name: 'User B', email: sharedEmail, password: 'local-test', lojaID: lojaB },
      ],
    })
    await prisma.product.create({
      data: {
        id: productId,
        name: 'Product',
        description: 'test',
        price: new Prisma.Decimal('10.00'),
        imageUrl: 'test',
        stock: 8,
        lojaID: lojaA,
        userID: userA,
        productVariants: {
          create: [
            { id: variantA, size: 'P', color: 'Preto', stock: 8 },
            { id: variantB, size: 'M', color: 'Preto', stock: 8 },
          ],
        },
      },
    })
  })

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: userA }, { targetId: userA }] } })
    await prisma.loyaltyTransaction.deleteMany({ where: { lojaID: { in: [lojaA, lojaB] } } })
    await prisma.loyaltyWallet.deleteMany({ where: { lojaID: { in: [lojaA, lojaB] } } })
    await prisma.orderStatusHistory.deleteMany({
      where: { order: { lojaID: { in: [lojaA, lojaB] } } },
    })
    await prisma.order.deleteMany({ where: { lojaID: { in: [lojaA, lojaB] } } })
    await prisma.product.deleteMany({ where: { lojaID: { in: [lojaA, lojaB] } } })
    await prisma.user.deleteMany({ where: { lojaID: { in: [lojaA, lojaB] } } })
    await prisma.loja.deleteMany({ where: { id: { in: [lojaA, lojaB] } } })
    await prisma.$disconnect()
  })

  it('permite o mesmo email em lojas distintas e rejeita duplicata na mesma loja', async () => {
    expect(await prisma.user.count({ where: { email: sharedEmail } })).toBe(2)

    await expect(prisma.user.create({
      data: {
        name: 'Duplicate',
        email: sharedEmail,
        password: 'local-test',
        lojaID: lojaA,
      },
    })).rejects.toMatchObject({ code: 'P2002' })
  })

  it('permite duas variantes do mesmo produto no mesmo pedido', async () => {
    const order = await prisma.order.create({
      data: {
        user: { connect: { id: userA } },
        loja: { connect: { id: lojaA } },
        deliveryType: 'PICKUP',
        subtotal: new Prisma.Decimal('20.00'),
        shippingCost: new Prisma.Decimal('0'),
        total: new Prisma.Decimal('20.00'),
        items: {
          create: [
            { productId, productVariantsId: variantA, name: 'P/P', quantity: 1, price: new Prisma.Decimal('10') },
            { productId, productVariantsId: variantB, name: 'P/M', quantity: 1, price: new Prisma.Decimal('10') },
          ],
        },
      },
      include: { items: true },
    })

    expect(order.items).toHaveLength(2)
  })

  it('rejeita nova relação order/user que cruze tenants e total inconsistente', async () => {
    await expect(prisma.order.create({
      data: {
        userID: userA,
        lojaID: lojaB,
        deliveryType: 'PICKUP',
        subtotal: new Prisma.Decimal('10'),
        shippingCost: new Prisma.Decimal('0'),
        total: new Prisma.Decimal('10'),
      },
    })).rejects.toMatchObject({ code: 'P2003' })

    await expect(prisma.order.create({
      data: {
        userID: userA,
        lojaID: lojaA,
        deliveryType: 'PICKUP',
        subtotal: new Prisma.Decimal('10'),
        shippingCost: new Prisma.Decimal('0'),
        total: new Prisma.Decimal('999'),
      },
    })).rejects.toBeTruthy()
  })

  it('reverte todo o estorno de estoque se uma variante falhar', async () => {
    await expect(prisma.$transaction((tx) => InventoryService.restoreStock([
      { productId, variantId: `${runId}-missing`, quantity: 2 },
    ], tx))).rejects.toMatchObject({ code: 'P2025' })

    const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } })
    expect(product.stock).toBe(8)
  })

  it('torna o crédito de fidelidade por pedido idempotente no banco', async () => {
    await prisma.loja.update({
      where: { id: lojaA },
      data: { loyaltyEnabled: true, loyaltyEarnRate: new Prisma.Decimal('1') },
    })
    const order = await prisma.order.create({
      data: {
        userID: userA,
        lojaID: lojaA,
        deliveryType: 'PICKUP',
        subtotal: new Prisma.Decimal('10'),
        shippingCost: new Prisma.Decimal('0'),
        total: new Prisma.Decimal('10'),
      },
    })

    await creditEarnedPoints({ lojaID: lojaA, userID: userA, orderId: order.id, subtotal: 10 })
    await expect(creditEarnedPoints({
      lojaID: lojaA,
      userID: userA,
      orderId: order.id,
      subtotal: 10,
    })).rejects.toMatchObject({ code: 'P2002' })

    const wallet = await prisma.loyaltyWallet.findUniqueOrThrow({
      where: { lojaID_userID: { lojaID: lojaA, userID: userA } },
    })
    expect(wallet.balance).toBe(10)
    expect(await prisma.loyaltyTransaction.count({ where: { orderId: order.id, type: 'EARN' } })).toBe(1)
  })

  it('permite apenas um cancelamento concorrente e estorna estoque uma vez', async () => {
    const order = await prisma.order.create({
      data: {
        userID: userA,
        lojaID: lojaA,
        deliveryType: 'PICKUP',
        subtotal: new Prisma.Decimal('20'),
        shippingCost: new Prisma.Decimal('0'),
        total: new Prisma.Decimal('20'),
        items: {
          create: [{
            productId,
            productVariantsId: variantA,
            name: 'Reserved item',
            quantity: 2,
            price: new Prisma.Decimal('10'),
          }],
        },
      },
    })

    const results = await Promise.all([
      updateOrderStatus({ orderId: order.id, newStatus: 'CANCELLED', performedById: 'SYSTEM', lojaID: lojaA }),
      updateOrderStatus({ orderId: order.id, newStatus: 'CANCELLED', performedById: 'SYSTEM', lojaID: lojaA }),
    ])

    expect(results.filter((result) => result.success)).toHaveLength(1)
    expect(results.filter((result) => result.success === false && result.code === 'CONFLICT')).toHaveLength(1)
    expect((await prisma.product.findUniqueOrThrow({ where: { id: productId } })).stock).toBe(10)
    expect((await prisma.productVariants.findUniqueOrThrow({ where: { id: variantA } })).stock).toBe(10)
    expect(await prisma.auditLog.count({ where: { entity: 'Order', entityId: order.id } })).toBe(1)
    expect(await prisma.orderStatusHistory.count({ where: { orderId: order.id } })).toBe(1)
  })
})
