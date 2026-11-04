import prisma from '@/lib/prisma';
import { reconcileProductStockFromNuvemshop, type NuvemshopProductReaderCaller } from './nuvemshop-stock-sync';

export interface NuvemshopHealthReport {
  schemaVersion: 1;
  timestamp: string;
  configuredStoreId: string | null;
  orders: {
    synced: number;
    processing: number;
    failed: number;
    deadLetter: number;
    pending: number;
  };
  outbox: {
    ready: number;
    leased: number;
    deadLetter: number;
    oldestPendingAt: string | null;
  };
  variants: {
    linkedCount: number;
    unlinkedCount: number;
    totalActive: number;
  };
  recentSyncErrors: Array<{
    orderNumber: number;
    lastSyncError: string | null;
    syncAttempts: number;
  }>;
  recentStockSyncLogs: Array<{
    id: string;
    sku: string | null;
    previousStock: number;
    newStock: number;
    source: string;
    createdAt: string;
  }>;
}

/**
 * Installation-wide read-only aggregate health snapshot for Nuvemshop integration.
 * Performs zero database mutations. Does not expose tokens or customer PII.
 */
export async function getNuvemshopIntegrationHealth(): Promise<NuvemshopHealthReport> {
  const configuredStoreId = process.env.NUVEMSHOP_STORE_ID || null;

  return await prisma.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;

    const now = new Date();
    const nuvemshopCommandTypes = ['NUVEMSHOP_ORDER_SYNC', 'NUVEMSHOP_ORDER_CANCEL'];

    const [
      orderSyncGroups,
      outboxGroups,
      oldestOutbox,
      linkedVariants,
      unlinkedVariants,
      recentErrors,
      recentLogs,
    ] = await Promise.all([
      tx.order.groupBy({
        by: ['syncStatus'],
        _count: true,
      }),
      tx.commerceOutbox.groupBy({
        by: ['status'],
        where: { commandType: { in: nuvemshopCommandTypes } },
        _count: true,
      }),
      tx.commerceOutbox.findFirst({
        where: {
          commandType: { in: nuvemshopCommandTypes },
          status: { in: ['READY', 'LEASED'] },
        },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      tx.productVariants.count({
        where: { retiredAt: null, nuvemshopVariantId: { not: null } },
      }),
      tx.productVariants.count({
        where: { retiredAt: null, nuvemshopVariantId: null },
      }),
      tx.order.findMany({
        where: { syncStatus: { in: ['FAILED', 'DEAD_LETTER'] } },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: { orderNumber: true, lastSyncError: true, syncAttempts: true },
      }),
      tx.stockSyncLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          sku: true,
          previousStock: true,
          newStock: true,
          source: true,
          createdAt: true,
        },
      }),
    ]);

    const orderCounts = {
      synced: orderSyncGroups.find(g => g.syncStatus === 'SYNCED')?._count ?? 0,
      processing: orderSyncGroups.find(g => g.syncStatus === 'PROCESSING')?._count ?? 0,
      failed: orderSyncGroups.find(g => g.syncStatus === 'FAILED')?._count ?? 0,
      deadLetter: orderSyncGroups.find(g => g.syncStatus === 'DEAD_LETTER')?._count ?? 0,
      pending: orderSyncGroups.find(g => g.syncStatus === 'PENDING')?._count ?? 0,
    };

    const outboxCounts = {
      ready: outboxGroups.find(g => g.status === 'READY')?._count ?? 0,
      leased: outboxGroups.find(g => g.status === 'LEASED')?._count ?? 0,
      deadLetter: outboxGroups.find(g => g.status === 'DEAD_LETTER')?._count ?? 0,
      oldestPendingAt: oldestOutbox?.createdAt.toISOString() ?? null,
    };

    return {
      schemaVersion: 1,
      timestamp: now.toISOString(),
      configuredStoreId,
      orders: orderCounts,
      outbox: outboxCounts,
      variants: {
        linkedCount: linkedVariants,
        unlinkedCount: unlinkedVariants,
        totalActive: linkedVariants + unlinkedVariants,
      },
      recentSyncErrors: recentErrors,
      recentStockSyncLogs: recentLogs.map(log => ({
        ...log,
        createdAt: log.createdAt.toISOString(),
      })),
    };
  });
}

export interface ReconcileBatchOptions {
  batchSize?: number;
  caller?: NuvemshopProductReaderCaller;
}

export interface ReconcileBatchSummary {
  scanned: number;
  reconciled: number;
  unchanged: number;
  errors: number;
  details: Array<{
    productId: string;
    remoteProductId: string;
    updatedVariantsCount: number;
    status: string;
  }>;
}

/**
 * Periodically reconciles local product stock for a batch of linked products.
 */
export async function reconcileNuvemshopStockBatch(
  options: ReconcileBatchOptions = {}
): Promise<ReconcileBatchSummary> {
  const limit = Math.max(1, Math.min(50, options.batchSize ?? 20));

  const candidateProducts = await prisma.product.findMany({
    where: {
      retiredAt: null,
      nuvemshopProductId: { not: null },
    },
    orderBy: { updatedAt: 'asc' },
    take: limit,
    select: { id: true, nuvemshopProductId: true },
  });

  const summary: ReconcileBatchSummary = {
    scanned: candidateProducts.length,
    reconciled: 0,
    unchanged: 0,
    errors: 0,
    details: [],
  };

  for (const product of candidateProducts) {
    if (!product.nuvemshopProductId) continue;

    try {
      const outcome = await reconcileProductStockFromNuvemshop(product.nuvemshopProductId, {
        caller: options.caller,
        source: 'CRON_RECONCILIATION',
      });

      if (outcome.status === 'RECONCILED') {
        if (outcome.updatedVariantsCount > 0) {
          summary.reconciled++;
        } else {
          summary.unchanged++;
        }
      } else {
        summary.errors++;
      }

      summary.details.push({
        productId: product.id,
        remoteProductId: product.nuvemshopProductId,
        updatedVariantsCount: outcome.updatedVariantsCount,
        status: outcome.status,
      });
    } catch {
      summary.errors++;
      summary.details.push({
        productId: product.id,
        remoteProductId: product.nuvemshopProductId,
        updatedVariantsCount: 0,
        status: 'UNHANDLED_EXCEPTION',
      });
    }
  }

  return summary;
}
