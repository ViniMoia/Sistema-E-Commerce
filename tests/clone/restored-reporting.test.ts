import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { tenantCache } from '@/lib/cache';
import { getAggregatedDashboardMetrics } from '@/services/dashboard.service';
import { listOrdersForAdmin, getOrderDetailForAdmin } from '@/services/order.service';
import { readCustomerFinancialSummaries } from '@/services/customer-financial-metrics.service';
import { createFulfillmentFixture } from '@/tests/setup/fulfillment-fixture';
import { manualRefund } from '@/services/payment/manual-refund.service';
import { GET as loyaltyReport } from '@/app/api/admin/loyalty/reports/route';

vi.mock('@/lib/auth/guards', () => ({ requireAdmin: vi.fn(async () => ({ user: {
  id: 'clone-admin', lojaID: '536bfa58-0531-49e8-9209-3a046281e516', role: 'ADMIN',
} })) }));

describe.skipIf(process.env.TEST_RESTORED_REPORTING !== 'true')('reviewed test-order classification', () => {
  const lojaID = '536bfa58-0531-49e8-9209-3a046281e516';
  let originalIds: string[];
  let originalState: unknown;
  const readOriginal = () => prisma.order.findMany({ where: { id: { in: originalIds } }, include: { items: true, statusHistory: true }, orderBy: { id: 'asc' } });
  const dashboard = async (store: string) => { tenantCache.clear(); return getAggregatedDashboardMetrics(store); };
  beforeAll(async () => {
    await verifyTestDatabase();
    originalIds = (await prisma.order.findMany({ where: { lojaID }, select: { id: true } })).map(o => o.id);
    expect(originalIds).toHaveLength(24);
    expect(await prisma.orderReportingExclusion.count()).toBe(24);
    originalState = await readOriginal();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('EXTERNAL_NETWORK_FORBIDDEN'); }));
  });
  afterAll(async () => {
    try {
      expect(await readOriginal()).toEqual(originalState);
      expect(await prisma.auditLog.count({ where: { effectKey: { startsWith: 'legacy-test-orders-20261015-v1:' } } })).toBe(24);
      expect(fetch).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); tenantCache.clear(); await prisma.$disconnect(); }
  });

  it('zero commercial dashboard and loyalty; all 24 historical orders remain searchable and paginated', async () => {
    const d = await dashboard(lojaID);
    expect(d.financial).toMatchObject({ allTime: { recognizedGross: 0, settledGross: 0 }, totalOrdersCount: 0, pendingOrderValue: 0, cancelledUnpaidOrderValue: 0 });
    expect(d.inbox).toMatchObject({ ordersAwaitingDispatchCount: 0, ordersAwaitingPickupCount: 0, ordersPendingPixCount: 0, urgentItems: [] });
    expect(d.recentOrders).toEqual([]);
    expect(d.logistics).toMatchObject({ totalShippingQuoted: 0, deliveryOrdersCount: 0, pickupOrdersCount: 0 });
    const users = await prisma.user.findMany({ where: { lojaID }, select: { id: true } });
    const metrics = await prisma.$transaction(tx => readCustomerFinancialSummaries(tx, lojaID, users.map(u => u.id)));
    expect([...metrics.values()].reduce((n,c) => n+c.totalOrders, 0)).toBe(0);
    const response = await loyaltyReport(new Request('http://localhost/api/admin/loyalty/reports'));
    expect(response.status).toBe(200);
    expect((await response.json()).data.metrics).toMatchObject({ totalCirculatingPoints: 0, totalLifetimeEarnedPoints: 0 });
    expect((await listOrdersForAdmin({ lojaID, reportingScope: 'COMMERCIAL' })).totalCount).toBe(0);
    expect((await listOrdersForAdmin({ lojaID, reportingScope: 'ALL' })).totalCount).toBe(24);
    const seen = new Set<string>(); let cursor: string | undefined;
    do {
      const page = await listOrdersForAdmin({ lojaID, reportingScope: 'TEST', pageSize: 7, cursor });
      expect(page.totalCount).toBe(24);
      for (const row of page.data) { expect(row.reportingExclusion?.reason).toBe('USER_CLASSIFIED_TEST_DATA'); expect(seen.has(row.id)).toBe(false); seen.add(row.id); }
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    expect(seen.size).toBe(24);
    const detail = await getOrderDetailForAdmin({ lojaID, orderId: originalIds[0] });
    expect(detail?.reportingExclusion?.reason).toBe('USER_CLASSIFIED_TEST_DATA');
    expect((await listOrdersForAdmin({ lojaID, reportingScope: 'TEST', search: String(detail!.orderNumber) })).data.map(o=>o.id)).toContain(detail!.id);
    expect(await getOrderDetailForAdmin({ lojaID: randomUUID(), orderId: originalIds[0] })).toBeNull();
  });

  it('does not infer test classification from old dates, missing intent or PAID status', async () => {
    const user = await prisma.user.findFirstOrThrow({ where: { lojaID } });
    const order = await prisma.order.create({ data: { lojaID, userID: user.id, status: 'PAID', deliveryType: 'PICKUP', subtotal: 99, total: 99,
      createdAt: new Date('2020-01-01T12:00:00Z') } });
    expect(await prisma.orderReportingExclusion.findUnique({ where: { orderId: order.id } })).toBeNull();
    const d = await dashboard(lojaID);
    expect(d.financial.totalOrdersCount).toBe(1);
    expect(d.financial.allTime.recognizedGross).toBe(0); // PAID alone is not financial evidence.
    const metrics = await prisma.$transaction(tx => readCustomerFinancialSummaries(tx, lojaID, [user.id]));
    expect(metrics.get(user.id)).toMatchObject({ totalSpent: 0, unverifiedOrders: 1, coverage: 'PARTIAL' });
    expect((await listOrdersForAdmin({ lojaID, reportingScope: 'TEST' })).totalCount).toBe(24);
  });

  it('new paid purchase and confirmed refund remain visible once and isolated from classified history', async () => {
    const f = await createFulfillmentFixture();
    const order = await f.order('PICKUP');
    expect((await dashboard(f.lojaID)).financial).toMatchObject({ totalOrdersCount: 1, allTime: { recognizedGross: 100, settledGross: 0 } });
    expect((await listOrdersForAdmin({ lojaID: f.lojaID, reportingScope: 'TEST' })).totalCount).toBe(0);
    const before = await prisma.$transaction(tx => readCustomerFinancialSummaries(tx, f.lojaID, [f.customer.id]));
    expect(before.get(f.customer.id)?.totalSpent).toBe(100);
    await manualRefund({ lojaID: f.lojaID, userId: f.admin.id, orderId: order.id, expectedVersion: 1, commandId: randomUUID(), action: 'REQUEST_REFUND' });
    expect((await dashboard(f.lojaID)).financial.allTime.recognizedGross).toBe(100);
    const command = { lojaID: f.lojaID, userId: f.admin.id, orderId: order.id, expectedVersion: 1, commandId: randomUUID(), action: 'CONFIRM_REFUND' as const, bankReference: 'clone-reporting-proof' };
    await manualRefund(command); await manualRefund(command);
    expect((await dashboard(f.lojaID)).financial).toMatchObject({ totalOrdersCount: 1, allTime: { recognizedGross: 100, confirmedRefunds: 100, netRecognized: 0 }, cancelledUnpaidOrderValue: 0 });
    const after = await prisma.$transaction(tx => readCustomerFinancialSummaries(tx, f.lojaID, [f.customer.id]));
    expect(after.get(f.customer.id)).toMatchObject({ recognizedGross: 100, confirmedRefunds: 100, totalSpent: 0 });
    expect((await listOrdersForAdmin({ lojaID: f.lojaID, reportingScope: 'ALL' })).data.map(o=>o.id)).toEqual([order.id]);
  });
});
