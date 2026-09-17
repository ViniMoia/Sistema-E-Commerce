import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InventoryService, InventoryError } from '@/services/inventory.service';
import { updateOrderStatus } from '@/services/order.service';
import { POST as checkoutPOST } from '@/app/api/checkout/route';
import prisma from '@/lib/prisma';
import * as tenantLib from '@/lib/tenant';
import * as checkoutService from '@/lib/services/checkout.service';
import * as loyaltyService from '@/services/loyalty.service';

vi.mock('@/lib/prisma', () => ({
  default: {
    $transaction: vi.fn(async (cb) => {
      if (typeof cb === 'function') {
        return await cb(prisma);
      }
      return cb;
    }),
    product: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    productVariants: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    loyaltyWallet: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    loyaltyTransaction: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/tenant', () => ({
  getLojaFromHeaders: vi.fn(),
}));

vi.mock('@/lib/services/checkout.service', () => ({
  createOrder: vi.fn(),
}));

vi.mock('@/services/loyalty.service', () => ({
  creditEarnedPoints: vi.fn(),
  refundOrderPoints: vi.fn(),
}));

describe('Auditoria Fase 1 - Validação dos Hotfixes Bloqueantes (AUD-002, AUD-003, AUD-004)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AUD-003: Blindagem contra Concorrência e Sobrevenda (Race Condition)', () => {
    it('deve disparar InventoryError(INSUFFICIENT_STOCK) se o produto pai resultar em estoque negativo', async () => {
      vi.mocked(prisma.product.update).mockResolvedValue({
        id: 'prod-esgotado',
        name: 'Produto Concorrente',
        stock: -1, // Simula decremento simultâneo além do estoque
      } as any);

      await expect(
        InventoryService.reserveStock(
          [{ productId: 'prod-esgotado', quantity: 1 }],
          prisma as any
        )
      ).rejects.toThrow('Estoque insuficiente para o produto "Produto Concorrente"');
    });

    it('deve disparar InventoryError(INSUFFICIENT_STOCK) se a variante resultar em estoque negativo', async () => {
      vi.mocked(prisma.product.update).mockResolvedValueOnce({
        id: 'prod-pai',
        name: 'Camisa Polo',
        stock: 0,
      } as any);

      vi.mocked(prisma.productVariants.update).mockResolvedValueOnce({
        id: 'var-esgotada',
        stock: -1,
      } as any);

      await expect(
        InventoryService.reserveStock(
          [{ productId: 'prod-pai', variantId: 'var-esgotada', quantity: 1 }],
          prisma as any
        )
      ).rejects.toThrow('Estoque insuficiente para a variação selecionada');
    });
  });

  describe('AUD-002: Estorno de Pontos de Fidelidade em Pedidos PENDING Cancelados', () => {
    it('deve invocar refundOrderPoints ao cancelar um pedido PENDING que utilizou pontos resgatados', async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
        id: 'order-pending-with-points',
        status: 'PENDING',
        userID: 'user-123',
        lojaID: 'loja-continental',
        subtotal: 100,
        pointsEarned: 0,
        pointsRedeemed: 500, // Cliente resgatou 500 pontos
        items: [],
      } as any);

      vi.mocked(prisma.order.update).mockResolvedValueOnce({
        id: 'order-pending-with-points',
        status: 'CANCELLED',
      } as any);

      const result = await updateOrderStatus({
        orderId: 'order-pending-with-points',
        newStatus: 'CANCELLED',
        performedById: 'admin-1',
        lojaID: 'loja-continental',
      });

      expect(result.success).toBe(true);
      expect(loyaltyService.refundOrderPoints).toHaveBeenCalledWith(
        expect.objectContaining({
          lojaID: 'loja-continental',
          orderId: 'order-pending-with-points',
        }),
        expect.anything()
      );
    });

    it('não deve invocar refundOrderPoints ao cancelar pedido PENDING que NÃO utilizou pontos', async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
        id: 'order-pending-no-points',
        status: 'PENDING',
        userID: 'user-123',
        lojaID: 'loja-continental',
        subtotal: 100,
        pointsEarned: 0,
        pointsRedeemed: 0, // Zero pontos resgatados
        items: [],
      } as any);

      vi.mocked(prisma.order.update).mockResolvedValueOnce({
        id: 'order-pending-no-points',
        status: 'CANCELLED',
      } as any);

      const result = await updateOrderStatus({
        orderId: 'order-pending-no-points',
        newStatus: 'CANCELLED',
        performedById: 'admin-1',
        lojaID: 'loja-continental',
      });

      expect(result.success).toBe(true);
      expect(loyaltyService.refundOrderPoints).not.toHaveBeenCalled();
    });
  });

  describe('AUD-004: Isolamento Multi-Tenant e Prevenção de Spoofing no Checkout', () => {
    it('deve rejeitar com 403 se o cliente tentar enviar um lojaID diferente do domínio da loja', async () => {
      vi.mocked(tenantLib.getLojaFromHeaders).mockResolvedValueOnce({
        id: 'loja-legitima-1',
        nome: 'Loja Alpha',
        slug: 'alpha',
      } as any);

      const req = new Request('http://alpha.com/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          lojaID: 'loja-vitima-2', // Tentativa de forjar Loja Beta
          deliveryType: 'PICKUP',
          customer: {
            name: 'Cliente Teste',
            email: 'cliente@teste.com',
            phone: '11999999999',
            cpfCnpj: '12345678909',
          },
          items: [{ productId: 'prod-1', name: 'Item Teste', quantity: 1, price: 50 }],
        }),
      });

      const res = await checkoutPOST(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('Violação de isolamento multi-tenant');
      expect(checkoutService.createOrder).not.toHaveBeenCalled();
    });

    it('deve permitir e vincular o pedido ao lojaID resolvido pelo domínio se coerente', async () => {
      vi.mocked(tenantLib.getLojaFromHeaders).mockResolvedValueOnce({
        id: 'loja-legitima-1',
        nome: 'Loja Alpha',
        slug: 'alpha',
      } as any);

      vi.mocked(checkoutService.createOrder).mockResolvedValueOnce({
        order: { id: 'ord-ok', orderNumber: 1001 },
      } as any);

      const req = new Request('http://alpha.com/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          lojaID: 'loja-legitima-1',
          deliveryType: 'PICKUP',
          customer: {
            name: 'Cliente Teste',
            email: 'cliente@teste.com',
            phone: '11999999999',
            cpfCnpj: '12345678909',
          },
          items: [{ productId: 'prod-1', name: 'Item Teste', quantity: 1, price: 50 }],
        }),
      });

      const res = await checkoutPOST(req);
      expect(res.status).toBe(200);
      expect(checkoutService.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          lojaID: 'loja-legitima-1',
        })
      );
    });
  });
});
