import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { receiveNuvemshopWebhook } from '@/lib/integrations/nuvemshop-webhook';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (process.env.NUVEMSHOP_WEBHOOK_ENABLED === 'false') {
    return NextResponse.json({ error: 'Ingestão de webhook Nuvemshop desativada.' }, { status: 503 });
  }

  const secret = process.env.NUVEMSHOP_CLIENT_SECRET ?? process.env.NUVEMSHOP_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Configuração de webhook não inicializada.' }, { status: 503 });
  }

  const signature = req.headers.get('x-linkedstore-hmac-sha256') ??
    req.headers.get('x-nuvemshop-hmac-sha256') ??
    req.headers.get('x-hmac-sha256');

  if (!signature) {
    return NextResponse.json({ error: 'Assinatura HMAC ausente.' }, { status: 401 });
  }

  try {
    const rawBody = await req.text();
    if (Buffer.byteLength(rawBody) > 256000) {
      return NextResponse.json({ error: 'Payload excede o limite.' }, { status: 413 });
    }

    const receipt = await receiveNuvemshopWebhook({
      rawBody,
      signature,
      secret,
    });

    return NextResponse.json(receipt, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';

    if (message === 'NUVEMSHOP_WEBHOOK_HMAC_INVALID') {
      return NextResponse.json({ error: 'Assinatura HMAC inválida.' }, { status: 401 });
    }
    if (message === 'NUVEMSHOP_WEBHOOK_INVALID_JSON' || message === 'NUVEMSHOP_WEBHOOK_PAYLOAD_INVALID') {
      return NextResponse.json({ error: 'Payload de webhook inválido.' }, { status: 400 });
    }
    if (message === 'NUVEMSHOP_WEBHOOK_STORE_MISMATCH') {
      return NextResponse.json({ error: 'Loja remota não autorizada.' }, { status: 403 });
    }
    if (message === 'NUVEMSHOP_WEBHOOK_SECRET_NOT_CONFIGURED') {
      return NextResponse.json({ error: 'Configuração de webhook não inicializada.' }, { status: 503 });
    }

    logger.error('Falha na persistência de webhook Nuvemshop.', new Error('NUVEMSHOP_WEBHOOK_PERSIST_FAILED'), {
      action: 'NUVEMSHOP_WEBHOOK_PERSIST_FAILED',
    });
    return NextResponse.json({ error: 'Evento não persistido; repetir entrega.' }, { status: 503 });
  }
}
