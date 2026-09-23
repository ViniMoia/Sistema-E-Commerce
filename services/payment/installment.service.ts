import { getPaymentConfig, type PaymentConfig } from '@/lib/config/payment.config';

export interface InstallmentOption {
  count: number;
  installmentValue: number;
  totalWithInterest: number;
  hasInterest: boolean;
  label: string;
}

/**
 * Calcula uma única opção de parcelamento para um determinado número de parcelas.
 */
export function calculateSingleInstallment(
  total: number,
  count: number,
  customConfig?: Partial<PaymentConfig>
): { installmentValue: number; totalWithInterest: number; hasInterest: boolean } {
  const config = { ...getPaymentConfig(), ...customConfig };

  if (count <= 1) {
    return {
      installmentValue: total,
      totalWithInterest: total,
      hasInterest: false,
    };
  }

  if (config.installmentAbsorbFees) {
    // Modo "Sem Juros": divide o valor diretamente
    const rawVal = Math.round((total / count) * 100) / 100;
    return {
      installmentValue: rawVal,
      totalWithInterest: total,
      hasInterest: false,
    };
  }

  // Modo com repasse de juros (Tabela Price padrão bancário)
  const i = config.installmentMonthlyRate;
  const factor = Math.pow(1 + i, count);
  const pmt = total * ((i * factor) / (factor - 1));
  const installmentValue = Math.round(pmt * 100) / 100;
  const totalWithInterest = Math.round(installmentValue * count * 100) / 100;

  return {
    installmentValue,
    totalWithInterest,
    hasInterest: true,
  };
}

/**
 * Gera todas as opções de parcelamento permitidas para o valor total da compra,
 * respeitando o valor mínimo da parcela (R$ 20,00 padrão) e o limite de parcelas.
 */
export function calculateInstallmentOptions(
  total: number,
  customConfig?: Partial<PaymentConfig>
): InstallmentOption[] {
  const config = { ...getPaymentConfig(), ...customConfig };

  if (total <= 0) {
    return [];
  }

  // maxParcelasPermitidas = min(12, max(1, floor(total / minValue)))
  const allowedMax = Math.min(
    config.installmentMaxCount,
    Math.max(1, Math.floor(total / config.installmentMinValue))
  );

  const options: InstallmentOption[] = [];

  for (let count = 1; count <= allowedMax; count++) {
    const { installmentValue, totalWithInterest, hasInterest } = calculateSingleInstallment(
      total,
      count,
      config
    );

    const formattedInstallment = installmentValue.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

    const formattedTotal = totalWithInterest.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

    let label: string;
    if (count === 1) {
      label = `1x de ${formattedInstallment} à vista`;
    } else if (!hasInterest) {
      label = `${count}x de ${formattedInstallment} sem juros`;
    } else {
      label = `${count}x de ${formattedInstallment} com juros (${formattedTotal})`;
    }

    options.push({
      count,
      installmentValue,
      totalWithInterest,
      hasInterest,
      label,
    });
  }

  return options;
}
