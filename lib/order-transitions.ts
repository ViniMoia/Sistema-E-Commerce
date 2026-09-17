export type OrderStatus = 'PENDING' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'

export const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['PAID', 'CANCELLED'],
  PAID: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: []
}

export function isValidTransition(
  current: OrderStatus,
  next: OrderStatus,
  deliveryType?: string
): boolean {
  // Retirada presencial (PICKUP) e modalidade sem frete (NONE) podem transicionar direto de PAGO para ENTREGUE
  if (current === 'PAID' && next === 'DELIVERED') {
    return deliveryType === 'PICKUP' || deliveryType === 'NONE'
  }
  return VALID_TRANSITIONS[current].includes(next)
}

