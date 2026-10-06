import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { paymentBacklog } from '@/services/payment/payment-supervision.service';
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET, token = req.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  if (!expected) return NextResponse.json({ error: 'Supervisão indisponível.' }, { status: 503 });
  if (Buffer.byteLength(token) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(token), Buffer.from(expected))) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  try { return NextResponse.json(await paymentBacklog(), { headers: { 'Cache-Control': 'private, no-store' } }); }
  catch { return NextResponse.json({ error: 'Supervisão indisponível.' }, { status: 503 }); }
}
