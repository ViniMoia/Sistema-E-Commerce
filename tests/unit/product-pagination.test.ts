import { describe, it, expect, vi } from 'vitest'
import { getProducts } from '@/services/product.service'
import prisma from '@/lib/prisma'

vi.mock('@/lib/prisma', () => {
  return {
    default: {
      product: {
        findMany: vi.fn(),
      },
    },
  }
})

describe('Proteção de Paginação de Produtos contra DoS (SCL-001)', () => {
  it('deve limitar take a no máximo 100 mesmo se o cliente solicitar um valor exorbitante', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([])

    await getProducts({ lojaId: 'loja-1', limit: 100000 })

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100,
        where: expect.objectContaining({
          lojaID: 'loja-1',
        }),
      })
    )
  })

  it('deve aplicar take padrão de 20 quando limit não for especificado', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([])

    await getProducts({ lojaId: 'loja-1' })

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 20,
      })
    )
  })

  it('deve calcular skip correto para paginação por página', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([])

    await getProducts({ lojaId: 'loja-1', page: 3, limit: 10 })

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
        skip: 20,
      })
    )
  })
})
