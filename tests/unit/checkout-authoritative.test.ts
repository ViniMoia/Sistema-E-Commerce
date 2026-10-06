import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createOrder } from '@/tests/helpers/checkout-domain-fixture'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'

vi.mock('@/lib/prisma', async () => {
  const { paymentAttemptFixture } = await import('@/tests/helpers/payment-fixture-mock');
  return {
    default: {
      paymentAttempt: paymentAttemptFixture(),
      $queryRaw: vi.fn().mockResolvedValue([]),
      orderBuyer: { create: vi.fn(async ({ data }: any) => ({ id: "buyer-1", ...data })) },
      $transaction: vi.fn((cb) => (typeof cb === 'function' ? cb(prisma) : cb)),
      loja: {
        findUnique: vi.fn(),
      },
      product: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      productVariants: {
        update: vi.fn(),
      },
      freightRule: {
        findFirst: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
      address: {
        create: vi.fn(),
      },
      order: {
        create: vi.fn(),
        findUnique: vi.fn(),
      },
    },
  }
})

describe('Pipeline Canônico de Checkout Autoritativo (SEC-002, DB-002)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-1", lojaID: "loja-1", status: "ACTIVE", email: "cliente@teste.com" } as any)
  })
  it('deve ignorar preço enviado pelo cliente e calcular autoritativamente com base no banco de dados', async () => {
    vi.mocked(prisma.loja.findUnique).mockResolvedValueOnce({
      id: 'loja-1',
      name: 'Loja Teste',
      pixKey: 'minha-chave-pix',
    } as any)

    // Preço no banco é R$ 150.00 e estoque é 10
    vi.mocked(prisma.product.findUnique).mockResolvedValue({
      id: 'prod-100',
      name: 'Tênis Premium',
      price: new Prisma.Decimal('150.00'),
      stock: 10,
      lojaID: 'loja-1',
      productVariants: [{ id: 'fixture-neutral-variant', size: 'Único', color: 'Padrão', stock: 100 }],
    } as any)

    // Regra de frete no banco é R$ 25.00
    vi.mocked(prisma.freightRule.findFirst).mockResolvedValueOnce({
      id: 'fr-1',
      lojaID: 'loja-1',
      cityName: 'Curitiba',
      value: new Prisma.Decimal('25.00'),
    } as any)

    vi.mocked(prisma.user.upsert).mockResolvedValueOnce({
      id: 'user-1',
      name: 'Cliente Teste',
      phone: '41999999999',
    } as any)

    vi.mocked(prisma.address.create).mockResolvedValueOnce({
      id: 'addr-1',
    } as any)

    ;(prisma.order.create as any).mockImplementationOnce(async ({ data }: any) => {
      return {
        id: 'ord-1',
        orderNumber: 1001,
        total: data.total,
        freightValue: data.freightValue,
        pixKeyUsed: data.pixKeyUsed,
        deliveryType: data.deliveryType,
        user: { name: 'Cliente Teste', phone: '41999999999' },
        items: data.items.create.map((i: any) => ({
          productId: i.productId,
          name: i.name,
          quantity: i.quantity,
          price: i.price,
        })),
      }
    })

    // Cliente malicioso envia price: 0.01 e freightValue: 0
    const result = await createOrder({
      paymentMethod: 'WHATSAPP_PIX',
      lojaID: 'loja-1',
      customer: {
        name: 'Cliente Teste',
        email: 'cliente@teste.com',
        phone: '41999999999',
      },
      items: [
        {
          productId: 'prod-100',
          quantity: 2,
          price: 0.01, // Tentativa de fraude!
        },
      ],
      address: {
        cep: '80000-000',
        state: 'PR',
        city: 'Curitiba',
        neighborhood: 'Centro',
        street: 'Rua das Flores',
        number: '123',
      },
      deliveryType: 'DELIVERY', freightQuoteToken: 'authorized-fixture-quote', freightOwnerKey: 'g:' + 'a'.repeat(64),
      freightValue: 0, // Tentativa de zerar frete!
    })

    // Subtotal esperado: 2 * 150.00 = 300.00
    // Frete esperado: 25.00
    // Total esperado: 325.00
    expect(result.order.total).toBe(325)
    expect(result.order.freightValue).toBe(25)
    expect(result.order.items[0].price).toBe(150)
  })

  it('deve rejeitar pedido se o produto pertencer a outra loja', async () => {
    vi.mocked(prisma.loja.findUnique).mockResolvedValueOnce({
      id: 'loja-A',
    } as any)

    vi.mocked(prisma.product.findUnique).mockResolvedValue({
      id: 'prod-x',
      lojaID: 'loja-B', // Loja divergente!
      stock: 10,
      price: new Prisma.Decimal('50.00'),
    } as any)

    await expect(
      createOrder({ paymentMethod: 'WHATSAPP_PIX',
        lojaID: 'loja-A',
        customer: { name: 'Pessoa A', email: 'a@a.com', phone: '111' },
        items: [{ productId: 'prod-x', quantity: 1 }],
        deliveryType: 'PICKUP',
      })
    ).rejects.toThrow('CHECKOUT_PRODUCT_UNAVAILABLE')
  })

  it('uma chave antiga não substitui intenção e consentimento no comando público', async () => {
    const { createOrder: command } = await vi.importActual<typeof import('@/services/checkout.service')>('@/services/checkout.service');
    await expect(command({ lojaID: 'loja-1', customer: { name: 'Cliente', email: 'cliente@teste.com', phone: '11999999999' },
      items: [{ productId: 'prod-1', quantity: 1 }], deliveryType: 'PICKUP', paymentMethod: 'WHATSAPP_PIX', idempotencyKey: 'historical-key' }))
      .rejects.toThrow('CHECKOUT_INTENT_REQUIRED');
    expect(prisma.order.create).not.toHaveBeenCalled();
  })
})

vi.mock('@/lib/freight/acceptance', async () => {
  const { freightAcceptanceMock } = await import('@/tests/helpers/freight-acceptance-mock');
  return freightAcceptanceMock(25);
});

vi.mock('@/services/payment/capabilities.service', async importOriginal => {
  const actual = await importOriginal<typeof import('@/services/payment/capabilities.service')>();
  const { completePaymentStore } = await import('@/tests/helpers/payment-fixture-mock');
  return { paymentCapabilities: (store: Parameters<typeof actual.paymentCapabilities>[0], gateway: Parameters<typeof actual.paymentCapabilities>[1]) => actual.paymentCapabilities(completePaymentStore(store), gateway) };
});

vi.mock('@/services/checkout-intent.service', async importOriginal => {
  const { intentUnitMock } = await import('@/tests/helpers/checkout-domain-fixture');
  return intentUnitMock(await importOriginal<typeof import('@/services/checkout-intent.service')>());
});
vi.mock('@/services/checkout-plan.service', async importOriginal => {
  const { planUnitMock } = await import('@/tests/helpers/checkout-domain-fixture');
  return planUnitMock(await importOriginal<typeof import('@/services/checkout-plan.service')>());
});
