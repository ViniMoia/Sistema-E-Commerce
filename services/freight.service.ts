import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { tenantCache } from '@/lib/cache'
import { createFreightRuleSchema, updateFreightRuleSchema } from '@/lib/validators/admin-freight'

export interface CreateFreightRuleParams {
  lojaID: string
  actorId: string
  cityName: string
  value: number
}

export interface UpdateFreightRuleParams {
  id: string
  lojaID: string
  actorId: string
  cityName?: string
  value?: number
}

export interface ListFreightRulesParams {
  lojaID: string
}

export type FreightRule = {
  id: string
  lojaID: string
  cityName: string
  value: number
  createdAt: Date
  updatedAt: Date
}

export async function listFreightRules(params: ListFreightRulesParams): Promise<FreightRule[]> {
  return await tenantCache.getOrSet(
    params.lojaID,
    'freight',
    'all_rules',
    async () => {
      const rules = await prisma.freightRule.findMany({
        where: { lojaID: params.lojaID },
        orderBy: { cityName: 'asc' },
      })
      return rules.map((r) => ({
        id: r.id,
        lojaID: r.lojaID,
        cityName: r.cityName,
        value: (r.value as Prisma.Decimal).toNumber(),
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }))
    },
    300000 // 5 minutos de cache
  )
}

export async function createFreightRule(params: CreateFreightRuleParams): Promise<FreightRule> {
  const validated = createFreightRuleSchema.parse({
    cityName: params.cityName,
    value: params.value,
  })
  const rule = await prisma.$transaction(async (tx) => {
    const exists = await tx.freightRule.findFirst({
      where: { lojaID: params.lojaID, cityName: validated.cityName },
    })
    if (exists) throw new Error('Regra de frete já existe para esta loja e cidade.')

    const created = await tx.freightRule.create({
      data: {
        lojaID: params.lojaID,
        cityName: validated.cityName,
        value: new Prisma.Decimal(validated.value),
      },
    })
    await tx.auditLog.create({
      data: {
        action: 'FREIGHT_RULE_CREATED',
        actorId: params.actorId,
        targetId: params.actorId,
        entity: 'FreightRule',
        entityId: created.id,
        newValue: { cityName: created.cityName, value: created.value.toString() },
        metadata: { lojaID: params.lojaID },
      },
    })
    return created
  })

  // Invalida cache de frete do tenant
  tenantCache.invalidateTenant(params.lojaID, 'freight')

  return {
    id: rule.id,
    lojaID: rule.lojaID,
    cityName: rule.cityName,
    value: (rule.value as Prisma.Decimal).toNumber(),
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  }
}

export async function updateFreightRule(params: UpdateFreightRuleParams): Promise<FreightRule | null> {
  const validated = updateFreightRuleSchema.parse({
    ...(params.cityName !== undefined ? { cityName: params.cityName } : {}),
    ...(params.value !== undefined ? { value: params.value } : {}),
  })
  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.freightRule.findUnique({ where: { id: params.id } })
    if (!existing || existing.lojaID !== params.lojaID) return null

    const data: Prisma.FreightRuleUpdateInput = {}
    if (validated.cityName !== undefined) data.cityName = validated.cityName
    if (validated.value !== undefined) data.value = new Prisma.Decimal(validated.value)
    const changed = await tx.freightRule.update({ where: { id: params.id }, data })
    await tx.auditLog.create({
      data: {
        action: 'FREIGHT_RULE_UPDATED',
        actorId: params.actorId,
        targetId: params.actorId,
        entity: 'FreightRule',
        entityId: changed.id,
        previousValue: { cityName: existing.cityName, value: existing.value.toString() },
        newValue: { cityName: changed.cityName, value: changed.value.toString() },
        metadata: { lojaID: params.lojaID },
      },
    })
    return changed
  })
  if (!updated) return null

  // Invalida cache de frete do tenant
  tenantCache.invalidateTenant(params.lojaID, 'freight')

  return {
    id: updated.id,
    lojaID: updated.lojaID,
    cityName: updated.cityName,
    value: (updated.value as Prisma.Decimal).toNumber(),
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  }
}

export async function deleteFreightRule(id: string, lojaID: string, actorId: string): Promise<FreightRule | null> {
  const deleted = await prisma.$transaction(async (tx) => {
    const existing = await tx.freightRule.findUnique({ where: { id } })
    if (!existing || existing.lojaID !== lojaID) return null

    await tx.auditLog.create({
      data: {
        action: 'FREIGHT_RULE_DELETED',
        actorId,
        targetId: actorId,
        entity: 'FreightRule',
        entityId: id,
        previousValue: { cityName: existing.cityName, value: existing.value.toString() },
        metadata: { lojaID },
      },
    })
    return tx.freightRule.delete({ where: { id } })
  })
  if (!deleted) return null

  // Invalida cache de frete do tenant
  tenantCache.invalidateTenant(lojaID, 'freight')

  return {
    id: deleted.id,
    lojaID: deleted.lojaID,
    cityName: deleted.cityName,
    value: (deleted.value as Prisma.Decimal).toNumber(),
    createdAt: deleted.createdAt,
    updatedAt: deleted.updatedAt,
  }
}
