import { getPaymentConfig, paymentConfigSchema, type PaymentConfig } from '@/lib/config/payment.config';
export interface InstallmentOption { count: number; installmentValue: number; totalWithInterest: number; hasInterest: boolean; label: string }
const ZERO = BigInt(0), HUNDRED = BigInt(100);
export function moneyCents(value: number | string): bigint {
  const text = String(value);
  if (!/^(0|[1-9]\d{0,7})(\.\d{1,2})?$/.test(text)) throw new Error('PAYMENT_AMOUNT_INVALID');
  const [whole, decimals = ''] = text.split('.'); return BigInt(whole) * HUNDRED + BigInt(decimals.padEnd(2, '0'));
}
export function centsMoney(cents: bigint): string {
  if (cents < ZERO || cents > BigInt(9999999999)) throw new Error('PAYMENT_AMOUNT_INVALID');
  return String(cents / HUNDRED) + '.' + String(cents % HUNDRED).padStart(2, '0');
}
/** Exact rational Price calculation, HALF_UP PMT. No floating point powers.
 * Asaas totalValue compensates any remaining cents in the LAST installment. */
export function installmentPlan(total: number | string, count: number, customConfig?: Partial<PaymentConfig>) {
  const config = paymentConfigSchema.parse({ ...getPaymentConfig(), ...customConfig }); const principal = moneyCents(total);
  if (!Number.isInteger(count) || count < 1 || count > config.installmentMaxCount || principal <= ZERO) throw new Error('PAYMENT_PLAN_INVALID');
  if (count > 1 && count > Number(principal / moneyCents(config.installmentMinValue))) throw new Error('PAYMENT_PLAN_INVALID');
  let financial = principal;
  if (count > 1 && !config.installmentAbsorbFees && config.installmentMonthlyRate > 0) {
    const rate = String(config.installmentMonthlyRate);
    if (!/^0\.\d{1,6}$|^1$/.test(rate)) throw new Error('PAYMENT_CONFIGURATION_INVALID');
    const fraction = rate === '1' ? { numerator: BigInt(1), base: BigInt(1) } :
      { numerator: BigInt(rate.split('.')[1]), base: BigInt(10) ** BigInt(rate.split('.')[1].length) };
    const power = (fraction.base + fraction.numerator) ** BigInt(count);
    const numerator = principal * fraction.numerator * power;
    const denominator = fraction.base * (power - fraction.base ** BigInt(count));
    const pmt = (numerator * BigInt(2) + denominator) / (denominator * BigInt(2));
    financial = pmt * BigInt(count);
    if (financial < principal) financial = principal;
  }
  const ordinary = financial / BigInt(count);
  if (count > 1 && ordinary < moneyCents(config.installmentMinValue)) throw new Error('PAYMENT_PLAN_INVALID');
  const installments = Array.from({ length: count }, (_, index) => centsMoney(index === count - 1 ? financial - ordinary * BigInt(count - 1) : ordinary));
  return { financialTotal: centsMoney(financial), financingCharge: centsMoney(financial - principal), installments,
    installmentValue: Number(installments[0]), totalWithInterest: Number(centsMoney(financial)), hasInterest: financial > principal };
}
export function calculateSingleInstallment(total: number, count: number, config?: Partial<PaymentConfig>) { return installmentPlan(total, count, config); }
export function calculateInstallmentOptions(total: number, customConfig?: Partial<PaymentConfig>): InstallmentOption[] {
  if (total <= 0) return [];
  const config = paymentConfigSchema.parse({ ...getPaymentConfig(), ...customConfig });
  const options: InstallmentOption[] = [];
  for (let count = 1; count <= config.installmentMaxCount; count++) {
    let plan; try { plan = installmentPlan(total, count, config); } catch (error) {
      if (error instanceof Error && error.message === 'PAYMENT_PLAN_INVALID') continue; throw error;
    }
    const first = plan.installmentValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const totalText = plan.totalWithInterest.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const unequal = plan.installments.some(value => value !== plan.installments[0]);
    options.push({ count, ...plan, label: count === 1 ? '1x de ' + first + ' à vista' :
      unequal ? count + ' parcelas, total ' + totalText + ' (ajuste de centavos na última)' :
      count + 'x de ' + first + (plan.hasInterest ? ' com juros (' + totalText + ')' : ' sem juros') });
  }
  return options;
}
