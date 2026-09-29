export type OrderStatus = 'PENDING' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'

export const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['PAID', 'CANCELLED'],
  PAID: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: []
}

export function getValidTransitions(
  current: OrderStatus,
  deliveryType?: string
): OrderStatus[] {
  if (
    current === 'PAID' &&
    (deliveryType === 'PICKUP' || deliveryType === 'NONE')
  ) {
    return ['SHIPPED', 'DELIVERED', 'CANCELLED']
  }
  return VALID_TRANSITIONS[current]
}

export function isValidTransition(
  current: OrderStatus,
  next: OrderStatus,
  deliveryType?: string
): boolean {
  return getValidTransitions(current, deliveryType).includes(next)
}

