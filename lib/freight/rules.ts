import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { tenantCache } from '@/lib/cache';
import { z } from 'zod';

export const freightRuleSchema = z.object({ cityName: z.string().trim().min(2).max(150),
  state: z.string().regex(/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/),
  municipalityCode: z.string().regex(/^\d{7}$/), value: z.number().finite().min(0).max(99999999.99)
    .refine(value => new Prisma.Decimal(value).equals(new Prisma.Decimal(value).toDecimalPlaces(2)), 'Valor deve ter no máximo duas casas.') }).strict();
export type FreightRule = { id: string; lojaID: string; cityName: string; state: string | null; municipalityCode: string | null;
  value: number; createdAt: Date; updatedAt: Date };
export interface CreateFreightRuleParams { lojaID: string; cityName: string; state: string; municipalityCode: string; value: number; actorId?: string }
export interface UpdateFreightRuleParams { id: string; lojaID: string; cityName?: string; state?: string; municipalityCode?: string; value?: number; actorId?: string }
const dto = (rule: Omit<FreightRule, 'value'> & { value: Prisma.Decimal }): FreightRule => ({ ...rule, value: rule.value.toNumber() });
async function authorize(tx: Prisma.TransactionClient, lojaID: string, actorId?: string) {
  await tx.$queryRaw`SELECT id FROM "Loja" WHERE id = ${lojaID} FOR UPDATE`;
  if (!actorId) throw new Error('UNAUTHORIZED');
  const actor = await tx.user.findUnique({ where: { id: actorId }, select: { lojaID: true, role: true, status: true } });
  if (!actor || actor.lojaID !== lojaID || actor.role !== 'ADMIN' || actor.status !== 'ACTIVE') throw new Error('FORBIDDEN');
}
export async function listFreightRules({ lojaID }: { lojaID: string }): Promise<FreightRule[]> {
  const store = await prisma.loja.findUniqueOrThrow({ where: { id: lojaID }, select: { configurationVersion: true } });
  return tenantCache.getOrSet(lojaID, 'freight', 'rules-v2-' + store.configurationVersion,
    async () => (await prisma.freightRule.findMany({ where: { lojaID }, orderBy: { cityName: 'asc' } })).map(dto), 300000);
}
export async function createFreightRule(params: CreateFreightRuleParams): Promise<FreightRule> {
  const data = freightRuleSchema.parse({ cityName: params.cityName, state: params.state, municipalityCode: params.municipalityCode, value: params.value });
  const rule = await prisma.$transaction(async tx => {
    await authorize(tx, params.lojaID, params.actorId);
    const exists = await tx.freightRule.findFirst({ where: { lojaID: params.lojaID, OR: [
      { cityName: { equals: data.cityName, mode: 'insensitive' } }, { state: data.state, municipalityCode: data.municipalityCode } ] } });
    if (exists) throw new Error('Regra já existe. Edite a configuração existente.');
    const created = await tx.freightRule.create({ data: { ...data, lojaID: params.lojaID } });
    await tx.auditLog.create({ data: { actorId: params.actorId!, actorType: 'USER', entity: 'FreightRule', entityId: created.id,
      action: 'FREIGHT_RULE_CREATED', newValue: data, metadata: { lojaID: params.lojaID } } });
    return created;
  });
  tenantCache.invalidateTenant(params.lojaID, 'freight'); return dto(rule);
}
export async function updateFreightRule(params: UpdateFreightRuleParams): Promise<FreightRule | null> {
  const hint = await prisma.freightRule.findUnique({ where: { id: params.id } });
  if (!hint || hint.lojaID !== params.lojaID) return null;
  const rule = await prisma.$transaction(async tx => {
    await authorize(tx, params.lojaID, params.actorId);
    const old = await tx.freightRule.findUnique({ where: { id: params.id } });
    if (!old || old.lojaID !== params.lojaID) return null;
    const data = freightRuleSchema.parse({ cityName: params.cityName ?? old.cityName, state: params.state ?? old.state,
      municipalityCode: params.municipalityCode ?? old.municipalityCode, value: params.value ?? old.value.toNumber() });
    const duplicate = await tx.freightRule.findFirst({ where: { lojaID: params.lojaID, id: { not: old.id }, OR: [
      { cityName: { equals: data.cityName, mode: 'insensitive' } }, { state: data.state, municipalityCode: data.municipalityCode } ] } });
    if (duplicate) throw new Error('Regra de município duplicada.');
    const updated = await tx.freightRule.update({ where: { id: old.id }, data });
    await tx.auditLog.create({ data: { actorId: params.actorId!, actorType: 'USER', entity: 'FreightRule', entityId: old.id,
      action: 'FREIGHT_RULE_UPDATED', previousValue: { cityName: old.cityName, state: old.state, municipalityCode: old.municipalityCode, value: old.value.toFixed(2) },
      newValue: data, metadata: { lojaID: params.lojaID } } });
    return updated;
  });
  tenantCache.invalidateTenant(params.lojaID, 'freight'); return rule ? dto(rule) : null;
}
export async function deleteFreightRule(id: string, lojaID: string, actorId?: string): Promise<FreightRule | null> {
  const hint = await prisma.freightRule.findUnique({ where: { id } }); if (!hint || hint.lojaID !== lojaID) return null;
  const deleted = await prisma.$transaction(async tx => {
    await authorize(tx, lojaID, actorId);
    const old = await tx.freightRule.findUnique({ where: { id } }); if (!old || old.lojaID !== lojaID) return null;
    await tx.freightRule.delete({ where: { id } });
    await tx.auditLog.create({ data: { actorId: actorId!, actorType: 'USER', entity: 'FreightRule', entityId: old.id,
      action: 'FREIGHT_RULE_DELETED', previousValue: { cityName: old.cityName, value: old.value.toFixed(2) }, metadata: { lojaID } } });
    return old;
  });
  tenantCache.invalidateTenant(lojaID, 'freight'); return deleted ? dto(deleted) : null;
}
