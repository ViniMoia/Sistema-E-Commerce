import { NextResponse } from 'next/server';
import { requirePurchaseAdmin } from '@/lib/auth/guards';
import { completePhysicalReturn, readPhysicalReturn, PhysicalReturnError } from '@/services/physical-return.service';
import { invalidateDashboardCache } from '@/services/dashboard.service';

type Context = { params: Promise<{ orderId: string }> };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
function errorResponse(error: unknown) {
  if (error instanceof PhysicalReturnError) return json({ success: false, error: error.message, code: error.code },
    { INVALID: 400, FORBIDDEN: 403, NOT_FOUND: 404, CONFLICT: 409 }[error.code]);
  return json({ success: false, error: 'Resultado não confirmado. Consulte o registro antes de repetir.' }, 503);
}
export async function GET(req: Request, context: Context) {
  const auth = await requirePurchaseAdmin(req); if (auth instanceof NextResponse) return auth;
  try { return json({ success: true, data: await readPhysicalReturn((await context.params).orderId, auth.user.lojaID) }); }
  catch (error) { return errorResponse(error); }
}
export async function POST(req: Request, context: Context) {
  const auth = await requirePurchaseAdmin(req); if (auth instanceof NextResponse) return auth;
  if (req.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json')
    return json({ success: false, error: 'Envie a conferência em JSON.' }, 415);
  try {
    const data = await completePhysicalReturn({ orderId: (await context.params).orderId, lojaID: auth.user.lojaID, actorId: auth.user.id }, await req.json().catch(()=>null));
    invalidateDashboardCache(auth.user.lojaID);
    return json({ success: true, data });
  } catch (error) { return errorResponse(error); }
}
