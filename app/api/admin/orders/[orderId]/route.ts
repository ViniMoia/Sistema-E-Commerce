import { NextResponse } from 'next/server';
import { ok, err } from '@/lib/api-response';
import { requireAdmin } from '@/lib/auth-admin';
import { getOrderDetailForAdmin } from '@/services/order.service';

export async function GET(
  req: Request,
  { params }: { params: { orderId: string } }
) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const order = await getOrderDetailForAdmin(params.orderId);
  if (!order) return err('Pedido não encontrado.', 404, 'NOT_FOUND');

  const serialized = {
    ...order,
    items: order.items.map(i => ({ ...i, price: i.price.toNumber() }))
  };
  return ok(serialized);
}
