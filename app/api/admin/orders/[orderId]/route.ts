import { NextResponse } from 'next/server';
import { ok, err } from '@/lib/api-response';
import { requireAdmin } from '@/lib/auth-admin';
import { getOrderDetailForAdmin } from '@/services/order.service';

export async function GET(
  req: Request,
  props: { params: Promise<{ orderId: string }> }
) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const params = await props.params;
  const order = await getOrderDetailForAdmin({ orderId: params.orderId, lojaID: auth.user.lojaID });
  if (!order) return err('Pedido não encontrado.', 404, 'NOT_FOUND');

  const serialized = {
    ...order,
    items: order.items.map(i => ({ ...i, price: i.price.toNumber() }))
  };
  return ok(serialized);
}
