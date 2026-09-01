import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const updateNotesSchema = z.object({
  adminNotes: z.string().nullable().optional(),
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

    const parsed = updateNotesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order || order.lojaID !== guard.user.lojaID) {
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        adminNotes: parsed.data.adminNotes || null,
      },
    });

    return NextResponse.json({ success: true, data: updated }, { status: 200 });
  } catch (error: any) {
    console.error('[ORDER_NOTES_UPDATE_ERROR]', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar notas internas' },
      { status: 500 }
    );
  }
}
