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
  return {
    installmentAbsorbFees: process.env.INSTALLMENT_ABSORB_FEES === 'true',
    installmentMinValue: parseFloat(process.env.INSTALLMENT_MIN_VALUE || '20.00'),
    installmentMaxCount: parseInt(process.env.INSTALLMENT_MAX_COUNT || '12', 10),
    installmentMonthlyRate: parseFloat(process.env.INSTALLMENT_MONTHLY_RATE || '0.0299'),
    boletoDueDays: parseInt(process.env.BOLETO_DUE_DAYS || '1', 10),
    asaasMinValue: parseFloat(process.env.ASAAS_MIN_VALUE || '5.00'),
  };
}

export const paymentConfig = getPaymentConfig();
