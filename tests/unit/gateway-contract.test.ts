import { describe, expect, it } from 'vitest';
import { verifyRemotePayment, verifyInstallmentContract } from '@/services/payment/gateway-contract';

const expected = { orderId: 'order-fixture', method: 'PIX', value: 24.95 };
const payment = { id: 'pay-fixture', externalReference: expected.orderId, billingType: 'PIX', value: 24.95, status: 'PENDING' };

describe('Asaas single-charge and installment contracts', () => {
  it.each([
    {}, { installmentNumber: null }, { installment: null }, { installment: null, installmentNumber: null },
  ])('accepts absent or null installment metadata on a single PIX: %j', metadata => {
    expect(verifyRemotePayment({ ...payment, ...metadata }, expected)).toMatchObject(payment);
  });

  it.each([
    { externalReference: 'another-order' }, { billingType: 'BOLETO' }, { value: 24.94 },
    { installmentNumber: 0 }, { installmentNumber: '1' }, { installment: {} },
  ])('still rejects invalid or conflicting payment data: %j', conflict => {
    expect(() => verifyRemotePayment({ ...payment, installmentNumber: null, ...conflict }, expected)).toThrow();
  });

  it.each([{ installment: null }, { installmentNumber: null }])('does not accept missing installment proof: %j', metadata => {
    const contract = { ...payment, billingType: 'CREDIT_CARD', installment: 'contract-fixture', installmentNumber: 1, ...metadata };
    expect(() => verifyInstallmentContract([contract], { orderId: expected.orderId, contractId: 'contract-fixture', value: 24.95, count: 1 })).toThrow();
  });
});
