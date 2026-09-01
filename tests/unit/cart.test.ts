import { describe, it, expect, vi } from 'vitest'
import { addToCart, CartError } from '@/services/cart.service'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'

vi.mock('@/lib/prisma', () => {
  return {
    default: {
      productVariants: {
        findUnique: vi.fn(),
      },
      cart: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      cartItem: {
        create: vi.fn(),
        update: vi.fn(),
        findFirst: vi.fn(),
        delete: vi.fn(),
      },
    },
  }
})

describe('Isolamento e Segurança do Carrinho de Compras (ARC-001)', () => {
  it('deve rejeitar item se a variante não pertencer ao produto informado', async () => {
    vi.mocked(prisma.productVariants.findUnique).mockResolvedValueOnce({
      id: 'var-1',
      ProductID: 'prod-A', // Pertence a prod-A
      stock: 10,
      product: { id: 'prod-A', lojaID: 'loja-1' },
    } as any)

    await expect(
      addToCart('user-1', {
        productID: 'prod-B', // Incompatível!
        variantID: 'var-1',
        quantity: 1,
      })
    ).rejects.toThrow('Invalid product or variant')
  })

  it('deve rejeitar item se a quantidade solicitada exceder o estoque', async () => {
    vi.mocked(prisma.productVariants.findUnique).mockResolvedValueOnce({
      id: 'var-1',
      ProductID: 'prod-1',
      stock: 2, // Apenas 2 em estoque
      product: { id: 'prod-1', lojaID: 'loja-1' },
    } as any)

    await expect(
      addToCart('user-1', {
        productID: 'prod-1',
        variantID: 'var-1',
        quantity: 5, // Solicita 5
      })
    ).rejects.toThrow('Insufficient stock')
  })

  it('deve bloquear mistura de produtos de lojas diferentes no mesmo carrinho', async () => {
    vi.mocked(prisma.productVariants.findUnique).mockResolvedValueOnce({
      id: 'var-2',
      ProductID: 'prod-2',
      stock: 10,
      product: { id: 'prod-2', lojaID: 'loja-B' }, // Loja B
    } as any)

    vi.mocked(prisma.cart.findFirst).mockResolvedValueOnce({
      id: 'cart-1',
      userID: 'user-1',
      status: 'ACTIVE',
      items: [
        {
          id: 'item-1',
          variantID: 'var-1',
          product: { lojaID: 'loja-A' }, // Já tem item da Loja A
        },
      ],
    } as any)

    await expect(
      addToCart('user-1', {
        productID: 'prod-2',
        variantID: 'var-2',
        quantity: 1,
      })
    ).rejects.toThrow('Você só pode adicionar produtos de uma única loja')
  })

  it('deve usar o preço autoritativo do banco de dados ao criar o cartItem', async () => {
    const dbPrice = new Prisma.Decimal('79.90')
    vi.mocked(prisma.productVariants.findUnique).mockResolvedValueOnce({
      id: 'var-1',
      ProductID: 'prod-1',
      stock: 10,
      color: 'Preto',
      size: 'M',
      product: {
        id: 'prod-1',
        name: 'Camisa Autorizada',
        price: dbPrice,
        imageUrl: 'https://img.com/camisa.png',
        lojaID: 'loja-1',
      },
    } as any)

    vi.mocked(prisma.cart.findFirst).mockResolvedValueOnce({
      id: 'cart-1',
      userID: 'user-1',
      status: 'ACTIVE',
      items: [],
    } as any)

    vi.mocked(prisma.cartItem.create).mockResolvedValueOnce({ id: 'item-1' } as any)

    await addToCart('user-1', {
      productID: 'prod-1',
      variantID: 'var-1',
      quantity: 2,
    })

    expect(prisma.cartItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cartID: 'cart-1',
          price: dbPrice,
          productName: 'Camisa Autorizada',
          quantity: 2,
        }),
      })
    )
  })
})
