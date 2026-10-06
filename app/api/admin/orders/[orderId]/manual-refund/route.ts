import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePurchaseAdmin } from '@/lib/auth/guards';
import { manualRefund } from '@/services/payment/manual-refund.service';
const schema = z.object({ commandId: z.string().regex(/^[a-zA-Z0-9_-]{1,96}$/), expectedVersion: z.number().int().nonnegative(),
  action: z.enum(['REQUEST_REFUND','CONFIRM_REFUND']), bankReference: z.string().regex(/^[a-zA-Z0-9_:/.-]{8,128}$/).optional() }).strict();
export async function POST(req: Request, context: { params: Promise<{ orderId: string }> }) {
  const auth = await requirePurchaseAdmin(req); if (auth instanceof NextResponse) return auth;
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'Comando inválido.' }, { status: 400 });
  try { return NextResponse.json({ data: await manualRefund({ ...body.data, orderId: (await context.params).orderId, lojaID: auth.user.lojaID, userId: auth.user.id }) }); }
  catch (error) { const code = error instanceof Error ? error.message : '';
    return NextResponse.json({ error: /^(MANUAL_REFUND_|PAYMENT_ORDER_)/.test(code) ? code : 'MANUAL_REFUND_UNAVAILABLE' },
      { status: code.endsWith('FORBIDDEN') ? 403 : code.endsWith('NOT_FOUND') ? 404 : code.startsWith('MANUAL_REFUND_') ? 409 : 503 }); }
}
