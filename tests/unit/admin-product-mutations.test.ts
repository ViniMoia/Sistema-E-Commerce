import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'

vi.mock('@/lib/prisma', () => ({
  default: {
    $transaction: vi.fn(async (callback) => callback(prisma)),
    loja: { findUnique: vi.fn() },
    product: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    productVariants: { update: vi.fn(), createMany: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}))

import prisma from '@/lib/prisma'
import { createProduct, deleteProduct, updateProduct } from '@/services/product.service'

const existingProduct = {
  id: 'product-1',
  lojaID: 'loja-1',
  name: 'Produto histórico',
  price: new Prisma.Decimal('100.00'),
  stock: 5,
  productVariants: [
    { id: 'variant-1', size: '500ml', color: 'Padrão', stock: 2 },
    { id: 'variant-2', size: '1L', color: 'Padrão', stock: 3 },
  ],
}

describe('mutações administrativas de catálogo (ADM-005/006/010)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('preserva IDs históricos e deriva estoque pai ao editar produto vendido', async () => {
    vi.mocked(prisma.product.findUnique)
      .mockResolvedValueOnce(existingProduct as any)
      .mockResolvedValueOnce({ ...existingProduct, price: new Prisma.Decimal('120'), stock: 8 } as any)
    vi.mocked(prisma.product.update).mockResolvedValue({ id: 'product-1' } as any)

    await updateProduct('product-1', {
      price: 120,
      stock: 999,
      variants: [
        { id: 'variant-1', size: '500ml', color: 'Padrão', stock: 3 },
        { id: 'variant-2', size: '1L', color: 'Padrão', stock: 5 },
      ],
    }, 'loja-1', 'admin-1')

    expect(prisma.product.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'product-1' },
      data: expect.objectContaining({ stock: 8, price: new Prisma.Decimal('120') }),
    }))
    expect(prisma.productVariants.update).toHaveBeenCalledTimes(2)
    expect((prisma.productVariants as any).deleteMany).toBeUndefined()
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'PRODUCT_UPDATED', entityId: 'product-1' }),
    }))
  })

  it('recusa remoção implícita de variante antes de qualquer mutação', async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValueOnce(existingProduct as any)

    await expect(updateProduct('product-1', {
      name: 'Produto ajustado',
      variants: [{ id: 'variant-1', size: '500ml', color: 'Padrão', stock: 2 }],
    }, 'loja-1', 'admin-1')).rejects.toThrow('VARIANT_REMOVAL_REQUIRES_ARCHIVE')

    expect(prisma.product.update).not.toHaveBeenCalled()
    expect(prisma.productVariants.update).not.toHaveBeenCalled()
    expect(prisma.auditLog.create).not.toHaveBeenCalled()
  })

  it('deriva estoque inicial exclusivamente das variantes', async () => {
    vi.mocked(prisma.loja.findUnique).mockResolvedValue({ id: 'loja-1' } as any)
    vi.mocked(prisma.product.create).mockResolvedValue({
      id: 'product-new', name: 'Produto novo', price: new Prisma.Decimal('10'), stock: 7,
      productVariants: [{ id: 'v1' }, { id: 'v2' }],
    } as any)

    await createProduct({
      name: 'Produto novo', description: 'Descrição válida', price: 10,
      imageUrl: 'https://example.test/product.png', stock: 999,
      lojaID: 'loja-1', userID: 'admin-1',
      variants: [
        { size: 'P', color: 'Azul', stock: 3 },
        { size: 'G', color: 'Azul', stock: 4 },
      ],
    })

    expect(prisma.product.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ stock: 7 }),
    }))
  })

  it('recusa exclusão de produto em uso sem efeito parcial', async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue({
      ...existingProduct, _count: { orderItems: 1, cartItem: 0 },
    } as any)

    await expect(deleteProduct('product-1', 'loja-1', 'admin-1')).rejects.toThrow('PRODUCT_IN_USE')
    expect(prisma.product.delete).not.toHaveBeenCalled()
    expect(prisma.auditLog.create).not.toHaveBeenCalled()
  })

  it('exclui produto nunca usado e grava auditoria na mesma transação', async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValue({
      ...existingProduct, _count: { orderItems: 0, cartItem: 0 },
    } as any)
    vi.mocked(prisma.product.delete).mockResolvedValue(existingProduct as any)

    await deleteProduct('product-1', 'loja-1', 'admin-1')

    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'PRODUCT_DELETED', entityId: 'product-1' }),
    }))
    expect(prisma.product.delete).toHaveBeenCalledWith({ where: { id: 'product-1' } })
  })
})
