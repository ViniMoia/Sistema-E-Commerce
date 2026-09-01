import { describe, it, expect } from 'vitest'
import { Prisma } from '@prisma/client'
import {
  calculatePointsEarned,
  calculateDiscountFromPoints,
  calculateMaxAllowedDiscount,
  SimulateLoyaltyRedeemSchema,
  AdjustLoyaltyBalanceSchema,
  UpdateLoyaltyConfigSchema,
} from '@/services/loyalty.service'

describe('Motor de Fidelidade & Cálculos Contábeis (Loyalty Engine)', () => {
  describe('calculatePointsEarned (Taxa de Acúmulo - Earn Rate)', () => {
    it('deve calcular corretamente 500 pontos para compra de R$ 1.000,00 com earnRate 0.5', () => {
      const points = calculatePointsEarned(1000, 0.5)
      expect(points).toBe(500)
    })

    it('deve truncar (Math.floor) valores fracionados de pontos', () => {
      // R$ 99,90 * 0.5 = 49.95 -> 49 pontos
      const points = calculatePointsEarned(99.9, 0.5)
      expect(points).toBe(49)
    })

    it('deve suportar valores passados como Prisma.Decimal', () => {
      const subtotal = new Prisma.Decimal('250.75')
      const earnRate = new Prisma.Decimal('0.5')
      const points = calculatePointsEarned(subtotal, earnRate)
      // 250.75 * 0.5 = 125.375 -> 125 pontos
      expect(points).toBe(125)
    })

    it('deve retornar 0 para valores nulos, negativos ou zerados', () => {
      expect(calculatePointsEarned(0, 0.5)).toBe(0)
      expect(calculatePointsEarned(-100, 0.5)).toBe(0)
      expect(calculatePointsEarned(1000, 0)).toBe(0)
    })
  })

  describe('calculateDiscountFromPoints (Taxa de Resgate - Burn Rate)', () => {
    it('deve calcular R$ 25,00 para 500 pontos com pointValue R$ 0,05', () => {
      const discount = calculateDiscountFromPoints(500, 0.05)
      expect(discount).toBe(25)
    })

    it('deve calcular com precisão de duas casas decimais', () => {
      // 137 pontos * 0.05 = 6.85
      const discount = calculateDiscountFromPoints(137, 0.05)
      expect(discount).toBe(6.85)
    })

    it('deve suportar Prisma.Decimal no pointValue', () => {
      const pointValue = new Prisma.Decimal('0.0500')
      const discount = calculateDiscountFromPoints(200, pointValue)
      expect(discount).toBe(10)
    })

    it('deve retornar 0 para pontos zerados ou negativos', () => {
      expect(calculateDiscountFromPoints(0, 0.05)).toBe(0)
      expect(calculateDiscountFromPoints(-50, 0.05)).toBe(0)
    })
  })

  describe('calculateMaxAllowedDiscount (Teto Percentual de Desconto)', () => {
    it('deve calcular teto de 50% em um carrinho de R$ 1.000,00 como R$ 500,00', () => {
      const maxDiscount = calculateMaxAllowedDiscount(1000, 50)
      expect(maxDiscount).toBe(500)
    })

    it('deve limitar no máximo em 100%', () => {
      const maxDiscount = calculateMaxAllowedDiscount(100, 150)
      expect(maxDiscount).toBe(100)
    })

    it('deve retornar 0 se subtotal ou percentual forem zerados', () => {
      expect(calculateMaxAllowedDiscount(0, 50)).toBe(0)
      expect(calculateMaxAllowedDiscount(500, 0)).toBe(0)
    })
  })

  describe('Validações Zod de Fidelidade', () => {
    it('deve validar schema de simulação de resgate com sucesso', () => {
      const valid = SimulateLoyaltyRedeemSchema.safeParse({
        lojaID: 'loja-123',
        subtotal: 150.0,
        requestedPoints: 200,
      })
      expect(valid.success).toBe(true)
    })

    it('deve rejeitar simulação com subtotal negativo ou zero', () => {
      const invalid = SimulateLoyaltyRedeemSchema.safeParse({
        lojaID: 'loja-123',
        subtotal: -10,
        requestedPoints: 200,
      })
      expect(invalid.success).toBe(false)
    })

    it('deve rejeitar ajuste administrativo com pontos iguais a zero', () => {
      const invalid = AdjustLoyaltyBalanceSchema.safeParse({
        lojaID: 'loja-123',
        userID: 'user-123',
        points: 0,
        description: 'Ajuste nulo',
        adminUserId: 'admin-123',
      })
      expect(invalid.success).toBe(false)
    })

    it('deve aceitar ajuste administrativo com pontos positivos ou negativos', () => {
      const credit = AdjustLoyaltyBalanceSchema.safeParse({
        lojaID: 'loja-123',
        userID: 'user-123',
        points: 500,
        description: 'Bônus de fidelidade',
        adminUserId: 'admin-123',
      })
      expect(credit.success).toBe(true)

      const debit = AdjustLoyaltyBalanceSchema.safeParse({
        lojaID: 'loja-123',
        userID: 'user-123',
        points: -100,
        description: 'Correção de lançamento duplicado',
        adminUserId: 'admin-123',
      })
      expect(debit.success).toBe(true)
    })

    it('deve validar configurações do programa de pontos', () => {
      const valid = UpdateLoyaltyConfigSchema.safeParse({
        loyaltyEnabled: true,
        loyaltyEarnRate: 0.5,
        loyaltyPointValue: 0.05,
        loyaltyMinPointsRedeem: 100,
        loyaltyMaxDiscountPct: 50.0,
        loyaltyPointsExpiryDays: 365,
      })
      expect(valid.success).toBe(true)
    })
  })
})
