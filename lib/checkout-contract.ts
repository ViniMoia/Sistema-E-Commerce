export interface CheckoutContractItem {
  productId: string
  variantId?: string
  name: string
  quantity: number
  price: number
  color?: string
  size?: string
}

export interface CheckoutContractInput {
  lojaID: string
  cartId?: string
  customer: { name: string; email: string; phone: string; cpfCnpj: string }
  items: CheckoutContractItem[]
  deliveryType: 'DELIVERY' | 'PICKUP' | 'NONE'
  address?: {
    state: string
    city: string
    neighborhood: string
    street: string
    number: string
    complement?: string
    cep: string
  }
  selectedFreight?: {
    providerId: string
    serviceName: string
    deliveryTimeInDays: number
    quoteToken?: string
  } | null
  paymentMethod: 'PIX' | 'CREDIT_CARD' | 'BOLETO'
  pointsToRedeem: number
  creditCard?: {
    holderName: string
    number: string
    expiryMonth: string
    expiryYear: string
    ccv: string
  }
  installments: number
}

/** Contrato compartilhado; preço, desconto e frete monetário nunca são autoridade do cliente. */
export function buildCheckoutPayload(input: CheckoutContractInput) {
  return {
    lojaID: input.lojaID,
    cartId: input.cartId,
    customer: input.customer,
    items: input.items,
    deliveryType: input.deliveryType,
    address: input.deliveryType === 'DELIVERY' ? input.address : undefined,
    freightQuoteToken:
      input.deliveryType === 'DELIVERY' ? input.selectedFreight?.quoteToken : undefined,
    paymentMethod: input.paymentMethod,
    pointsToRedeem: input.pointsToRedeem,
    creditCard: input.paymentMethod === 'CREDIT_CARD' ? input.creditCard : undefined,
    installments: input.paymentMethod === 'CREDIT_CARD' ? input.installments : 1,
  }
}
