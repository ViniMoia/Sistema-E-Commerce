import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { randomUUID } from 'node:crypto'
import { getLogContext } from '@/lib/observability/request-context'

// Financial rates/flags and visual colors are safe; contact, address, free text,
// provider configuration and payment identifiers must never enter the snapshots.
const snapshotSelect = {
  enableCorreios: true, enablePickup: true, enableNoFreight: true, additionalDays: true,
  primaryColor: true, secondaryColor: true, loyaltyEnabled: true,
  loyaltyEarnRate: true, loyaltyPointValue: true, loyaltyMinPointsRedeem: true,
  loyaltyMaxDiscountPct: true, loyaltyPointsExpiryDays: true,
} satisfies Prisma.LojaSelect

export async function persistAuditedSettings<T>(
  lojaID: string,
  actorId: string,
  action: 'STORE_SETTINGS_UPDATE' | 'LOYALTY_SETTINGS_UPDATE',
  changedFields: string[],
  mutate: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async tx => {
    const context = getLogContext()
    const requestId = typeof context.requestId === 'string' ? context.requestId : randomUUID()
    const actor = await tx.user.findFirst({
      where: { id: actorId, lojaID, role: 'ADMIN', status: 'ACTIVE' }, select: { id: true },
    })
    if (!actor) throw new Error('SETTINGS_ACTOR_FORBIDDEN')
    await tx.$queryRaw`SELECT id FROM "Loja" WHERE id = ${lojaID} FOR UPDATE`
    const previous = await tx.loja.findUniqueOrThrow({ where: { id: lojaID }, select: snapshotSelect })
    const result = await mutate(tx)
    const next = await tx.loja.findUniqueOrThrow({ where: { id: lojaID }, select: snapshotSelect })
    await tx.auditLog.create({ data: {
      action, actorId, targetId: actorId, entity: 'Loja', entityId: lojaID,
      previousValue: JSON.parse(JSON.stringify(previous)),
      newValue: JSON.parse(JSON.stringify(next)),
      metadata: { lojaID, requestId, changedFields: [...new Set(changedFields)].sort() },
    } })
    return result
  })
}
