import { describe, it, expect } from 'vitest';
import {
  calculateInstallmentOptions,
  calculateSingleInstallment,
} from '@/services/payment/installment.service';
import { calculateBusinessDueDate } from '@/services/payment/due-date.service';

describe('Motor de Parcelamento & Vencimento (Continental E-Commerce)', () => {
  describe('Cálculo de Parcelas com Repasse de Taxas (Padrão Homologado)', () => {
    it('deve respeitar rigorosamente o piso de R$ 20,00 por parcela', () => {
      // Compra de R$ 50,00: max permitido = floor(50 / 20) = 2 parcelas
      const options50 = calculateInstallmentOptions(50.0);
      expect(options50.length).toBe(2);
      expect(options50[0].count).toBe(1);
      expect(options50[1].count).toBe(2);

      // Compra de R$ 39,90: max permitido = floor(39.90 / 20) = 1 parcela
      const options39 = calculateInstallmentOptions(39.9);
      expect(options39.length).toBe(1);
      expect(options39[0].count).toBe(1);

      // Compra de R$ 100,00: max permitido = floor(100 / 20) = 5 parcelas
      const options100 = calculateInstallmentOptions(100.0);
      expect(options100.length).toBe(5);
      expect(options100[4].count).toBe(5);

      // Compra de R$ 300,00: limitado ao teto de 12 parcelas
      const options300 = calculateInstallmentOptions(300.0);
      expect(options300.length).toBe(12);
    });

    it('deve aplicar repasse de juros nas parcelas a partir de 2x quando installmentAbsorbFees for false', () => {
      const options = calculateInstallmentOptions(100.0, {
        installmentAbsorbFees: false,
        installmentMonthlyRate: 0.0299,
        installmentMinValue: 20.0,
      });

      // 1x é sempre sem juros
      expect(options[0].count).toBe(1);
      expect(options[0].hasInterest).toBe(false);
      expect(options[0].totalWithInterest).toBe(100.0);
      expect(options[0].label).toContain('à vista');

      // 2x tem juros e o total deve ser maior que R$ 100,00
      expect(options[1].count).toBe(2);
      expect(options[1].hasInterest).toBe(true);
      expect(options[1].totalWithInterest).toBeGreaterThan(100.0);
      expect(options[1].label).toContain('com juros');
    });

    it('deve calcular corretamente no modo "sem juros" quando configurado com installmentAbsorbFees true', () => {
      const options = calculateInstallmentOptions(120.0, {
        installmentAbsorbFees: true,
        installmentMinValue: 20.0,
        installmentMaxCount: 6,
      });

      expect(options.length).toBe(6);
      options.forEach((opt) => {
        expect(opt.hasInterest).toBe(false);
        expect(opt.totalWithInterest).toBe(120.0);
        if (opt.count > 1) {
          expect(opt.label).toContain('sem juros');
        }
      });
      // 6x de R$ 20,00
      expect(options[5].installmentValue).toBe(20.0);
    });

    it('deve retornar array vazio se o total for zero ou negativo', () => {
      expect(calculateInstallmentOptions(0)).toEqual([]);
      expect(calculateInstallmentOptions(-50)).toEqual([]);
    });

    it('deve calcular parcela única corretamente', () => {
      const single1x = calculateSingleInstallment(150.0, 1);
      expect(single1x.installmentValue).toBe(150.0);
      expect(single1x.hasInterest).toBe(false);

      const single3x = calculateSingleInstallment(150.0, 3, { installmentAbsorbFees: false });
      expect(single3x.hasInterest).toBe(true);
      expect(single3x.totalWithInterest).toBeGreaterThan(150.0);
    });
  });

  describe('Cálculo de Vencimento D+1 em Dias Úteis (Boleto Bancário)', () => {
    it('deve calcular D+1 para Segunda-feira -> Terça-feira', () => {
      // 2026-09-21 foi Segunda-feira
      const monday = new Date(2026, 8, 21, 10, 0, 0); // Month is 0-indexed: 8 = Setembro
      const { dueDateString } = calculateBusinessDueDate(1, monday);
      expect(dueDateString).toBe('2026-09-22');
    });

    it('deve calcular D+1 para Sexta-feira -> Segunda-feira seguinte', () => {
      // 2026-09-25 foi Sexta-feira
      const friday = new Date(2026, 8, 25, 14, 0, 0);
      const { dueDateString } = calculateBusinessDueDate(1, friday);
      expect(dueDateString).toBe('2026-09-28');
    });

    it('deve calcular D+1 para Sábado -> Terça-feira subsequente', () => {
      // 2026-09-26 foi Sábado
      const saturday = new Date(2026, 8, 26, 12, 0, 0);
      const { dueDateString } = calculateBusinessDueDate(1, saturday);
      expect(dueDateString).toBe('2026-09-29');
    });

    it('deve calcular D+1 para Domingo -> Terça-feira subsequente', () => {
      // 2026-09-27 foi Domingo
      const sunday = new Date(2026, 8, 27, 16, 0, 0);
      const { dueDateString } = calculateBusinessDueDate(1, sunday);
      expect(dueDateString).toBe('2026-09-29');
    });
  });
});
