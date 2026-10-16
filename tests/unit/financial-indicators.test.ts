import { describe, it, expect } from 'vitest';
import { getBusinessTimeRanges } from '@/lib/utils/date-ranges';

describe('Indicadores Financeiros — Horizontes Temporais & Precisão Contábil', () => {
  describe('Horizontes Temporais (America/Sao_Paulo)', () => {
    it('deve converter corretamente um instante no meio do dia em São Paulo', () => {
      // 17 de Setembro de 2026 às 12:00:00 no Brasil (15:00:00 UTC)
      const refDate = new Date('2026-09-17T15:00:00.000Z');
      const ranges = getBusinessTimeRanges(refDate);

      expect(ranges.dateStringSP).toBe('2026-09-17');
      // Início do dia SP (00:00:00 SP) = 03:00:00 UTC do dia 17
      expect(ranges.startOfDay.toISOString()).toBe('2026-09-17T03:00:00.000Z');
      // Fim do dia SP (23:59:59.999 SP) = 02:59:59.999 UTC do dia 18
      expect(ranges.endOfDay.toISOString()).toBe('2026-09-18T02:59:59.999Z');
      // Início do mês SP = 01/09 às 03:00:00 UTC
      expect(ranges.startOfMonth.toISOString()).toBe('2026-09-01T03:00:00.000Z');
    });

    it('TC-FIN-08: deve manter uma transação às 23:55 em São Paulo (02:55 UTC do dia seguinte) no dia civil correto', () => {
      // 23:55 do dia 17 em São Paulo = 02:55:00 UTC do dia 18
      const lateNightTx = new Date('2026-09-18T02:55:00.000Z');
      const ranges = getBusinessTimeRanges(lateNightTx);

      // Deve reconhecer como 17 de setembro!
      expect(ranges.dateStringSP).toBe('2026-09-17');
      expect(lateNightTx.getTime()).toBeGreaterThanOrEqual(ranges.startOfDay.getTime());
      expect(lateNightTx.getTime()).toBeLessThanOrEqual(ranges.endOfDay.getTime());
    });

    it('TC-FIN-07: deve isolar virada de mês civil (31 de Agosto vs 01 de Setembro)', () => {
      // 31 de Agosto às 22:00 em SP = 01 de Setembro às 01:00 UTC
      const endOfAugustSP = new Date('2026-09-01T01:00:00.000Z');
      const augustRanges = getBusinessTimeRanges(endOfAugustSP);

      expect(augustRanges.dateStringSP).toBe('2026-08-31');
      expect(augustRanges.startOfMonth.toISOString()).toBe('2026-08-01T03:00:00.000Z');

      // 01 de Setembro às 00:05 em SP = 01 de Setembro às 03:05 UTC
      const startOfSeptemberSP = new Date('2026-09-01T03:05:00.000Z');
      const septRanges = getBusinessTimeRanges(startOfSeptemberSP);

      expect(septRanges.dateStringSP).toBe('2026-09-01');
      expect(septRanges.startOfMonth.toISOString()).toBe('2026-09-01T03:00:00.000Z');

      // Transação de agosto NÃO deve estar dentro do mês de setembro
      expect(endOfAugustSP.getTime()).toBeLessThan(septRanges.startOfMonth.getTime());
    });
  });

  // Financial recognition/refunds are tested against PostgreSQL in dashboard-financial-evidence.test.ts.
});
