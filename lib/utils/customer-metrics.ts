export interface OrderForMetrics {
  total?: number
  deliveryType?: string
  status?: string
  createdAt?: string
  items?: Array<{ name: string; quantity: number }>
}

export function calculateAverageOrderValue(orders: OrderForMetrics[]): number {
  if (!orders || orders.length === 0) {
    return 0
  }
  const validOrders = orders.filter(order => order.status !== 'CANCELLED')
  if (validOrders.length === 0) {
    return 0
  }
  const total = validOrders.reduce((sum, order) => sum + (order.total || 0), 0)
  return total / validOrders.length
}

export function calculatePreferredDelivery(
  orders: OrderForMetrics[]
): 'DELIVERY' | 'PICKUP' | null {
  if (!orders || orders.length === 0) {
    return null
  }
  const counts: Record<string, number> = {}
  orders.forEach(order => {
    if (order.deliveryType) {
      counts[order.deliveryType] = (counts[order.deliveryType] || 0) + 1
    }
  })
  const entries = Object.entries(counts)
  if (entries.length === 0) {
    return null
  }
  const sorted = entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  return sorted[0][0] as 'DELIVERY' | 'PICKUP'
}

export function findMostBoughtProduct(orders: OrderForMetrics[]): string | null {
  if (!orders || orders.length === 0) {
    return null
  }
  const productCounts: Record<string, number> = {}
  orders.forEach(order => {
    if (order.items && Array.isArray(order.items)) {
      order.items.forEach(item => {
        productCounts[item.name] = (productCounts[item.name] || 0) + item.quantity
      })
    }
  })
  const entries = Object.entries(productCounts)
  if (entries.length === 0) {
    return null
  }
  const sorted = entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  return sorted[0][0]
}

export function calculateCancelledOrders(orders: OrderForMetrics[]): number {
  if (!orders || orders.length === 0) {
    return 0
  }
  return orders.filter(order => order.status === 'CANCELLED').length
}