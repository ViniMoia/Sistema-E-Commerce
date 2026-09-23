import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { updateOrderStatus } from '@/services/order.service';
import type { AsaasWebhookPayload } from '@/types/asaas.types';
import type { Prisma } from '@prisma/client';
import crypto from 'crypto';
import { logger } from '@/lib/logger';
import { emailService } from '@/lib/email';

/**
 * Disparo assíncrono e não-bloqueante de e-mail de confirmação de pagamento.
 * Falhas neste envio são registradas em log de erro, mas NUNCA quebram a liquidação
 * nem atrasam a resposta HTTP 200 ao gateway Asaas.
 */
async function sendOrderPaymentConfirmationAsync(orderId: string, paymentDate: Date): Promise<void> {
  try {
    const fullOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { name: true, email: true } },
        loja: { select: { name: true } },
        items: {
          select: {
            name: true,
            quantity: true,
            price: true,
            color: true,
            size: true,
          },
        },
        address: true,
      },
    });

    if (!fullOrder || !fullOrder.user?.email) {
      logger.warn('Dados insuficientes para envio de e-mail de confirmação de pagamento', {
        action: 'PAYMENT_EMAIL_SKIPPED',
        orderId,
      });
      return;
    }

    let addressFormatted: string | null = null;
    if (fullOrder.address) {
      const a = fullOrder.address;
      const comp = a.complement ? `, ${a.complement}` : '';
      addressFormatted = `${a.street}, ${a.number}${comp} - ${a.district}, ${a.city}/${a.state} - CEP: ${a.cep}`;
    }

    const platformDomain = process.env.PLATFORM_DOMAIN || 'continentalestetica.com.br';
    const orderUrl = `https://${platformDomain}/profile/orders/${fullOrder.id}`;

    await emailService.sendOrderPaymentConfirmedEmail({
      to: fullOrder.user.email,
      customerName: fullOrder.user.name || 'Cliente',
      orderNumber: fullOrder.orderNumber,
      totalValue: Number(fullOrder.total),
      paymentDate,
      items: fullOrder.items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        price: Number(i.price),
        color: i.color,
        size: i.size,
      })),
      deliveryType: fullOrder.deliveryType,
      shippingServiceName: fullOrder.shippingServiceName,
      shippingEstimatedDays: fullOrder.shippingEstimatedDays,
      addressFormatted,
      pointsEarned: fullOrder.pointsEarned,
      storeName: fullOrder.loja?.name || 'Continental Produtos Estéticos',
      orderUrl,
    });

    logger.info('E-mail de confirmação de pagamento despachado com sucesso', {
      action: 'PAYMENT_CONFIRMATION_EMAIL_SENT',
      orderId,
      to: fullOrder.user.email,
    });
  } catch (emailErr) {
    logger.error('Falha não-bloqueante no envio de e-mail de confirmação de pagamento', emailErr, {
      action: 'PAYMENT_CONFIRMATION_EMAIL_FAILED',
      orderId,
    });
  }
}

export async function POST(req: Request) {
  try {
    // 1. Validação de Segurança do Token do Webhook Asaas (Fail-Closed - P0-002 / ACT-002)
    const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN;
    if (!webhookToken) {
      logger.error('Configuração de webhook não inicializada: ASAAS_WEBHOOK_TOKEN ausente', undefined, {
        action: 'WEBHOOK_SECURITY_ALERT',
      });
      return NextResponse.json(
        { error: 'Configuração de webhook não inicializada no servidor.' },
        { status: 500 }
      );
    }

    const receivedToken =
      req.headers.get('asaas-access-token') || req.headers.get('access_token');
    if (!receivedToken) {
      return NextResponse.json(
        { error: 'Token de webhook inválido ou não autorizado.' },
        { status: 401 }
      );
    }

    const bufReceived = Buffer.from(receivedToken);
    const bufExpected = Buffer.from(webhookToken);

    if (
      bufReceived.length !== bufExpected.length ||
      !crypto.timingSafeEqual(bufReceived, bufExpected)
    ) {
      return NextResponse.json(
        { error: 'Token de webhook inválido ou não autorizado.' },
        { status: 401 }
      );
    }

    const body = (await req.json()) as AsaasWebhookPayload;

    if (!body || !body.event || !body.payment) {
      return NextResponse.json(
        { error: 'Payload de webhook incompleto.' },
        { status: 400 }
      );
    }

    const eventId =
      body.id || `${body.event}_${body.payment.id}_${body.dateCreated || Date.now()}`;

    // 2. Verificação de Idempotência: Se já foi registrado, retorna 200 imediatamente
    const existingEvent = await prisma.paymentWebhookEvent.findUnique({
      where: { eventId },
    });

    if (existingEvent) {
      return NextResponse.json({
        received: true,
        status: 'ALREADY_PROCESSED',
        eventId,
      });
    }

    // 3. Registrar evento de webhook para trilha de auditoria e garantia de idempotência (AUD2-005)
    try {
      await prisma.paymentWebhookEvent.create({
        data: {
          provider: 'ASAAS',
          eventId,
          eventType: body.event,
          payload: body as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (err: any) {
      // Se duas requisições concorrentes ultrapassaram o findUnique, captura a colisão de chave única (P2002)
      if (err?.code === 'P2002' || err?.message?.includes('Unique constraint')) {
        return NextResponse.json({
          received: true,
          status: 'ALREADY_PROCESSED',
          eventId,
        });
      }
      throw err;
    }

    // 4. Localizar o pedido correspondente (por externalReference ou asaasPaymentId)
    const order = await prisma.order.findFirst({
      where: {
        OR: [
          ...(body.payment.externalReference
            ? [{ id: body.payment.externalReference }]
            : []),
          ...(body.payment.id ? [{ asaasPaymentId: body.payment.id }] : []),
        ],
      },
      select: {
        id: true,
        status: true,
        lojaID: true,
        total: true,
      },
    });

    if (!order) {
      return NextResponse.json({
        received: true,
        warning: 'Order not found for payment',
        eventId,
      });
    }

    // Atualiza metadados do Asaas no pedido
    await prisma.order.update({
      where: { id: order.id },
      data: {
        asaasPaymentId: body.payment.id,
        asaasPaymentStatus: body.payment.status,
        ...(body.payment.invoiceUrl
          ? { asaasInvoiceUrl: body.payment.invoiceUrl }
          : {}),
      },
    });

    // 5. Automação de Transição de Estados
    if (
      body.event === 'PAYMENT_RECEIVED' ||
      body.event === 'PAYMENT_CONFIRMED'
    ) {
      if (order.status === 'PENDING') {
        const paymentDateRaw =
          body.payment.paymentDate ||
          body.payment.clientPaymentDate ||
          body.payment.confirmedDate ||
          undefined;

        const paymentDate = paymentDateRaw ? new Date(paymentDateRaw) : new Date();

        const updateResult = await updateOrderStatus({
          orderId: order.id,
          newStatus: 'PAID',
          performedById: 'ASAAS_GATEWAY',
          lojaID: order.lojaID,
          paidAt: paymentDate,
          ipAddress:
            req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
            'asaas-webhook',
        });

        if (updateResult.success === false) {
          return NextResponse.json(
            { received: true, error: updateResult.error },
            { status: 422 }
          );
        }

        // Disparo assíncrono não-bloqueante (fire-and-forget seguro)
        sendOrderPaymentConfirmationAsync(order.id, paymentDate).catch((err) => {
          logger.error('Erro na promessa de envio de e-mail de confirmação de pagamento', err, {
            action: 'PAYMENT_CONFIRMATION_EMAIL_UNHANDLED_ERROR',
            orderId: order.id,
          });
        });
      } else if (order.status === 'CANCELLED') {
        // Alerta de Discrepância Financeira / Pagamento Tardio (AUD2-005):
        // Pagamento capturado no Asaas para pedido que já havia sido cancelado por timeout.
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'asaas-webhook';
        const auditPromise = prisma.auditLog?.create
          ? prisma.auditLog.create({
              data: {
                actorId: 'ASAAS_GATEWAY',
                targetId: order.id,
                action: 'PAYMENT_RECEIVED_ON_CANCELLED_ORDER',
                entity: 'Order',
                entityId: order.id,
                previousValue: { status: 'CANCELLED' },
                newValue: { status: 'CANCELLED', asaasPaymentStatus: body.payment.status },
                ipAddress: ip,
                metadata: {
                  paymentId: body.payment.id,
                  value: body.payment.value,
                  warning: 'Late payment captured for cancelled order',
                },
              },
            })
          : Promise.resolve();

        await Promise.all([
          prisma.order.update({
            where: { id: order.id },
            data: {
              adminNotes: `[ALERTA DE PAGAMENTO TARDIO] Pagamento de R$ ${body.payment.value || order.total} confirmado no gateway Asaas (${body.payment.id}) após o pedido constar como CANCELADO. Necessário estorno manual ou verificação de estoque.`,
            },
          }),
          auditPromise,
        ]);
      }
    } else if (body.event === 'PAYMENT_REFUNDED') {
      if (order.status === 'PAID') {
        await updateOrderStatus({
          orderId: order.id,
          newStatus: 'CANCELLED',
          performedById: 'ASAAS_GATEWAY',
          lojaID: order.lojaID,
          ipAddress:
            req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
            'asaas-webhook',
        });
      }
    } else if (
      body.event === 'PAYMENT_OVERDUE' ||
      body.event === 'PAYMENT_DELETED'
    ) {
      // Quando a cobrança PIX/Boleto expira ou é cancelada no Asaas, cancela o pedido pendente
      // liberando o estoque físico e estornando pontos de fidelidade resgatados (AUD-005)
      if (order.status === 'PENDING') {
        await updateOrderStatus({
          orderId: order.id,
          newStatus: 'CANCELLED',
          performedById: 'ASAAS_GATEWAY_EXPIRATION',
          lojaID: order.lojaID,
          reason: `Cobrança expirada ou cancelada no gateway Asaas (${body.event})`,
          ipAddress:
            req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
            'asaas-webhook',
        });
      }
    } else if (body.event === 'PAYMENT_AWAITING_RISK_ANALYSIS') {
      logger.info('Pagamento de cartão em análise de risco no Asaas', {
        action: 'ASAAS_PAYMENT_AWAITING_RISK_ANALYSIS',
        orderId: order.id,
        asaasPaymentId: body.payment.id,
      });
      await prisma.order.update({
        where: { id: order.id },
        data: {
          adminNotes: `[ANÁLISE DE SEGURANÇA] Cobrança de Cartão ${body.payment.id} em análise antifraude pelo Asaas. Aguardar confirmação antes do despacho.`,
        },
      });
    }

    logger.info('Evento do Asaas processado com sucesso', {
      action: 'ASAAS_WEBHOOK_PROCESSED',
      correlationId: eventId,
      eventType: body.event,
      orderId: order.id,
      tenantId: order.lojaID,
      asaasPaymentId: body.payment.id,
    });

    return NextResponse.json({
      received: true,
      status: 'PROCESSED',
      orderId: order.id,
      event: body.event,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Erro interno ao processar webhook Asaas', error, {
      action: 'ASAAS_WEBHOOK_INTERNAL_ERROR',
    });
    return NextResponse.json(
      { error: 'Erro interno ao processar webhook Asaas', details: errorMsg },
      { status: 500 }
    );
  }
}
