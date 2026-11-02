import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '@/app/api/cron/nuvemshop/status/route';
import {
  getNuvemshopIntegrationHealth,
  reconcileNuvemshopStockBatch,
} from '@/lib/integrations/nuvemshop-supervision';
import * as stockSyncModule from '@/lib/integrations/nuvemshop-stock-sync';
import prisma from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  default: {
    $transaction: vi.fn(async (work) => work(prisma)),
    $executeRaw: vi.fn(),
    order: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    commerceOutbox: {
      groupBy: vi.fn(),
      findFirst: vi.fn(),
    },
    productVariants: {
      count: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
    },
    stockSyncLog: {
      findMany: vi.fn(),
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('CRON_SECRET', 'test-cron-secret-123');
  vi.stubEnv('NUVEMSHOP_STORE_ID', '8179726');

  (prisma.order.groupBy as any).mockResolvedValue([
    { syncStatus: 'SYNCED', _count: 42 },
    { syncStatus: 'FAILED', _count: 2 },
  ]);

  (prisma.commerceOutbox.groupBy as any).mockResolvedValue([
    { status: 'READY', _count: 3 },
    { status: 'DEAD_LETTER', _count: 1 },
  ]);

  vi.mocked(prisma.commerceOutbox.findFirst).mockResolvedValue({
    createdAt: new Date('2026-10-30T10:00:00Z'),
  } as never);

  vi.mocked(prisma.productVariants.count)
    .mockResolvedValueOnce(517) // linked
    .mockResolvedValueOnce(3);  // unlinked

  vi.mocked(prisma.order.findMany).mockResolvedValue([
    { orderNumber: 99, lastSyncError: 'Variant missing', syncAttempts: 3 },
  ] as never);

  vi.mocked(prisma.stockSyncLog.findMany).mockResolvedValue([
    {
      id: 'log-1',
      sku: 'SKU-01',
      previousStock: 5,
      newStock: 8,
      source: 'WEBHOOK',
      createdAt: new Date('2026-10-30T11:00:00Z'),
    },
  ] as never);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Nuvemshop Supervision & Observability', () => {
  it('collects read-only health metrics without exposing customer PII', async () => {
    const health = await getNuvemshopIntegrationHealth();

    expect(health.schemaVersion).toBe(1);
    expect(health.configuredStoreId).toBe('8179726');
    expect(health.orders.synced).toBe(42);
    expect(health.orders.failed).toBe(2);
    expect(health.outbox.ready).toBe(3);
    expect(health.outbox.deadLetter).toBe(1);
    expect(health.outbox.oldestPendingAt).toBe('2026-10-30T10:00:00.000Z');
    expect(health.variants.linkedCount).toBe(517);
    expect(health.variants.unlinkedCount).toBe(3);
    expect(health.variants.totalActive).toBe(520);
    expect(health.recentSyncErrors).toHaveLength(1);
    expect(health.recentStockSyncLogs).toHaveLength(1);

    expect(prisma.$executeRaw).toHaveBeenCalled();
  });

  it('runs batch reconciliation over linked products', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([
      { id: 'p1', nuvemshopProductId: '1001' },
      { id: 'p2', nuvemshopProductId: '1002' },
    ] as never);

    const spyReconcile = vi.spyOn(stockSyncModule, 'reconcileProductStockFromNuvemshop')
      .mockResolvedValueOnce({ status: 'RECONCILED', productId: 'p1', updatedVariantsCount: 2 })
      .mockResolvedValueOnce({ status: 'RECONCILED', productId: 'p2', updatedVariantsCount: 0 });

    const summary = await reconcileNuvemshopStockBatch({ batchSize: 10 });

    expect(summary.scanned).toBe(2);
    expect(summary.reconciled).toBe(1);
    expect(summary.unchanged).toBe(1);
    expect(summary.errors).toBe(0);
    expect(spyReconcile).toHaveBeenCalledTimes(2);

    spyReconcile.mockRestore();
  });
});

describe('Nuvemshop Supervision Route Handler (GET)', () => {
  it('returns 503 if CRON_SECRET is not configured', async () => {
    vi.stubEnv('CRON_SECRET', '');
    const req = new Request('http://localhost/api/cron/nuvemshop/status', {
      headers: { authorization: 'Bearer test-cron-secret-123' },
    });
    const res = await GET(req);
    expect(res.status).toBe(503);
  });

  it('returns 401 if authorization token is missing or invalid', async () => {
    const req = new Request('http://localhost/api/cron/nuvemshop/status', {
      headers: { authorization: 'Bearer wrong-secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 with health metrics when authorization is valid', async () => {
    const req = new Request('http://localhost/api/cron/nuvemshop/status', {
      headers: { authorization: 'Bearer test-cron-secret-123' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.orders.synced).toBe(42);
    expect(body.variants.linkedCount).toBe(517);
  });
});
