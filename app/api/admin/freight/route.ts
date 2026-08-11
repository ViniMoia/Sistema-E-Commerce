import { NextResponse } from 'next/server'
import { ok, err } from '@/lib/api-response'
import { requireAdmin } from '@/lib/auth-admin'
import { listFreightRules, createFreightRule } from '@/lib/services/freight.service'

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
  const body = await req.json()
  const { cityName, value } = body as { cityName: string; value: number }
  try {
    const rule = await createFreightRule({ lojaID, cityName, value })
    return ok(rule, 201)
  } catch (e) {
    return err((e as Error).message, 400)
  }
}
