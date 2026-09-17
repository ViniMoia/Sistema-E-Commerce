import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '@/app/api/webhooks/asaas/route';
import prisma from '@/lib/prisma';
import * as orderService from '@/services/order.service';

vi.mock('@/lib/prisma', () => ({
  default: {
    paymentWebhookEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    order: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/services/order.service', () => ({
  updateOrderStatus: vi.fn(),
}));

describe('Asaas Webhook Handler (POST /api/webhooks/asaas)', () => {
  const originalEnv = process.env;
  const TEST_TOKEN = 'secret-token-123';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, ASAAS_WEBHOOK_TOKEN: TEST_TOKEN };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('deve retornar status 500 se ASAAS_WEBHOOK_TOKEN não estiver configurado no servidor (Fail-Closed)', async () => {
    delete process.env.ASAAS_WEBHOOK_TOKEN;

    const req = new Request('http://localhost/api/webhooks/asaas', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'asaas-access-token': TEST_TOKEN,
      },
      body: JSON.stringify({ event: 'PAYMENT_RECEIVED', payment: { id: 'pay_123' } }),
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toContain('Configuração de webhook não inicializada');
  });

  it('deve rejeitar requisição com status 401 se token do webhook for inválido ou ausente', async () => {
    const req = new Request('http://localhost/api/webhooks/asaas', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'asaas-access-token': 'wrong-token',
      },
      body: JSON.stringify({ event: 'PAYMENT_RECEIVED', payment: { id: 'pay_123' } }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toContain('Token de webhook inválido');
  });

  it('deve rejeitar requisição com status 400 se payload estiver incompleto', async () => {
    const req = new Request('http://localhost/api/webhooks/asaas', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'asaas-access-token': TEST_TOKEN,
      },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('deve retornar 200 com status ALREADY_PROCESSED se o evento já foi processado (Idempotência)', async () => {
    vi.mocked(prisma.paymentWebhookEvent.findUnique).mockResolvedValueOnce({
      id: 'event_rec_1',
      eventId: 'PAYMENT_RECEIVED_pay_123_100',
      status: 'PROCESSED',
    } as any);

    const req = new Request('http://localhost/api/webhooks/asaas', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'asaas-access-token': TEST_TOKEN,
      },
      body: JSON.stringify({
        id: 'PAYMENT_RECEIVED_pay_123_100',
        event: 'PAYMENT_RECEIVED',
        payment: { id: 'pay_123', status: 'RECEIVED', value: 150.0 },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('ALREADY_PROCESSED');
    expect(orderService.updateOrderStatus).not.toHaveBeenCalled();
  });

  it('deve atualizar pedido para PAID quando receber PAYMENT_RECEIVED em pedido PENDING', async () => {
    vi.mocked(prisma.paymentWebhookEvent.findUnique).mockResolvedValueOnce(null);
    vi.mocked(prisma.paymentWebhookEvent.create).mockResolvedValueOnce({} as any);
    vi.mocked(prisma.order.findFirst).mockResolvedValueOnce({
      id: 'order_abc_123',
      status: 'PENDING',
      lojaID: 'loja_default',
      total: 150,
    } as any);
    vi.mocked(prisma.order.update).mockResolvedValueOnce({} as any);
    vi.mocked(orderService.updateOrderStatus).mockResolvedValueOnce({
      success: true,
      order: { id: 'order_abc_123', status: 'PAID' },
    } as any);

    const req = new Request('http://localhost/api/webhooks/asaas', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'asaas-access-token': TEST_TOKEN,
      },
      body: JSON.stringify({
        id: 'evt_new_1',
        event: 'PAYMENT_RECEIVED',
        payment: {
          id: 'pay_asaas_999',
          externalReference: 'order_abc_123',
          status: 'RECEIVED',
          value: 150.0,
          invoiceUrl: 'https://asaas.com/i/invoice123',
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('PROCESSED');
    expect(json.orderId).toBe('order_abc_123');

    // Verifica que chamou updateOrderStatus com performer ASAAS_GATEWAY
    expect(orderService.updateOrderStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order_abc_123',
        newStatus: 'PAID',
        performedById: 'ASAAS_GATEWAY',
      })
    );

    // Verifica que atualizou asaasPaymentId e status no pedido
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order_abc_123' },
      data: expect.objectContaining({
        asaasPaymentId: 'pay_asaas_999',
        asaasPaymentStatus: 'RECEIVED',
        asaasInvoiceUrl: 'https://asaas.com/i/invoice123',
      }),
    });
  });

  it('deve atualizar pedido para CANCELLED quando receber PAYMENT_REFUNDED em pedido PAID', async () => {
    vi.mocked(prisma.paymentWebhookEvent.findUnique).mockResolvedValueOnce(null);
    vi.mocked(prisma.paymentWebhookEvent.create).mockResolvedValueOnce({} as any);
    vi.mocked(prisma.order.findFirst).mockResolvedValueOnce({
      id: 'order_paid_456',
      status: 'PAID',
      lojaID: 'loja_default',
      total: 200,
    } as any);
    vi.mocked(prisma.order.update).mockResolvedValueOnce({} as any);
    vi.mocked(orderService.updateOrderStatus).mockResolvedValueOnce({
      success: true,
      order: { id: 'order_paid_456', status: 'CANCELLED' },
    } as any);

    const req = new Request('http://localhost/api/webhooks/asaas', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'asaas-access-token': TEST_TOKEN,
      },
      body: JSON.stringify({
        id: 'evt_refund_1',
        event: 'PAYMENT_REFUNDED',
        payment: {
          id: 'pay_asaas_456',
          externalReference: 'order_paid_456',
          status: 'REFUNDED',
          value: 200.0,
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(orderService.updateOrderStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order_paid_456',
        newStatus: 'CANCELLED',
        performedById: 'ASAAS_GATEWAY',
      })
    );
  });

  it('deve atualizar pedido PENDING para CANCELLED ao receber PAYMENT_OVERDUE (AUD-005)', async () => {
    vi.mocked(prisma.paymentWebhookEvent.findUnique).mockResolvedValueOnce(null);
    vi.mocked(prisma.paymentWebhookEvent.create).mockResolvedValueOnce({} as any);
    vi.mocked(prisma.order.findFirst).mockResolvedValueOnce({
      id: 'order_pending_overdue',
      status: 'PENDING',
      lojaID: 'loja_default',
      total: 150,
    } as any);
    vi.mocked(prisma.order.update).mockResolvedValueOnce({} as any);
    vi.mocked(orderService.updateOrderStatus).mockResolvedValueOnce({
      success: true,
      order: { id: 'order_pending_overdue', status: 'CANCELLED' },
    } as any);

    const req = new Request('http://localhost/api/webhooks/asaas', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'asaas-access-token': TEST_TOKEN,
      },
      body: JSON.stringify({
        id: 'evt_overdue_1',
        event: 'PAYMENT_OVERDUE',
        payment: {
          id: 'pay_asaas_overdue',
          externalReference: 'order_pending_overdue',
          status: 'OVERDUE',
          value: 150.0,
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(orderService.updateOrderStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order_pending_overdue',
        newStatus: 'CANCELLED',
        performedById: 'ASAAS_GATEWAY_EXPIRATION',
      })
    );
  });
});
