import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { drainPaymentInbox, reconcilePaymentAttempts } from '@/services/payment/payment-worker.service';
import { drainPaymentOutbox } from '@/services/payment/payment-outbox.service';
import { processExpiredOrders } from '@/services/order-timeout.service';
export const runtime = 'nodejs';
export const maxDuration = 300;
async function run(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected || process.env.PAYMENT_WORKER_ENABLED !== 'true') return NextResponse.json({ error: 'Executor financeiro desabilitado.' }, { status: 503 });
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  if (Buffer.byteLength(token) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(token), Buffer.from(expected))) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const limit = Number(new URL(req.url).searchParams.get('limit') ?? 1);
  if (!Number.isInteger(limit) || limit < 1 || limit > 5) return NextResponse.json({ error: 'Limite inválido.' }, { status: 400 });
  try {
    const inbox = await drainPaymentInbox(limit);
    const reconciliation = await reconcilePaymentAttempts(limit);
    const expiration = await processExpiredOrders({ batchSize: limit, dryRun: process.env.PAYMENT_EXPIRATION_ENABLED !== 'true' });
    const outbox = await drainPaymentOutbox(limit);
    return NextResponse.json({ inbox, reconciliation, expiration, outbox }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return NextResponse.json({ error: 'Executor interrompido; trabalhos preservados para retomada.' }, { status: 503 }); }
}
export const GET = run;
export const POST = run;
