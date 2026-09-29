import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { updateOrderStatus } from '@/services/order.service';
import type { AsaasWebhookPayload } from '@/types/asaas.types';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import crypto from 'crypto';
import { logger, sanitizeLogText } from '@/lib/logger';
import { emailService } from '@/lib/email';
import {
  attachRequestId,
  createRequestLogContext,
  enrichLogContext,
  runWithLogContext,
} from '@/lib/observability/request-context';
import { incrementMetric } from '@/lib/observability/metrics';
import { reconcileRefundsForOrder } from '@/services/refund.service';

const webhookSchema = z.object({
  id: z.string().min(1).max(200),
  event: z.enum([
    'PAYMENT_CREATED',
    'PAYMENT_UPDATED',
    'PAYMENT_CONFIRMED',
    'PAYMENT_RECEIVED',
    'PAYMENT_OVERDUE',
    'PAYMENT_DELETED',
    'PAYMENT_RESTORED',
    'PAYMENT_REFUNDED',
    'PAYMENT_PARTIALLY_REFUNDED',
    'PAYMENT_REFUND_IN_PROGRESS',
    'PAYMENT_REFUND_DENIED',
    'PAYMENT_RECEIVED_IN_CASH_UNDONE',
    'PAYMENT_CHARGEBACK_REQUESTED',
    'PAYMENT_CHARGEBACK_DISPUTE',
    'PAYMENT_AWAITING_CHARGEBACK_REVERSAL',
    'PAYMENT_DUNNING_REQUESTED',
    'PAYMENT_DUNNING_RECEIVED',
    'PAYMENT_AWAITING_RISK_ANALYSIS',
  ]),
  dateCreated: z.string().optional(),
  payment: z.object({
    id: z.string().min(1).max(200),
    externalReference: z.string().min(1).max(200).optional(),
    status: z.string().min(1).max(80).optional(),
    value: z.number().positive().finite(),
    invoiceUrl: z.string().url().max(2048).optional(),
    paymentDate: z.string().optional(),
    clientPaymentDate: z.string().optional(),
    confirmedDate: z.string().optional(),
  }).passthrough(),
}).passthrough();

const REFUND_WEBHOOK_EVENTS = new Set<AsaasWebhookPayload['event']>([
  'PAYMENT_REFUNDED',
  'PAYMENT_PARTIALLY_REFUNDED',
  'PAYMENT_REFUND_IN_PROGRESS',
  'PAYMENT_REFUND_DENIED',
]);

function storedWebhookPayload(body: AsaasWebhookPayload): Prisma.InputJsonObject {
  return {
    id: body.id!,
    event: body.event,
    ...(body.dateCreated ? { dateCreated: body.dateCreated } : {}),
    payment: {
      id: body.payment.id,
      ...(body.payment.externalReference
        ? { externalReference: body.payment.externalReference }
        : {}),
      ...(body.payment.status ? { status: body.payment.status } : {}),
      value: body.payment.value,
      ...((body.payment as any).billingType
        ? { billingType: (body.payment as any).billingType }
        : {}),
      ...(body.payment.paymentDate ? { paymentDate: body.payment.paymentDate } : {}),
      ...(body.payment.clientPaymentDate
        ? { clientPaymentDate: body.payment.clientPaymentDate }
        : {}),
      ...(body.payment.confirmedDate ? { confirmedDate: body.payment.confirmedDate } : {}),
    },
  };
}

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

    const emailResult = await emailService.sendOrderPaymentConfirmedEmail({
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

    if (!emailResult.success) {
      throw new Error('EMAIL_PROVIDER_REJECTED');
    }

    logger.info('E-mail de confirmação de pagamento despachado com sucesso', {
      action: 'PAYMENT_CONFIRMATION_EMAIL_SENT',
      orderId,
      messageId: emailResult.messageId,
    });
  } catch (emailErr) {
    logger.error('Falha não-bloqueante no envio de e-mail de confirmação de pagamento', emailErr, {
      action: 'PAYMENT_CONFIRMATION_EMAIL_FAILED',
      orderId,
    });
  }
}

export async function POST(req: Request) {
  const requestContext = createRequestLogContext(req.headers);
  return runWithLogContext(requestContext, async () => {
    const response = await handleWebhook(req);
    return attachRequestId(response, requestContext.requestId);
  });
}

async function handleWebhook(req: Request) {
  let claimedEventId: string | null = null;

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

    const parsedBody = webhookSchema.safeParse(await req.json());
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Payload de webhook inválido.' },
        { status: 400 }
      );
    }
    const body = parsedBody.data as unknown as AsaasWebhookPayload;

    const eventId = body.id!;
    enrichLogContext({
      eventId,
      correlationId: body.payment.externalReference || body.payment.id,
      orderId: body.payment.externalReference,
      asaasPaymentId: body.payment.id,
    });

    // 2. Inbox durável: somente PROCESSED significa conclusão. Eventos FAILED
    // podem ser retomados e locks abandonados expiram para evitar travamento eterno.
    const existingEvent = await prisma.paymentWebhookEvent.findUnique({
      where: { eventId },
    });

    if (existingEvent?.status === 'PROCESSED') {
      incrementMetric('webhook_events_total', {
        result: 'duplicate',
        event_type: body.event,
      });
      return NextResponse.json({
        received: true,
        status: 'ALREADY_PROCESSED',
        eventId,
      });
    }

    if (!existingEvent) {
      try {
        await prisma.paymentWebhookEvent.create({
          data: {
            provider: 'ASAAS',
            eventId,
            eventType: body.event,
            payload: storedWebhookPayload(body),
          },
        });
      } catch (err: any) {
        if (err?.code === 'P2002' || err?.message?.includes('Unique constraint')) {
          return NextResponse.json(
            { received: true, status: 'PROCESSING', eventId },
            { status: 202 }
          );
        }
        throw err;
      }
    }

    const staleBefore = new Date(Date.now() - 5 * 60 * 1000);
    const claim = await prisma.paymentWebhookEvent.updateMany({
      where: {
        eventId,
        OR: [
          { status: { in: ['RECEIVED', 'FAILED'] } },
          { status: 'PROCESSING', lockedAt: { lt: staleBefore } },
        ],
      },
      data: {
        status: 'PROCESSING',
        lockedAt: new Date(),
        attempts: { increment: 1 },
        lastError: null,
      },
    });

    if (claim.count !== 1) {
      const current = await prisma.paymentWebhookEvent.findUnique({ where: { eventId } });
      if (current?.status === 'PROCESSED') {
        return NextResponse.json({ received: true, status: 'ALREADY_PROCESSED', eventId });
      }
      return NextResponse.json(
        { received: true, status: 'PROCESSING', eventId },
        { status: 202 }
      );
    }

    claimedEventId = eventId;

    // 4. A referência externa, quando presente, é a identidade autoritativa do pedido.
    // Sem ela, apenas uma cobrança previamente vinculada pode ser localizada.
    const order = await prisma.order.findFirst({
      where: body.payment.externalReference
        ? {
            OR: [
              { paymentReference: body.payment.externalReference },
              { id: body.payment.externalReference },
            ],
          }
        : { asaasPaymentId: body.payment.id },
      select: {
        id: true,
        status: true,
        lojaID: true,
        userID: true,
        total: true,
        paymentMethod: true,
        paymentReference: true,
        asaasPaymentId: true,
        paymentWorkflowStatus: true,
      },
    });

    if (!order) {
      throw new Error('ORDER_NOT_FOUND_FOR_PAYMENT');
    }
    enrichLogContext({ orderId: order.id, tenantId: order.lojaID });

    if (
      body.payment.externalReference &&
      body.payment.externalReference !== order.paymentReference &&
      body.payment.externalReference !== order.id
    ) {
      throw new Error('PAYMENT_ORDER_IDENTITY_MISMATCH');
    }
    if (order.asaasPaymentId && order.asaasPaymentId !== body.payment.id) {
      throw new Error('PAYMENT_IDENTITY_MISMATCH');
    }
    if (!new Prisma.Decimal(body.payment.value).equals(order.total)) {
      throw new Error('PAYMENT_VALUE_MISMATCH');
    }

    const expectedBillingType: Record<string, string> = {
      PIX: 'PIX',
      CREDIT_CARD: 'CREDIT_CARD',
      BOLETO: 'BOLETO',
    };
    const billingType = (body.payment as any).billingType as string | undefined;
    if (
      billingType &&
      order.paymentMethod &&
      expectedBillingType[order.paymentMethod] &&
      expectedBillingType[order.paymentMethod] !== billingType
    ) {
      throw new Error('PAYMENT_METHOD_MISMATCH');
    }

    // Atualiza metadados do Asaas no pedido
    await prisma.order.update({
      where: { id: order.id },
      data: {
        asaasPaymentId: body.payment.id,
        asaasPaymentStatus: body.payment.status || body.event.replace('PAYMENT_', ''),
        ...(body.payment.invoiceUrl
          ? { asaasInvoiceUrl: body.payment.invoiceUrl }
          : {}),
      },
    });

    // 5. Automação de Transição de Estados
    let refundRequiresManualReview = false;
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

        if (updateResult.success === false && !(
          (await prisma.order.findUnique({
            where: { id: order.id },
            select: { status: true },
          }))?.status === 'PAID'
        )) {
          throw new Error(`ORDER_TRANSITION_FAILED:${updateResult.code}`);
        }

        await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentWorkflowStatus: 'CONFIRMED',
            paymentLastError: null,
            paymentReconciledAt: new Date(),
          },
        });

        // O envio é aguardado e limitado pelo timeout do provider. A falha de
        // notificação continua não bloqueante para a liquidação financeira,
        // mas não fica pendurada após a resposta do webhook.
        await sendOrderPaymentConfirmationAsync(order.id, paymentDate);
      } else if (order.status === 'CANCELLED') {
        // Alerta de Discrepância Financeira / Pagamento Tardio (AUD2-005):
        // Pagamento capturado no Asaas para pedido que já havia sido cancelado por timeout.
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'asaas-webhook';
        const auditPromise = prisma.auditLog?.create
          ? prisma.auditLog.create({
              data: {
                actorId: order.userID,
                targetId: order.userID,
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
              paymentWorkflowStatus: 'RECONCILIATION_REQUIRED',
              paymentLastError: 'Pagamento confirmado após cancelamento do pedido.',
            },
          }),
          auditPromise,
        ]);
      } else {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentWorkflowStatus: 'CONFIRMED',
            paymentLastError: null,
            paymentReconciledAt: new Date(),
          },
        });
      }
    } else if (REFUND_WEBHOOK_EVENTS.has(body.event)) {
      // O webhook autenticado apenas dispara a consulta autoritativa. Estornos
      // parciais e integrais so concluem quando a lista do Asaas retorna DONE.
      const refundResult = await reconcileRefundsForOrder(order.id);
      if (refundResult.matched === 0 || refundResult.unmatched > 0) {
        refundRequiresManualReview = true;
        await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentWorkflowStatus: 'RECONCILIATION_REQUIRED',
            paymentLastError: 'Estorno externo sem intencao local correspondente.',
          },
        });
      }
    } else if (
      body.event === 'PAYMENT_OVERDUE' ||
      body.event === 'PAYMENT_DELETED'
    ) {
      // Quando a cobrança PIX/Boleto expira ou é cancelada no Asaas, cancela o pedido pendente
      // liberando o estoque físico e estornando pontos de fidelidade resgatados (AUD-005)
      if (order.status === 'PENDING') {
        const updateResult = await updateOrderStatus({
          orderId: order.id,
          newStatus: 'CANCELLED',
          performedById: 'ASAAS_GATEWAY_EXPIRATION',
          lojaID: order.lojaID,
          reason: `Cobrança expirada ou cancelada no gateway Asaas (${body.event})`,
          ipAddress:
            req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
            'asaas-webhook',
        });
        if (updateResult.success === false && !(
          (await prisma.order.findUnique({
            where: { id: order.id },
            select: { status: true },
          }))?.status === 'CANCELLED'
        )) {
          throw new Error(`ORDER_TRANSITION_FAILED:${updateResult.code}`);
        }
        await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentWorkflowStatus: 'DECLINED',
            paymentLastError: `Cobrança encerrada pelo gateway: ${body.event}.`,
            paymentReconciledAt: new Date(),
          },
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
          paymentWorkflowStatus: 'AWAITING_PAYMENT',
        },
      });
    } else if (
      body.event === 'PAYMENT_RECEIVED_IN_CASH_UNDONE' ||
      body.event.startsWith('PAYMENT_CHARGEBACK') ||
      body.event.startsWith('PAYMENT_DUNNING')
    ) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentWorkflowStatus: 'RECONCILIATION_REQUIRED',
          paymentLastError: `Evento financeiro exige revisão: ${body.event}.`,
          adminNotes: `[ALERTA FINANCEIRO] Evento ${body.event} recebido para a cobrança ${body.payment.id}.`,
        },
      });
    }

    const requiresManualReview =
      refundRequiresManualReview ||
      (body.event === 'PAYMENT_CONFIRMED' || body.event === 'PAYMENT_RECEIVED') &&
        order.status === 'CANCELLED' ||
      REFUND_WEBHOOK_EVENTS.has(body.event) &&
        (order.status === 'SHIPPED' || order.status === 'DELIVERED') ||
      body.event === 'PAYMENT_RECEIVED_IN_CASH_UNDONE' ||
      body.event.startsWith('PAYMENT_CHARGEBACK') ||
      body.event.startsWith('PAYMENT_DUNNING');

    // O webhook e o worker convergem no mesmo registro durável. O upsert também
    // cobre pedidos legados cujo evento chegue antes do primeiro ciclo do worker.
    await prisma.paymentReconciliation.upsert({
      where: { orderID: order.id },
      create: {
        orderID: order.id,
        paymentReference: order.paymentReference,
        status: requiresManualReview ? 'MANUAL_REVIEW' : 'RESOLVED',
        gatewayPaymentId: body.payment.id,
        gatewayStatus: body.payment.status || body.event.replace('PAYMENT_', ''),
        resolvedAt: requiresManualReview ? null : new Date(),
        lastErrorCode: requiresManualReview ? 'WEBHOOK_EVENT_REQUIRES_REVIEW' : null,
        lastErrorMessage: requiresManualReview
          ? `Evento financeiro exige revisão: ${body.event}.`
          : null,
      },
      update: {
        status: requiresManualReview ? 'MANUAL_REVIEW' : 'RESOLVED',
        gatewayPaymentId: body.payment.id,
        gatewayStatus: body.payment.status || body.event.replace('PAYMENT_', ''),
        resolvedAt: requiresManualReview ? null : new Date(),
        lockedAt: null,
        leaseOwner: null,
        lastErrorCode: requiresManualReview ? 'WEBHOOK_EVENT_REQUIRES_REVIEW' : null,
        lastErrorMessage: requiresManualReview
          ? `Evento financeiro exige revisão: ${body.event}.`
          : null,
      },
    });

    await prisma.paymentWebhookEvent.updateMany({
      where: { eventId, status: 'PROCESSING' },
      data: {
        status: 'PROCESSED',
        processedAt: new Date(),
        lockedAt: null,
        lastError: null,
      },
    });
    claimedEventId = null;

    logger.info('Evento do Asaas processado com sucesso', {
      action: 'ASAAS_WEBHOOK_PROCESSED',
      correlationId: eventId,
      eventType: body.event,
      orderId: order.id,
      tenantId: order.lojaID,
      asaasPaymentId: body.payment.id,
    });
    incrementMetric('webhook_events_total', {
      result: 'processed',
      event_type: body.event,
    });

    return NextResponse.json({
      received: true,
      status: 'PROCESSED',
      orderId: order.id,
      event: body.event,
    });
  } catch (error) {
    const errorMsg = sanitizeLogText(error instanceof Error ? error.message : 'Unknown error');
    if (claimedEventId) {
      await prisma.paymentWebhookEvent.updateMany({
        where: { eventId: claimedEventId, status: 'PROCESSING' },
        data: {
          status: 'FAILED',
          lockedAt: null,
          lastError: errorMsg.slice(0, 1000),
        },
      }).catch((inboxError) => {
        logger.error('Falha ao registrar erro na inbox de webhook', inboxError, {
          action: 'ASAAS_WEBHOOK_INBOX_UPDATE_FAILED',
          correlationId: claimedEventId,
        });
      });
    }
    logger.error('Erro interno ao processar webhook Asaas', error, {
      action: 'ASAAS_WEBHOOK_INTERNAL_ERROR',
    });
    incrementMetric('webhook_events_total', {
      result: 'failed',
      event_type: 'UNKNOWN',
    });
    return NextResponse.json(
      { error: 'Erro interno ao processar webhook Asaas' },
      { status: 500 }
    );
  }
}
