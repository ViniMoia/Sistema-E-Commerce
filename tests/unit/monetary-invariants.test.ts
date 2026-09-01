import { describe, it, expect } from 'vitest'
import { Prisma } from '@prisma/client'

describe('Invariantes Monetárias & Aritmética de Precisão Exata (DB-003)', () => {
  it('deve somar valores monetários sem erros de precisão de ponto flutuante', () => {
    // Em JavaScript padrão (Float), 0.1 + 0.2 = 0.30000000000000004
    const item1 = new Prisma.Decimal('0.10')
    const item2 = new Prisma.Decimal('0.20')
    const total = item1.add(item2)

    expect(total.toString()).toBe('0.3')
    expect(total.toFixed(2)).toBe('0.30')
  })

  it('deve calcular subtotais com multiplicação de quantidades com exatidão', () => {
    const unitPrice = new Prisma.Decimal('49.99')
    const quantity = 3
    const subtotal = unitPrice.mul(quantity)

    expect(subtotal.toString()).toBe('149.97')
  })

  it('deve aplicar frete e calcular total final com precisão decimal exata', () => {
    const subtotal = new Prisma.Decimal('149.97')
    const shipping = new Prisma.Decimal('15.50')
    const total = subtotal.add(shipping)

    expect(total.toFixed(2)).toBe('165.47')
  })
})
