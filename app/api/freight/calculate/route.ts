import { NextResponse } from 'next/server';
import { z } from 'zod';
import { freightOrchestrator } from '@/services/freight';
import { freightItemsSchema } from '@/lib/freight/authority';
import { freightOwnerForRequest } from '@/lib/freight/owner';
import { getCurrentUser } from '@/lib/session';
import { getLojaFromHeaders } from '@/lib/tenant';
import { checkRateLimit } from '@/lib/rate-limit';
import { freightClientResponseSchema } from '@/lib/commerce/freight-contract';
const schema = z.object({ lojaID: z.string().optional(), destinationCep: z.string().optional(),
  deliveryType: z.enum(['DELIVERY', 'PICKUP', 'NONE']).default('DELIVERY'), items: freightItemsSchema });
export async function POST(request: Request) {
  const limited = checkRateLimit(request, 'freight_quote', 30, 60000); if (limited) return limited;
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Itens de cotação inválidos.' }, { status: 400 });
  try {
    const tenant = await getLojaFromHeaders();
    if (!tenant) return NextResponse.json({ error: 'Loja não encontrada.' }, { status: 404 });
    if (parsed.data.lojaID && parsed.data.lojaID !== tenant.id) return NextResponse.json({ error: 'Loja incompatível com o domínio.' }, { status: 403 });
    const ownerKey = await freightOwnerForRequest(tenant.id, await getCurrentUser(), true);
    const result = await freightOrchestrator.calculate({ ...parsed.data, lojaID: tenant.id, ownerKey: ownerKey! });
    if (parsed.data.deliveryType === 'DELIVERY') freightClientResponseSchema.parse({ success: true, data: result });
    return NextResponse.json({ success: true, data: result }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'FREIGHT_OWNER_FORBIDDEN') return NextResponse.json({ error: 'Sessão não autorizada para esta loja.' }, { status: 403 });
    const unavailable = ['FREIGHT_OPTIONS_UNAVAILABLE', 'FREIGHT_DESTINATION_UNAVAILABLE', 'FREIGHT_QUOTE_SECRET_MISSING'].includes(code);
    const requote = code === 'FREIGHT_REQUOTE_REQUIRED';
    if (code.startsWith('FREIGHT_') || code === 'CEP_INVALID') return NextResponse.json({ success: false, code,
      error: requote ? 'Dados alterados. Calcule e confirme o frete novamente.' : 'Não foi possível autorizar esta cotação de frete.' }, { status: unavailable ? 503 : requote ? 409 : 400 });
    console.error('[FREIGHT_QUOTE_FAILURE] Falha interna na cotação.');
    return NextResponse.json({ success: false, error: 'Falha ao calcular frete.' }, { status: 500 });
  }
}
