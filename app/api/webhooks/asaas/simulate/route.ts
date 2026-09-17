import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { updateOrderStatus } from '@/services/order.service';

/**
 * Endpoint de Simulação Local para Homologação do Webhook Asaas.
 * Permite simular o recebimento de pagamento no ambiente de testes sem necessidade de transação bancária real.
 */
export async function POST(req: Request) {
  // Bloqueio mandatório de segurança em ambiente de produção (P0-001 / ACT-001)
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Endpoint de simulação indisponível em ambiente de produção.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { orderId, event = 'PAYMENT_RECEIVED' } = body;

    if (!orderId) {
      return NextResponse.json(
        { error: 'orderId é obrigatório para simulação.' },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, lojaID: true, total: true },
    });

    if (!order) {
      return NextResponse.json(
        { error: `Pedido ${orderId} não encontrado.` },
        { status: 404 }
      );
    }

    const simEventId = `sim_${event}_${order.id}_${Date.now()}`;
    const simPaymentId = `pay_sim_${Date.now()}`;

    // 1. Registrar evento na tabela PaymentWebhookEvent (Auditoria e Idempotência)
    await prisma.paymentWebhookEvent.create({
      data: {
        provider: 'ASAAS_SIMULATOR',
        eventId: simEventId,
        eventType: event,
        payload: {
          simulated: true,
          event,
          payment: {
            id: simPaymentId,
            externalReference: order.id,
            status: 'RECEIVED',
            value: Number(order.total),
          },
        },
      },
    });

    // 2. Atualizar metadados no pedido
    await prisma.order.update({
      where: { id: order.id },
      data: {
        asaasPaymentId: simPaymentId,
        asaasPaymentStatus: 'RECEIVED',
      },
    });

    // 3. Disparar automação de status
    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
      const result = await updateOrderStatus({
        orderId: order.id,
        newStatus: 'PAID',
        performedById: 'ASAAS_GATEWAY',
        lojaID: order.lojaID,
      });

      if (result.success === false) {
        return NextResponse.json(
          { error: result.error },
          { status: 422 }
        );
      }
    } else if (event === 'PAYMENT_REFUNDED') {
      await updateOrderStatus({
        orderId: order.id,
        newStatus: 'CANCELLED',
        performedById: 'ASAAS_GATEWAY',
        lojaID: order.lojaID,
      });
    }

    return NextResponse.json({
      success: true,
      simulated: true,
      eventId: simEventId,
      orderId: order.id,
      newStatus: event === 'PAYMENT_REFUNDED' ? 'CANCELLED' : 'PAID',
      message: 'Pagamento Asaas simulado com sucesso. Status atualizado e estoque/pontos processados.',
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ASAAS_SIMULATOR_ERROR]', error);
    return NextResponse.json(
      { error: 'Erro ao simular webhook do Asaas', details: errorMsg },
      { status: 500 }
    );
  }
}
