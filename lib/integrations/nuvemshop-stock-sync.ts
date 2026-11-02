import { z } from 'zod';
import prisma from '@/lib/prisma';
import { CommerceLocks } from '@/lib/commerce/locks';
import { logger } from '@/lib/logger';

const remoteId = z.union([
  z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  z.string().regex(/^[1-9]\d*$/),
]).transform(String);

export const nuvemshopProductStockSchema = z.object({
  id: remoteId,
  published: z.boolean().optional(),
  visibility: z.enum(['visible', 'unlisted', 'hidden']).optional(),
  variants: z.array(z.object({
    id: remoteId,
    product_id: remoteId,
    sku: z.string().nullable().optional(),
    stock: z.number().int().nonnegative().nullable(),
    stock_management: z.boolean().optional(),
  })).min(1),
});

export type NuvemshopRemoteProduct = z.infer<typeof nuvemshopProductStockSchema>;

export interface NuvemshopProductReaderCaller {
  getProduct(storeId: string, accessToken: string, productId: string, userAgent?: string): Promise<{
    success: boolean;
    data?: unknown;
    status?: number;
    error?: string;
  }>;
}

export const defaultNuvemshopProductReader: NuvemshopProductReaderCaller = {
  async getProduct(storeId: string, accessToken: string, productId: string, userAgent?: string) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`https://api.nuvemshop.com.br/v1/${storeId}/products/${productId}`, {
        method: 'GET',
        headers: {
          'Authentication': `bearer ${accessToken}`,
          'User-Agent': userAgent || process.env.NUVEMSHOP_USER_AGENT || 'Continental-Ecommerce (contato@continentalestetica.com.br)',
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (response.ok) {
        const data = await response.json();
        return { success: true, data, status: response.status };
      }
      return { success: false, status: response.status, error: `HTTP_${response.status}` };
    } catch (err) {
      clearTimeout(timer);
      const isAbort = err instanceof Error && err.name === 'AbortError';
      return { success: false, status: isAbort ? 408 : 500, error: isAbort ? 'TIMEOUT' : 'NETWORK_ERROR' };
    }
  },
};

export interface ReconcileStockOptions {
  caller?: NuvemshopProductReaderCaller;
  eventId?: string;
  source?: 'WEBHOOK' | 'CRON_RECONCILIATION' | 'MANUAL';
  expectedStoreId?: string;
}

export interface ReconcileStockResult {
  status: 'RECONCILED' | 'SKIPPED' | 'NOT_FOUND' | 'ERROR';
  productId?: string;
  updatedVariantsCount: number;
  reason?: string;
}

/**
 * Reconciles local product stock with canonical Nuvemshop product state.
 * Performs remote read outside locks, then reconciles transactionally under CommerceLocks.
 * Updates both variant-level stock and parent aggregate product stock.
 * Audits all changes in StockSyncLog.
 */
export async function reconcileProductStockFromNuvemshop(
  remoteProductId: string,
  options: ReconcileStockOptions = {}
): Promise<ReconcileStockResult> {
  const caller = options.caller ?? defaultNuvemshopProductReader;
  const configuredStoreId = options.expectedStoreId ?? process.env.NUVEMSHOP_STORE_ID;
  const accessToken = process.env.NUVEMSHOP_ACCESS_TOKEN;
  const userAgent = process.env.NUVEMSHOP_USER_AGENT;

  if (!configuredStoreId || !accessToken) {
    return { status: 'SKIPPED', updatedVariantsCount: 0, reason: 'NUVEMSHOP_CREDENTIALS_MISSING' };
  }

  // 1. Fetch Remote Product State (OUTSIDE TRANSACTION/LOCKS)
  const remoteResponse = await caller.getProduct(
    configuredStoreId,
    accessToken,
    remoteProductId,
    userAgent
  );

  if (!remoteResponse.success || !remoteResponse.data) {
    logger.warn('Falha na leitura canônica de estoque Nuvemshop.', {
      action: 'NUVEMSHOP_CANONICAL_READ_FAILED',
      remoteProductId,
      status: remoteResponse.status,
      error: remoteResponse.error,
    });
    return {
      status: 'ERROR',
      updatedVariantsCount: 0,
      reason: remoteResponse.error || `HTTP_${remoteResponse.status ?? 500}`,
    };
  }

  const parsed = nuvemshopProductStockSchema.safeParse(remoteResponse.data);
  if (!parsed.success) {
    return {
      status: 'ERROR',
      updatedVariantsCount: 0,
      reason: 'INVALID_REMOTE_PRODUCT_SCHEMA',
    };
  }

  const remoteProduct = parsed.data;

  // 2. Transactional Reconciliation Phase (under product & variant locks)
  return await prisma.$transaction(async tx => {
    const product = await tx.product.findFirst({
      where: { nuvemshopProductId: remoteProduct.id },
      include: {
        productVariants: true,
      },
    });

    if (!product) {
      return {
        status: 'NOT_FOUND',
        updatedVariantsCount: 0,
        reason: 'LOCAL_PRODUCT_NOT_LINKED',
      };
    }

    const locks = new CommerceLocks(tx);
    await locks.acquire('product', [product.id]);
    const variantIds = product.productVariants.map(v => v.id);
    if (variantIds.length > 0) {
      await locks.acquire('variant', variantIds);
    }

    // Map remote variants by variant ID
    const remoteVariantMap = new Map(
      remoteProduct.variants.map(rv => [rv.id, rv])
    );

    let updatedVariantsCount = 0;
    const nextVariantStocks: number[] = [];

    for (const variant of product.productVariants) {
      // Preserve retired status without reviving retired variants
      if (variant.retiredAt) {
        continue;
      }

      if (!variant.nuvemshopVariantId) {
        nextVariantStocks.push(variant.stock);
        continue;
      }

      const remoteVariant = remoteVariantMap.get(variant.nuvemshopVariantId);
      if (!remoteVariant) {
        nextVariantStocks.push(variant.stock);
        continue;
      }

      // Nuvemshop stock can be null if stock management is disabled
      const newStock = remoteVariant.stock ?? 0;

      if (variant.stock !== newStock) {
        await tx.stockSyncLog.create({
          data: {
            lojaID: product.lojaID,
            productId: product.id,
            variantId: variant.id,
            sku: variant.sku,
            source: options.source ?? 'WEBHOOK',
            previousStock: variant.stock,
            newStock,
            nuvemshopEventId: options.eventId ?? null,
            metadata: {
              remoteProductId: remoteProduct.id,
              remoteVariantId: remoteVariant.id,
            },
          },
        });

        await tx.productVariants.update({
          where: { id: variant.id },
          data: { stock: newStock },
        });

        updatedVariantsCount++;
        nextVariantStocks.push(newStock);
      } else {
        nextVariantStocks.push(variant.stock);
      }
    }

    // Reconcile total parent stock
    const newTotalStock = nextVariantStocks.reduce((sum, s) => sum + s, 0);
    if (product.stock !== newTotalStock || updatedVariantsCount > 0) {
      await tx.product.update({
        where: { id: product.id },
        data: {
          stock: newTotalStock,
          catalogVersion: { increment: 1 },
        },
      });
    }

    return {
      status: 'RECONCILED',
      productId: product.id,
      updatedVariantsCount,
    };
  });
}
