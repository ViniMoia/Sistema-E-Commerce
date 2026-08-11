interface OrderItemParams {
  name: string
  quantity: number
  price: number
  color?: string
  size?: string
}

interface OrderParams {
  orderNumber: number
  customerName: string
  items: OrderItemParams[]
  deliveryType: string
  address?: {
    street: string
    number: string
    city: string
    state: string
  }
  freightValue: number | null
  total: number
  pixKey: string | null
}

export function buildWhatsAppMessage(order: OrderParams): string {
  const itemsText = order.items
    .map((item) => {
      const details = [item.color, item.size].filter(Boolean).join('/')
      const detailsStr = details ? ` (${details})` : ''
      const subtotal = (item.quantity * item.price).toFixed(2)
      return `- ${item.quantity}x ${item.name}${detailsStr} — R$ ${subtotal}`
    })
    .join('\n')

  let deliveryText = 'Retirada'
  if (order.deliveryType === 'DELIVERY' && order.address) {
    deliveryText = `${order.address.street}, ${order.address.number} - ${order.address.city}/${order.address.state}`
  }

  const freightText =
    order.deliveryType === 'PICKUP'
      ? 'Grátis'
      : order.freightValue !== null && order.freightValue > 0
        ? `R$ ${order.freightValue.toFixed(2)}`
        : 'A calcular / Grátis'

  const messageLines = [
    `🛒 Novo Pedido #${order.orderNumber}`,
    `👤 Cliente: ${order.customerName}`,
    ``,
    `📦 Itens:`,
    itemsText,
    ``,
    `🚚 Entrega: ${deliveryText}`,
    `📦 Frete: ${freightText}`,
    `💰 Total: R$ ${order.total.toFixed(2)}`,
    ``,
    `💳 Pagamento via Pix`,
    `Chave Pix: ${order.pixKey || 'Não informada'}`,
  ]

  return messageLines.join('\n')
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const cleanPhone = phone.replace(/\D/g, '')
  const encodedMessage = encodeURIComponent(message)
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`
}
