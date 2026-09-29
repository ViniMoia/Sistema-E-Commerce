import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { adjustPointsManually } from '@/services/loyalty.service'
import { deleteProduct, updateProduct } from '@/services/product.service'

const runId = `admin07-${Date.now()}-${Math.random().toString(16).slice(2)}`
const lojaID = `${runId}-store`
const adminID = `${runId}-admin`
const customerID = `${runId}-customer`
const productID = `${runId}-product`
const variantA = `${runId}-variant-a`
const variantB = `${runId}-variant-b`
const cartID = `${runId}-cart`

describe.sequential('invariantes administrativas da remediação 07', () => {
  beforeAll(async () => {
    await prisma.loja.create({
      data: {
        id: lojaID, name: 'Admin Local Test', slug: lojaID,
        description: 'fixture descartável', coverImageUrl: 'test',
        loyaltyEnabled: true, loyaltyPointValue: new Prisma.Decimal('0.05'),
      },
    })
    await prisma.user.createMany({
      data: [
        { id: adminID, name: 'Admin', email: `${adminID}@test.local`, password: 'local-test', lojaID, role: 'ADMIN' },
        { id: customerID, name: 'Customer', email: `${customerID}@test.local`, password: 'local-test', lojaID },
      ],
    })
    await prisma.product.create({
      data: {
        id: productID, name: 'Produto histórico', description: 'fixture local',
        price: new Prisma.Decimal('100'), imageUrl: 'test', stock: 5, lojaID, userID: adminID,
        productVariants: {
          create: [
            { id: variantA, size: '500ml', color: 'Padrão', stock: 2 },
            { id: variantB, size: '1L', color: 'Padrão', stock: 3 },
          ],
        },
      },
    })
    await prisma.cart.create({
      data: {
        id: cartID, userID: customerID, status: 'ACTIVE',
        items: {
          create: {
            productID, variantID: variantA, quantity: 1,
            productName: 'Produto histórico', price: new Prisma.Decimal('100'),
            imageUrl: 'test', size: '500ml', color: 'Padrão',
          },
        },
      },
    })
  })

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: adminID }, { targetId: adminID }] } })
    await prisma.loyaltyTransaction.deleteMany({ where: { lojaID } })
    await prisma.loyaltyWallet.deleteMany({ where: { lojaID } })
    await prisma.cart.deleteMany({ where: { userID: customerID } })
    await prisma.freightRule.deleteMany({ where: { lojaID } })
    await prisma.product.deleteMany({ where: { lojaID } })
    await prisma.user.deleteMany({ where: { lojaID } })
    await prisma.loja.deleteMany({ where: { id: lojaID } })
    await prisma.$disconnect()
  })

  it('aplica duas intenções concorrentes de pontos exatamente uma vez', async () => {
    const input = {
      lojaID, userID: customerID, points: 500, description: 'Crédito concorrente', adminUserId: adminID,
      idempotencyKey: '77777777-7777-4777-8777-777777777777',
    }
    const results = await Promise.all([adjustPointsManually(input), adjustPointsManually(input)])

    expect(results.map((result) => result.transaction.id).every((id) => id === results[0].transaction.id)).toBe(true)
    expect(await prisma.loyaltyTransaction.count({
      where: { operationKey: `admin-adjust:${lojaID}:${input.idempotencyKey}` },
    })).toBe(1)
    expect((await prisma.loyaltyWallet.findUniqueOrThrow({
      where: { lojaID_userID: { lojaID, userID: customerID } },
    })).balance).toBe(500)
  })

  it('atualiza variantes por ID e mantém estoque pai como soma', async () => {
    await updateProduct(productID, {
      price: 120,
      stock: 999,
      variants: [
        { id: variantA, size: '500ml', color: 'Padrão', stock: 4 },
        { id: variantB, size: '1L', color: 'Padrão', stock: 6 },
      ],
    }, lojaID, adminID)

    const product = await prisma.product.findUniqueOrThrow({
      where: { id: productID }, include: { productVariants: { orderBy: { id: 'asc' } } },
    })
    expect(product.stock).toBe(10)
    expect(new Set(product.productVariants.map((variant) => variant.id))).toEqual(new Set([variantA, variantB]))
  })

  it('bloqueia exclusão de produto em carrinho sem apagar nem auditar delete', async () => {
    await expect(deleteProduct(productID, lojaID, adminID)).rejects.toThrow('PRODUCT_IN_USE')
    expect(await prisma.product.count({ where: { id: productID } })).toBe(1)
    expect(await prisma.auditLog.count({
      where: { entity: 'Product', entityId: productID, action: 'PRODUCT_DELETED' },
    })).toBe(0)
  })

  it('constraint do PostgreSQL rejeita frete negativo mesmo fora da rota', async () => {
    await expect(prisma.freightRule.create({
      data: { lojaID, cityName: 'Cidade inválida', value: new Prisma.Decimal('-0.01') },
    })).rejects.toBeTruthy()
    expect(await prisma.freightRule.count({ where: { lojaID, cityName: 'Cidade inválida' } })).toBe(0)
  })
})
