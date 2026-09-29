import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { z } from 'zod';
import { updateOrderTracking } from '@/services/order.service';
import { logger } from '@/lib/logger';

const updateTrackingSchema = z.object({
  trackingCode: z.string().trim().min(1).max(100).nullable(),
}).strict();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const guard = await requireAdmin(request);
    if (guard instanceof NextResponse) return guard;

    const { orderId } = await params;
    const body = await request.json().catch(() => null);

    const parsed = updateTrackingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.issues },
        { status: 422 }
      );
    }

    const updated = await updateOrderTracking({
      orderId,
      lojaID: guard.user.lojaID,
      actorId: guard.user.id,
      trackingCode: parsed.data.trackingCode,
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown',
    });
    if (!updated) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });

    return NextResponse.json({ success: true, data: updated }, { status: 200 });
  } catch (error: any) {
    logger.error('Falha ao atualizar rastreamento do pedido', error, { action: 'ORDER_TRACKING_UPDATE_ERROR' });
    return NextResponse.json(
      { error: 'Erro interno ao atualizar código de rastreamento.' },
      { status: 500 }
    );
  }
}
