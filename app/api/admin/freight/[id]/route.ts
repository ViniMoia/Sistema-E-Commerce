import { NextResponse } from 'next/server'
import { ok, err } from '@/lib/api-response'
import { requireAdmin } from '@/lib/auth/guards'
import { updateFreightRule, deleteFreightRule } from '@/services/freight.service'
import { z } from 'zod'

const updateFreightRuleSchema = z.object({
  cityName: z.string().min(1, 'Nome da cidade é obrigatório').optional(),
  value: z.number().min(0, 'Valor de frete não pode ser negativo').optional(),
})

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
    })

    if (!updated) {
      return err('Regra de frete não encontrada.', 404, 'NOT_FOUND')
    }

    return ok(updated)
  } catch (e) {
    return err((e as Error).message, 500)
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
    const deleted = await deleteFreightRule(id, adminResult.user.lojaID)
    if (!deleted) {
      return err('Regra de frete não encontrada.', 404, 'NOT_FOUND')
    }

    return ok(deleted)
  } catch (e) {
    return err((e as Error).message, 500)
  }
}
