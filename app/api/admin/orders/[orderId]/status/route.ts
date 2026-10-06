import { NextResponse } from 'next/server';
import { ok, err } from '@/lib/api-response';
import { requirePurchaseAdmin as requireAdmin } from '@/lib/auth/guards';
import { updateOrderStatusBodySchema } from '@/lib/validators/order.validators';
import { updateOrderStatus } from '@/services/order.service';

export async function PATCH(
  req: Request,
  props: { params: Promise<{ orderId: string }> }
) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const params = await props.params;
  let body: unknown;
  try { body = await req.json(); } catch { return err('JSON inválido.', 400, 'VALIDATION_ERROR'); }
  const parsed = updateOrderStatusBodySchema.safeParse(body);
  if (!parsed.success) return err('Parâmetros inválidos.', 400, 'VALIDATION_ERROR');

  const result = await updateOrderStatus({
    orderId: params.orderId,
    newStatus: parsed.data.newStatus,
    performedById: auth.user.id,
    lojaID: auth.user.lojaID,
    actor: { type: 'USER', userId: auth.user.id, lojaID: auth.user.lojaID },
    commandId: parsed.data.commandId,
    expectedVersion: parsed.data.expectedVersion,
    trackingCode: parsed.data.trackingCode,
    shippingProvider: parsed.data.shippingProvider,
    ipAddress:
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown',
  });

  if (result.success === false) {
    return err(
      result.error,
      result.code === 'NOT_FOUND' ? 404 : result.code === 'FORBIDDEN' ? 403 : result.code === 'CONFLICT' ? 409 : 422,
      result.code
    );
  }

  return ok(result.order);
}
