interface OrderForMetrics {
  total: number
  deliveryType: string
  status: string
  createdAt: string
  items: Array<{ name: string; quantity: number }>
}

export function calculateAverageOrderValue(orders: OrderForMetrics[]): number {
  if (orders.length === 0) {
    return 0
  }
  const total = orders.reduce((sum, order) => sum + order.total, 0)
  return total / orders.length
}

export function calculatePreferredDelivery(
  orders: OrderForMetrics[]
): 'DELIVERY' | 'PICKUP' | null {
  if (orders.length === 0) {
    return null
  }
  const counts: Record<string, number> = {}
  orders.forEach(order => {
    counts[order.deliveryType] = (counts[order.deliveryType] || 0) + 1
  })
  const entries = Object.entries(counts)
  if (entries.length === 0) {
    return null
  }
  const sorted = entries.sort((a, b) => b[1] - a[1])
  return sorted[0][0] as 'DELIVERY' | 'PICKUP'
}

export function findMostBoughtProduct(orders: OrderForMetrics[]): string | null {
  if (orders.length === 0) {
    return null
  }
  const productCounts: Record<string, number> = {}
  orders.forEach(order => {
    order.items.forEach(item => {
      productCounts[item.name] = (productCounts[item.name] || 0) + item.quantity
    })
  })
  const entries = Object.entries(productCounts)
  if (entries.length === 0) {
    return null
  }
  const sorted = entries.sort((a, b) => b[1] - a[1])
  return sorted[0][0]
}

export function calculateCancelledOrders(orders: OrderForMetrics[]): number {
  return orders.filter(order => order.status === 'CANCELLED').length
}