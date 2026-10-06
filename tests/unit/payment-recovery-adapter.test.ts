import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { AsaasClient, asaasClient } from '@/services/asaas/asaas.client';
import { AsaasPaymentAdapter } from '@/services/asaas/asaas.adapter';
import { paymentAccountScope } from '@/lib/commerce/payment-account';
const payment = { id: 'pay-fixture', externalReference: 'order-fixture', billingType: 'PIX' as const, value: 100, status: 'PENDING' as const,
  dueDate: '2030-10-05', customer: 'cus-fixture', dateCreated: '2026-10-05', netValue: 99 };
const query = { externalReference: 'order-fixture', paymentIds: ['pay-fixture'], method: 'PIX' as const, installments: 1 };
beforeEach(() => { vi.restoreAllMocks(); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });
describe('WF-14 Asaas lookup/transport: controlled responses, no real provider calls', () => {
  it('searches by encoded reference with complete pagination requirement', async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ data: [], hasMore: false })));
    vi.stubGlobal('fetch', fetch); const client = new AsaasClient('https://api-sandbox.asaas.com/v3', 'fixture');
    expect(await client.listPaymentsByReference('order&second=true')).toEqual([]);
    expect(fetch.mock.calls[0][0]).toContain('externalReference=order%26second%3Dtrue');
  });
  it('incomplete pagination never produces an authoritative partial contract', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [payment], hasMore: true }))));
    await expect(new AsaasClient('https://api-sandbox.asaas.com/v3', 'fixture').listPaymentsByReference('order')).rejects.toThrow('PAYMENT_LOOKUP_INCOMPLETE');
  });
  it('body stalls are bounded by the same eight-second deadline', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(async () => ({ status: 200, ok: true, json: () => new Promise(() => {}) })));
    const lookup = new AsaasClient('https://api-sandbox.asaas.com/v3', 'fixture').getPayment('pay-fixture');
    const assertion = expect(lookup).rejects.toThrow('ASAAS_RESPONSE_TIMEOUT');
    await vi.advanceTimersByTimeAsync(8001); await assertion;
  });
  it('known ID omitted from listing is queried independently, including a deleted charge', async () => {
    vi.spyOn(asaasClient, 'listPaymentsByReference').mockResolvedValue([]);
    const lookup = vi.spyOn(asaasClient, 'getPayment').mockResolvedValue({ ...payment, deleted: true });
    expect((await new AsaasPaymentAdapter().inspectAttempt(query)).charges[0].deleted).toBe(true);
    expect(lookup).toHaveBeenCalledWith(payment.id);
  });
  it('404 lookup is uncertainty, never inferred cancellation', async () => {
    vi.spyOn(asaasClient, 'listPaymentsByReference').mockResolvedValue([]);
    vi.spyOn(asaasClient, 'getPayment').mockRejectedValue(new Error('404'));
    await expect(new AsaasPaymentAdapter().inspectAttempt(query)).rejects.toThrow('404');
  });
  it('receipt lookup returning a different payment ID is rejected', async () => {
    vi.spyOn(asaasClient, 'listPaymentsByReference').mockResolvedValue([]);
    vi.spyOn(asaasClient, 'getPayment').mockResolvedValue({ ...payment, id: 'another-payment' });
    await expect(new AsaasPaymentAdapter().inspectAttempt(query)).rejects.toThrow('PAYMENT_CORRELATION_CONFLICT');
  });
  it('QR failure does not recreate an existing PIX', async () => {
    vi.spyOn(asaasClient, 'listPaymentsByReference').mockResolvedValue([payment]);
    vi.spyOn(asaasClient, 'getPixQrCode').mockRejectedValue(new Error('unavailable'));
    const create = vi.spyOn(asaasClient, 'createPayment');
    const result = await new AsaasPaymentAdapter().inspectAttempt(query);
    expect(result.charges).toHaveLength(1); expect(result.charges[0].instructions).toEqual({}); expect(create).not.toHaveBeenCalled();
  });
  it('timezone-free PIX expiry is not interpreted according to machine timezone', async () => {
    vi.spyOn(asaasClient, 'listPaymentsByReference').mockResolvedValue([payment]);
    vi.spyOn(asaasClient, 'getPixQrCode').mockResolvedValue({ payload: 'fixture', encodedImage: 'fixture', expirationDate: '2030-10-05 12:00:00' });
    expect((await new AsaasPaymentAdapter().inspectAttempt(query)).charges[0].instructions?.expiresAt).toBeUndefined();
  });
  it('boleto due date is exclusive end of Brazilian civil day, not midnight UTC', async () => {
    vi.spyOn(asaasClient, 'listPaymentsByReference').mockResolvedValue([{ ...payment, billingType: 'BOLETO', bankSlipUrl: 'https://example.invalid/boleto' }]);
    vi.spyOn(asaasClient, 'getBoletoIdentificationField').mockResolvedValue({ identificationField: 'fixture', barCode: 'fixture' });
    expect((await new AsaasPaymentAdapter().inspectAttempt({ ...query, method: 'BOLETO' })).charges[0].dueAt).toBe('2030-10-06T03:00:00.000Z');
  });
  it('account scope is independent of transport credentials and rejects malformed identifiers', () => {
    vi.stubEnv('ASAAS_ACCOUNT_SCOPE', 'same-account'); expect(paymentAccountScope()).toBe('same-account');
    vi.stubEnv('ASAAS_ACCOUNT_SCOPE', '../another'); expect(paymentAccountScope).toThrow('PAYMENT_ACCOUNT_SCOPE_INVALID');
  });
});
