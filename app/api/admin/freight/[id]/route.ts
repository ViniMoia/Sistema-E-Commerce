import { NextResponse } from 'next/server'
import { ok, err } from '@/lib/api-response'
import { requirePurchaseAdmin as requireAdmin } from '@/lib/auth/guards'
import { updateFreightRule, deleteFreightRule, freightRuleSchema } from '@/services/freight.service'

const updateFreightRuleSchema = freightRuleSchema.partial().refine(data => Object.keys(data).length > 0);

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, context: RouteContext) {
  const adminResult = await requireAdmin(req)
  if (adminResult instanceof NextResponse) return adminResult

  const params = await context.params
  const { id } = params
  if (!id) {
    return err('ID da regra não informado', 400)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return err('JSON inválido', 400)
  }

  const parsed = updateFreightRuleSchema.safeParse(body)
  if (!parsed.success) {
    return err('Dados inválidos: ' + parsed.error.issues.map((i) => i.message).join(', '), 422)
  }

  try {
    const updated = await updateFreightRule({
      id,
      lojaID: adminResult.user.lojaID,
      cityName: parsed.data.cityName,
      value: parsed.data.value,
      state: parsed.data.state,
      municipalityCode: parsed.data.municipalityCode,
      actorId: adminResult.user.id,
    })

    if (!updated) {
      return err('Regra de frete não encontrada.', 404, 'NOT_FOUND')
    }

    return ok(updated)
  } catch {
    return err('Não foi possível alterar a regra. Confira geografia e autorização.', 409)
  }
}

export async function PUT(req: Request, context: RouteContext) {
  return PATCH(req, context)
}

export async function DELETE(req: Request, context: RouteContext) {
  const adminResult = await requireAdmin(req)
  if (adminResult instanceof NextResponse) return adminResult

  const params = await context.params
  const { id } = params
  if (!id) {
    return err('ID da regra não informado', 400)
  }

  try {
    const deleted = await deleteFreightRule(id, adminResult.user.lojaID, adminResult.user.id)
    if (!deleted) {
      return err('Regra de frete não encontrada.', 404, 'NOT_FOUND')
    }

    return ok(deleted)
  } catch {
    return err('Não foi possível alterar a regra. Confira geografia e autorização.', 409)
  }
}
