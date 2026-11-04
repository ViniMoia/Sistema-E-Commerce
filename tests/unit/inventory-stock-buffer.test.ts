import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { InventoryService, InventoryError } from '@/services/inventory.service';
import { resolveCatalogVariant, isVariantAvailable } from '@/lib/product-variants';
import { getProductStockSummary } from '@/components/home/HomeClient';
import prisma from '@/lib/prisma';

vi.mock('@/services/loyalty.service', () => ({
  creditEarnedPoints: vi.fn().mockResolvedValue(null),
  refundOrderPoints: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/prisma', () => {
  return {
    default: {
      $queryRaw: vi.fn().mockResolvedValue([]),
      $transaction: vi.fn(async (cb) => {
        if (typeof cb === 'function') {
          return await cb(prisma);
        }
        return cb;
      }),
      product: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      productVariants: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    },
  };
});

describe('Estoque de Segurança Omnichannel (stockBuffer) - Vitrine & Reserva', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.product.findUnique as any).mockImplementation(async ({ where }: any) => ({
      id: where.id,
      lojaID: 'loja-1',
      retiredAt: null,
      productVariants: [],
    }));
    (prisma.productVariants.findUnique as Mock).mockImplementation(async ({ where }: any) => ({
      ProductID: where.id.replace('var-', 'prod-'),
      retiredAt: null,
    }));
  });

  describe('1. Regras de Domínio e Resolução de Variantes (lib/product-variants)', () => {
    it('isVariantAvailable deve retornar false quando variant.stock <= stockBuffer', () => {
      const variant = { id: 'v1', size: 'Único', color: 'Padrão', stock: 1 };
      expect(isVariantAvailable(variant, 1)).toBe(false);
      expect(isVariantAvailable(variant, 2)).toBe(false);
      expect(isVariantAvailable(variant, 0)).toBe(true);
    });

    it('isVariantAvailable deve retornar true quando variant.stock > stockBuffer', () => {
      const variant = { id: 'v1', size: 'Único', color: 'Padrão', stock: 2 };
      expect(isVariantAvailable(variant, 1)).toBe(true);
    });

    it('resolveCatalogVariant deve desconsiderar variantes cujo estoque é menor ou igual ao stockBuffer', () => {
      const variants = [
        { id: 'v-p', size: 'P', color: 'Azul', stock: 1 },
        { id: 'v-m', size: 'M', color: 'Azul', stock: 5 },
      ];

      // Com stockBuffer = 1, a variante 'P' (1 un) não é selecionável online
      const resolvedP = resolveCatalogVariant(variants, 'P', 'Azul', 1);
      expect(resolvedP).toBeNull();

      // Variante 'M' (5 un) continua disponível
      const resolvedM = resolveCatalogVariant(variants, 'M', 'Azul', 1);
      expect(resolvedM).not.toBeNull();
      expect(resolvedM?.id).toBe('v-m');

      // Se stockBuffer for 0 (exclusivo e-commerce), variante 'P' fica disponível
      const resolvedPZeroBuffer = resolveCatalogVariant(variants, 'P', 'Azul', 0);
      expect(resolvedPZeroBuffer?.id).toBe('v-p');
    });
  });

  describe('2. Indicador de Exclusividade Presencial (HomeClient: getProductStockSummary)', () => {
    it('deve classificar produto como Exclusivo Loja Física quando stock <= stockBuffer e stock > 0', () => {
      const prod = {
        id: 'prod-balcao',
        name: 'Item Raro',
        price: 100,
        description: 'Item',
        imageUrl: '/test.jpg',
        stock: 1,
        stockBuffer: 1,
      };

      const summary = getProductStockSummary(prod as any);
      expect(summary.totalPhysical).toBe(1);
      expect(summary.availableOnline).toBe(0);
      expect(summary.isExclusivePhysical).toBe(true);
      expect(summary.isOutOfStock).toBe(false);
    });

    it('deve permitir venda online quando stock > stockBuffer', () => {
      const prod = {
        id: 'prod-disponivel',
        name: 'Item Comum',
        price: 50,
        description: 'Item',
        imageUrl: '/test.jpg',
        stock: 3,
        stockBuffer: 1,
      };

      const summary = getProductStockSummary(prod as any);
      expect(summary.totalPhysical).toBe(3);
      expect(summary.availableOnline).toBe(2);
      expect(summary.isExclusivePhysical).toBe(false);
      expect(summary.isOutOfStock).toBe(false);
    });

    it('deve classificar como esgotado quando stock for 0', () => {
      const prod = {
        id: 'prod-zerado',
        name: 'Item Zerado',
        price: 50,
        description: 'Item',
        imageUrl: '/test.jpg',
        stock: 0,
        stockBuffer: 1,
      };

      const summary = getProductStockSummary(prod as any);
      expect(summary.totalPhysical).toBe(0);
      expect(summary.availableOnline).toBe(0);
      expect(summary.isExclusivePhysical).toBe(false);
      expect(summary.isOutOfStock).toBe(true);
    });
  });

  describe('3. Reserva Atômica de Inventário (InventoryService.reserveStock)', () => {
    it('Caso 1: Produto com estoque 1 e buffer 1 rejeita compra online com mensagem protegida para o balcão', async () => {
      vi.mocked(prisma.product.update).mockResolvedValueOnce({
        id: 'prod-1',
        name: 'Aspirador Automotivo',
        stock: 0, // Decrementou de 1 para 0
        stockBuffer: 1,
      } as any);

      await expect(
        InventoryService.reserveStock(
          [{ productId: 'prod-1', quantity: 1 }],
          prisma as any,
          'loja-1'
        )
      ).rejects.toThrow(
        'A última unidade do produto "Aspirador Automotivo" está reservada para compra presencial na loja física.'
      );
    });

    it('Caso 2: Produto com estoque 2 e buffer 1 permite 1 compra e rejeita a segunda compra consecutiva', async () => {
      // Primeira compra: estoque cai de 2 para 1. 1 >= stockBuffer (1) -> Aceito!
      vi.mocked(prisma.product.update).mockResolvedValueOnce({
        id: 'prod-2',
        name: 'Cera Líquida',
        stock: 1,
        stockBuffer: 1,
      } as any);

      await expect(
        InventoryService.reserveStock(
          [{ productId: 'prod-2', quantity: 1 }],
          prisma as any,
          'loja-1'
        )
      ).resolves.toBeUndefined();

      // Segunda compra consecutiva: estoque cai de 1 para 0. 0 < stockBuffer (1) -> Rejeita!
      vi.mocked(prisma.product.update).mockResolvedValueOnce({
        id: 'prod-2',
        name: 'Cera Líquida',
        stock: 0,
        stockBuffer: 1,
      } as any);

      await expect(
        InventoryService.reserveStock(
          [{ productId: 'prod-2', quantity: 1 }],
          prisma as any,
          'loja-1'
        )
      ).rejects.toThrow(
        'A última unidade do produto "Cera Líquida" está reservada para compra presencial na loja física.'
      );
    });

    it('Caso 3: Produto exclusivo online (stockBuffer = 0) permite a compra normalmente até zerar', async () => {
      vi.mocked(prisma.product.update).mockResolvedValueOnce({
        id: 'prod-online-only',
        name: 'E-Book Digital',
        stock: 0, // Caiu de 1 para 0
        stockBuffer: 0,
      } as any);

      await expect(
        InventoryService.reserveStock(
          [{ productId: 'prod-online-only', quantity: 1 }],
          prisma as any,
          'loja-1'
        )
      ).resolves.toBeUndefined();
    });

    it('Caso 4: Variante com estoque 1 e buffer 1 rejeita compra online protegendo a peça de mostruário', async () => {
      vi.mocked(prisma.product.findUnique).mockResolvedValueOnce({
        id: 'prod-var',
        lojaID: 'loja-1',
        retiredAt: null,
        productVariants: [{ id: 'var-g' }],
      } as any);

      vi.mocked(prisma.productVariants.findUnique).mockResolvedValueOnce({
        id: 'var-g',
        ProductID: 'prod-var',
        retiredAt: null,
      } as any);

      vi.mocked(prisma.product.update).mockResolvedValueOnce({
        id: 'prod-var',
        name: 'Camiseta Preta G',
        stock: 5, // Pai ainda tem saldo de outros tamanhos
        stockBuffer: 1,
      } as any);

      vi.mocked(prisma.productVariants.update).mockResolvedValueOnce({
        id: 'var-g',
        ProductID: 'prod-var',
        stock: 0, // Último tamanho G caiu para 0
      } as any);

      await expect(
        InventoryService.reserveStock(
          [{ productId: 'prod-var', variantId: 'var-g', quantity: 1 }],
          prisma as any,
          'loja-1'
        )
      ).rejects.toThrow(
        'A última unidade da variação selecionada está reservada para compra presencial na loja física.'
      );
    });

    it('Caso 5: Restituição (restoreStock) incrementa o estoque sem violar ou corromper a integridade', async () => {
      vi.mocked(prisma.product.findUnique).mockResolvedValueOnce({
        id: 'prod-cancelado',
        lojaID: 'loja-1',
        retiredAt: null,
      } as any);

      vi.mocked(prisma.product.update).mockResolvedValueOnce({
        id: 'prod-cancelado',
        stock: 2,
        stockBuffer: 1,
      } as any);

      const releases = await InventoryService.restoreStock(
        [{ productId: 'prod-cancelado', quantity: 1 }],
        prisma as any,
        'loja-1'
      );

      expect(releases).toHaveLength(1);
      expect(releases[0].destination).toBe('AVAILABLE');
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-cancelado', lojaID: 'loja-1' },
        data: { stock: { increment: 1 }, inventoryVersion: { increment: 1 } },
      });
    });
  });
});
