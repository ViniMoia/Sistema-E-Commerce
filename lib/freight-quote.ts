import crypto from 'node:crypto'

export interface FreightQuoteItemIdentity {
  productId: string
  variantId?: string | null
  quantity: number
}

export interface FreightQuotePayload {
  version: 1
  lojaID: string
  destinationCep: string
  itemsHash: string
  providerId: string
  serviceCode: string
  serviceName: string
  price: string
  deliveryTimeInDays: number
  expiresAt: number
}

function quoteSecret(): string {
  const secret = process.env.FREIGHT_QUOTE_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('FREIGHT_QUOTE_SECRET deve ter ao menos 32 caracteres.')
  }
  return secret
}

export function hashFreightItems(items: FreightQuoteItemIdentity[]): string {
  const canonical = items
    .map((item) => ({
      productId: item.productId,
      variantId: item.variantId || '',
      quantity: item.quantity,
    }))
    .sort((a, b) =>
      `${a.productId}:${a.variantId}`.localeCompare(`${b.productId}:${b.variantId}`)
    )
  return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
}

function signature(encodedPayload: string): string {
  return crypto.createHmac('sha256', quoteSecret()).update(encodedPayload).digest('base64url')
}

export function signFreightQuote(
  payload: Omit<FreightQuotePayload, 'version' | 'expiresAt'>,
  ttlMs = 30 * 60 * 1000
): string {
  const complete: FreightQuotePayload = { ...payload, version: 1, expiresAt: Date.now() + ttlMs }
  const encoded = Buffer.from(JSON.stringify(complete)).toString('base64url')
  return `${encoded}.${signature(encoded)}`
}

export function verifyFreightQuote(
  token: string,
  expected: { lojaID: string; destinationCep: string; items: FreightQuoteItemIdentity[] }
): FreightQuotePayload {
  const [encoded, receivedSignature, extra] = token.split('.')
  if (!encoded || !receivedSignature || extra) throw new Error('Cotação de frete inválida.')

  const expectedSignature = signature(encoded)
  const receivedBuffer = Buffer.from(receivedSignature)
  const expectedBuffer = Buffer.from(expectedSignature)
  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    throw new Error('Cotação de frete inválida.')
  }

  let payload: FreightQuotePayload
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
  } catch {
    throw new Error('Cotação de frete inválida.')
  }

  const valid =
    payload.version === 1 &&
    payload.lojaID === expected.lojaID &&
    payload.destinationCep === expected.destinationCep.replace(/\D/g, '') &&
    payload.itemsHash === hashFreightItems(expected.items) &&
    Number.isInteger(payload.deliveryTimeInDays) &&
    payload.deliveryTimeInDays >= 0 &&
    /^\d+(\.\d{2})$/.test(payload.price) &&
    payload.expiresAt > Date.now()

  if (!valid) throw new Error('Cotação de frete expirada ou incompatível com o pedido.')
  return payload
}
