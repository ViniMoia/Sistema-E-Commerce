import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '@/lib/prisma';
import * as orderService from '@/services/order.service';
import {
  processExpiredOrders,
  DEFAULT_ASAAS_TIMEOUT_MINUTES,
  DEFAULT_MANUAL_TIMEOUT_HOURS,
} from '@/services/order-timeout.service';

vi.mock('@/lib/prisma', () => ({
  default: {
    order: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/services/order.service', () => ({
  updateOrderStatus: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Motor de Timeout e Cancelamento Automático de Pedidos (PEND-FIN-003)', () => {
  const baseNow = new Date('2026-09-22T12:00:00Z');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve buscar pedidos PENDING com os cutoffs corretos para Asaas (60m) e Manual (24h)', async () => {
    vi.mocked(prisma.order.findMany).mockResolvedValueOnce([]);

    const summary = await processExpiredOrders({ now: baseNow });

    expect(prisma.order.findMany).toHaveBeenCalledTimes(1);
    const queryArgs = vi.mocked(prisma.order.findMany).mock.calls[0][0];

    expect(queryArgs?.where?.status).toBe('PENDING');

    // 60 min antes de 12:00:00Z -> 11:00:00Z
    const expectedAsaasCutoff = new Date('2026-09-22T11:00:00Z');
    // 24h antes de 12:00:00Z -> 2026-09-21T12:00:00Z
    const expectedManualCutoff = new Date('2026-09-21T12:00:00Z');

    expect(queryArgs?.where?.OR).toEqual([
      {
        asaasPaymentId: { not: null },
        createdAt: { lte: expectedAsaasCutoff },
      },
      {
        asaasPaymentId: null,
        createdAt: { lte: expectedManualCutoff },
      },
    ]);

    expect(summary.processedCount).toBe(0);
    expect(summary.cancelledCount).toBe(0);
    expect(summary.success).toBe(true);
  });

  it('deve cancelar com sucesso pedido Asaas PIX expirado há mais de 60 minutos', async () => {
    const expiredAsaasOrder = {
      id: 'ord-asaas-1',
      orderNumber: 101,
      lojaID: 'loja-continental',
      status: 'PENDING' as const,
      asaasPaymentId: 'pay_asaas_123',
      createdAt: new Date('2026-09-22T10:30:00Z'), // 90 min atrás
    };

    vi.mocked(prisma.order.findMany).mockResolvedValueOnce([expiredAsaasOrder as any]);
    vi.mocked(orderService.updateOrderStatus).mockResolvedValueOnce({
      success: true,
      order: { id: 'ord-asaas-1', status: 'CANCELLED' },
    });

    const summary = await processExpiredOrders({ now: baseNow });

    expect(orderService.updateOrderStatus).toHaveBeenCalledWith({
      orderId: 'ord-asaas-1',
      newStatus: 'CANCELLED',
      performedById: 'SYSTEM_CRON_TIMEOUT',
      lojaID: 'loja-continental',
      reason: 'Cancelamento automático por timeout de pagamento PIX (60m (Asaas PIX))',
    });

    expect(summary.processedCount).toBe(1);
    expect(summary.cancelledCount).toBe(1);
    expect(summary.errorCount).toBe(0);
    expect(summary.cancelledOrderIds).toEqual(['ord-asaas-1']);
    expect(summary.success).toBe(true);
  });

  it('deve cancelar com sucesso pedido WhatsApp PIX Manual expirado há mais de 24 horas', async () => {
    const expiredManualOrder = {
      id: 'ord-manual-1',
      orderNumber: 102,
      lojaID: 'loja-continental',
      status: 'PENDING' as const,
      asaasPaymentId: null,
      createdAt: new Date('2026-09-21T10:00:00Z'), // 26 horas atrás
    };

    vi.mocked(prisma.order.findMany).mockResolvedValueOnce([expiredManualOrder as any]);
    vi.mocked(orderService.updateOrderStatus).mockResolvedValueOnce({
      success: true,
      order: { id: 'ord-manual-1', status: 'CANCELLED' },
    });

    const summary = await processExpiredOrders({ now: baseNow });

    expect(orderService.updateOrderStatus).toHaveBeenCalledWith({
      orderId: 'ord-manual-1',
      newStatus: 'CANCELLED',
      performedById: 'SYSTEM_CRON_TIMEOUT',
      lojaID: 'loja-continental',
      reason: 'Cancelamento automático por timeout de pagamento PIX (24h (WhatsApp PIX Manual))',
    });

    expect(summary.cancelledCount).toBe(1);
    expect(summary.cancelledOrderIds).toEqual(['ord-manual-1']);
  });

  it('deve aplicar isolamento multi-tenant quando fornecido lojaID', async () => {
    vi.mocked(prisma.order.findMany).mockResolvedValueOnce([]);

    await processExpiredOrders({ lojaID: 'loja-especifica-123', now: baseNow });

    const queryArgs = vi.mocked(prisma.order.findMany).mock.calls[0][0];
    expect(queryArgs?.where?.lojaID).toBe('loja-especifica-123');
  });

  it('deve respeitar e limitar o batchSize com limite de segurança de 100', async () => {
    vi.mocked(prisma.order.findMany).mockResolvedValueOnce([]);

    await processExpiredOrders({ batchSize: 25 });
    expect(vi.mocked(prisma.order.findMany).mock.calls[0][0]?.take).toBe(25);

    vi.mocked(prisma.order.findMany).mockClear();
    vi.mocked(prisma.order.findMany).mockResolvedValueOnce([]);

    await processExpiredOrders({ batchSize: 500 }); // Excede teto de 100
    expect(vi.mocked(prisma.order.findMany).mock.calls[0][0]?.take).toBe(100);
  });

  it('deve ser resiliente e continuar processando os demais pedidos se um falhar no lote', async () => {
    const orders = [
      {
        id: 'ord-fail',
        orderNumber: 201,
        lojaID: 'loja-1',
        status: 'PENDING' as const,
        asaasPaymentId: 'pay-fail',
        createdAt: new Date('2026-09-22T10:00:00Z'),
      },
      {
        id: 'ord-ok',
        orderNumber: 202,
        lojaID: 'loja-1',
        status: 'PENDING' as const,
        asaasPaymentId: 'pay-ok',
        createdAt: new Date('2026-09-22T10:00:00Z'),
      },
    ];

    vi.mocked(prisma.order.findMany).mockResolvedValueOnce(orders as any);

    // Primeiro pedido falha na FSM
    vi.mocked(orderService.updateOrderStatus).mockResolvedValueOnce({
      success: false,
      error: 'Transição inválida ou lock concorrente',
      code: 'INVALID_TRANSITION',
    });

    // Segundo pedido sucede
    vi.mocked(orderService.updateOrderStatus).mockResolvedValueOnce({
      success: true,
      order: { id: 'ord-ok', status: 'CANCELLED' },
    });

    const summary = await processExpiredOrders({ now: baseNow });

    expect(summary.processedCount).toBe(2);
    expect(summary.cancelledCount).toBe(1);
    expect(summary.errorCount).toBe(1);
    expect(summary.cancelledOrderIds).toEqual(['ord-ok']);
    expect(summary.errors).toEqual([
      {
        orderId: 'ord-fail',
        orderNumber: 201,
        error: 'Transição inválida ou lock concorrente',
      },
    ]);
    expect(summary.success).toBe(false);
  });

  it('deve capturar exceção inesperada individual sem interromper os demais pedidos', async () => {
    const orders = [
      {
        id: 'ord-crash',
        orderNumber: 301,
        lojaID: 'loja-1',
        status: 'PENDING' as const,
        asaasPaymentId: 'pay-crash',
        createdAt: new Date('2026-09-22T10:00:00Z'),
      },
      {
        id: 'ord-ok-2',
        orderNumber: 302,
        lojaID: 'loja-1',
        status: 'PENDING' as const,
        asaasPaymentId: 'pay-ok-2',
        createdAt: new Date('2026-09-22T10:00:00Z'),
      },
    ];

    vi.mocked(prisma.order.findMany).mockResolvedValueOnce(orders as any);

    // Primeiro pedido lança exceção não tratada
    vi.mocked(orderService.updateOrderStatus).mockRejectedValueOnce(
      new Error('Timeout de transação no banco')
    );

    // Segundo pedido sucede
    vi.mocked(orderService.updateOrderStatus).mockResolvedValueOnce({
      success: true,
      order: { id: 'ord-ok-2', status: 'CANCELLED' },
    });

    const summary = await processExpiredOrders({ now: baseNow });

    expect(summary.processedCount).toBe(2);
    expect(summary.cancelledCount).toBe(1);
    expect(summary.errorCount).toBe(1);
    expect(summary.errors[0]).toEqual({
      orderId: 'ord-crash',
      orderNumber: 301,
      error: 'Timeout de transação no banco',
    });
    expect(summary.cancelledOrderIds).toEqual(['ord-ok-2']);
  });

  it('deve tratar erro na consulta Prisma findMany e retornar sumário sem crashar', async () => {
    vi.mocked(prisma.order.findMany).mockRejectedValueOnce(
      new Error('Conexão recusada com pooler')
    );

    const summary = await processExpiredOrders();

    expect(summary.success).toBe(false);
    expect(summary.cancelledCount).toBe(0);
    expect(summary.errorCount).toBe(1);
    expect(summary.errors[0].orderId).toBe('QUERY_FAILED');
  });
});
