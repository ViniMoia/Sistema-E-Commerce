import { beforeEach, describe, expect, it, vi } from 'vitest'
import prisma from '@/lib/prisma'
import { completeCheckoutCart } from '@/services/cart.service'

vi.mock('@/lib/prisma', () => ({
  default: {
    $transaction: vi.fn((callback) => callback(prisma)),
    $queryRaw: vi.fn(),
    order: { findFirst: vi.fn() },
    cart: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}))

describe('fechamento persistido e idempotente do carrinho (FUX-003)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ id: 'user-a' }] as never)
  })

  it('conclui somente o carrinho de origem e preserva itens de outro checkout', async () => {
    vi.mocked(prisma.order.findFirst).mockResolvedValueOnce({
      id: 'order-a',
      sourceCartID: 'cart-a',
      items: [{ productVariantsId: 'variant-a', quantity: 2 }],
    } as never)
    vi.mocked(prisma.cart.findFirst).mockResolvedValueOnce({
      id: 'cart-a',
      userID: 'user-a',
      status: 'ACTIVE',
      items: [
        {
          productID: 'product-a', variantID: 'variant-a', quantity: 3,
          productName: 'Produto A', price: 10, color: 'Preto', size: 'U', imageUrl: '/a.png',
          product: { lojaID: 'loja-a' },
        },
        {
          productID: 'product-b', variantID: 'variant-b', quantity: 1,
          productName: 'Produto B', price: 20, color: 'Azul', size: 'M', imageUrl: '/b.png',
          product: { lojaID: 'loja-a' },
        },
      ],
    } as never)
    vi.mocked(prisma.cart.create).mockResolvedValueOnce({ id: 'cart-b' } as never)
    vi.mocked(prisma.cart.update).mockResolvedValueOnce({ id: 'cart-a', status: 'COMPLETED' } as never)

    await completeCheckoutCart('order-a', 'user-a', 'loja-a')

    expect(prisma.cart.create).toHaveBeenCalledWith({
      data: {
        userID: 'user-a',
        status: 'ACTIVE',
        items: {
          create: expect.arrayContaining([
            expect.objectContaining({ variantID: 'variant-a', quantity: 1 }),
            expect.objectContaining({ variantID: 'variant-b', quantity: 1 }),
          ]),
        },
      },
    })
    expect(prisma.cart.update).toHaveBeenCalledWith({
      where: { id: 'cart-a' },
      data: { status: 'COMPLETED' },
    })
  })

  it('trata retry como no-op depois que o carrinho de origem foi concluido', async () => {
    vi.mocked(prisma.order.findFirst).mockResolvedValueOnce({
      id: 'order-a', sourceCartID: 'cart-a', items: [],
    } as never)
    vi.mocked(prisma.cart.findFirst).mockResolvedValueOnce({
      id: 'cart-a', userID: 'user-a', status: 'COMPLETED', items: [],
    } as never)

    await completeCheckoutCart('order-a', 'user-a', 'loja-a')

    expect(prisma.cart.create).not.toHaveBeenCalled()
    expect(prisma.cart.update).not.toHaveBeenCalled()
  })

  it('nao permite concluir pedido fora do owner e tenant autenticados', async () => {
    vi.mocked(prisma.order.findFirst).mockResolvedValueOnce(null)

    await expect(completeCheckoutCart('order-b', 'user-a', 'loja-a')).rejects.toMatchObject({
      code: 'CHECKOUT_CART_NOT_FOUND',
      statusCode: 404,
    })
    expect(prisma.cart.update).not.toHaveBeenCalled()
  })
})
