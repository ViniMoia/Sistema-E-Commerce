import { logger } from '@/lib/logger'
import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { ok, err } from '@/lib/api-response'
import { requireAdmin } from '@/lib/auth/guards'
import { listFreightRules, createFreightRule } from '@/services/freight.service'
import { createFreightRuleSchema } from '@/lib/validators/admin-freight'

export async function GET(req: Request) {
  const adminResult = await requireAdmin(req)
  if (adminResult instanceof NextResponse) return adminResult
  const { lojaID } = adminResult.user
  const rules = await listFreightRules({ lojaID })
  return ok(rules)
}

export async function POST(req: Request) {
  const adminResult = await requireAdmin(req)
  if (adminResult instanceof NextResponse) return adminResult
  const { lojaID } = adminResult.user
  const body = await req.json().catch(() => null)
  if (body === null) return err('JSON inválido.', 400, 'INVALID_JSON')

  const parsed = createFreightRuleSchema.safeParse(body)
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? 'Dados de frete inválidos.', 422, 'VALIDATION_ERROR')
  }

  const { cityName, value } = parsed.data
  try {
    const rule = await createFreightRule({
      lojaID,
      actorId: adminResult.user.id,
      cityName,
      value,
    })
    return ok(rule, 201)
  } catch (e) {
    logger.error('Freight rule mutation failed', e, { action: 'FREIGHT_RULE_FAILED' })
    if ((e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') || (e instanceof Error && e.message === 'Regra de frete já existe para esta loja e cidade.')) {
      return err('Regra de frete já existe para esta loja e cidade.', 409)
    }
    return err('Erro ao alterar regra de frete.', 500, 'INTERNAL_ERROR')
  }
}
