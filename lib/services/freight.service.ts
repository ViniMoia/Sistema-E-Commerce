import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

interface CreateFreightRuleParams {
  lojaID: string
  cityName: string
  value: number
}

interface UpdateFreightRuleParams {
  id: string
  lojaID: string
  cityName?: string
  value?: number
}

interface ListFreightRulesParams {
  lojaID: string
}

type FreightRule = {
  id: string
  lojaID: string
  cityName: string
  value: number
  createdAt: Date
  updatedAt: Date
}

export async function listFreightRules(params: ListFreightRulesParams): Promise<FreightRule[]> {
  const rules = await prisma.freightRule.findMany({
    where: { lojaID: params.lojaID },
    orderBy: { cityName: 'asc' }
  })
  return rules.map(r => ({
    id: r.id,
    lojaID: r.lojaID,
    cityName: r.cityName,
    value: (r.value as Prisma.Decimal).toNumber(),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt
  }))
}

export async function createFreightRule(params: CreateFreightRuleParams): Promise<FreightRule> {
  const exists = await prisma.freightRule.findFirst({
    where: { lojaID: params.lojaID, cityName: params.cityName }
  })
  if (exists) {
    throw new Error('Regra de frete já existe para esta loja e cidade.')
  }
  const rule = await prisma.freightRule.create({
    data: {
      lojaID: params.lojaID,
      cityName: params.cityName,
      value: new Prisma.Decimal(params.value)
    }
  })
  return {
    id: rule.id,
    lojaID: rule.lojaID,
    cityName: rule.cityName,
    value: (rule.value as Prisma.Decimal).toNumber(),
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt
  }
}

export async function updateFreightRule(params: UpdateFreightRuleParams): Promise<FreightRule | null> {
  const existing = await prisma.freightRule.findUnique({ where: { id: params.id } })
  if (!existing || existing.lojaID !== params.lojaID) {
    return null
  }
  const data: any = {}
  if (params.cityName !== undefined) data.cityName = params.cityName
  if (params.value !== undefined) data.value = new Prisma.Decimal(params.value)
  const updated = await prisma.freightRule.update({
    where: { id: params.id },
    data
  })
  return {
    id: updated.id,
    lojaID: updated.lojaID,
    cityName: updated.cityName,
    value: (updated.value as Prisma.Decimal).toNumber(),
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt
  }
}

export async function deleteFreightRule(id: string, lojaID: string): Promise<FreightRule | null> {
  const existing = await prisma.freightRule.findUnique({ where: { id } })
  if (!existing || existing.lojaID !== lojaID) {
    return null
  }
  const deleted = await prisma.freightRule.delete({ where: { id } })
  return {
    id: deleted.id,
    lojaID: deleted.lojaID,
    cityName: deleted.cityName,
    value: (deleted.value as Prisma.Decimal).toNumber(),
    createdAt: deleted.createdAt,
    updatedAt: deleted.updatedAt
  }
}
