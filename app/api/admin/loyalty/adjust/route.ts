import { NextResponse } from 'next/server'
import { ok, err } from '@/lib/api-response'
import { requirePurchaseAdmin } from '@/lib/auth/guards'
import { adjustPointsManually, AdjustLoyaltyBalanceSchema, LoyaltyError } from '@/services/loyalty.service'

export async function POST(req: Request) {
  const auth = await requirePurchaseAdmin(req)
  if (auth instanceof NextResponse) return auth

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return err('JSON inválido.', 400)
  }

  const rawData = {
    ...(typeof body === 'object' && body !== null ? body : {}),
    lojaID: auth.user.lojaID,
    adminUserId: auth.user.id,
  }

  const parseResult = AdjustLoyaltyBalanceSchema.safeParse(rawData)
  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]
    return err(issue ? issue.message : 'Dados de ajuste inválidos.', 400)
  }

  try {
    const result = await adjustPointsManually(parseResult.data)
    return ok({
      message: 'Ajuste de saldo realizado com sucesso.',
      newBalance: result.wallet.balance,
      transactionId: result.transaction.id,
      debt: result.wallet.debt,
      replay: result.replay,
    })
  } catch (error: unknown) {
    if (error instanceof LoyaltyError) return err(error.message,
      error.code === 'FORBIDDEN' ? 403 : ['CONFLICT', 'RECONCILIATION_REQUIRED'].includes(error.code) ? 409 : 422)
    console.error('[ADMIN_LOYALTY_ADJUST_ERROR]')
    return err('Erro ao realizar ajuste manual de saldo.', 500)
  }
}
