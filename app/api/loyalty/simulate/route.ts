import { ok, err } from '@/lib/api-response'
import { checkRateLimit } from '@/lib/rate-limit'
import { getCurrentUser } from '@/lib/session'
import { simulatePointsRedemption, SimulateLoyaltyRedeemSchema } from '@/services/loyalty.service'

export async function POST(request: Request) {
  // Proteção contra spam de simulação: 30 requisições/minuto
  const rateLimitResponse = checkRateLimit(request, 'loyalty_simulate', 30, 60000)
  if (rateLimitResponse) return rateLimitResponse

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return err('JSON inválido.', 400)
  }

  const parseResult = SimulateLoyaltyRedeemSchema.safeParse(body)
  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]
    return err(issue ? issue.message : 'Dados de simulação inválidos.', 400)
  }

  const data = parseResult.data

  // Identificar se há um usuário com sessão ativa
  const currentUser = await getCurrentUser()
  const resolvedUserId = currentUser ? currentUser.id : data.userID

  try {
    const result = await simulatePointsRedemption({
      ...data,
      userID: resolvedUserId,
    })

    return ok(result)
  } catch (error: any) {
    console.error('[LOYALTY_SIMULATE_ERROR]', error)
    return err(error?.message || 'Erro ao simular resgate de pontos.', 400)
  }
}
