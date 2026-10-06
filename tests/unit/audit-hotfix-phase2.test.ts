import { freightOrchestrator } from '@/services/freight';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as orderStatusGET } from '@/app/api/orders/[id]/status/route';
import { POST as freightCalculatePOST } from '@/app/api/freight/calculate/route';
import { adjustPointsManually, LoyaltyError } from '@/services/loyalty.service';
import prisma from '@/lib/prisma';
import * as tenantLib from '@/lib/tenant';
import * as sessionLib from '@/lib/session';
import * as rateLimitLib from '@/lib/rate-limit';
import { NextResponse } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  default: {
    $transaction: vi.fn(async (cb) => {
      if (typeof cb === 'function') {
        return await cb(prisma);
      }
      return cb;
    }),
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    loja: {
      findUnique: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    loyaltyWallet: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    loyaltyTransaction: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/tenant', () => ({
  getLojaFromHeaders: vi.fn(),
}));
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));

vi.mock('@/services/freight', () => ({
  freightOrchestrator: {
    calculate: vi.fn().mockResolvedValue({ serverTime: '2026-10-05T12:00:00Z', merchandiseSubtotal: '140.00', options: [
      { providerId: 'CORREIOS', serviceCode: '04014', serviceName: 'SEDEX', price: 25.5, deliveryTimeInDays: 2,
        freightQuoteToken: 'fixture-authority', freightQuoteId: 'fixture-id', expiresAt: '2030-01-01T00:00:00Z' },
    ] }),
  },
}));

describe('Auditoria Fase 2 - Validação de Hardening e Otimizações (AUD-006, AUD-007, AUD-008)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AUD-006: Proteção Multi-Tenant e Rate Limit em GET /api/orders/[id]/status', () => {
    it('deve retornar 404 se o pedido pertencer a outra loja (Isolamento Multi-Tenant)', async () => {
      vi.mocked(tenantLib.getLojaFromHeaders).mockResolvedValueOnce({
        id: 'loja-continental-sp',
        nome: 'Continental SP',
        slug: 'continental-sp',
      } as any);

      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
        id: 'ord-alheia-1',
        orderNumber: 555,
        status: 'PAID',
        lojaID: 'loja-continental-rj', // Loja divergente do domínio
        total: 199.9,
        asaasPaymentStatus: 'RECEIVED',
        deliveredConfirmedAt: null,
        updatedAt: new Date(),
      } as any);

      const req = new Request('http://sp.continental.com/api/orders/ord-alheia-1/status');
      const res = await orderStatusGET(req, { params: Promise.resolve({ id: 'ord-alheia-1' }) });

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toContain('Pedido não encontrado');
    });

    it('deve retornar 200 para o titular autenticado na loja do domínio', async () => {
      vi.mocked(sessionLib.getCurrentUser).mockResolvedValueOnce({ id: 'owner-1', lojaID: 'loja-continental-sp', status: 'ACTIVE', role: 'CUSTOMER' } as any);
      vi.mocked(tenantLib.getLojaFromHeaders).mockResolvedValueOnce({
        id: 'loja-continental-sp',
        nome: 'Continental SP',
        slug: 'continental-sp',
      } as any);

      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
        id: 'ord-legitima-1',
        userID: 'owner-1',
        orderNumber: 1234,
        status: 'PAID',
        lojaID: 'loja-continental-sp',
        total: 150.0,
        asaasPaymentStatus: 'RECEIVED',
        deliveredConfirmedAt: null,
        updatedAt: new Date(),
      } as any);

      const req = new Request('http://sp.continental.com/api/orders/ord-legitima-1/status');
      const res = await orderStatusGET(req, { params: Promise.resolve({ id: 'ord-legitima-1' }) });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.order.id).toBe('ord-legitima-1');
      expect(data.order.orderNumber).toBe(1234);
    });

    it('deve bloquear por Rate Limiting se ultrapassar a cota permitida', async () => {
      const spyRateLimit = vi.spyOn(rateLimitLib, 'checkRateLimit').mockReturnValueOnce(
        NextResponse.json({ error: 'Muitas requisições' }, { status: 429 })
      );

      const req = new Request('http://sp.continental.com/api/orders/ord-spam/status');
      const res = await orderStatusGET(req, { params: Promise.resolve({ id: 'ord-spam' }) });

      expect(res.status).toBe(429);
      spyRateLimit.mockRestore();
    });
  });

  describe('AUD-007: scoped actor and target required for loyalty adjustment', () => {
    const command = { lojaID: 'loja-alpha', userID: 'foreign-user', points: 100,
      description: 'Audit fixture', adminUserId: 'admin-1', commandId: 'adjust-1' };
    it('rejects a target outside the store before any wallet write', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ role: 'ADMIN', status: 'ACTIVE' } as any).mockResolvedValueOnce(null);
      await expect(adjustPointsManually(command)).rejects.toMatchObject({ code: 'USER_NOT_FOUND' });
      expect(prisma.user.findUnique).toHaveBeenNthCalledWith(2, { where: { id_lojaID: { id: command.userID, lojaID: command.lojaID } }, select: { status: true } });
      expect(prisma.loyaltyWallet.update).not.toHaveBeenCalled();
    });
    it('rejects missing or cross-tenant administrator even when a target exists', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
      await expect(adjustPointsManually(command)).rejects.toThrow(LoyaltyError);
      expect(prisma.loyaltyWallet.update).not.toHaveBeenCalled();
    });
  });

  describe('WF-11: identidade de itens no contrato público de cotação', () => {
    it('deve delegar identidade de itens sem aceitar economia do cliente', async () => {
      vi.mocked(tenantLib.getLojaFromHeaders).mockResolvedValueOnce({
        id: 'loja-1',
      } as any);

      vi.mocked(prisma.product.findMany).mockResolvedValueOnce([
        {
          id: 'prod-1',
          name: 'Cera Automotiva',
          price: 50,
          weightInGrams: 500,
          lengthCm: 20,
          widthCm: 15,
          heightCm: 10,
          lojaID: 'loja-1',
        },
        {
          id: 'prod-2',
          name: 'Shampoo Neutro',
          price: 40,
          weightInGrams: 1000,
          lengthCm: 25,
          widthCm: 10,
          heightCm: 10,
          lojaID: 'loja-1',
        },
      ] as any);

      const req = new Request('http://loja.com/api/freight/calculate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          lojaID: 'loja-1',
          destinationCep: '01001-000',
          items: [
            { productId: 'prod-1', quantity: 2 },
            { productId: 'prod-2', quantity: 1 },
          ],
        }),
      });

      const res = await freightCalculatePOST(req);
      expect(res.status).toBe(200);

      // Route sends identity only; batching and database economics now belong to the authority service.
      expect(freightOrchestrator.calculate).toHaveBeenCalledWith(expect.objectContaining({
        lojaID: 'loja-1', items: [{ productId: 'prod-1', quantity: 2 }, { productId: 'prod-2', quantity: 1 }],
      }));
    });
  });
});

vi.mock('@/lib/freight/owner', () => ({ freightOwnerForRequest: vi.fn(async () => 'g:' + 'a'.repeat(64)) }));
