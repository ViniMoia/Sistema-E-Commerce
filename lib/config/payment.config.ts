import { z } from 'zod';
export const paymentConfigSchema = z.object({
  installmentAbsorbFees: z.boolean(), installmentMinValue: z.number().finite().positive().refine(value => /^\d+(\.\d{1,2})?$/.test(String(value)), 'Whole cents required'),
  installmentMaxCount: z.number().int().min(1).max(12), installmentMonthlyRate: z.number().finite().min(0).max(1).refine(value => /^([01]|0\.\d{1,6})$/.test(String(value)), 'At most six decimal places required'),
  boletoDueDays: z.number().int().min(1).max(30), asaasMinValue: z.number().finite().min(5).refine(value => /^\d+(\.\d{1,2})?$/.test(String(value)), 'Whole cents required'),
}).strict();
export type PaymentConfig = z.infer<typeof paymentConfigSchema>;
export function getPaymentConfig(): PaymentConfig {
  const flag = process.env.INSTALLMENT_ABSORB_FEES;
  if (flag !== undefined && !['true', 'false'].includes(flag)) throw new Error('PAYMENT_CONFIGURATION_INVALID');
  return paymentConfigSchema.parse({ installmentAbsorbFees: flag === 'true',
    installmentMinValue: Number(process.env.INSTALLMENT_MIN_VALUE ?? '20'),
    installmentMaxCount: Number(process.env.INSTALLMENT_MAX_COUNT ?? '12'),
    installmentMonthlyRate: Number(process.env.INSTALLMENT_MONTHLY_RATE ?? '0.0299'),
    boletoDueDays: Number(process.env.BOLETO_DUE_DAYS ?? '1'), asaasMinValue: Number(process.env.ASAAS_MIN_VALUE ?? '5'),
  });
}
