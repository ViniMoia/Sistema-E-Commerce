import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addToCart } from '@/services/cart.service'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'

vi.mock('@/lib/prisma', () => ({
  default: {
    $transaction: vi.fn((callback) => callback(prisma)),
    $queryRaw: vi.fn(),
    productVariants: { findFirst: vi.fn() },
    product: { findFirst: vi.fn() },
    cart: { findFirst: vi.fn(), create: vi.fn() },
    cartItem: { create: vi.fn(), update: vi.fn() },
  },
}))

const lojaID = 'loja-1'

function variant(overrides: Record<string, unknown> = {}) {
  return {
    id: 'var-1',
    ProductID: 'prod-1',
    stock: 10,
    color: 'Preto',
    size: 'M',
    product: {
      id: 'prod-1',
      name: 'Camisa Autorizada',
      price: new Prisma.Decimal('79.90'),
      imageUrl: 'https://img.test/camisa.png',
      stock: 10,
      lojaID,
    },
    ...overrides,
  }
}

describe('carrinho autoritativo e concorrente (BE-011)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ id: 'user-1' }] as any)
  })

  it.each([0, -1, 1.5, 100])('rejeita quantidade inválida %s antes de tocar o banco', async (quantity) => {
    await expect(addToCart('user-1', lojaID, {
      productID: 'prod-1',
      variantID: 'var-1',
      quantity,
    })).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 422 })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('rejeita produto/variante de outro tenant sem criar carrinho ou item', async () => {
    vi.mocked(prisma.productVariants.findFirst).mockResolvedValueOnce(null)
    vi.mocked(prisma.product.findFirst).mockResolvedValueOnce(null)

    await expect(addToCart('user-1', lojaID, {
      productID: 'prod-other',
      variantID: 'var-other',
      quantity: 1,
    })).rejects.toMatchObject({ code: 'PRODUCT_NOT_AVAILABLE', statusCode: 404 })

    expect(prisma.productVariants.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'var-other',
        ProductID: 'prod-other',
        product: { lojaID },
      }),
    }))
    expect(prisma.cart.create).not.toHaveBeenCalled()
    expect(prisma.cartItem.create).not.toHaveBeenCalled()
  })

  it('não cria variante de catálogo quando o produto não possui variante comprável', async () => {
    vi.mocked(prisma.productVariants.findFirst).mockResolvedValueOnce(null)
    vi.mocked(prisma.product.findFirst).mockResolvedValueOnce({ id: 'prod-1' } as any)

    await expect(addToCart('user-1', lojaID, {
      productID: 'prod-1',
      quantity: 1,
    })).rejects.toMatchObject({ code: 'PRODUCT_VARIANT_REQUIRED', statusCode: 409 })
    expect((prisma.productVariants as any).create).toBeUndefined()
    expect(prisma.cart.create).not.toHaveBeenCalled()
  })

  it('seleciona variante persistida e usa snapshot autoritativo do banco', async () => {
    const storedVariant = variant()
    vi.mocked(prisma.productVariants.findFirst).mockResolvedValueOnce(storedVariant as any)
    vi.mocked(prisma.cart.findFirst).mockResolvedValueOnce({
      id: 'cart-1',
      userID: 'user-1',
      status: 'ACTIVE',
      items: [],
    } as any)
    vi.mocked(prisma.cartItem.create).mockResolvedValueOnce({ id: 'item-1' } as any)

    await addToCart('user-1', lojaID, { productID: 'prod-1', quantity: 2 })

    expect(prisma.cartItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cartID: 'cart-1',
        productID: 'prod-1',
        variantID: 'var-1',
        quantity: 2,
        price: storedVariant.product.price,
        productName: storedVariant.product.name,
      }),
    })
  })

  it('incrementa o item existente sob o lock do usuário e respeita o menor estoque pai/variante', async () => {
    vi.mocked(prisma.productVariants.findFirst).mockResolvedValueOnce(
      variant({ stock: 8, product: { ...variant().product, stock: 5 } }) as any
    )
    vi.mocked(prisma.cart.findFirst).mockResolvedValueOnce({
      id: 'cart-1',
      userID: 'user-1',
      status: 'ACTIVE',
      items: [{
        id: 'item-1',
        variantID: 'var-1',
        quantity: 4,
        product: { lojaID },
      }],
    } as any)

    await expect(addToCart('user-1', lojaID, {
      productID: 'prod-1',
      variantID: 'var-1',
      quantity: 2,
    })).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK', statusCode: 409 })
    expect(prisma.cartItem.update).not.toHaveBeenCalled()
  })
})
