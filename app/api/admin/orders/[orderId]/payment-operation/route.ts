import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePurchaseAdmin } from '@/lib/auth/guards';
import { requestPaymentOperation } from '@/services/payment/payment-operations.service';
const schema = z.object({ kind: z.enum(['CANCEL', 'REFUND']), commandId: z.string().regex(/^[a-zA-Z0-9_-]{1,96}$/), expectedVersion: z.number().int().nonnegative() }).strict();
export async function POST(req: Request, context: { params: Promise<{ orderId: string }> }) {
  const auth = await requirePurchaseAdmin(req); if (auth instanceof NextResponse) return auth;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Comando financeiro inválido.' }, { status: 400 });
  try {
    const result = await requestPaymentOperation({ ...parsed.data, orderId: (await context.params).orderId, lojaID: auth.user.lojaID, userId: auth.user.id });
    return NextResponse.json({ data: result }, { status: 202 });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    const status = code === 'PAYMENT_ORDER_NOT_FOUND' ? 404 : code === 'PAYMENT_OPERATION_FORBIDDEN' ? 403 : code.startsWith('PAYMENT_') ? 409 : 503;
    return NextResponse.json({ error: status === 503 ? 'Operação financeira indisponível.' : code }, { status });
  }
}
