import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { ZodError } from 'zod';
import { receivePaymentEvent } from '@/services/payment/payment-inbox.service';
import { logger } from '@/lib/logger';

export async function POST(req: Request) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!expected) return NextResponse.json({ error: 'Configuração de webhook não inicializada.' }, { status: 503 });
  const token = req.headers.get('asaas-access-token') ?? req.headers.get('access_token') ?? '';
  if (!token || Buffer.byteLength(token) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
    return NextResponse.json({ error: 'Token de webhook inválido.' }, { status: 401 });
  }
  // Only acknowledge asynchronously with the deployed consumer, off by default.
  if (process.env.PAYMENT_WORKER_ENABLED !== 'true') return NextResponse.json({ error: 'Consumidor financeiro indisponível.' }, { status: 503 });
  try {
    const body = await req.text();
    if (Buffer.byteLength(body) > 256000) return NextResponse.json({ error: 'Payload excede o limite.' }, { status: 413 });
    const accepted = await receivePaymentEvent(JSON.parse(body));
    return NextResponse.json({ received: true, ...accepted });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) return NextResponse.json({ error: 'Payload de webhook inválido.' }, { status: 400 });
    if (error instanceof Error && error.message === 'WEBHOOK_EVENT_ID_CONTENT_CONFLICT') return NextResponse.json({ error: 'Identidade do evento conflitante.' }, { status: 409 });
    logger.error('Recebimento financeiro não persistido.', new Error('PAYMENT_INBOX_PERSIST_FAILED'), { action: 'PAYMENT_INBOX_PERSIST_FAILED' });
    return NextResponse.json({ error: 'Evento não persistido; repetir entrega.' }, { status: 503 });
  }
}
