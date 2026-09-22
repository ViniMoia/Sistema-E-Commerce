import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '@/app/api/webhooks/asaas/route';
import prisma from '@/lib/prisma';
import * as orderService from '@/services/order.service';
import { emailService } from '@/lib/email';

vi.mock('@/lib/prisma', () => ({
  default: {
    paymentWebhookEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    order: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/services/order.service', () => ({
  updateOrderStatus: vi.fn(),
}));

vi.mock('@/lib/email', () => ({
  emailService: {
    sendOrderPaymentConfirmedEmail: vi.fn().mockResolvedValue({ success: true, messageId: 'msg-test' }),
  },
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

  it('deve rejeitar requisição com status 401 se cabeçalho asaas-access-token estiver ausente', async () => {
    const req = new Request('http://localhost/api/webhooks/asaas', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ event: 'PAYMENT_RECEIVED', payment: { id: 'pay_123' } }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toContain('Token de webhook inválido');
  });

  it('deve rejeitar requisição com status 401 se token do webhook for inválido (tamanho diferente)', async () => {
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

  it('deve rejeitar requisição com status 401 para token forjado com mesmo tamanho (timingSafeEqual)', async () => {
    // TEST_TOKEN tem 16 caracteres ('secret-token-123')
    const forgedToken = 'secret-token-999';
    const req = new Request('http://localhost/api/webhooks/asaas', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'asaas-access-token': forgedToken,
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

  it('deve atualizar pedido PENDING para CANCELLED ao receber PAYMENT_DELETED (AUD-005)', async () => {
    vi.mocked(prisma.paymentWebhookEvent.findUnique).mockResolvedValueOnce(null);
    vi.mocked(prisma.paymentWebhookEvent.create).mockResolvedValueOnce({} as any);
    vi.mocked(prisma.order.findFirst).mockResolvedValueOnce({
      id: 'order_pending_deleted',
      status: 'PENDING',
      lojaID: 'loja_default',
      total: 150,
    } as any);
    vi.mocked(prisma.order.update).mockResolvedValueOnce({} as any);
    vi.mocked(orderService.updateOrderStatus).mockResolvedValueOnce({
      success: true,
      order: { id: 'order_pending_deleted', status: 'CANCELLED' },
    } as any);

    const req = new Request('http://localhost/api/webhooks/asaas', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'asaas-access-token': TEST_TOKEN,
      },
      body: JSON.stringify({
        id: 'evt_deleted_1',
        event: 'PAYMENT_DELETED',
        payment: {
          id: 'pay_asaas_deleted',
          externalReference: 'order_pending_deleted',
          status: 'DELETED',
          value: 150.0,
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(orderService.updateOrderStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order_pending_deleted',
        newStatus: 'CANCELLED',
        performedById: 'ASAAS_GATEWAY_EXPIRATION',
      })
    );
  });

  it('deve lidar com concorrência estrita (P2002) retornando 200 ALREADY_PROCESSED', async () => {
    vi.mocked(prisma.paymentWebhookEvent.findUnique).mockResolvedValueOnce(null);
    const p2002Error: any = new Error('Unique constraint failed on the fields: (`eventId`)');
    p2002Error.code = 'P2002';
    vi.mocked(prisma.paymentWebhookEvent.create).mockRejectedValueOnce(p2002Error);

    const req = new Request('http://localhost/api/webhooks/asaas', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'asaas-access-token': TEST_TOKEN,
      },
      body: JSON.stringify({
        id: 'evt_concurrent_1',
        event: 'PAYMENT_RECEIVED',
        payment: { id: 'pay_concurrent', status: 'RECEIVED', value: 100 },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('ALREADY_PROCESSED');
    expect(orderService.updateOrderStatus).not.toHaveBeenCalled();
  });

  it('deve disparar e-mail de confirmação de pagamento de forma assíncrona quando o pedido transitar para PAID', async () => {
    vi.mocked(prisma.paymentWebhookEvent.findUnique).mockResolvedValueOnce(null);
    vi.mocked(prisma.paymentWebhookEvent.create).mockResolvedValueOnce({} as any);
    vi.mocked(prisma.order.findFirst).mockResolvedValueOnce({
      id: 'ord-email-test',
      status: 'PENDING',
      lojaID: 'loja-1',
      total: 250,
    } as any);
    vi.mocked(prisma.order.update).mockResolvedValueOnce({} as any);
    vi.mocked(orderService.updateOrderStatus).mockResolvedValueOnce({
      success: true,
      order: { id: 'ord-email-test', status: 'PAID' },
    } as any);

    const fullOrderMock = {
      id: 'ord-email-test',
      orderNumber: 501,
      total: 250,
      deliveryType: 'DELIVERY',
      shippingServiceName: 'SEDEX',
      shippingEstimatedDays: 2,
      pointsEarned: 25,
      user: { name: 'Carlos Silva', email: 'carlos@exemplo.com' },
      loja: { name: 'Continental Loja' },
      items: [
        { name: 'Produto A', quantity: 2, price: 100, color: 'Azul', size: 'G' },
        { name: 'Produto B', quantity: 1, price: 50, color: null, size: null },
      ],
      address: {
        street: 'Av. Brasil',
        number: '500',
        complement: 'Sala 1',
        district: 'Centro',
        city: 'São Paulo',
        state: 'SP',
        cep: '01000-000',
      },
    };

    vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(fullOrderMock as any);

    const req = new Request('http://localhost/api/webhooks/asaas', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'asaas-access-token': TEST_TOKEN,
      },
      body: JSON.stringify({
        id: 'evt_email_1',
        event: 'PAYMENT_RECEIVED',
        payment: { id: 'pay_email_1', externalReference: 'ord-email-test', value: 250.0 },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    // Permite que a microtarefa/promessa assíncrona resolva
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(prisma.order.findUnique).toHaveBeenCalledWith({
      where: { id: 'ord-email-test' },
      include: expect.any(Object),
    });

    expect(emailService.sendOrderPaymentConfirmedEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'carlos@exemplo.com',
        customerName: 'Carlos Silva',
        orderNumber: 501,
        totalValue: 250,
      })
    );
  });

  it('deve manter resposta HTTP 200 de sucesso mesmo se o envio de e-mail rejeitar (resiliência / fail-safe)', async () => {
    vi.mocked(prisma.paymentWebhookEvent.findUnique).mockResolvedValueOnce(null);
    vi.mocked(prisma.paymentWebhookEvent.create).mockResolvedValueOnce({} as any);
    vi.mocked(prisma.order.findFirst).mockResolvedValueOnce({
      id: 'ord-email-fail',
      status: 'PENDING',
      lojaID: 'loja-1',
      total: 100,
    } as any);
    vi.mocked(prisma.order.update).mockResolvedValueOnce({} as any);
    vi.mocked(orderService.updateOrderStatus).mockResolvedValueOnce({
      success: true,
      order: { id: 'ord-email-fail', status: 'PAID' },
    } as any);

    // findUnique lança erro de rede simulando falha temporária
    vi.mocked(prisma.order.findUnique).mockRejectedValueOnce(new Error('Erro de conexão no envio de e-mail'));

    const req = new Request('http://localhost/api/webhooks/asaas', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'asaas-access-token': TEST_TOKEN,
      },
      body: JSON.stringify({
        id: 'evt_email_fail',
        event: 'PAYMENT_RECEIVED',
        payment: { id: 'pay_fail_1', externalReference: 'ord-email-fail', value: 100.0 },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('PROCESSED');
    expect(json.received).toBe(true);
  });
});

