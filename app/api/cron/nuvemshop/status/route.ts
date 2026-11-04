import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getNuvemshopIntegrationHealth } from '@/lib/integrations/nuvemshop-supervision';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';

  if (!expected) {
    return NextResponse.json({ error: 'Supervisão Nuvemshop indisponível.' }, { status: 503 });
  }

  if (Buffer.byteLength(token) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  try {
    const health = await getNuvemshopIntegrationHealth();
    return NextResponse.json(health, {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch {
    return NextResponse.json({ error: 'Falha na coleta de métricas de supervisão Nuvemshop.' }, { status: 503 });
  }
}
