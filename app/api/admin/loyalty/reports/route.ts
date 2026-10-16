import { NextResponse } from 'next/server'
import { ok, err } from '@/lib/api-response'
import { requireAdmin } from '@/lib/auth/guards'
import { readLoyaltyReport } from '@/services/loyalty-report.service'

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  try {
    const response = ok(await readLoyaltyReport(auth.user.lojaID))
    response.headers.set('Cache-Control', 'private, no-store')
    return response
  } catch {
    return err('Erro ao gerar relatório de fidelidade.', 500)
  }
}
