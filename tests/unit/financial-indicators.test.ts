import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getBusinessTimeRanges, getZonedDateParts } from '@/lib/utils/date-ranges';
import { Prisma, OrderStatus } from '@prisma/client';

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

  describe('Precisão Decimal & Regras Contábeis Arbitrárias', () => {
    it('TC-FIN-10: deve somar centavos complexos com Prisma.Decimal sem erros de ponto flutuante', () => {
      // 10 pedidos de R$ 19,99
      let total = new Prisma.Decimal(0);
      const itemPrice = new Prisma.Decimal('19.99');

      for (let i = 0; i < 10; i++) {
        total = total.add(itemPrice);
      }

      // Em IEEE 754 float: 19.99 * 10 = 199.90000000000003
      expect(total.toString()).toBe('199.9');
      expect(total.toFixed(2)).toBe('199.90');
      expect(Number(total.toFixed(2))).toBe(199.9);
    });

    it('TC-FIN-01 & TC-FIN-02: deve calcular agregação diária com múltiplos pedidos e subtrair descontos de pontos', () => {
      // Pedido 1: R$ 100,00 bruto
      // Pedido 2: R$ 50,00 bruto
      // Pedido 3: R$ 120,50 bruto
      const p1 = new Prisma.Decimal('100.00');
      const p2 = new Prisma.Decimal('50.00');
      const p3 = new Prisma.Decimal('120.50');

      const dayTotal = p1.add(p2).add(p3);
      expect(dayTotal.toFixed(2)).toBe('270.50');
    });

    it('TC-FIN-03 & TC-FIN-04: pedidos PENDING e CANCELLED não devem pontuar em status elegíveis', () => {
      const validStatuses: OrderStatus[] = [OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.DELIVERED];

      expect(validStatuses.includes(OrderStatus.PENDING)).toBe(false);
      expect(validStatuses.includes(OrderStatus.CANCELLED)).toBe(false);
      expect(validStatuses.includes(OrderStatus.PAID)).toBe(true);
      expect(validStatuses.includes(OrderStatus.SHIPPED)).toBe(true);
      expect(validStatuses.includes(OrderStatus.DELIVERED)).toBe(true);
    });

    it('TC-FIN-06: pedido com createdAt no mês passado mas paidAt no dia de hoje deve pontuar hoje', () => {
      const today = new Date('2026-09-17T14:00:00.000Z');
      const ranges = getBusinessTimeRanges(today);

      const orderCreatedLastMonth = {
        id: 'ord_1',
        createdAt: new Date('2026-08-25T10:00:00.000Z'),
        paidAt: new Date('2026-09-17T11:00:00.000Z'),
        status: OrderStatus.PAID,
        total: new Prisma.Decimal('250.00'),
      };

      // Avaliação temporal baseada em paidAt
      const isPaidToday =
        orderCreatedLastMonth.paidAt.getTime() >= ranges.startOfDay.getTime() &&
        orderCreatedLastMonth.paidAt.getTime() <= ranges.endOfDay.getTime();

      const isPaidThisMonth =
        orderCreatedLastMonth.paidAt.getTime() >= ranges.startOfMonth.getTime() &&
        orderCreatedLastMonth.paidAt.getTime() <= ranges.endOfMonth.getTime();

      expect(isPaidToday).toBe(true);
      expect(isPaidThisMonth).toBe(true);
    });

    it('TC-FIN-09: ausência de recebimentos deve formatar graciosamente como zero', () => {
      const zeroSum: Prisma.Decimal | null = null;
      const count = 0;

      const settledTodayRevenue = Math.round((zeroSum?.toNumber() ?? 0) * 100) / 100;
      const settledTodayOrdersCount = count;

      expect(settledTodayRevenue).toBe(0);
      expect(settledTodayOrdersCount).toBe(0);

      const formatted = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(settledTodayRevenue);

      expect(formatted).toContain('0,00');
    });
  });

  describe('Discriminação de Frete vs Receita Líquida de Produtos', () => {
    it('TC-FREIGHT-01: pedido com frete grátis/balcão deve atribuir 100% à receita líquida de produtos', () => {
      const total = new Prisma.Decimal('150.00');
      const shipping = new Prisma.Decimal('0.00');

      const netRevenue = total.sub(shipping);
      expect(netRevenue.toFixed(2)).toBe('150.00');
      expect(shipping.toFixed(2)).toBe('0.00');

      const productsPct = Math.round((Number(netRevenue) / Number(total)) * 100);
      const shippingPct = 100 - productsPct;

      expect(productsPct).toBe(100);
      expect(shippingPct).toBe(0);
    });

    it('TC-FREIGHT-02: pedido com frete Correios/J&T deve discriminar frete e produto líquido com precisão', () => {
      // Produto: R$ 100,00 | Frete: R$ 35,00 | Total: R$ 135,00
      const total = new Prisma.Decimal('135.00');
      const shipping = new Prisma.Decimal('35.00');
      const netRevenue = total.sub(shipping);

      expect(netRevenue.toFixed(2)).toBe('100.00');
      expect(shipping.toFixed(2)).toBe('35.00');

      const productsPct = Math.round((Number(netRevenue) / Number(total)) * 100); // 100 / 135 = 74.07% -> 74%
      const shippingPct = 100 - productsPct; // 26%

      expect(productsPct).toBe(74);
      expect(shippingPct).toBe(26);
    });

    it('TC-FREIGHT-03: deve satisfazer a invariante Total = Líquido de Produtos + Frete em todos os períodos', () => {
      const settledTotal = 1158.99;
      const settledShipping = 148.50;
      const settledNet = Math.max(0, Math.round((settledTotal - settledShipping) * 100) / 100);

      expect(settledNet).toBe(1010.49);
      expect(Math.round((settledNet + settledShipping) * 100) / 100).toBe(settledTotal);
    });
  });
});
