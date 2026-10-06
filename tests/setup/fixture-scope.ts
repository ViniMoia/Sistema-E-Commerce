import { randomUUID } from 'node:crypto'
import prisma, { verifyTestDatabase } from '@/lib/prisma'

const ownedStores = new Set<string>()
export function registerFixtureStore(id: string) { ownedStores.add(id) }

export async function createFixtureStore(id: string = randomUUID()) {
  await verifyTestDatabase()
  if (await prisma.loja.findUnique({ where: { id } })) {
    if (!ownedStores.has(id)) throw new Error('Fixture não pode adotar uma loja preexistente.')
    return id
  }
  registerFixtureStore(id)
  await prisma.loja.create({ data: {
    id, slug: `fixture-${randomUUID()}`, name: 'Loja de teste',
    description: 'Fixture descartável', coverImageUrl: 'https://example.com/fixture.jpg',
    enableManualPix: true, pixKey: 'fixture@example.invalid', whatsappNumber: '11999999999',
  } })
  return id
}

export async function cleanupFixtureStores() {
  await verifyTestDatabase() // recheck immediately before scoped, atomic cleanup
  const lojaID = { in: [...ownedStores] }
  if (!lojaID.in.length) return
  await prisma.$transaction(async tx => {
    const users = await tx.user.findMany({ where: { lojaID }, select: { id: true } })
    const userID = { in: users.map(user => user.id) }
    const orders = await tx.order.findMany({ where: { lojaID }, select: { id: true } })
    if (orders.length) await tx.paymentWebhookEvent.deleteMany({ where: { OR: orders.map(order => ({ payload: { path: ['payment', 'externalReference'], equals: order.id } })) } })
    await tx.commerceOutbox.deleteMany({ where: { aggregateId: { in: orders.map(order => order.id) } } })
    if (orders.length) await tx.paymentInbox.deleteMany({ where: { OR: orders.map(order => ({ payload: { path: ['payment', 'externalReference'], equals: order.id } })) } })
    await tx.auditLog.deleteMany({ where: { entity: 'Order', entityId: { in: orders.map(order => order.id) } } })
    const attempts = await tx.paymentAttempt.findMany({ where: { order: { lojaID } }, select: { id: true } })
    await tx.auditLog.deleteMany({ where: { entity: 'PaymentAttempt', entityId: { in: attempts.map(a => a.id) } } })
    await tx.inventoryReservation.deleteMany({ where: { order: { lojaID } } })
    await tx.financialFact.deleteMany({ where: { order: { lojaID } } })
    await tx.paymentOperation.deleteMany({ where: { attempt: { order: { lojaID } } } })
    await tx.paymentCharge.deleteMany({ where: { attempt: { order: { lojaID } } } })
    await tx.paymentAttempt.deleteMany({ where: { order: { lojaID } } })
    // Break only the owned refund provenance edge before deleting the owned
    // allocations/lots. A foreign reference still aborts the whole cleanup.
    await tx.loyaltyLot.updateMany({ where: { wallet: { lojaID } }, data: { sourceAllocationId: null } })
    await tx.loyaltyAllocation.deleteMany({ where: { transaction: { lojaID } } })
    await tx.loyaltyLot.deleteMany({ where: { wallet: { lojaID } } })
    await tx.orderStatusHistory.deleteMany({ where: { order: { lojaID } } })
    await tx.orderItem.deleteMany({ where: { order: { lojaID } } })
    await tx.loyaltyTransaction.deleteMany({ where: { lojaID } })
    await tx.order.deleteMany({ where: { lojaID } })
    await tx.freightQuote.deleteMany({ where: { lojaID } })
    await tx.checkoutIntent.deleteMany({ where: { lojaID } })
    await tx.checkoutBasket.deleteMany({ where: { lojaID } })
    await tx.orderBuyer.deleteMany({ where: { lojaID } })
    await tx.cart.deleteMany({ where: { user: { lojaID } } })
    await tx.user.updateMany({ where: { lojaID }, data: { defaultAddressId: null } })
    await tx.address.deleteMany({ where: { userID } })
    await tx.auditLog.deleteMany({ where: { OR: [{ actorId: userID }, { targetId: userID }] } })
    await tx.product.deleteMany({ where: { lojaID } })
    await tx.freightRule.deleteMany({ where: { lojaID } })
    await tx.stockSyncLog.deleteMany({ where: { lojaID } })
    await tx.user.deleteMany({ where: { lojaID } })
    await tx.loja.deleteMany({ where: { id: lojaID } })
  })
  ownedStores.clear()
}
