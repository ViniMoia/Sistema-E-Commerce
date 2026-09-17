import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as orderStatusGET } from '@/app/api/orders/[id]/status/route';
import { POST as freightCalculatePOST } from '@/app/api/freight/calculate/route';
import { adjustPointsManually, LoyaltyError } from '@/services/loyalty.service';
import prisma from '@/lib/prisma';
import * as tenantLib from '@/lib/tenant';
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

vi.mock('@/services/freight', () => ({
  freightOrchestrator: {
    calculate: vi.fn().mockResolvedValue([
      { serviceName: 'SEDEX', price: 25.5, estimatedDays: 2 },
    ]),
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

    it('deve retornar 200 com os dados do pedido se pertencer à loja do domínio', async () => {
      vi.mocked(tenantLib.getLojaFromHeaders).mockResolvedValueOnce({
        id: 'loja-continental-sp',
        nome: 'Continental SP',
        slug: 'continental-sp',
      } as any);

      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
        id: 'ord-legitima-1',
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

  describe('AUD-007: Validação de Filiação de Usuário em adjustPointsManually', () => {
    it('deve rejeitar ajuste com USER_NOT_FOUND se o usuário pertencer a outra loja', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null); // Não encontrado na loja informada

      await expect(
        adjustPointsManually({
          lojaID: 'loja-alpha',
          userID: 'user-de-outra-loja',
          points: 100,
          description: 'Bônus indevido',
          adminUserId: 'admin-1',
        })
      ).rejects.toThrow(LoyaltyError);

      await expect(
        adjustPointsManually({
          lojaID: 'loja-alpha',
          userID: 'user-de-outra-loja',
          points: 100,
          description: 'Bônus indevido',
          adminUserId: 'admin-1',
        })
      ).rejects.toThrow(/não pertence a esta loja/);
    });

    it('deve permitir ajuste se o usuário for validado como pertencente à loja', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
        id: 'user-legitimo',
        lojaID: 'loja-alpha',
      } as any);

      vi.mocked((prisma as any).loja.findUnique).mockResolvedValueOnce({
        id: 'loja-alpha',
        loyaltyEnabled: true,
        loyaltyEarnRate: { toString: () => '1' },
        loyaltyPointValue: { toString: () => '0.1' },
        loyaltyMinPointsRedeem: 100,
        loyaltyMaxDiscountPct: { toString: () => '20' },
        loyaltyPointsExpiryDays: 365,
      } as any);

      vi.mocked(prisma.loyaltyWallet.upsert).mockResolvedValueOnce({
        id: 'wallet-1',
        lojaID: 'loja-alpha',
        userID: 'user-legitimo',
        balance: 200,
      } as any);

      vi.mocked(prisma.loyaltyWallet.update).mockResolvedValueOnce({
        id: 'wallet-1',
        balance: 300,
      } as any);

      vi.mocked(prisma.loyaltyTransaction.create).mockResolvedValueOnce({
        id: 'tx-adj-1',
      } as any);

      const result = await adjustPointsManually({
        lojaID: 'loja-alpha',
        userID: 'user-legitimo',
        points: 100,
        description: 'Bônus fidelidade legítimo',
        adminUserId: 'admin-1',
      });

      expect(result.wallet.balance).toBe(300);
      expect(result.transaction.id).toBe('tx-adj-1');
    });
  });

  describe('AUD-008: Consulta em Lote (Sem N+1) no Cálculo de Frete', () => {
    it('deve buscar produtos em lote com prisma.product.findMany em vez de loop findUnique', async () => {
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

      // Deve ter chamado findMany exatamente 1 vez com todos os IDs dos produtos
      expect(prisma.product.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: expect.arrayContaining(['prod-1', 'prod-2']) } },
        })
      );

      // findUnique NUNCA deve ter sido chamado no loop
      expect(prisma.product.findUnique).not.toHaveBeenCalled();
    });
  });
});
