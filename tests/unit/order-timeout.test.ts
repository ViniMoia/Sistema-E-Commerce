import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '@/lib/prisma';
import { processExpiredOrders } from '@/services/order-timeout.service';
import { transitionOrder } from '@/lib/commerce/order-command';
vi.mock('@/lib/prisma', () => ({ default: { $transaction: vi.fn(work => work(prisma)), $queryRaw: vi.fn(),
  paymentAttempt: { findMany: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() }, order: { findUniqueOrThrow: vi.fn() } } }));
vi.mock('@/services/payment/payment-evidence.service', () => ({ paymentNow: async () => new Date('2026-10-05T12:00:00Z') }));
vi.mock('@/lib/commerce/order-command', () => ({ transitionOrder: vi.fn(async () => ({ success: true })) }));
const candidate = { id: 'attempt-fixture', orderId: 'order-fixture', method: 'WHATSAPP_PIX', provider: 'MANUAL', status: 'NOT_STARTED', reservationExpiresAt: new Date(0), order: { id: 'order-fixture', lojaID: 'loja-fixture', status: 'PENDING', version: 3 } };
beforeEach(() => {
  vi.clearAllMocks(); vi.mocked(prisma.$queryRaw).mockResolvedValue([]); vi.mocked(prisma.paymentAttempt.findMany).mockResolvedValue([]);
  vi.mocked(prisma.paymentAttempt.findUniqueOrThrow).mockResolvedValue(candidate as never);
  vi.mocked(prisma.order.findUniqueOrThrow).mockResolvedValue(candidate.order as never);
});
describe('WF-14 method-aware expiration uses persisted deadlines and database clock', () => {
  it('selects persisted expired attempts without generic age/Asaas-ID heuristics', async () => {
    await processExpiredOrders({ now: new Date('2040-01-01'), asaasTimeoutMinutes: 1 });
    const query = vi.mocked(prisma.paymentAttempt.findMany).mock.calls[0][0];
    expect(query?.where).toMatchObject({ reservationExpiresAt: { lte: new Date('2026-10-05T12:00:00Z') }, method: { in: ['WHATSAPP_PIX','PIX','BOLETO'] } });
    expect(JSON.stringify(query)).not.toContain('createdAt');
  });
  it('tenant filter applies to the order relation', async () => { await processExpiredOrders({ lojaID: 'loja-specific' }); expect(vi.mocked(prisma.paymentAttempt.findMany).mock.calls[0][0]?.where?.order).toMatchObject({ lojaID: 'loja-specific' }); });
  it('batch is bounded to 100', async () => { await processExpiredOrders({ batchSize: 1000 }); expect(vi.mocked(prisma.paymentAttempt.findMany).mock.calls[0][0]?.take).toBe(100); });
  it('dry run performs no transition', async () => { vi.mocked(prisma.paymentAttempt.findMany).mockResolvedValue([candidate] as never); const summary = await processExpiredOrders({ dryRun: true }); expect(summary.processedCount).toBe(1); expect(transitionOrder).not.toHaveBeenCalled(); });
  it('manual deadline is rechecked under lock and a paid candidate is preserved', async () => { vi.mocked(prisma.paymentAttempt.findMany).mockResolvedValue([candidate] as never); vi.mocked(prisma.order.findUniqueOrThrow).mockResolvedValue({ ...candidate.order, status: 'PAID' } as never); expect((await processExpiredOrders()).cancelledCount).toBe(0); expect(transitionOrder).not.toHaveBeenCalled(); });
  it('cancel command carries current version, tenant and system actor', async () => { vi.mocked(prisma.paymentAttempt.findMany).mockResolvedValue([candidate] as never); expect((await processExpiredOrders()).cancelledCount).toBe(1); expect(transitionOrder).toHaveBeenCalledWith(expect.objectContaining({ expectedVersion: 3, lojaID: 'loja-fixture', newStatus: 'CANCELLED', actor: { type: 'SYSTEM', code: 'ORDER_TIMEOUT' } }), prisma); });
  it('individual failure is reported without pretending cancellation', async () => { vi.mocked(prisma.paymentAttempt.findMany).mockResolvedValue([candidate] as never); vi.mocked(transitionOrder).mockRejectedValueOnce(new Error('failure')); const result = await processExpiredOrders(); expect(result.success).toBe(false); expect(result.cancelledCount).toBe(0); expect(result.errorCount).toBe(1); });
  it('query failure is reported', async () => { vi.mocked(prisma.paymentAttempt.findMany).mockRejectedValueOnce(new Error('DB unavailable')); expect(await processExpiredOrders()).toMatchObject({ success: false, errorCount: 1, cancelledCount: 0 }); });
});
