/**
 * ============================================================================
 * UTILITÁRIO DE HORIZONTES TEMPORAIS FINANCEIROS (America/Sao_Paulo)
 * ============================================================================
 * Responsável por calcular os limites exatos de dia, mês e períodos de fechamento
 * contábil no fuso horário oficial de Brasília (America/Sao_Paulo).
 *
 * Garante que transações ocorridas entre 21h00 e 23h59 (horário de Brasília) não
 * sejam deslocadas para o dia seguinte no banco de dados (que armazena em UTC).
 * ============================================================================
 */

export const BUSINESS_TIMEZONE = 'America/Sao_Paulo';

export interface BusinessTimeRanges {
  /** Início do dia civil corrente em São Paulo (convertido para UTC) */
  startOfDay: Date;
  /** Fim do dia civil corrente em São Paulo (convertido para UTC) */
  endOfDay: Date;
  /** Início do mês civil corrente em São Paulo (convertido para UTC) */
  startOfMonth: Date;
  /** Fim do mês civil corrente em São Paulo (convertido para UTC) */
  endOfMonth: Date;
  /** Instante de referência considerado */
  referenceInstant: Date;
  /** String da data civil formatada (YYYY-MM-DD) */
  dateStringSP: string;
}

/**
 * Obtém os componentes de data civil (ano, mês 1-indexed, dia) no fuso de Brasília
 */
export function getZonedDateParts(date = new Date(), timeZone = BUSINESS_TIMEZONE): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const partMap: Record<string, number> = {};

  for (const part of parts) {
    if (part.type !== 'literal') {
      partMap[part.type] = parseInt(part.value, 10);
    }
  }

  return {
    year: partMap.year,
    month: partMap.month, // 1-12
    day: partMap.day,     // 1-31
    hour: partMap.hour === 24 ? 0 : partMap.hour,
    minute: partMap.minute,
    second: partMap.second,
  };
}

/**
 * Retorna os intervalos exatos de início e fim do dia e do mês civil
 * convertidos para instantes de comparação UTC.
 */
export function getBusinessTimeRanges(referenceDate = new Date()): BusinessTimeRanges {
  const parts = getZonedDateParts(referenceDate);

  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStringSP = `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;

  // No fuso de Brasília (UTC-3), 00:00:00 corresponde a 03:00:00 UTC do mesmo dia civil
  // e 23:59:59.999 corresponde a 02:59:59.999 UTC do dia civil seguinte.
  const startOfDay = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 3, 0, 0, 0));
  const endOfDay = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1, 2, 59, 59, 999));

  // Início do mês: dia 1 às 00:00:00 SP -> 03:00:00 UTC
  const startOfMonth = new Date(Date.UTC(parts.year, parts.month - 1, 1, 3, 0, 0, 0));

  // Fim do mês: último dia às 23:59:59.999 SP (mês seguinte dia 1 às 02:59:59.999 UTC)
  const endOfMonth = new Date(Date.UTC(parts.year, parts.month, 1, 2, 59, 59, 999));

  return {
    startOfDay,
    endOfDay,
    startOfMonth,
    endOfMonth,
    referenceInstant: referenceDate,
    dateStringSP,
  };
}
