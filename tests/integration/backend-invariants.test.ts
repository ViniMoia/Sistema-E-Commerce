import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { addToCart } from '@/services/cart.service'

const runId = `be05-${Date.now()}-${Math.random().toString(16).slice(2)}`
const lojaID = `${runId}-store`
const userID = `${runId}-user`
const productID = `${runId}-product`
const variantID = `${runId}-variant`

describe.sequential('invariantes de backend da remediação 05', () => {
  beforeAll(async () => {
    await prisma.loja.create({
      data: {
        id: lojaID,
        name: 'Backend Local Test',
        slug: lojaID,
        description: 'fixture descartável',
        coverImageUrl: 'test',
      },
    })
    await prisma.user.create({
      data: {
        id: userID,
        name: 'Backend User',
        email: `${userID}@test.local`,
        password: 'local-test',
        lojaID,
      },
    })
    await prisma.product.create({
      data: {
        id: productID,
        name: 'Produto de carrinho',
        description: 'fixture local',
        price: new Prisma.Decimal('25.50'),
        imageUrl: 'test',
        stock: 50,
        lojaID,
        userID,
        productVariants: {
          create: { id: variantID, size: 'U', color: 'Única', stock: 50 },
        },
      },
    })
  })

  afterAll(async () => {
    await prisma.cart.deleteMany({ where: { userID } })
    await prisma.product.deleteMany({ where: { lojaID } })
    await prisma.user.deleteMany({ where: { lojaID } })
    await prisma.loja.deleteMany({ where: { id: lojaID } })
    await prisma.$disconnect()
  })

  it('serializa reenvios concorrentes sem duplicar carrinho, item ou variante', async () => {
    await Promise.all(Array.from({ length: 20 }, () => addToCart(userID, lojaID, {
      productID,
      variantID,
      quantity: 1,
    })))

    const carts = await prisma.cart.findMany({
      where: { userID, status: 'ACTIVE' },
      include: { items: true },
    })

    expect(carts).toHaveLength(1)
    expect(carts[0].items).toHaveLength(1)
    expect(carts[0].items[0]).toMatchObject({ variantID, quantity: 20 })
    expect(await prisma.productVariants.count({ where: { ProductID: productID } })).toBe(1)
  })

  it('rejeita produto sem estoque também na camada de serviço', async () => {
    await prisma.product.update({ where: { id: productID }, data: { stock: 0 } })

    await expect(addToCart(userID, lojaID, {
      productID,
      variantID,
      quantity: 1,
    })).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK', statusCode: 409 })
  })
})
