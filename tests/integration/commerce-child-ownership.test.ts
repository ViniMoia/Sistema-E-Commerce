import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import prisma from '@/lib/prisma'
import { validateTestEnvironment } from '@/tests/setup/db'
import { updateLojaSettings } from '@/services/loja.service'
import { persistAuditedSettings } from '@/services/store-settings-audit.service'
import { listCustomers } from '@/services/customer.service'
import { listOrdersForAdmin } from '@/services/order.service'

const prefix = `child-${randomUUID()}`
const stores = [`${prefix}-a`, `${prefix}-b`]
const users = [`${prefix}-admin`, `${prefix}-other`, `${prefix}-customer`]
const products = [`${prefix}-pa`, `${prefix}-pb`, `${prefix}-race`]
const variants = products.map(id => `${id}-v`)
const carts = [`${prefix}-ca`, `${prefix}-cb`]
const orders = [`${prefix}-oa`, `${prefix}-oc`]
const addresses = [`${prefix}-aa`, `${prefix}-ab`]
const cartItem = (productID: string, variantID: string) => ({
  cartID: carts[0], productID, variantID, quantity: 1, productName: 'Fixture',
  price: 10, imageUrl: '/fixture.png', color: 'Test', size: 'Test',
})

describe.sequential('physical child ownership and audited settings', () => {
  beforeAll(async () => {
    validateTestEnvironment()
    for (const id of stores) await prisma.loja.create({ data: { id, name: id, slug: id, description: 'test', coverImageUrl: '/test.png' } })
    await prisma.user.createMany({ data: users.map((id, i) => ({ id, name: 'Fixture', email: `${id}@example.test`, password: 'test-only', role: i < 2 ? 'ADMIN' : 'CUSTOMER', lojaID: stores[i === 1 ? 1 : 0], createdAt: new Date('2026-01-01') })) })
    for (let i = 0; i < products.length; i++) await prisma.product.create({ data: { id: products[i], name: 'Fixture', description: 'test', imageUrl: '/test.png', price: 10, stock: 2, lojaID: stores[i === 1 ? 1 : 0], userID: users[i === 1 ? 1 : 0], productVariants: { create: { id: variants[i], size: 'Test', color: 'Test', stock: 2 } } } })
    for (let i = 0; i < 2; i++) {
      await prisma.cart.create({ data: { id: carts[i], userID: users[i] } })
      await prisma.address.create({ data: { id: addresses[i], userID: users[i], cep: '00000000', state: 'SP', city: 'Test', district: 'Test', street: 'Test', number: '1' } })
      await prisma.order.create({ data: { id: orders[i], userID: users[i === 0 ? 0 : 2], lojaID: stores[0], deliveryType: 'PICKUP', subtotal: 10, total: 10 } })
    }
  })
  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { actorId: { in: users } } })
    await prisma.order.deleteMany({ where: { lojaID: { in: stores } } })
    await prisma.cart.deleteMany({ where: { userID: { in: users } } })
    await prisma.address.deleteMany({ where: { userID: { in: users } } })
    await prisma.product.deleteMany({ where: { id: { in: products } } })
    await prisma.user.deleteMany({ where: { id: { in: users } } })
    await prisma.loja.deleteMany({ where: { id: { in: stores } } })
    await prisma.$disconnect()
  })
  it('rejects cross-store cart items and variants of another product', async () => {
    await expect(prisma.cartItem.create({ data: cartItem(products[1], variants[1]) })).rejects.toThrow('COMMERCE_TENANT_MISMATCH')
    await expect(prisma.cartItem.create({ data: cartItem(products[0], variants[1]) })).rejects.toThrow('COMMERCE_VARIANT_MISMATCH')
    await expect(prisma.cartItem.create({ data: cartItem(products[0], variants[2]) })).rejects.toThrow('COMMERCE_VARIANT_MISMATCH')
    expect(await prisma.cartItem.count({ where: { cartID: carts[0] } })).toBe(0)
  })
  it('rejects cross-store order items, addresses, default addresses and source carts', async () => {
    await expect(prisma.orderItem.create({ data: { orderId: orders[0], productId: products[1], productVariantsId: variants[1], quantity: 1, price: 10, name: 'Fixture', size: 'Test', color: 'Test' } })).rejects.toThrow()
    await expect(prisma.order.update({ where: { id: orders[0] }, data: { addressID: addresses[1] } })).rejects.toThrow()
    await expect(prisma.order.update({ where: { id: orders[0] }, data: { sourceCartID: carts[1] } })).rejects.toThrow()
    await expect(prisma.user.update({ where: { id: users[0] }, data: { defaultAddressId: addresses[1] } })).rejects.toThrow()
  })
  it('prevents reparenting from bypassing a valid child link', async () => {
    await prisma.cartItem.create({ data: cartItem(products[0], variants[0]) })
    await expect(prisma.productVariants.update({ where: { id: variants[0] }, data: { ProductID: products[1] } })).rejects.toThrow()
    await expect(prisma.cart.update({ where: { id: carts[0] }, data: { userID: users[1] } })).rejects.toThrow()
  })
  it('serializes a competing parent move and child insert without an invalid link', async () => {
    const results = await Promise.allSettled([
      prisma.cartItem.create({ data: cartItem(products[2], variants[2]) }),
      prisma.product.update({ where: { id: products[2] }, data: { lojaID: stores[1], userID: users[1] } }),
    ])
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    const item = await prisma.cartItem.findFirst({ where: { productID: products[2] }, include: { product: true, cart: { include: { user: true } } } })
    if (item) expect(item.product.lojaID).toBe(item.cart.user.lojaID)
  })
  it('commits a settings audit atomically without storing payment/contact data', async () => {
    expect(await updateLojaSettings(stores[0], { primaryColor: '#123456', pixKey: 'private-fixture-value' }, users[0])).not.toBeNull()
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityId: stores[0], action: 'STORE_SETTINGS_UPDATE' } })
    expect(audit.newValue).toMatchObject({ primaryColor: '#123456' })
    expect(JSON.stringify(audit)).not.toContain('private-fixture-value')
    await expect(persistAuditedSettings(stores[0], users[0], 'STORE_SETTINGS_UPDATE', ['primaryColor'], async tx => {
      await tx.loja.update({ where: { id: stores[0] }, data: { primaryColor: '#ffffff' } })
      throw new Error('fixture failure after write')
    })).rejects.toThrow('fixture failure')
    expect((await prisma.loja.findUniqueOrThrow({ where: { id: stores[0] } })).primaryColor).toBe('#123456')
    expect(await prisma.auditLog.count({ where: { entityId: stores[0] } })).toBe(1)
    expect(await updateLojaSettings(stores[0], { primaryColor: '#ffffff' }, users[1])).toBeNull()
  })
  it('paginates equal timestamps without repeating or dropping customers', async () => {
    const first = await listCustomers({ lojaID: stores[0], limit: 1 })
    const second = await listCustomers({ lojaID: stores[0], limit: 1, cursor: first.nextCursor! })
    expect(new Set([...first.data, ...second.data].map(row => row.id))).toEqual(new Set([users[0], users[2]]))
    expect(second.nextCursor).toBeNull()
  })
  it('paginates three orders sharing the same timestamp', async () => {
    const createdAt = new Date('2026-01-01')
    await prisma.order.updateMany({ where: { lojaID: stores[0] }, data: { createdAt } })
    const extra = await prisma.order.create({ data: { userID: users[2], lojaID: stores[0], deliveryType: 'PICKUP', subtotal: 10, total: 10, createdAt } })
    const seen: string[] = []
    let cursor: string | undefined
    for (let page = 0; page < 3; page++) {
      const result = await listOrdersForAdmin({ lojaID: stores[0], pageSize: 1, cursor })
      expect(result.data).toHaveLength(1)
      seen.push(result.data[0].id)
      cursor = result.nextCursor ?? undefined
    }
    expect(new Set(seen)).toEqual(new Set([...orders, extra.id]))
    expect(cursor).toBeUndefined()
  })
  it('rolls back settings when the audit insert itself fails', async () => {
    const actor = await prisma.user.create({ data: { name: 'Audit fixture', email: `${prefix}-audit@example.test`, password: 'fixture', role: 'ADMIN', lojaID: stores[0] } })
    try {
      const before = await prisma.loja.findUniqueOrThrow({ where: { id: stores[0] } })
      await expect(persistAuditedSettings(stores[0], actor.id, 'STORE_SETTINGS_UPDATE', ['primaryColor'], async tx => {
        await tx.loja.update({ where: { id: stores[0] }, data: { primaryColor: '#abcdef' } })
        // Force the audit FK to fail after a successful settings mutation.
        await tx.user.delete({ where: { id: actor.id } })
      })).rejects.toThrow()
      expect((await prisma.loja.findUniqueOrThrow({ where: { id: stores[0] } })).primaryColor).toBe(before.primaryColor)
      expect(await prisma.user.findUnique({ where: { id: actor.id } })).not.toBeNull()
    } finally { await prisma.user.delete({ where: { id: actor.id } }) }
  })
})
