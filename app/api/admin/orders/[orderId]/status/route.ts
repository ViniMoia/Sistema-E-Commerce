import { NextResponse } from 'next/server';
import { ok, err } from '@/lib/api-response';
import { requireAdmin } from '@/lib/auth-admin';
import { updateOrderStatusBodySchema } from '@/lib/validators/order.validators';
import { updateOrderStatus } from '@/services/order.service';

export async function PATCH(
  req: Request,
  props: { params: Promise<{ orderId: string }> }
) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const params = await props.params;
  const parsed = updateOrderStatusBodySchema.safeParse(await req.json());
  if (!parsed.success) return err('Parâmetros inválidos.', 400, 'VALIDATION_ERROR');

  const result = await updateOrderStatus({
    orderId: params.orderId,
    newStatus: parsed.data.newStatus,
    performedById: auth.user.id,
    lojaID: auth.user.lojaID,
    ipAddress:
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown',
  });

  if (result.success === false) {
    return err(
      result.error,
      result.code === 'NOT_FOUND' ? 404 : 422,
      result.code
    );
  }

  return ok(result.order);
}
