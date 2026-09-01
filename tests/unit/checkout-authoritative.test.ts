import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createOrder } from '@/services/checkout.service'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'

vi.mock('@/lib/prisma', () => {
  return {
    default: {
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
    vi.clearAllMocks()
  })
  it('deve ignorar preço enviado pelo cliente e calcular autoritativamente com base no banco de dados', async () => {
    vi.mocked(prisma.loja.findUnique).mockResolvedValueOnce({
      id: 'loja-1',
      name: 'Loja Teste',
      pixKey: 'minha-chave-pix',
    } as any)

    // Preço no banco é R$ 150.00 e estoque é 10
    vi.mocked(prisma.product.findUnique).mockResolvedValueOnce({
      id: 'prod-100',
      name: 'Tênis Premium',
      price: new Prisma.Decimal('150.00'),
      stock: 10,
      lojaID: 'loja-1',
      productVariants: [],
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
          productId: i.product.connect.id,
          name: i.name,
          quantity: i.quantity,
          price: i.price,
        })),
      }
    })

    // Cliente malicioso envia price: 0.01 e freightValue: 0
    const result = await createOrder({
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
      deliveryType: 'DELIVERY',
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

    vi.mocked(prisma.product.findUnique).mockResolvedValueOnce({
      id: 'prod-x',
      lojaID: 'loja-B', // Loja divergente!
      stock: 10,
      price: new Prisma.Decimal('50.00'),
    } as any)

    await expect(
      createOrder({
        lojaID: 'loja-A',
        customer: { name: 'A', email: 'a@a.com', phone: '111' },
        items: [{ productId: 'prod-x', quantity: 1 }],
        deliveryType: 'PICKUP',
      })
    ).rejects.toThrow('não pertence a esta loja')
  })

  it('deve retornar pedido existente de forma idempotente quando idempotencyKey for repetida (DB-002)', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
      id: 'ord-idempotent-1',
      orderNumber: 9999,
      total: new Prisma.Decimal('199.90'),
      freightValue: null,
      pixKeyUsed: 'pix-123',
      deliveryType: 'PICKUP',
      user: { name: 'Cliente Existente', phone: '11999999999' },
      items: [{ productId: 'prod-1', name: 'Item', quantity: 1, price: new Prisma.Decimal('199.90') }],
    } as any)

    const result = await createOrder({
      lojaID: 'loja-1',
      idempotencyKey: 'idempotent-token-xyz',
      customer: { name: 'Cliente Existente', email: 'cliente@teste.com', phone: '11999999999' },
      items: [{ productId: 'prod-1', quantity: 1 }],
      deliveryType: 'PICKUP',
    })

    expect(result.order.id).toBe('ord-idempotent-1')
    expect(result.order.orderNumber).toBe(9999)
    // Garante que não chamou order.create novamente
    expect(prisma.order.create).not.toHaveBeenCalled()
  })
})
