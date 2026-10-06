import { ok, err } from '@/lib/api-response'
import { checkRateLimit } from '@/lib/rate-limit'
import { getCurrentUser } from '@/lib/session'
import { getLojaFromHeaders } from '@/lib/tenant'
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
  const activeLoja = await getLojaFromHeaders()
  if (!activeLoja) return err('Loja não encontrada.', 404)
  if (data.lojaID !== activeLoja.id || (currentUser && currentUser.lojaID !== activeLoja.id)) {
    return err('Acesso não autorizado à loja.', 403)
  }
  // A declared identifier never supplies authority, including for guests.
  // Accept the session's own ID temporarily for older frontend clients.
  if (data.userID && data.userID !== currentUser?.id) return err('Identidade de simulação inválida.', 403)

  try {
    const result = await simulatePointsRedemption({
      subtotal: data.subtotal,
      requestedPoints: data.requestedPoints,
      lojaID: activeLoja.id,
      userID: currentUser?.id,
    })

    return ok(result)
  } catch (error: any) {
    console.error('[LOYALTY_SIMULATE_ERROR] Falha na simulação de pontos.')
    return err(error?.message || 'Erro ao simular resgate de pontos.', 400)
  }
}
