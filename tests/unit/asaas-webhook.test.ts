import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '@/app/api/webhooks/asaas/route';
import prisma from '@/lib/prisma';
vi.mock('@/lib/prisma', () => ({ default: { $transaction: vi.fn((work) => work(prisma)), paymentInbox: { upsert: vi.fn() } } }));
const payload = { id: 'evt-fixture', event: 'PAYMENT_RECEIVED', payment: { id: 'pay-fixture', externalReference: 'order-fixture', billingType: 'PIX', value: 100, status: 'RECEIVED' } };
const request = (body: unknown = payload, token = 'fixture-token') => new Request('http://localhost/api/webhooks/asaas', { method: 'POST',
  headers: { 'asaas-access-token': token }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('ASAAS_WEBHOOK_TOKEN', 'fixture-token'); vi.stubEnv('PAYMENT_WORKER_ENABLED', 'true'); vi.stubEnv('ASAAS_ACCOUNT_SCOPE', 'primary');
  vi.mocked(prisma.paymentInbox.upsert).mockImplementation((args => Promise.resolve({ id: 'inbox-fixture', status: 'READY', ...args.create })) as unknown as typeof prisma.paymentInbox.upsert);
});
afterEach(() => vi.unstubAllEnvs());
describe('WF-14 webhook transport acknowledges durable receipt, never assumes application', () => {
  it('missing security configuration fails closed', async () => { vi.stubEnv('ASAAS_WEBHOOK_TOKEN', ''); expect((await POST(request())).status).toBe(503); });
  it('missing token is denied', async () => { expect((await POST(request(payload, ''))).status).toBe(401); });
  it('forged token of equal length is denied', async () => { expect((await POST(request(payload, 'fixture-tokex'))).status).toBe(401); });
  it('disabled consumer cannot accept asynchronous events', async () => { vi.stubEnv('PAYMENT_WORKER_ENABLED', 'false'); expect((await POST(request())).status).toBe(503); expect(prisma.paymentInbox.upsert).not.toHaveBeenCalled(); });
  it('malformed JSON is rejected without persistence', async () => { const req = new Request('http://localhost', { method: 'POST', headers: { 'asaas-access-token': 'fixture-token' }, body: '{' }); expect((await POST(req)).status).toBe(400); });
  it('invalid shape and financial values are rejected', async () => { expect((await POST(request({ ...payload, payment: { ...payload.payment, value: -1 } }))).status).toBe(400); expect((await POST(request({}))).status).toBe(400); });
  it('success means received work, not approved payment', async () => { const response = await POST(request()); expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ received: true, status: 'RECEIVED' }); });
  it('strips extra provider secrets before durable storage', async () => { await POST(request({ ...payload, payment: { ...payload.payment, creditCard: { number: 'NO_PAN', ccv: 'NO_CVV' } } })); expect(JSON.stringify(vi.mocked(prisma.paymentInbox.upsert).mock.calls)).not.toMatch(/NO_PAN|NO_CVV/); });
  it('known completed event can report processed', async () => { vi.mocked(prisma.paymentInbox.upsert).mockResolvedValueOnce({ status: 'COMPLETED', payload } as never); expect(await (await POST(request())).json()).toMatchObject({ status: 'PROCESSED' }); });
  it('unknown new provider fields remain compatible', async () => { expect((await POST(request({ ...payload, newProviderAttribute: true }))).status).toBe(200); });
  it('failed durable persistence asks for provider retry', async () => { vi.mocked(prisma.paymentInbox.upsert).mockRejectedValueOnce(new Error('DB failed')); expect((await POST(request())).status).toBe(503); });
  it('same event ID with conflicting content is not acknowledged as a duplicate', async () => { vi.mocked(prisma.paymentInbox.upsert).mockResolvedValueOnce({ status: 'READY', payload: { ...payload, payment: { ...payload.payment, value: 101 } } } as never); expect((await POST(request())).status).toBe(409); });
  it('oversized body is rejected', async () => { expect((await POST(request({ ...payload, huge: 'x'.repeat(256001) }))).status).toBe(413); });
});

