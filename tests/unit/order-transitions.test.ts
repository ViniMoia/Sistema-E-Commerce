import { describe, it, expect } from 'vitest'
import { isValidTransition, OrderStatus } from '@/lib/order-transitions'

const getTransitionError = (from: OrderStatus, to: OrderStatus): string | null => {
  if (isValidTransition(from, to)) {
    return null
  }
  
  if (from === 'DELIVERED') {
    return 'Pedido já entregue não pode ter o status alterado.'
  }
  
  if (from === 'CANCELLED') {
    return 'Pedido cancelado não pode ter o status alterado.'
  }
  
  return `Transição inválida de ${from} para ${to}.`
}

describe('isValidTransition', () => {
  it('deve retornar true para PENDING → PAID', () => {
    expect(isValidTransition('PENDING', 'PAID')).toBe(true)
  })

  it('deve retornar true para PENDING → CANCELLED', () => {
    expect(isValidTransition('PENDING', 'CANCELLED')).toBe(true)
  })

  it('deve retornar true para PAID → SHIPPED', () => {
    expect(isValidTransition('PAID', 'SHIPPED')).toBe(true)
  })

  it('deve retornar true para PAID → CANCELLED', () => {
    expect(isValidTransition('PAID', 'CANCELLED')).toBe(true)
  })

  it('deve retornar true para SHIPPED → DELIVERED', () => {
    expect(isValidTransition('SHIPPED', 'DELIVERED')).toBe(true)
  })

  it('deve retornar false para PENDING → SHIPPED', () => {
    expect(isValidTransition('PENDING', 'SHIPPED')).toBe(false)
  })

  it('deve retornar false para PENDING → DELIVERED', () => {
    expect(isValidTransition('PENDING', 'DELIVERED')).toBe(false)
  })

  it('deve retornar false para PAID → PENDING', () => {
    expect(isValidTransition('PAID', 'PENDING')).toBe(false)
  })

  it('deve retornar false para PAID → DELIVERED', () => {
    expect(isValidTransition('PAID', 'DELIVERED')).toBe(false)
  })

  it('deve retornar false para SHIPPED → CANCELLED', () => {
    expect(isValidTransition('SHIPPED', 'CANCELLED')).toBe(false)
  })

  it('deve retornar false para SHIPPED → PENDING', () => {
    expect(isValidTransition('SHIPPED', 'PENDING')).toBe(false)
  })

  it('deve retornar false para DELIVERED como from para todos os statuses', () => {
    expect(isValidTransition('DELIVERED', 'PENDING')).toBe(false)
    expect(isValidTransition('DELIVERED', 'PAID')).toBe(false)
    expect(isValidTransition('DELIVERED', 'SHIPPED')).toBe(false)
    expect(isValidTransition('DELIVERED', 'DELIVERED')).toBe(false)
    expect(isValidTransition('DELIVERED', 'CANCELLED')).toBe(false)
  })

  it('deve retornar false para CANCELLED como from para todos os statuses', () => {
    expect(isValidTransition('CANCELLED', 'PENDING')).toBe(false)
    expect(isValidTransition('CANCELLED', 'PAID')).toBe(false)
    expect(isValidTransition('CANCELLED', 'SHIPPED')).toBe(false)
    expect(isValidTransition('CANCELLED', 'DELIVERED')).toBe(false)
    expect(isValidTransition('CANCELLED', 'CANCELLED')).toBe(false)
  })
})

describe('getTransitionError', () => {
  it('deve retornar null para transições válidas', () => {
    expect(getTransitionError('PENDING', 'PAID')).toBeNull()
    expect(getTransitionError('PENDING', 'CANCELLED')).toBeNull()
    expect(getTransitionError('PAID', 'SHIPPED')).toBeNull()
    expect(getTransitionError('PAID', 'CANCELLED')).toBeNull()
    expect(getTransitionError('SHIPPED', 'DELIVERED')).toBeNull()
  })

  it('deve retornar mensagem em PT-BR para transições inválidas', () => {
    expect(getTransitionError('PENDING', 'SHIPPED')).toContain('Transição inválida')
    expect(getTransitionError('PENDING', 'DELIVERED')).toContain('Transição inválida')
    expect(getTransitionError('PAID', 'PENDING')).toContain('Transição inválida')
    expect(getTransitionError('PAID', 'DELIVERED')).toContain('Transição inválida')
    expect(getTransitionError('SHIPPED', 'CANCELLED')).toContain('Transição inválida')
    expect(getTransitionError('SHIPPED', 'PENDING')).toContain('Transição inválida')
  })

  it('deve mencionar o status atual na mensagem de erro', () => {
    const error = getTransitionError('PENDING', 'SHIPPED')
    expect(error).toContain('PENDING')
  })

  it('deve retornar mensagem específica para DELIVERED como estado final', () => {
    expect(getTransitionError('DELIVERED', 'PENDING')).toBe('Pedido já entregue não pode ter o status alterado.')
    expect(getTransitionError('DELIVERED', 'CANCELLED')).toBe('Pedido já entregue não pode ter o status alterado.')
  })

  it('deve retornar mensagem específica para CANCELLED como estado final', () => {
    expect(getTransitionError('CANCELLED', 'PENDING')).toBe('Pedido cancelado não pode ter o status alterado.')
    expect(getTransitionError('CANCELLED', 'PAID')).toBe('Pedido cancelado não pode ter o status alterado.')
  })
})