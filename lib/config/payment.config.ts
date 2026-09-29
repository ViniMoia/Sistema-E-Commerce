/**
 * Configurações e Parâmetros dos Meios de Pagamento (Continental E-Commerce)
 * Permite parametrização flexível para alternância entre repasse de juros e parcelamento sem juros,
 * valor mínimo de parcela, prazos de vencimento e limites mínimos do gateway Asaas.
 */

export interface PaymentConfig {
  /**
   * Se true, a loja absorve as taxas de parcelamento do cartão oferecendo "sem juros".
   * Se false (padrão inicial homologado), as taxas são repassadas ao comprador na composição das parcelas.
   */
  installmentAbsorbFees: boolean;

  /**
   * Valor monetário mínimo de cada parcela em R$ (padrão homologado: R$ 20,00).
   */
  installmentMinValue: number;

  /**
   * Número máximo de parcelas permitidas no cartão (padrão: 12x).
   */
  installmentMaxCount: number;

  /**
   * Taxa de juros mensal nominal utilizada no cálculo do repasse (ex: 0.0299 para 2.99% a.m.).
   */
  installmentMonthlyRate: number;

  /**
   * Prazo de vencimento do Boleto Bancário em dias úteis (padrão homologado: 1 dia útil).
   */
  boletoDueDays: number;

  /**
   * Piso mínimo de cobrança aceito pela API de pagamentos do Asaas (R$ 5,00).
   */
  asaasMinValue: number;
}

export function getPaymentConfig(): PaymentConfig {
  const numberSetting = (
    name: string,
    fallback: number,
    limits: { min: number; max: number; integer?: boolean }
  ): number => {
    const raw = process.env[name] || String(fallback);
    const value = Number(raw);
    if (
      !Number.isFinite(value) ||
      value < limits.min ||
      value > limits.max ||
      (limits.integer && !Number.isInteger(value))
    ) {
      throw new Error(`Configuração numérica inválida: ${name}`);
    }
    return value;
  };

  return {
    installmentAbsorbFees: process.env.INSTALLMENT_ABSORB_FEES === 'true',
    installmentMinValue: numberSetting('INSTALLMENT_MIN_VALUE', 20, { min: 0.01, max: 100000 }),
    installmentMaxCount: numberSetting('INSTALLMENT_MAX_COUNT', 12, { min: 1, max: 24, integer: true }),
    installmentMonthlyRate: numberSetting('INSTALLMENT_MONTHLY_RATE', 0.0299, { min: 0, max: 1 }),
    boletoDueDays: numberSetting('BOLETO_DUE_DAYS', 1, { min: 1, max: 30, integer: true }),
    asaasMinValue: numberSetting('ASAAS_MIN_VALUE', 5, { min: 0.01, max: 100000 }),
  };
}

export const paymentConfig = getPaymentConfig();
