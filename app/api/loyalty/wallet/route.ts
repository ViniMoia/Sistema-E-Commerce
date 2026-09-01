import { NextResponse } from 'next/server'
import { ok, err } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth/guards'
import { getStatement } from '@/services/loyalty.service'

export async function GET(req: Request) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const url = new URL(req.url)
  const page = parseInt(url.searchParams.get('page') || '1', 10)
  const limit = parseInt(url.searchParams.get('limit') || '20', 10)

  try {
    const statement = await getStatement({
      lojaID: auth.user.lojaID,
      userID: auth.user.id,
      page,
      limit,
    })

    return ok(statement)
  } catch (error: any) {
    console.error('[LOYALTY_WALLET_ERROR]', error)
    return err(error?.message || 'Erro ao carregar carteira de pontos.', 500)
  }
}
