import { describe, it, expect } from 'vitest'
import { 
  calculateAverageOrderValue, 
  calculatePreferredDelivery, 
  findMostBoughtProduct, 
  calculateCancelledOrders 
} from '@/lib/utils/customer-metrics'

describe('calculateAverageOrderValue', () => {
  it('deve retornar 0 quando o array de pedidos está vazio', () => {
    expect(calculateAverageOrderValue([])).toBe(0)
  })

  it('deve retornar a média correta para um único pedido', () => {
    const orders = [{ total: 100 }]
    expect(calculateAverageOrderValue(orders)).toBe(100)
  })

  it('deve retornar a média correta para múltiplos pedidos', () => {
    const orders = [
      { total: 100 },
      { total: 200 },
      { total: 300 }
    ]
    expect(calculateAverageOrderValue(orders)).toBe(200)
  })

  it('deve ignorar pedidos CANCELLED no cálculo da média', () => {
    const orders = [
      { total: 100, status: 'PENDING' },
      { total: 200, status: 'CANCELLED' },
      { total: 300, status: 'PAID' }
    ]
    expect(calculateAverageOrderValue(orders)).toBe(200)
  })
})

describe('calculatePreferredDelivery', () => {
  it('deve retornar null quando o array de pedidos está vazio', () => {
    expect(calculatePreferredDelivery([])).toBeNull()
  })

  it('deve retornar DELIVERY quando a maioria é DELIVERY', () => {
    const orders = [
      { deliveryType: 'DELIVERY' },
      { deliveryType: 'DELIVERY' },
      { deliveryType: 'PICKUP' }
    ]
    expect(calculatePreferredDelivery(orders)).toBe('DELIVERY')
  })

  it('deve retornar PICKUP quando a maioria é PICKUP', () => {
    const orders = [
      { deliveryType: 'PICKUP' },
      { deliveryType: 'PICKUP' },
      { deliveryType: 'DELIVERY' }
    ]
    expect(calculatePreferredDelivery(orders)).toBe('PICKUP')
  })

  it('deve retornar o mais frequente quando empata (primeiro alfabeticamente)', () => {
    const orders = [
      { deliveryType: 'DELIVERY' },
      { deliveryType: 'PICKUP' }
    ]
    expect(calculatePreferredDelivery(orders)).toBe('DELIVERY')
  })
})

describe('findMostBoughtProduct', () => {
  it('deve retornar null quando não há itens', () => {
    expect(findMostBoughtProduct([])).toBeNull()
  })

  it('deve retornar o produto com maior quantidade total', () => {
    const orders = [
      { items: [{ name: 'Produto A', quantity: 2 }] },
      { items: [{ name: 'Produto B', quantity: 5 }] },
      { items: [{ name: 'Produto A', quantity: 1 }] }
    ]
    expect(findMostBoughtProduct(orders)).toBe('Produto B')
  })

  it('deve lidar com empate corretamente (retorna o primeiro alfabeticamente)', () => {
    const orders = [
      { items: [{ name: 'Zebra', quantity: 3 }] },
      { items: [{ name: 'Maçã', quantity: 3 }] }
    ]
    expect(findMostBoughtProduct(orders)).toBe('Maçã')
  })
})

describe('calculateCancelledOrders', () => {
  it('deve retornar 0 quando não há pedidos cancelados', () => {
    const orders = [
      { status: 'PENDING' },
      { status: 'PAID' },
      { status: 'SHIPPED' }
    ]
    expect(calculateCancelledOrders(orders)).toBe(0)
  })

  it('deve contar apenas pedidos com status CANCELLED', () => {
    const orders = [
      { status: 'PENDING' },
      { status: 'CANCELLED' },
      { status: 'PAID' },
      { status: 'CANCELLED' },
      { status: 'SHIPPED' }
    ]
    expect(calculateCancelledOrders(orders)).toBe(2)
  })

  it('não deve contar PENDING, PAID, SHIPPED, DELIVERED como cancelados', () => {
    const orders = [
      { status: 'PENDING' },
      { status: 'PAID' },
      { status: 'SHIPPED' },
      { status: 'DELIVERED' }
    ]
    expect(calculateCancelledOrders(orders)).toBe(0)
  })
})