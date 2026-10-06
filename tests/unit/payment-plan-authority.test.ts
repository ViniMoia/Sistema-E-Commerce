import { describe, it, expect, afterEach, vi } from 'vitest';
import { Prisma, type Loja } from '@prisma/client';
import { installmentPlan, moneyCents, calculateInstallmentOptions } from '@/services/payment/installment.service';
import { getPaymentConfig } from '@/lib/config/payment.config';
import { buildFinancialPlan } from '@/services/payment/financial-plan.service';
import { paymentCapabilities } from '@/services/payment/capabilities.service';
import { exactEarnPoints, freezeEarnPolicy } from '@/lib/commerce/loyalty-earn';
import { verifyInstallmentContract } from '@/services/payment/gateway-contract';
import { AsaasClient } from '@/services/asaas/asaas.client';
import type { PaymentGateway } from '@/types/payment-gateway.types';
const config = { installmentAbsorbFees: false, installmentMonthlyRate: 0, installmentMinValue: 20, installmentMaxCount: 12, boletoDueDays: 1, asaasMinValue: 5 };
const store = { id: 'fixture', configurationVersion: 7, loyaltyEnabled: true, loyaltyEarnRate: new Prisma.Decimal('.5'),
  loyaltyPointValue: new Prisma.Decimal('.05'), loyaltyPointsExpiryDays: 365, enableManualPix: true, pixKey: 'fixture@example.invalid',
  whatsappNumber: '11999999999', enablePix: true, enableBoleto: false, enableCreditCard: true } as Loja;
const plan = (overrides: Partial<Parameters<typeof buildFinancialPlan>[0]> = {}) => buildFinancialPlan({ store, method: 'CREDIT_CARD',
  subtotal: new Prisma.Decimal(100), discount: new Prisma.Decimal(20), freight: new Prisma.Decimal(15), eligible: true,
  count: 3, config, maximumInstallments: 3, acceptedFinancialTotal: 95, ...overrides });
afterEach(() => vi.unstubAllEnvs());
describe('WF-12: exact authoritative amounts and explicit capacity', () => {
  it('distributes zero-interest residual cents in the last installment', () => {
    expect(installmentPlan('100.00', 3, config)).toMatchObject({ financialTotal: '100.00', financingCharge: '0.00', installments: ['33.33', '33.33', '33.34'] });
    expect(installmentPlan('350.00', 12, { ...config, installmentAbsorbFees: true })).toMatchObject({ installments: [...Array(11).fill('29.16'), '29.24'] });
  });
  it('conserves principal, charges and installments for every available interest plan', () => {
    for (const option of calculateInstallmentOptions(1000, { ...config, installmentMonthlyRate: .0299 })) {
      const result = installmentPlan(1000, option.count, { ...config, installmentMonthlyRate: .0299 });
      expect(result.installments.reduce((sum, item) => sum + moneyCents(item), BigInt(0))).toBe(moneyCents(result.financialTotal));
      expect(moneyCents(result.financialTotal) - BigInt(100000)).toBe(moneyCents(result.financingCharge));
    }
  });
  it('absorbed fees do not increase the buyer total', () => expect(installmentPlan(100, 3, { ...config, installmentMonthlyRate: .1, installmentAbsorbFees: true }).financialTotal).toBe('100.00'));
  it('uses the Price rate with HALF_UP installment rounding', () => expect(installmentPlan(100, 3, { ...config, installmentMonthlyRate: .1 })).toMatchObject({
    financialTotal: '120.63', financingCharge: '20.63', installments: ['40.21','40.21','40.21'],
  }));
  it.each([NaN, Infinity, -1, 1.001, '1e2', '001.00'])('rejects invalid monetary boundary %s', value => expect(() => moneyCents(value)).toThrow());
  it('rejects invalid counts and insufficient principal per installment', () => {
    for (const count of [0, 1.5, 13, 3]) expect(() => installmentPlan(39.9, count, config)).toThrow('PAYMENT_PLAN_INVALID');
  });
  it('rejects malformed runtime configuration instead of accepting parseFloat prefixes', () => {
    vi.stubEnv('INSTALLMENT_MONTHLY_RATE', '0.02oops'); expect(() => getPaymentConfig()).toThrow();
    vi.stubEnv('INSTALLMENT_MONTHLY_RATE', '0'); vi.stubEnv('INSTALLMENT_MAX_COUNT', '13'); expect(() => getPaymentConfig()).toThrow();
  });
  it('requires consent for the full financial total, rejects a forged installment', () => {
    expect(() => plan({ acceptedFinancialTotal: undefined })).toThrow('PAYMENT_RECONFIRM_REQUIRED');
    expect(() => plan({ acceptedFinancialTotal: 10 })).toThrow('PAYMENT_RECONFIRM_REQUIRED');
    expect(() => plan({ installmentValue: 1 })).toThrow('PAYMENT_RECONFIRM_REQUIRED');
  });
  it('freezes only net merchandise as earn base, excludes freight and finance', () => {
    expect(plan().plan).toMatchObject({ commercialTotal: '95.00', loyaltyEarnBase: '80.00', pointsEarned: 40 });
    expect(plan().earn).toMatchObject({ base: '80.00', rate: '0.50', expiryDays: 365, configurationVersion: 7 });
  });
  it('floors Decimal arithmetic accurately and refuses invented guest earnings', () => {
    expect(exactEarnPoints('0.29', '100')).toBe(29);
    expect(exactEarnPoints('1.99', '.5')).toBe(0);
    expect(freezeEarnPolicy(store, new Prisma.Decimal(100), false).points).toBe(0);
  });
  it('does not expose remote methods when the gateway is unavailable', async () => {
    const port = { capabilities: async () => ({ configured: false, methods: [], maximumInstallments: 1 }) } as unknown as PaymentGateway;
    expect((await paymentCapabilities(store, port)).methods).toEqual(['WHATSAPP_PIX']);
    expect((await paymentCapabilities({ ...store, enableManualPix: false }, port)).methods).toEqual([]);
    expect((await paymentCapabilities({ ...store, pixKey: null }, port)).methods).toEqual([]);
    expect((await paymentCapabilities({ ...store, whatsappNumber: null }, port)).methods).toEqual([]);
  });
  it('requires store flags even for an explicitly configured injected gateway', async () => {
    const port = { capabilities: async () => ({ configured: true, methods: ['PIX', 'BOLETO', 'CREDIT_CARD'], maximumInstallments: 3 }) } as unknown as PaymentGateway;
    const dto = await paymentCapabilities(store, port);
    expect(dto.methods).toEqual(['WHATSAPP_PIX', 'PIX', 'CREDIT_CARD']);
    expect(JSON.stringify(dto)).not.toContain(store.pixKey!);
    expect(dto.maximumInstallments).toBe(3);
  });
  it('uses the captured actual key, not a later environment mutation', () => {
    const client = new AsaasClient('https://api-sandbox.asaas.com/v3', '');
    vi.stubEnv('ASAAS_API_KEY', '$aact_hml_later_key'); expect(client.configurationReady()).toBe(false);
    expect(new AsaasClient('https://other.example.invalid/v3', '$aact_hml_key').configurationReady()).toBe(false);
    expect(new AsaasClient('https://api-sandbox.asaas.com/v3', '$aact_hml_key').configurationReady()).toBe(true);
    expect(() => new AsaasClient('https://api-sandbox.asaas.com/v3', '$aact_prod_key')).toThrow();
  });
  it('does not approve a contract from only its first charge or repeated IDs', () => {
    const charges = [1,2,3].map(ordinal => ({ id: 'pay' + ordinal, externalReference: 'order', installment: 'contract', installmentNumber: ordinal,
      value: ordinal === 3 ? 33.34 : 33.33, billingType: 'CREDIT_CARD', status: 'PENDING' }));
    const expected = { orderId: 'order', contractId: 'contract', value: 100, count: 3 };
    expect(verifyInstallmentContract(charges, expected)).toHaveLength(3);
    expect(() => verifyInstallmentContract(charges.slice(0,1), expected)).toThrow();
    expect(() => verifyInstallmentContract(charges.map(c => ({ ...c, id: 'same' })), expected)).toThrow();
    expect(() => verifyInstallmentContract(charges.map(c => ({ ...c, value: 1 })), expected)).toThrow();
  });
});
