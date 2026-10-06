import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getClientIp, rateLimit } from '@/lib/rate-limit';
import { InventoryService } from '@/services/inventory.service';
import { POST as webhookPost } from '@/app/api/webhooks/asaas/route';
import { GET as orderStatusGet } from '@/app/api/orders/[id]/status/route';
import { createOrder } from '@/tests/helpers/checkout-domain-fixture';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import * as tenantModule from '@/lib/tenant';

vi.mock('@/lib/prisma', () => ({
  default: {
    $queryRaw: vi.fn().mockResolvedValue([]),
      orderBuyer: { create: vi.fn(async ({ data }: any) => ({ id: "buyer-1", ...data })) },
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
    paymentInbox: { upsert: vi.fn(async (args: any) => ({ ...args.create, status: 'READY' })) },
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
      vi.mocked(prisma.product.findUnique).mockResolvedValue({
        id: 'prod-1',
        lojaID: 'loja-A',
        price: new Prisma.Decimal('100.00'),
        stock: 10,
        productVariants: [{ id: 'fixture-neutral-variant', size: 'Único', color: 'Padrão', stock: 100 }],
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
      vi.mocked(prisma.product.findUnique).mockResolvedValue({
        id: 'prod-1',
        lojaID: 'loja-A',
        price: new Prisma.Decimal('100.00'),
        stock: 10,
        productVariants: [{ id: 'fixture-neutral-variant', size: 'Único', color: 'Padrão', stock: 100 }],
      } as any);

      // Usuário no banco é da loja-A mas com outro e-mail
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'user-vitima',
        lojaID: 'loja-A',
        email: 'legitimo@teste.com', status: 'ACTIVE',
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
        $queryRaw: vi.fn().mockResolvedValue([]),
        product: {
          findUnique: vi.fn(async ({ where }) => ({ id: where.id, lojaID: 'loja-1', retiredAt: null })),
          update: vi.fn(async ({ where }) => {
            executionOrder.push(`P:${where.id}`);
            return { id: where.id, stock: 10 };
          }),
        },
        productVariants: {
          findUnique: vi.fn(async ({ where }) => ({ ProductID: where.id.replace('var-', 'prod-'), retiredAt: null })),
          update: vi.fn(async ({ where }) => {
            executionOrder.push(`V:${where.id}`);
            return { id: where.id, stock: 5 };
          }),
        },
      };

      // Array intencionalmente em ordem invertida (Z, depois M, depois A)
      const disorderedItems = [
        { productId: 'prod-Z', variantId: 'var-Z', quantity: 1 },
        { productId: 'prod-A', variantId: 'var-A', quantity: 2 },
        { productId: 'prod-M', variantId: 'var-M', quantity: 1 },
      ];

      await InventoryService.reserveStock(disorderedItems, mockTx, 'loja-1');

      // Deve executar na ordem determinística: prod-A -> prod-M -> prod-Z
      expect(executionOrder).toEqual([
        'P:prod-A',
        'V:var-A',
        'P:prod-M',
        'V:var-M',
        'P:prod-Z',
        'V:var-Z',
      ]);
    });
  });

  describe('AUD2-005: Durable delivery and late-payment reconciliation boundary', () => {
    beforeEach(() => { vi.stubEnv('ASAAS_WEBHOOK_TOKEN', 'valid-test-token'); vi.stubEnv('PAYMENT_WORKER_ENABLED', 'true'); });
    const payload = { id: 'evt_fixture', event: 'PAYMENT_CONFIRMED', payment: { id: 'pay_fixture',
      billingType: 'PIX', status: 'CONFIRMED', value: 150, externalReference: 'ord_cancelled_10' } };
    const request = () => new Request('http://localhost/api/webhooks/asaas', { method: 'POST',
      headers: { 'asaas-access-token': 'valid-test-token' }, body: JSON.stringify(payload) });
    it('durable received marker is not mistaken for already applied effects', async () => {
      const res = await webhookPost(request());
      expect(res.status).toBe(200); expect(await res.json()).toMatchObject({ received: true, status: 'RECEIVED' });
      expect(prisma.paymentInbox.upsert).toHaveBeenCalled(); expect(prisma.order.update).not.toHaveBeenCalled();
    });
    it('late-payment receipt preserves work for verified reconciliation, without a false commercial transition', async () => {
      const res = await webhookPost(request()); expect(res.status).toBe(200);
      expect(prisma.paymentInbox.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ eventType: 'PAYMENT_CONFIRMED' }) }));
      expect(prisma.auditLog.create).not.toHaveBeenCalled(); expect(prisma.order.update).not.toHaveBeenCalled();
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

vi.mock('@/services/checkout-intent.service', async importOriginal => {
  const { intentUnitMock } = await import('@/tests/helpers/checkout-domain-fixture');
  return intentUnitMock(await importOriginal<typeof import('@/services/checkout-intent.service')>());
});
vi.mock('@/services/checkout-plan.service', async importOriginal => {
  const { planUnitMock } = await import('@/tests/helpers/checkout-domain-fixture');
  return planUnitMock(await importOriginal<typeof import('@/services/checkout-plan.service')>());
});
