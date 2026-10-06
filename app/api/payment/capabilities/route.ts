import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getLojaFromHeaders } from '@/lib/tenant';
import { paymentCapabilities } from '@/services/payment/capabilities.service';
import { asaasPaymentAdapter } from '@/services/asaas/asaas.adapter';
export async function GET() {
  const tenant = await getLojaFromHeaders();
  if (!tenant) return NextResponse.json({ error: 'Loja não encontrada.' }, { status: 404 });
  try {
    const store = await prisma.loja.findUniqueOrThrow({ where: { id: tenant.id } });
    return NextResponse.json(await paymentCapabilities(store, asaasPaymentAdapter), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return NextResponse.json({ error: 'Pagamento temporariamente indisponível.' }, { status: 503 }); }
}
