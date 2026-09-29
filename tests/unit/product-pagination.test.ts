import { describe, it, expect, vi } from 'vitest'
import { getProducts, getProductsPage } from '@/services/product.service'
import prisma from '@/lib/prisma'
import { productFiltersSchema } from '@/lib/validators/product'

vi.mock('@/lib/prisma', () => ({
  default: {
    product: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}))

describe('Paginação, filtros e ordenação de produtos (BE-015)', () => {
  it('limita take a no máximo 100 para chamadas públicas', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([])

    await getProducts({ lojaId: 'loja-1', limit: 100000 })

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100,
        where: expect.objectContaining({ lojaID: 'loja-1' }),
      })
    )
  })

  it('aplica take padrão de 20 na função compatível', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([])

    await getProducts({ lojaId: 'loja-1' })

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 })
    )
  })

  it('calcula skip por página', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([])

    await getProducts({ lojaId: 'loja-1', page: 3, limit: 10 })

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10, skip: 20 })
    )
  })

  it('aplica sortBy com desempate estável', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([])

    await getProducts({ lojaId: 'loja-1', sortBy: 'price_asc' })

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ price: 'asc' }, { id: 'asc' }],
      })
    )
  })

  it('retorna metadados e remove o item sentinela do corpo legado', async () => {
    const rows = Array.from({ length: 3 }, (_, index) => ({ id: `prod-${index + 1}` }))
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce(rows as any)
    vi.mocked(prisma.product.count).mockResolvedValueOnce(8)

    const result = await getProductsPage({ lojaId: 'loja-1', page: 2, limit: 2 })

    expect(result).toMatchObject({
      total: 8,
      page: 2,
      pageSize: 2,
      hasNextPage: true,
      nextCursor: 'prod-2',
    })
    expect(result.data).toHaveLength(2)
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 3, skip: 2 })
    )
  })

  it('rejeita faixa invertida, campos extras e page junto com cursor', () => {
    expect(productFiltersSchema.safeParse({ minPrice: '20', maxPrice: '10' }).success).toBe(false)
    expect(productFiltersSchema.safeParse({ debug: 'true' }).success).toBe(false)
    expect(productFiltersSchema.safeParse({
      cursor: '5df38f14-048f-4b9b-bbac-15215c16f15a',
      page: '2',
    }).success).toBe(false)
  })
})
