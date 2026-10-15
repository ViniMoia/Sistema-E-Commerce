import { afterEach, describe, expect, it, vi } from 'vitest';
import { AsaasClient, asaasClient } from '@/services/asaas/asaas.client';
import { AsaasPaymentAdapter } from '@/services/asaas/asaas.adapter';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Asaas full installment refund transport', () => {
  it('sends one contract POST with no partial value, preserving charge refund transport', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new AsaasClient('https://api-sandbox.asaas.com/v3', 'fixture-key');
    await client.refundInstallment('contract/fixture');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('https://api-sandbox.asaas.com/v3/installments/contract%2Ffixture/refund',
      expect.objectContaining({ method: 'POST', body: '{}' }));
    await client.refundPayment('single', 57.2);
    expect(fetchMock).toHaveBeenLastCalledWith('https://api-sandbox.asaas.com/v3/payments/single/refund',
      expect.objectContaining({ method: 'POST', body: '{"value":57.2}' }));
  });
  it.each([400, 500])('does not retry HTTP %s or hide an unresolved refund', async status => {
    const fetchMock = vi.fn(async () => new Response('{}', { status }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(new AsaasClient('https://api-sandbox.asaas.com/v3', 'fixture-key').refundInstallment('contract')).rejects.toThrow('PAYMENT_REFUND_UNRESOLVED');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('does not retry a lost response', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('connection lost'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(new AsaasClient('https://api-sandbox.asaas.com/v3', 'fixture-key').refundInstallment('contract')).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('adapter delegates the contract ID without falling back to a charge refund', async () => {
    const contract = vi.spyOn(asaasClient, 'refundInstallment').mockResolvedValue();
    const charge = vi.spyOn(asaasClient, 'refundPayment').mockResolvedValue();
    await new AsaasPaymentAdapter().refundInstallment('contract');
    expect(contract).toHaveBeenCalledExactlyOnceWith('contract'); expect(charge).not.toHaveBeenCalled();
  });
});
