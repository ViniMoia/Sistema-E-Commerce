import type { Prisma } from '@prisma/client';
import { CommerceLocks } from '@/lib/commerce/locks';

export interface InventoryRelease {
  productId: string; variantId: string | null; quantity: number; destination: 'AVAILABLE' | 'UNAVAILABLE';
}

export interface InventoryItemInput {
  productId: string;
  variantId?: string | null;
  quantity: number;
  name?: string;
}

export class InventoryError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'InventoryError';
  }
}

/**
 * Serviço Canônico de Gestão de Inventário e Estoque (REV-001 / Clean Architecture).
 * Centraliza e unifica as operações atômicas de reserva e estorno de estoque em toda a aplicação.
 */
export class InventoryService {
  /**
   * Reserva estoque de forma atômica durante o checkout (status PENDING).
   * Decrementa simetricamente tanto o produto pai quanto a variante dentro da transação.
   */
  static async reserveStock(
    items: InventoryItemInput[],
    tx: Prisma.TransactionClient,
    lojaID: string
  ): Promise<void> {
    if (!lojaID) throw new InventoryError('INVALID_INPUT', 'Contexto de loja é obrigatório.');
    if (items.some(item => !item.productId || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 2147483647)) throw new InventoryError('INVALID_INPUT', 'Produto e quantidade inteira positiva são obrigatórios.');
    const locks = new CommerceLocks(tx);
    await locks.acquire('product', items.map(item => item.productId));
    await locks.acquire('variant', items.flatMap(item => item.variantId ? [item.variantId] : []));
    // Validate the entire batch before its first write, including direct callers.
    for (const item of items) {
      if (!item.productId || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 2147483647) {
        throw new InventoryError('INVALID_INPUT', 'Produto e quantidade inteira positiva são obrigatórios.');
      }
      const product = await tx.product.findUnique({ where: { id: item.productId }, select: { id: true, lojaID: true, retiredAt: true, productVariants: { select: { id: true } } } });
      if (!product || product.lojaID !== lojaID || product.retiredAt) {
        throw new InventoryError('INVALID_SCOPE', 'Produto inválido ou não pertence a esta loja.');
      }
      if (!item.variantId && product.productVariants?.length) throw new InventoryError('INVALID_SCOPE', 'Seleção de variante é obrigatória para reservar este produto.');
      if (item.variantId) {
        const variant = await tx.productVariants.findUnique({ where: { id: item.variantId }, select: { ProductID: true, retiredAt: true } });
        if (!variant || variant.ProductID !== product.id || variant.retiredAt) {
          throw new InventoryError('INVALID_SCOPE', 'Variação inválida ou não pertence ao produto.');
        }
      }
    }
    // Ordenação Determinística de Locks (Prevenção de Deadlocks 40P01 - AUD2-004):
    // Garante que múltiplas transações concorrentes sempre adquiram locks de linha
    // na mesma sequência estrita (por productId e variantId), eliminando ciclos de espera mútua.
    const sortedItems = [...items].sort((a, b) => {
      const cmpProduct = (a.productId || '').localeCompare(b.productId || '');
      if (cmpProduct !== 0) return cmpProduct;
      return (a.variantId || '').localeCompare(b.variantId || '');
    });

    for (const item of sortedItems) {
      if (!item.productId) {
        throw new InventoryError('INVALID_INPUT', 'Identificador do produto (productId) é obrigatório.');
      }

      const quantity = item.quantity;

      // Decremento atômico no produto pai com salvaguarda contra estoque negativo / condição de corrida (AUD-003)
      const updatedProduct = await tx.product.update({
        where: { id: item.productId, lojaID, retiredAt: null },
        data: {
          stock: { decrement: quantity },
          inventoryVersion: { increment: 1 },
        },
      });

      if (updatedProduct && typeof updatedProduct.stock === 'number' && updatedProduct.stock < 0) {
        throw new InventoryError(
          'INSUFFICIENT_STOCK',
          `Estoque insuficiente para o produto "${updatedProduct.name || item.productId}". Disponibilidade esgotada concorrentemente.`
        );
      }

      // Decremento atômico na variante (se especificada) com salvaguarda de concorrência (AUD-003)
      if (item.variantId) {
        const updatedVariant = await tx.productVariants.update({
          where: { id: item.variantId, ProductID: item.productId, retiredAt: null },
          data: {
            stock: { decrement: quantity },
            inventoryVersion: { increment: 1 },
          },
        });

        if (updatedVariant && typeof updatedVariant.stock === 'number' && updatedVariant.stock < 0) {
          throw new InventoryError(
            'INSUFFICIENT_STOCK',
            `Estoque insuficiente para a variação selecionada. Disponibilidade esgotada concorrentemente.`
          );
        }
      }
    }
  }

  /**
   * Estorna estoque de forma atômica e simétrica em caso de cancelamento de pedido.
   * Suporta cancelamento de pedidos PENDING ou PAID, incrementando tanto o produto pai quanto a variante.
   */
  static async restoreStock(
    items: InventoryItemInput[],
    tx: Prisma.TransactionClient,
    lojaID: string
  ): Promise<InventoryRelease[]> {
    if (!lojaID || items.some(item => !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 2147483647 || (item.variantId && !item.productId))) {
      throw new InventoryError('INVALID_INPUT', 'Contexto e vínculos de restituição inválidos.');
    }
    const locks = new CommerceLocks(tx);
    await locks.acquire('product', items.flatMap(item => item.productId ? [item.productId] : []));
    await locks.acquire('variant', items.flatMap(item => item.variantId ? [item.variantId] : []));
    const releases: InventoryRelease[] = [];
    const sortedItems = [...items].sort((a, b) => {
      const cmpProduct = (a.productId || '').localeCompare(b.productId || '');
      if (cmpProduct !== 0) return cmpProduct;
      return (a.variantId || '').localeCompare(b.variantId || '');
    });

    for (const item of sortedItems) {
      const quantity = item.quantity;
      if (!item.productId) continue; // Detached historical item: no fabricated inventory destination.
      const product = await tx.product.findUnique({ where: { id: item.productId }, select: { lojaID: true, retiredAt: true } });
      const variant = item.variantId ? await tx.productVariants.findUnique({ where: { id: item.variantId }, select: { ProductID: true, retiredAt: true } }) : null;
      if (!product || product.lojaID !== lojaID || (item.variantId && (!variant || variant.ProductID !== item.productId))) throw new InventoryError('INVALID_SCOPE', 'Vínculos de restituição inválidos.');
      const unavailable = Boolean(product.retiredAt || variant?.retiredAt);
      const data = { [unavailable ? 'unavailableStock' : 'stock']: { increment: quantity }, inventoryVersion: { increment: 1 } };
      if (item.productId) {
          await tx.product.update({
            where: { id: item.productId, lojaID },
            data,
          });
      }

      // 2. Incrementa estoque da variante (se variantId existir)
      if (item.variantId) {
          await tx.productVariants.update({
            where: { id: item.variantId, ProductID: item.productId, product: { lojaID } },
            data,
          });
      }
      releases.push({ productId: item.productId, variantId: item.variantId ?? null, quantity, destination: unavailable ? 'UNAVAILABLE' : 'AVAILABLE' });
    }
    return releases;
  }
}
