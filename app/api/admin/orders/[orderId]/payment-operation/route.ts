import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePurchaseAdmin } from '@/lib/auth/guards';
import { requestPaymentOperation, readBoletoRefund } from '@/services/payment/payment-operations.service';
import { selectRequestHost } from '@/lib/tenant';
const schema = z.object({ kind: z.enum(['CANCEL', 'REFUND']), commandId: z.string().regex(/^[a-zA-Z0-9_-]{1,96}$/), expectedVersion: z.number().int().nonnegative() }).strict();
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } });
export async function GET(req: Request, context: { params: Promise<{ orderId: string }> }) {
  const auth = await requirePurchaseAdmin(req); if (auth instanceof NextResponse) return auth;
  try {
    return json({ data: await readBoletoRefund({ orderId: (await context.params).orderId, lojaID: auth.user.lojaID, userId: auth.user.id }) });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    return json({ error: 'Não foi possível consultar a devolução.' }, code === 'PAYMENT_ORDER_NOT_FOUND' ? 404 : code === 'PAYMENT_OPERATION_FORBIDDEN' ? 403 : 503);
  }
}
export async function POST(req: Request, context: { params: Promise<{ orderId: string }> }) {
  const auth = await requirePurchaseAdmin(req); if (auth instanceof NextResponse) return auth;
  // Browser commands must originate on the same tenant host. Non-browser
  // operators may omit Origin, but must still authenticate and send JSON.
  const origin = req.headers.get('origin');
  let originAllowed = req.headers.get('sec-fetch-site') !== 'cross-site';
  if (origin) {
    try {
      const url = new URL(origin);
      originAllowed = originAllowed && ['https:', 'http:'].includes(url.protocol) && url.origin === origin &&
        url.host.toLowerCase() === selectRequestHost(req.headers.get('host'), req.headers.get('x-forwarded-host')).toLowerCase();
    } catch { originAllowed = false; }
  }
  if (!originAllowed) return json({ error: 'Origem da solicitação não autorizada.' }, 403);
  if (req.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json')
    return json({ error: 'Envie o comando financeiro em JSON.' }, 415);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Comando financeiro inválido.' }, 400);
  try {
    const result = await requestPaymentOperation({ ...parsed.data, orderId: (await context.params).orderId, lojaID: auth.user.lojaID, userId: auth.user.id });
    return json({ data: result }, 202);
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    const status = code === 'PAYMENT_ORDER_NOT_FOUND' ? 404 : code === 'PAYMENT_OPERATION_FORBIDDEN' ? 403 : code.startsWith('PAYMENT_') ? 409 : 503;
    return json({ error: status === 503 ? 'Operação financeira indisponível.' : code }, status);
  }
}
