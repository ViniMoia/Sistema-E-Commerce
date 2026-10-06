import { NextResponse } from 'next/server';
import { requirePurchaseAdmin } from '@/lib/auth/guards';
import { ok, err } from '@/lib/api-response';
import { updateOrderTrackingBodySchema } from '@/lib/validators/order.validators';
import { updateOrderTracking } from '@/lib/commerce/order-command';
import { invalidateDashboardCache } from '@/services/dashboard.service';

export async function PATCH(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const guard = await requirePurchaseAdmin(request);
  if (guard instanceof NextResponse) return guard;
  let body: unknown;
  try { body = await request.json(); } catch { return err('JSON inválido.', 400, 'VALIDATION_ERROR'); }
  const parsed = updateOrderTrackingBodySchema.safeParse(body);
  if (!parsed.success) return err('Parâmetros inválidos.', 400, 'VALIDATION_ERROR');
  const { orderId } = await params;
  const result = await updateOrderTracking({ ...parsed.data, trackingCode: parsed.data.trackingCode ?? null, orderId, lojaID: guard.user.lojaID,
    performedById: guard.user.id, actor: { type: 'USER', userId: guard.user.id, lojaID: guard.user.lojaID },
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0].trim() });
  if (result.success === false) return err(result.error,
    result.code === 'NOT_FOUND' ? 404 : result.code === 'FORBIDDEN' ? 403 : result.code === 'CONFLICT' ? 409 : 422, result.code);
  try { invalidateDashboardCache(guard.user.lojaID); } catch { /* Durable event committed. */ }
  return ok(result.order);
}
