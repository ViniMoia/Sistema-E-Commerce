import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import prisma, { verifyTestDatabase } from '@/lib/prisma';
import { tenantCache } from '@/lib/cache';
import { getAggregatedDashboardMetrics } from '@/services/dashboard.service';
import { readCustomerFinancialSummaries } from '@/services/customer-financial-metrics.service';
import { createFixtureStore } from '@/tests/setup/fixture-scope';
import { createFulfillmentFixture } from '@/tests/setup/fulfillment-fixture';
import { manualRefund } from '@/services/payment/manual-refund.service';
import { GET as loyaltyReport } from '@/app/api/admin/loyalty/reports/route';

// Regression of restored legacy coverage and financial evidence; not production approval.
// Only the restored-clone runner opts in. Real services/DB; auth alone is stubbed
// for the route-level loyalty calculation (this is not an authorization test).
vi.mock('@/lib/auth/guards', () => ({ requireAdmin: vi.fn(async () => ({ user: {
  id: 'clone-audit-admin', lojaID: '536bfa58-0531-49e8-9209-3a046281e516', role: 'ADMIN',
} })) }));

describe.skipIf(process.env.TEST_AUDIT_INDICATORS !== 'true')('restored indicators diagnostic', () => {
  const lojaID = '536bfa58-0531-49e8-9209-3a046281e516';
  const report: Record<string, unknown> = { schemaVersion: 2, cloneOnly: true,
    productionReady: false, sourceWritten: false, sharedHomologationWritten: false,
    transport: 'local services; no provider requests' };
  let originals: unknown;
  const originalState = async () => ({
    orders: await prisma.order.findMany({ where: { lojaID }, include: { items: true }, orderBy: { id: 'asc' } }),
    transactions: await prisma.loyaltyTransaction.findMany({ where: { lojaID }, orderBy: { id: 'asc' } }),
    wallets: await prisma.loyaltyWallet.findMany({ where: { lojaID }, orderBy: { id: 'asc' } }),
  });
  const dashboard = async (store: string) => { tenantCache.clear(); return getAggregatedDashboardMetrics(store); };
  beforeAll(async () => {
    await verifyTestDatabase();
    expect(await prisma.loja.count()).toBe(1);
    expect(await prisma.order.count()).toBe(24);
    originals = await originalState();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('EXTERNAL_NETWORK_FORBIDDEN'); }));
  });
  afterAll(async () => {
    try {
      expect(await originalState()).toEqual(originals);
      expect(fetch).not.toHaveBeenCalled();
      report.originalOrdersWalletsAndTransactionsPreserved = true;
      if (process.env.TEST_INDICATOR_REPORT) fs.writeFileSync(process.env.TEST_INDICATOR_REPORT, JSON.stringify(report, null, 2)+'\n', { flag: 'wx' });
    } finally { vi.useRealTimers(); vi.unstubAllGlobals(); tenantCache.clear(); await prisma.$disconnect(); }
  });

  it('measures retained test orders and the loyalty fallback after zero opening', async () => {
    const d = await dashboard(lojaID);
    const users = await prisma.user.findMany({ where: { lojaID }, select: { id: true } });
    const customers = await prisma.$transaction(tx => readCustomerFinancialSummaries(tx, lojaID, users.map(u => u.id)), { isolationLevel: 'RepeatableRead' });
    const totals = [...customers.values()].reduce((a, c) => ({ spent: a.spent+c.totalSpent, unverified: a.unverified+c.unverifiedOrders }), { spent: 0, unverified: 0 });
    const response = await loyaltyReport(new Request('http://localhost/api/admin/loyalty/reports'));
    const loyalty = await response.json();
    expect(response.status).toBe(200);
    expect(d.financial.totalOrdersCount).toBe(24);
    expect(d.financial.paidOrdersCount).toBe(4);
    expect(d.financial.pendingOrdersCount).toBe(10);
    expect(d.financial.cancelledOrdersCount).toBe(10);
    expect(totals).toEqual({ spent: 0, unverified: 24 });
    expect(d.loyalty.totalCirculatingPoints).toBe(0);
    expect(loyalty.data.metrics.totalLifetimeEarnedPoints).toBe(0);
    const { pixConfig: _privateConfig, ...financial } = d.financial;
    report.legacy = { financial, customerEvidence: totals,
      inbox: { dispatch: d.inbox.ordersAwaitingDispatchCount, pickup: d.inbox.ordersAwaitingPickupCount, pending: d.inbox.ordersPendingPixCount },
      recentLegacyOrders: d.recentOrders.length,
      loyalty: { dashboardCirculating: d.loyalty.totalCirculatingPoints, report: loyalty.data.metrics },
      declaredHistoricalTestOrders: 24 };
  });

  it('never invents revenue from paid status, dates or financing snapshots without facts', async () => {
    // Date-only fake clock, no fake IO timers. All synthetic rows remain on clone.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-16T15:00:00Z'));
    try {
      const store = await createFixtureStore();
      const user = await prisma.user.create({ data: { lojaID: store, name: 'Indicator fixture', email: randomUUID()+'@example.invalid', password: '' } });
      const base = { lojaID: store, userID: user.id, status: 'PAID' as const, deliveryType: 'PICKUP' as const, shippingCost: 0 };
      await prisma.order.create({ data: { ...base, subtotal: 100, total: 100, financialTotal: 120, financingCharge: 20,
        financialPlan: { diagnosticFixture: true },
        createdAt: new Date('2026-09-01T12:00:00Z'), paidAt: new Date('2026-10-16T12:00:00Z') } });
      await prisma.order.create({ data: { ...base, subtotal: 50, total: 50, createdAt: new Date('2026-10-16T13:00:00Z'), paidAt: null } });
      await prisma.order.create({ data: { ...base, subtotal: 70, total: 70, createdAt: new Date('2026-09-01T12:00:00Z'), paidAt: new Date('2026-09-02T12:00:00Z') } });
      const d = await dashboard(store);
      expect(d.financial.today.recognizedGross).toBe(0);
      expect(d.financial.month.recognizedGross).toBe(0);
      expect(d.financial.unverifiedOrders).toBe(3);
      expect(d.financial.allTime.netRecognized).toBe(0);
      expect(d.financial.totalOrdersCount).toBe(3); // Other tenant's 24 orders excluded.
      report.periods = { synthetic: true, today: 0, month: 0, total: 0,
        unverifiedOrders: 3,
        observations: 'No facts: paid status, paidAt, createdAt and financing snapshots alone do not establish recognition or settlement.' };
    } finally { vi.useRealTimers(); }
  });

  it('compares paid, requested refund and confirmed refund using the real manual lifecycle', async () => {
    const f = await createFulfillmentFixture();
    const order = await f.order('PICKUP');
    const before = await dashboard(f.lojaID);
    await manualRefund({ lojaID: f.lojaID, userId: f.admin.id, orderId: order.id, expectedVersion: 1, commandId: randomUUID(), action: 'REQUEST_REFUND' });
    const pending = await dashboard(f.lojaID);
    await manualRefund({ lojaID: f.lojaID, userId: f.admin.id, orderId: order.id, expectedVersion: 1, commandId: randomUUID(), action: 'CONFIRM_REFUND', bankReference: 'clone-indicator-audit' });
    const after = await dashboard(f.lojaID);
    const customers = await prisma.$transaction(tx => readCustomerFinancialSummaries(tx, f.lojaID, [f.customer.id]));
    const summary = customers.get(f.customer.id)!;
    expect(before.financial.allTime.netRecognized).toBe(100);
    expect(pending.financial.allTime.netRecognized).toBe(100);
    expect(after.financial.allTime.netRecognized).toBe(0);
    expect(after.financial.cancelledUnpaidOrderValue).toBe(0);
    expect(summary.totalSpent).toBe(0); expect(summary.confirmedRefunds).toBe(100);
    report.refund = { synthetic: true, dashboardBefore: 100, dashboardWhileRequested: 100,
      dashboardAfter: 0, cancelledUnpaidOrderValueAfter: 0, customerRecognizedGross: summary.recognizedGross,
      customerConfirmedRefunds: summary.confirmedRefunds, customerNet: summary.totalSpent,
      observations: 'Confirmed refunds retain gross and settlement history; net recognition decreases, unpaid cancellation value stays zero.' };
  });
});
