import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import {
  createCheckoutFingerprint,
  createOrder,
  type CreateOrderParams,
} from '@/services/checkout.service'
import { buildCheckoutPayload } from '@/lib/checkout-contract'
import { createOrderSchema } from '@/lib/validators/checkout.validators'
import { hashFreightItems, signFreightQuote, verifyFreightQuote } from '@/lib/freight-quote'
import { PaymentGatewayError, type PaymentGateway } from '@/types/payment-gateway.types'
import { InventoryService } from '@/services/inventory.service'
import { updateOrderStatus } from '@/services/order.service'
import { CustomTableProvider } from '@/services/freight/providers/custom-table.provider'

vi.mock('@/lib/prisma', () => ({
  default: {
    $transaction: vi.fn((callback) => callback(prisma)),
    loja: { findUnique: vi.fn() },
    product: { findUnique: vi.fn(), findMany: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    freightRule: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    address: { create: vi.fn() },
    order: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}))

vi.mock('@/services/inventory.service', () => ({
  InventoryService: { reserveStock: vi.fn(), restoreStock: vi.fn() },
}))

vi.mock('@/services/loyalty.service', () => ({
  simulatePointsRedemption: vi.fn(),
  calculatePointsEarned: vi.fn(() => 0),
  debitRedeemedPoints: vi.fn(),
}))

vi.mock('@/services/order.service', () => ({
  updateOrderStatus: vi.fn(),
}))

function fakeGateway(): PaymentGateway {
  return {
    createPixCharge: vi.fn().mockResolvedValue({
      paymentId: 'pay-fake-1',
      status: 'PENDING',
      pixQrCodeBase64: 'fake-qr',
      pixPayload: 'fake-pix-payload',
    }),
    createCreditCardCharge: vi.fn(),
    createBoletoCharge: vi.fn(),
    getPaymentStatus: vi.fn(),
    requestRefund: vi.fn(),
    listPaymentRefunds: vi.fn().mockResolvedValue([]),
    findPaymentsByReference: vi.fn(),
  }
}

function params(gateway: PaymentGateway): CreateOrderParams {
  return {
    lojaID: 'store-1',
    idempotencyKey: 'idem-transaction-remediation-0001',
    customer: {
      userId: 'user-1',
      name: 'Cliente Teste',
      email: 'cliente@test.local',
      phone: '11999999999',
      cpfCnpj: '52998224725',
    },
    items: [{ productId: 'product-1', variantId: 'variant-1', quantity: 1 }],
    deliveryType: 'PICKUP',
    paymentMethod: 'PIX',
    paymentGateway: gateway,
  }
}

function arrangeOrderCreation(input: CreateOrderParams) {
  vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(null)
  vi.mocked(prisma.loja.findUnique).mockResolvedValueOnce({
    id: 'store-1',
    pixKey: null,
    loyaltyEnabled: false,
  } as any)
  vi.mocked(prisma.product.findMany).mockResolvedValueOnce([{
    id: 'product-1',
    lojaID: 'store-1',
    name: 'Última Unidade',
    price: new Prisma.Decimal('100.00'),
    stock: 1,
    productVariants: [{ id: 'variant-1', stock: 1 }],
  }] as any)
  vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
    id: 'user-1',
    lojaID: 'store-1',
    email: 'cliente@test.local',
  } as any)
  vi.mocked(prisma.user.update).mockResolvedValueOnce({} as any)
  vi.mocked(InventoryService.reserveStock).mockResolvedValueOnce(undefined as never)
  ;(prisma.order.create as any).mockImplementationOnce(async ({ data }: any) => ({
    id: 'order-1',
    paymentReference: 'payment-reference-1',
    orderNumber: 1001,
    lojaID: 'store-1',
    userID: 'user-1',
    status: 'PENDING',
    total: data.total,
    subtotal: data.subtotal,
    freightValue: data.freightValue,
    shippingCost: data.shippingCost,
    shippingProvider: data.shippingProvider,
    shippingServiceName: data.shippingServiceName,
    shippingEstimatedDays: data.shippingEstimatedDays,
    paymentMethod: data.paymentMethod,
    pixKeyUsed: null,
    customerCpfCnpj: '52998224725',
    installments: data.installments,
    installmentValue: data.installmentValue,
    pointsEarned: 0,
    pointsRedeemed: 0,
    pointsDiscountValue: new Prisma.Decimal(0),
    deliveryType: 'PICKUP',
    checkoutFingerprint: createCheckoutFingerprint(input),
    paymentWorkflowStatus: 'PROCESSING',
    user: { name: 'Cliente Teste', phone: '11999999999', cpfCnpj: '52998224725' },
    items: [{ productId: 'product-1', name: 'Última Unidade', quantity: 1, price: new Prisma.Decimal(100) }],
  }))
}

describe('remediação transacional do checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.FREIGHT_QUOTE_SECRET = 'test-only-freight-secret-at-least-32-chars'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('produz o contrato canônico sem preço de frete/desconto e preserva variantId', () => {
    const payload = buildCheckoutPayload({
      lojaID: 'store-1',
      customer: { name: 'Cliente', email: 'c@test.local', phone: '11999999999', cpfCnpj: '52998224725' },
      items: [{ productId: 'product-1', variantId: 'variant-1', name: 'Produto', quantity: 1, price: 0.01 }],
      deliveryType: 'PICKUP',
      paymentMethod: 'PIX',
      pointsToRedeem: 0,
      installments: 1,
    })

    expect(payload.items[0].variantId).toBe('variant-1')
    expect(payload).not.toHaveProperty('shippingCost')
    expect(payload).not.toHaveProperty('pointsDiscountValue')
    expect(createOrderSchema.safeParse(payload).success).toBe(true)
  })

  it('rejeita adulteração e troca de itens em uma cotação assinada', () => {
    const items = [{ productId: 'product-1', variantId: 'variant-1', quantity: 1 }]
    const token = signFreightQuote({
      lojaID: 'store-1',
      destinationCep: '01001000',
      itemsHash: hashFreightItems(items),
      providerId: 'CORREIOS',
      serviceCode: 'SEDEX',
      serviceName: 'SEDEX',
      price: '25.90',
      deliveryTimeInDays: 2,
    })

    expect(verifyFreightQuote(token, { lojaID: 'store-1', destinationCep: '01001-000', items }).price)
      .toBe('25.90')
    expect(() => verifyFreightQuote(`${token.slice(0, -1)}x`, {
      lojaID: 'store-1', destinationCep: '01001-000', items,
    })).toThrow('inválida')
    expect(() => verifyFreightQuote(token, {
      lojaID: 'store-1',
      destinationCep: '01001-000',
      items: [{ ...items[0], quantity: 2 }],
    })).toThrow('incompatível')
  })

  it('oferece regra local somente para a cidade resolvida pelo CEP no servidor', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      cep: '01001-000',
      localidade: 'São Paulo',
      uf: 'SP',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })))
    vi.mocked(prisma.freightRule.findMany).mockResolvedValueOnce([
      { id: 'rule-sp', lojaID: 'store-1', cityName: 'Sao Paulo', value: new Prisma.Decimal('20.00') },
      { id: 'rule-rj', lojaID: 'store-1', cityName: 'Rio de Janeiro', value: new Prisma.Decimal('5.00') },
    ] as any)

    const options = await new CustomTableProvider().calculateQuotes({
      lojaID: 'store-1',
      originCep: '80000000',
      destinationCep: '01001000',
      packages: { weightInGrams: 300, lengthCm: 16, widthCm: 11, heightCm: 4 },
      cartTotal: 100,
      itemsCount: 1,
    })

    expect(options).toHaveLength(1)
    expect(options[0]).toMatchObject({ serviceCode: 'LOCAL_rule-sp', price: 20 })
    expect(options.some((option) => option.serviceCode === 'LOCAL_rule-rj')).toBe(false)
    expect(fetch).toHaveBeenCalledWith(
      'https://viacep.com.br/ws/01001000/json/',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  it('não cobra de novo após sucesso externo com falha de persistência', async () => {
    const gateway = fakeGateway()
    const input = params(gateway)
    arrangeOrderCreation(input)
    vi.mocked(prisma.order.update)
      .mockRejectedValueOnce(new Error('database write failed'))
      .mockResolvedValue({} as any)

    await expect(createOrder(input)).rejects.toMatchObject({
      code: 'PAYMENT_RECONCILIATION_REQUIRED',
      statusCode: 409,
    })
    expect(prisma.product.findMany).toHaveBeenCalledTimes(1)
    expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: { in: ['product-1'] },
        lojaID: 'store-1',
      },
    }))
    expect(prisma.product.findUnique).not.toHaveBeenCalled()
    expect(gateway.createPixCharge).toHaveBeenCalledTimes(1)
    expect(gateway.createPixCharge).toHaveBeenCalledWith(expect.objectContaining({
      orderId: 'order-1',
      paymentReference: 'payment-reference-1',
    }))
    expect(prisma.order.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        paymentReference: expect.any(String),
        paymentReconciliation: expect.objectContaining({
          create: expect.objectContaining({ status: 'PENDING' }),
        }),
      }),
    }))
    expect(prisma.order.update).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ paymentWorkflowStatus: 'RECONCILIATION_REQUIRED' }),
    }))
    expect(updateOrderStatus).not.toHaveBeenCalled()

    vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
      id: 'order-1',
      lojaID: 'store-1',
      checkoutFingerprint: createCheckoutFingerprint(input),
      paymentWorkflowStatus: 'RECONCILIATION_REQUIRED',
      user: { name: 'Cliente Teste', phone: '11999999999' },
      items: [],
    } as any)
    await expect(createOrder(input)).rejects.toMatchObject({
      code: 'PAYMENT_RECONCILIATION_REQUIRED',
    })
    expect(gateway.createPixCharge).toHaveBeenCalledTimes(1)
  })

  it('compensa pedido e estoque somente em recusa determinística', async () => {
    const gateway = fakeGateway()
    vi.mocked(gateway.createPixCharge).mockRejectedValueOnce(
      new PaymentGatewayError('Pagamento recusado', 422, 'PAYMENT_REFUSED')
    )
    const input = params(gateway)
    arrangeOrderCreation(input)
    vi.mocked(prisma.order.update).mockResolvedValue({} as any)
    vi.mocked(updateOrderStatus).mockResolvedValueOnce({
      success: true,
      order: { id: 'order-1', status: 'CANCELLED' },
    } as any)

    await expect(createOrder(input)).rejects.toMatchObject({
      code: 'PAYMENT_DECLINED',
      statusCode: 402,
    })
    expect(prisma.order.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ paymentWorkflowStatus: 'DECLINED' }),
    }))
    expect(updateOrderStatus).toHaveBeenCalledWith(expect.objectContaining({
      orderId: 'order-1',
      newStatus: 'CANCELLED',
    }))
  })
})
