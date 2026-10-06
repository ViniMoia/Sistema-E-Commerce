import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { getOrdersByUser } from '@/services/order.service';
import { handleOrderError } from '@/lib/order-errors';
import { getLojaFromHeaders } from '@/lib/tenant';
import { completeCheckoutHttp } from '@/lib/commerce/checkout-http';
export async function POST(request: Request) {
  const guard = await requireAuth(request);
  if (guard instanceof NextResponse) return guard;
  return completeCheckoutHttp(request);
}

export async function GET(req?: Request) {
  const guard = await requireAuth(req);
  if (guard instanceof NextResponse) return guard;

  try {
    const activeLoja = await getLojaFromHeaders();
    const lojaID = activeLoja?.id;

    if (!lojaID) {
      return NextResponse.json(
        { error: "Contexto de loja não identificado." },
        { status: 400 }
      );
    }
    if (guard.user.lojaID !== lojaID) return NextResponse.json({ error: 'Sessão não autorizada para esta loja.' }, { status: 403 });

    // Isolamento estrito por tenant: cliente só enxerga seus próprios pedidos na loja ativa
    const orders = await getOrdersByUser({
      userID: guard.user.id,
      lojaID,
    });
    return NextResponse.json(orders, { status: 200 });
  } catch (error) {
    return handleOrderError(error);
  }
}
