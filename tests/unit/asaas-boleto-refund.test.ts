import { afterEach, describe, expect, it, vi } from 'vitest';
import { AsaasClient, asaasClient } from '@/services/asaas/asaas.client';
import { AsaasPaymentAdapter } from '@/services/asaas/asaas.adapter';
import { boletoRefundUrl } from '@/lib/commerce/boleto-refund';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const requestUrl = 'https://sandbox.asaas.com/refund/fixture-private-token';
describe('Boleto refund transport', () => {
  it('uses the specific full refund endpoint exactly once and selects only the payer URL', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ requestUrl, privateDocument: 'discard' })));
    vi.stubGlobal('fetch', fetchMock);
    const result = await new AsaasClient('https://api-sandbox.asaas.com/v3', 'fixture').refundBoleto('payment/id');
    expect(result).toEqual({ requestUrl });
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('https://api-sandbox.asaas.com/v3/payments/payment%2Fid/bankSlip/refund',
      expect.objectContaining({ method: 'POST', body: '{}', redirect: 'error' }));
  });
  it.each([400, 401, 500])('does not retry HTTP %s or return provider error data', async status => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ requestUrl }), { status }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(new AsaasClient('https://api-sandbox.asaas.com/v3', 'fixture').refundBoleto('id')).rejects.toThrow('PAYMENT_BOLETO_REFUND_UNRESOLVED');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each([{}, { requestUrl: 'https://evil.invalid/form' }, { requestUrl: 'https://www.asaas.com/refund/live' }, null])('rejects unusable or wrong-environment links without a second POST: %j', async body => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(body)));
    vi.stubGlobal('fetch', fetchMock);
    await expect(new AsaasClient('https://api-sandbox.asaas.com/v3', 'fixture').refundBoleto('id')).rejects.toThrow('PAYMENT_BOLETO_REFUND_UNRESOLVED');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('does not retry a lost response or fall back to the generic refund', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('lost'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(new AsaasClient('https://api-sandbox.asaas.com/v3', 'fixture').refundBoleto('id')).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const specific = vi.spyOn(asaasClient, 'refundBoleto').mockResolvedValue({ requestUrl });
    const generic = vi.spyOn(asaasClient, 'refundPayment').mockResolvedValue();
    expect(await new AsaasPaymentAdapter().refundBoleto('id')).toEqual({ requestUrl });
    expect(specific).toHaveBeenCalledExactlyOnceWith('id'); expect(generic).not.toHaveBeenCalled();
  });
  it.each(['javascript:alert(1)', 'http://sandbox.asaas.com/form', 'https://sandbox.asaas.com.evil.invalid/form',
    'https://user:password@sandbox.asaas.com/form', 'https://sandbox.asaas.com:444/form', 'https://sandbox.asaas.com/form#secret',
    'https://sandbox.asaas.com\\@evil.invalid/form', 'https://sandbox.asaas.com/'])('rejects unsafe link %s', value => {
    expect(boletoRefundUrl(value, 'SANDBOX')).toBeNull();
  });
  it('separates production links from Sandbox', () => {
    expect(boletoRefundUrl(requestUrl, 'PRODUCTION')).toBeNull();
    expect(boletoRefundUrl('https://www.asaas.com/refund/fixture', 'PRODUCTION')).toBeTruthy();
    expect(boletoRefundUrl(requestUrl, 'INVALID')).toBeNull();
  });
});
