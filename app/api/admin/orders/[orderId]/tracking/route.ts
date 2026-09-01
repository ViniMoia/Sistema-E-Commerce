import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const updateTrackingSchema = z.object({
  trackingCode: z.string().nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const guard = await requireAdmin(request);
    if (guard instanceof NextResponse) return guard;

    const { orderId } = await params;
    const body = await request.json();

    const parsed = updateTrackingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.issues },
        { status: 400 }
      );
    }

    // Garante que o pedido pertence à loja do admin
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order || order.lojaID !== guard.user.lojaID) {
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        trackingCode: parsed.data.trackingCode?.trim() || null,
        // Se adicionou rastreio e o status era PAID ou PENDING, pode sugerir transição para SHIPPED se desejar
      },
    });

    return NextResponse.json({ success: true, data: updated }, { status: 200 });
  } catch (error: any) {
    console.error('[ORDER_TRACKING_UPDATE_ERROR]', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar código de rastreamento' },
      { status: 500 }
    );
  }
}
