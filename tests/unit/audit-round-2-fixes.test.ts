import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getClientIp, rateLimit } from '@/lib/rate-limit';
import { InventoryService } from '@/services/inventory.service';
import { POST as webhookPost } from '@/app/api/webhooks/asaas/route';
import { GET as orderStatusGet } from '@/app/api/orders/[id]/status/route';
import { createOrder } from '@/services/checkout.service';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import * as tenantModule from '@/lib/tenant';

vi.mock('@/lib/prisma', () => ({
  default: {
    $transaction: vi.fn((cb) => (typeof cb === 'function' ? cb(prisma) : cb)),
    loja: {
      findUnique: vi.fn(),
    },
    product: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    productVariants: {
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    order: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    paymentWebhookEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    freightRule: {
      findFirst: vi.fn(),
    },
    address: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/services/order.service', () => ({
  updateOrderStatus: vi.fn(),
}));

vi.mock('@/lib/tenant', () => ({
  getLojaFromHeaders: vi.fn(),
}));

describe('Auditoria Profunda Rodada 2 — Testes de Homologação das Correções (AUD2-001 a AUD2-008)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AUD2-001: Proteção Anti-IDOR / Anti-Impersonation no Checkout', () => {
    it('deve rejeitar checkout se o customer.userId pertencer a outra loja', async () => {
      vi.mocked(prisma.loja.findUnique).mockResolvedValueOnce({ id: 'loja-A' } as any);
      vi.mocked(prisma.product.findUnique).mockResolvedValueOnce({
        id: 'prod-1',
        lojaID: 'loja-A',
        price: new Prisma.Decimal('100.00'),
        stock: 10,
        productVariants: [],
      } as any);

      // Usuário no banco pertence à loja-B
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'user-vitima',
        lojaID: 'loja-B',
        email: 'vitima@loja-b.com',
      } as any);

      await expect(
        createOrder({
          lojaID: 'loja-A',
          customer: {
            name: 'Atacante',
            email: 'vitima@loja-b.com',
            phone: '11999999999',
            userId: 'user-vitima',
          },
          items: [{ productId: 'prod-1', quantity: 1 }],
          deliveryType: 'NONE',
        })
      ).rejects.toThrow('Usuário inválido ou não pertence a esta loja.');
    });

    it('deve rejeitar checkout se o customer.userId não corresponder ao e-mail informado', async () => {
      vi.mocked(prisma.loja.findUnique).mockResolvedValueOnce({ id: 'loja-A' } as any);
      vi.mocked(prisma.product.findUnique).mockResolvedValueOnce({
        id: 'prod-1',
        lojaID: 'loja-A',
        price: new Prisma.Decimal('100.00'),
        stock: 10,
        productVariants: [],
      } as any);

      // Usuário no banco é da loja-A mas com outro e-mail
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'user-vitima',
        lojaID: 'loja-A',
        email: 'legitimo@teste.com',
      } as any);

      await expect(
        createOrder({
          lojaID: 'loja-A',
          customer: {
            name: 'Atacante',
            email: 'atacante@evil.com', // E-mail divergente
            phone: '11999999999',
            userId: 'user-vitima',
          },
          items: [{ productId: 'prod-1', quantity: 1 }],
          deliveryType: 'NONE',
        })
      ).rejects.toThrow('Identificador de usuário não corresponde ao e-mail informado.');
    });
  });

  describe('AUD2-003: Rate Limiting & Prevenção de Header Spoofing em getClientIp', () => {
    it('deve priorizar cabeçalho confiável cf-connecting-ip quando válido', () => {
      const req = new Request('http://localhost/api/checkout', {
        headers: {
          'cf-connecting-ip': '198.51.100.25',
          'x-forwarded-for': 'attacker-spoofed-ip, 10.0.0.1',
        },
      });
      const ip = getClientIp(req);
      expect(ip).toBe('198.51.100.25');
    });

    it('deve ignorar valores inválidos ou scripts maliciosos em x-forwarded-for', () => {
      const req = new Request('http://localhost/api/auth/login', {
        headers: {
          'x-forwarded-for': '<script>alert(1)</script>, invalid-ip-string, 192.168.1.50',
        },
      });
      const ip = getClientIp(req);
      expect(ip).toBe('192.168.1.50');
    });

    it('deve retornar 127.0.0.1 de forma segura se nenhum IP válido for encontrado', () => {
      const req = new Request('http://localhost/api/auth/login', {
        headers: {
          'x-forwarded-for': 'garbage, fake, 999.999.999.999',
        },
      });
      const ip = getClientIp(req);
      expect(ip).toBe('127.0.0.1');
    });
  });

  describe('AUD2-004: Ordenação Determinística de Locks em InventoryService (Anti-Deadlock 40P01)', () => {
    it('deve ordenar deterministicamente os produtos por productId e variantId ao reservar estoque', async () => {
      const executionOrder: string[] = [];

      const mockTx: any = {
        product: {
          update: vi.fn(async ({ where }) => {
            executionOrder.push(`P:${where.id}`);
            return { id: where.id, stock: 10 };
          }),
        },
        productVariants: {
          update: vi.fn(async ({ where }) => {
            executionOrder.push(`V:${where.id}`);
            return { id: where.id, stock: 5 };
          }),
        },
      };

      // Array intencionalmente em ordem invertida (Z, depois M, depois A)
      const disorderedItems = [
        { productId: 'prod-Z', variantId: 'var-1', quantity: 1 },
        { productId: 'prod-A', variantId: 'var-2', quantity: 2 },
        { productId: 'prod-M', variantId: 'var-1', quantity: 1 },
      ];

      await InventoryService.reserveStock(disorderedItems, mockTx);

      // Deve executar na ordem determinística: prod-A -> prod-M -> prod-Z
      expect(executionOrder).toEqual([
        'P:prod-A',
        'V:var-2',
        'P:prod-M',
        'V:var-1',
        'P:prod-Z',
        'V:var-1',
      ]);
    });
  });

  describe('AUD2-005: Resiliência em Concorrência de Webhooks Asaas e Pagamento de Pedidos Cancelados', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv, ASAAS_WEBHOOK_TOKEN: 'valid-test-token' };
    });

    it('deve capturar colisão P2002 em webhook concorrente e retornar ALREADY_PROCESSED graciosamente', async () => {
      vi.mocked(prisma.paymentWebhookEvent.findUnique).mockResolvedValueOnce(null);
      // Simula erro de chave única (P2002) disparado quando duas requisições simultâneas tentam create
      const p2002Error: any = new Error('Unique constraint failed on the fields: (eventId)');
      p2002Error.code = 'P2002';
      vi.mocked(prisma.paymentWebhookEvent.create).mockRejectedValueOnce(p2002Error);

      const req = new Request('http://localhost/api/webhooks/asaas', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'asaas-access-token': 'valid-test-token',
        },
        body: JSON.stringify({
          id: 'evt_concurrent_1',
          event: 'PAYMENT_RECEIVED',
          payment: { id: 'pay_concurrent_1', status: 'RECEIVED' },
        }),
      });

      const res = await webhookPost(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe('ALREADY_PROCESSED');
      expect(json.received).toBe(true);
    });

    it('deve registrar alerta no AuditLog e em adminNotes se PAYMENT_CONFIRMED chegar para pedido CANCELLED', async () => {
      vi.mocked(prisma.paymentWebhookEvent.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.paymentWebhookEvent.create).mockResolvedValueOnce({} as any);

      // Pedido já está CANCELLED
      vi.mocked(prisma.order.findFirst).mockResolvedValueOnce({
        id: 'ord_cancelled_10',
        status: 'CANCELLED',
        lojaID: 'loja_1',
        total: new Prisma.Decimal('150.00'),
      } as any);

      const req = new Request('http://localhost/api/webhooks/asaas', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'asaas-access-token': 'valid-test-token',
        },
        body: JSON.stringify({
          id: 'evt_late_payment',
          event: 'PAYMENT_CONFIRMED',
          payment: {
            id: 'pay_late_123',
            status: 'CONFIRMED',
            value: 150.0,
            externalReference: 'ord_cancelled_10',
          },
        }),
      });

      const res = await webhookPost(req);
      expect(res.status).toBe(200);

      // Garante que o AuditLog foi chamado com a ação de alerta crítico
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'PAYMENT_RECEIVED_ON_CANCELLED_ORDER',
            targetId: 'ord_cancelled_10',
          }),
        })
      );

      // Garante que adminNotes do pedido foi atualizado com o alerta explicativo
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ord_cancelled_10' },
          data: expect.objectContaining({
            adminNotes: expect.stringContaining('[ALERTA DE PAGAMENTO TARDIO]'),
          }),
        })
      );
    });
  });

  describe('AUD2-006: Tenancy Estrito (Fail-Closed) em Polling de Pedido', () => {
    it('deve retornar 404 se a loja ativa não puder ser resolvida pelo domínio', async () => {
      vi.mocked(tenantModule.getLojaFromHeaders).mockResolvedValueOnce(null);

      const req = new Request('http://unknown-host.com/api/orders/ord-1/status');
      const res = await orderStatusGet(req, { params: Promise.resolve({ id: 'ord-1' }) });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe('Pedido não encontrado');
    });

    it('deve retornar 404 se o pedido pertencer a loja diferente do domínio atual', async () => {
      vi.mocked(tenantModule.getLojaFromHeaders).mockResolvedValueOnce({ id: 'loja-A' } as any);
      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
        id: 'ord-1',
        lojaID: 'loja-B', // Outra loja
      } as any);

      const req = new Request('http://loja-a.com/api/orders/ord-1/status');
      const res = await orderStatusGet(req, { params: Promise.resolve({ id: 'ord-1' }) });

      expect(res.status).toBe(404);
    });
  });
});
