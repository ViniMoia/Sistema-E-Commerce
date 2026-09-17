import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/orders/route';
import { getOrdersByUser, OrderError } from '@/services/order.service';
import prisma from '@/lib/prisma';
import * as guards from '@/lib/auth/guards';
import * as tenant from '@/lib/tenant';

vi.mock('@/lib/prisma', () => ({
  default: {
    order: {
      findMany: vi.fn(),
    },
    cart: {
      findUnique: vi.fn(),
    },
    address: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/auth/guards', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/tenant', () => ({
  getLojaFromHeaders: vi.fn(),
}));

describe('Blindagem Multi-Tenant e Eliminação de Vazamento Cross-Tenant (REV-004)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Testes de Serviço: getOrdersByUser', () => {
    it('deve rejeitar execução com VALIDATION_ERROR se userID não for fornecido', async () => {
      await expect(
        getOrdersByUser({ userID: '', lojaID: 'loja-1' })
      ).rejects.toThrow(OrderError);

      expect(prisma.order.findMany).not.toHaveBeenCalled();
    });

    it('deve rejeitar execução com VALIDATION_ERROR se lojaID não for fornecido', async () => {
      await expect(
        getOrdersByUser({ userID: 'usr-1', lojaID: '' })
      ).rejects.toThrow(OrderError);

      expect(prisma.order.findMany).not.toHaveBeenCalled();
    });

    it('deve consultar o Prisma delimitando obrigatoriamente userID E lojaID', async () => {
      vi.mocked(prisma.order.findMany).mockResolvedValueOnce([
        {
          id: 'ord-1',
          userID: 'usr-1',
          lojaID: 'loja-1',
          items: [],
        },
      ] as any);

      const orders = await getOrdersByUser({ userID: 'usr-1', lojaID: 'loja-1' });

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userID: 'usr-1',
            lojaID: 'loja-1',
          },
        })
      );
      expect(orders).toHaveLength(1);
    });
  });

  describe('2. Testes de Rota: GET /api/orders', () => {
    it('Cenário Crítico: Admin NÃO deve vazar pedidos globais (deve filtrar por seu próprio ID e Loja)', async () => {
      // Simula usuário autenticado com papel ADMIN
      vi.mocked(guards.requireAuth).mockResolvedValueOnce({
        user: {
          id: 'admin-1',
          name: 'Admin da Loja',
          email: 'admin@loja1.com',
          role: 'ADMIN',
          status: 'ACTIVE',
          lojaID: 'loja-1',
        },
      } as any);

      vi.mocked(tenant.getLojaFromHeaders).mockResolvedValueOnce({
        id: 'loja-1',
        name: 'Loja Oficial 1',
        slug: 'loja-1',
      } as any);

      vi.mocked(prisma.order.findMany).mockResolvedValueOnce([]);

      const res = await GET(new Request('http://localhost/api/orders'));
      expect(res.status).toBe(200);

      // GARANTIA ANTI-LEAK: prisma.order.findMany foi chamado com { userID: 'admin-1', lojaID: 'loja-1' }
      // E NUNCA com { userID: undefined }
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userID: 'admin-1',
            lojaID: 'loja-1',
          },
        })
      );
      expect(prisma.order.findMany).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userID: undefined,
          },
        })
      );
    });

    it('deve restringir pedidos de CUSTOMER estritamente ao seu userID e lojaID ativa', async () => {
      vi.mocked(guards.requireAuth).mockResolvedValueOnce({
        user: {
          id: 'customer-10',
          role: 'CUSTOMER',
          status: 'ACTIVE',
          lojaID: 'loja-1',
        },
      } as any);

      vi.mocked(tenant.getLojaFromHeaders).mockResolvedValueOnce({
        id: 'loja-1',
      } as any);

      vi.mocked(prisma.order.findMany).mockResolvedValueOnce([]);

      const res = await GET(new Request('http://localhost/api/orders'));
      expect(res.status).toBe(200);

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userID: 'customer-10',
            lojaID: 'loja-1',
          },
        })
      );
    });

    it('deve falhar fechado com status 400 se nenhum contexto de tenant/loja for identificado', async () => {
      vi.mocked(guards.requireAuth).mockResolvedValueOnce({
        user: {
          id: 'customer-no-loja',
          role: 'CUSTOMER',
          status: 'ACTIVE',
          lojaID: '',
        },
      } as any);

      vi.mocked(tenant.getLojaFromHeaders).mockResolvedValueOnce(null);

      const res = await GET(new Request('http://localhost/api/orders'));
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('Contexto de loja não identificado');
      expect(prisma.order.findMany).not.toHaveBeenCalled();
    });
  });

  describe('3. Testes de Rota: POST /api/orders (Prevenção de Spoofing)', () => {
    it('deve rejeitar com 403 se o cliente tentar forjar criação de pedido em lojaID diferente da loja ativa', async () => {
      vi.mocked(guards.requireAuth).mockResolvedValueOnce({
        user: {
          id: 'usr-1',
          role: 'CUSTOMER',
          status: 'ACTIVE',
          lojaID: 'loja-vitima-1',
        },
      } as any);

      vi.mocked(tenant.getLojaFromHeaders).mockResolvedValueOnce({
        id: 'loja-vitima-1',
        name: 'Loja Vítima',
      } as any);

      const req = new Request('http://localhost/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartID: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          addressID: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
          lojaID: 'loja-alheia-999', // Tentativa de spoofing cross-tenant!
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain('Loja inválida ou inconsistente');
    });
  });
});
