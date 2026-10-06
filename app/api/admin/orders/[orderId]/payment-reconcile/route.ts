import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePurchaseAdmin } from '@/lib/auth/guards';
import { requestPaymentReconciliation } from '@/services/payment/payment-supervision.service';
export async function POST(req: Request, context: { params: Promise<{ orderId: string }> }) {
  const auth = await requirePurchaseAdmin(req); if (auth instanceof NextResponse) return auth;
  const input = z.object({ commandId: z.string().regex(/^[a-zA-Z0-9_-]{1,96}$/) }).strict().safeParse(await req.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: 'Comando inválido.' }, { status: 400 });
  try {
    return NextResponse.json({ data: await requestPaymentReconciliation({ ...input.data, orderId: (await context.params).orderId,
      lojaID: auth.user.lojaID, userId: auth.user.id }) }, { status: 202 });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    return NextResponse.json({ error: code.startsWith('PAYMENT_') ? code : 'PAYMENT_RECONCILIATION_UNAVAILABLE' },
      { status: code.endsWith('FORBIDDEN') ? 403 : code.endsWith('NOT_FOUND') ? 404 : code.startsWith('PAYMENT_') ? 409 : 503 });
  }
}
