import { ok, err } from '@/lib/api-response'
import { checkRateLimit } from '@/lib/rate-limit'
import { getCurrentUser } from '@/lib/session'
import { LoyaltyError, simulatePointsRedemption } from '@/services/loyalty.service'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const publicSimulationSchema = z.object({
  subtotal: z.number().positive('Subtotal deve ser maior que zero'),
  requestedPoints: z.number().int().min(0, 'Pontos solicitados não podem ser negativos'),
}).strict()

export async function POST(request: Request) {
  // Proteção contra spam de simulação: 30 requisições/minuto
  const rateLimitResponse = checkRateLimit(request, 'loyalty_simulate', 30, 60000)
  if (rateLimitResponse) return rateLimitResponse

  const currentUser = await getCurrentUser()
  if (!currentUser) return err('Não autenticado.', 401)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return err('JSON inválido.', 400)
  }

  const parseResult = publicSimulationSchema.safeParse(body)
  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]
    return err(issue ? issue.message : 'Dados de simulação inválidos.', 400)
  }

  const data = parseResult.data

  try {
    const result = await simulatePointsRedemption({
      ...data,
      lojaID: currentUser.lojaID,
      userID: currentUser.id,
    })

    return ok(result)
  } catch (error: unknown) {
    logger.error('Falha ao simular resgate de pontos', error, { action: 'LOYALTY_SIMULATE_ERROR' })
    if (error instanceof LoyaltyError) return err(error.message, 400, error.code)
    return err('Erro interno ao simular resgate de pontos.', 500, 'LOYALTY_SIMULATE_INTERNAL_ERROR')
  }
}
