import prisma from '@/lib/prisma';
import { updateOrderStatus } from '@/services/order.service';
import { logger } from '@/lib/logger';

export const DEFAULT_ASAAS_TIMEOUT_MINUTES = 60;
export const DEFAULT_MANUAL_TIMEOUT_HOURS = 24;
export const DEFAULT_BATCH_SIZE = 50;

export interface ProcessExpiredOrdersOptions {
  lojaID?: string;
  batchSize?: number;
  asaasTimeoutMinutes?: number;
  manualTimeoutHours?: number;
  now?: Date;
}

export interface OrderTimeoutSummary {
  success: boolean;
  processedCount: number;
  cancelledCount: number;
  errorCount: number;
  cancelledOrderIds: string[];
  errors: Array<{ orderId: string; orderNumber?: number; error: string }>;
  executionTimeMs: number;
}

/**
 * Localiza e cancela automaticamente pedidos com status PENDING que ultrapassaram o tempo limite de pagamento.
 * - Pedidos com cobrança Asaas PIX: expiram após 60 minutos (ou asaasTimeoutMinutes).
 * - Pedidos com pagamento WhatsApp PIX manual: expiram após 24 horas (ou manualTimeoutHours).
 *
 * Cada cancelamento aciona atômica e autoritativamente a FSM (updateOrderStatus),
 * que estorna o estoque reservado (InventoryService) e devolve pontos de fidelidade (refundOrderPoints).
 */
export async function processExpiredOrders(
  options?: ProcessExpiredOrdersOptions
): Promise<OrderTimeoutSummary> {
  const startTime = Date.now();
  const referenceDate = options?.now ?? new Date();

  const asaasTimeoutMinutes = options?.asaasTimeoutMinutes ?? DEFAULT_ASAAS_TIMEOUT_MINUTES;
  const manualTimeoutHours = options?.manualTimeoutHours ?? DEFAULT_MANUAL_TIMEOUT_HOURS;
  const batchSize = Math.min(options?.batchSize ?? DEFAULT_BATCH_SIZE, 100);

  const asaasCutoff = new Date(referenceDate.getTime() - asaasTimeoutMinutes * 60 * 1000);
  const manualCutoff = new Date(referenceDate.getTime() - manualTimeoutHours * 60 * 60 * 1000);

  const cancelledOrderIds: string[] = [];
  const errors: Array<{ orderId: string; orderNumber?: number; error: string }> = [];

  try {
    // Busca otimizada utilizando índices [lojaID, status, createdAt]
    const candidateOrders = await prisma.order.findMany({
      where: {
        status: 'PENDING',
        ...(options?.lojaID ? { lojaID: options.lojaID } : {}),
        OR: [
          {
            asaasPaymentId: { not: null },
            createdAt: { lte: asaasCutoff },
          },
          {
            asaasPaymentId: null,
            createdAt: { lte: manualCutoff },
          },
        ],
      },
      take: batchSize,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        orderNumber: true,
        lojaID: true,
        status: true,
        asaasPaymentId: true,
        createdAt: true,
      },
    });

    for (const order of candidateOrders) {
      const isAsaas = order.asaasPaymentId !== null;
      const timeoutLabel = isAsaas
        ? `${asaasTimeoutMinutes}m (Asaas PIX)`
        : `${manualTimeoutHours}h (WhatsApp PIX Manual)`;
      const reason = `Cancelamento automático por timeout de pagamento PIX (${timeoutLabel})`;

      try {
        const result = await updateOrderStatus({
          orderId: order.id,
          newStatus: 'CANCELLED',
          performedById: 'SYSTEM_CRON_TIMEOUT',
          lojaID: order.lojaID,
          reason,
        });

        if (result.success) {
          cancelledOrderIds.push(order.id);
          logger.info('Pedido cancelado por timeout de pagamento com sucesso', {
            action: 'ORDER_TIMEOUT_CANCELLED',
            orderId: order.id,
            orderNumber: order.orderNumber,
            tenantId: order.lojaID,
            isAsaas,
            timeoutLabel,
          });
        } else {
          const errorMessage = 'error' in result ? result.error : 'Falha na transição de status';
          errors.push({
            orderId: order.id,
            orderNumber: order.orderNumber,
            error: errorMessage,
          });
          logger.warn('Falha na transição ao cancelar pedido por timeout', {
            action: 'ORDER_TIMEOUT_TRANSITION_FAILED',
            orderId: order.id,
            orderNumber: order.orderNumber,
            error: errorMessage,
          });
        }
      } catch (err: any) {
        errors.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          error: err?.message || 'Erro inesperado ao processar cancelamento por timeout',
        });
        logger.error('Exceção crítica ao cancelar pedido por timeout', err, {
          action: 'ORDER_TIMEOUT_EXCEPTION',
          orderId: order.id,
          orderNumber: order.orderNumber,
          tenantId: order.lojaID,
        });
      }
    }

    const executionTimeMs = Date.now() - startTime;

    return {
      success: errors.length === 0,
      processedCount: candidateOrders.length,
      cancelledCount: cancelledOrderIds.length,
      errorCount: errors.length,
      cancelledOrderIds,
      errors,
      executionTimeMs,
    };
  } catch (findErr: any) {
    logger.error('Erro ao buscar pedidos elegíveis para timeout', findErr, {
      action: 'ORDER_TIMEOUT_QUERY_FAILED',
      tenantId: options?.lojaID,
    });

    return {
      success: false,
      processedCount: 0,
      cancelledCount: 0,
      errorCount: 1,
      cancelledOrderIds: [],
      errors: [{ orderId: 'QUERY_FAILED', error: findErr?.message || 'Falha na consulta ao banco' }],
      executionTimeMs: Date.now() - startTime,
    };
  }
}
