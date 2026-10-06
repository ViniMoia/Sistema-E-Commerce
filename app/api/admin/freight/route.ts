import { NextResponse } from 'next/server';
import { ok, err } from '@/lib/api-response';
import { requirePurchaseAdmin } from '@/lib/auth/guards';
import { listFreightRules, createFreightRule, freightRuleSchema } from '@/services/freight.service';
export async function GET(req: Request) {
  const auth = await requirePurchaseAdmin(req); if (auth instanceof NextResponse) return auth;
  return ok(await listFreightRules({ lojaID: auth.tenant!.id }));
}
export async function POST(req: Request) {
  const auth = await requirePurchaseAdmin(req); if (auth instanceof NextResponse) return auth;
  const data = freightRuleSchema.safeParse(await req.json().catch(() => null));
  if (!data.success) return err('Informe município, UF, código IBGE e tarifa válidos.', 422);
  try { return ok(await createFreightRule({ ...data.data, lojaID: auth.tenant!.id, actorId: auth.user.id }), 201); }
  catch { return err('Não foi possível registrar a regra. Confira duplicatas e autorização.', 409); }
}
