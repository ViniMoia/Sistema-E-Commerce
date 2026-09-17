import type { Prisma } from '@prisma/client';

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
    _lojaID?: string
  ): Promise<void> {
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

      const quantity = Math.max(1, Math.floor(item.quantity));

      // Decremento atômico no produto pai com salvaguarda contra estoque negativo / condição de corrida (AUD-003)
      const updatedProduct = await tx.product.update({
        where: { id: item.productId },
        data: {
          stock: { decrement: quantity },
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
          where: { id: item.variantId },
          data: {
            stock: { decrement: quantity },
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
    tx: Prisma.TransactionClient
  ): Promise<void> {
    const sortedItems = [...items].sort((a, b) => {
      const cmpProduct = (a.productId || '').localeCompare(b.productId || '');
      if (cmpProduct !== 0) return cmpProduct;
      return (a.variantId || '').localeCompare(b.variantId || '');
    });

    for (const item of sortedItems) {
      const quantity = Math.max(1, Math.floor(item.quantity));

      // 1. Incrementa estoque do produto pai (se productId existir)
      if (item.productId) {
        try {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: { increment: quantity },
            },
          });
        } catch (err) {
          console.warn(`[INVENTORY_RESTORE_WARNING] Falha ao incrementar produto pai ${item.productId}:`, err);
        }
      }

      // 2. Incrementa estoque da variante (se variantId existir)
      if (item.variantId) {
        try {
          await tx.productVariants.update({
            where: { id: item.variantId },
            data: {
              stock: { increment: quantity },
            },
          });
        } catch (err) {
          console.warn(`[INVENTORY_RESTORE_WARNING] Falha ao incrementar variante ${item.variantId}:`, err);
        }
      }
    }
  }
}
