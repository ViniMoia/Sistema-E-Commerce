import { describe, it, expect, vi } from 'vitest'
import { updateProduct, deleteProduct } from '@/services/product.service'
import { updateOrderStatus } from '@/services/order.service'
import { getCustomerProfile } from '@/services/customer.service'
import prisma from '@/lib/prisma'

vi.mock('@/lib/prisma', () => {
  return {
    default: {
      $transaction: vi.fn((cb) => (typeof cb === 'function' ? cb(prisma) : cb)),
      product: {
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      order: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      user: {
        findFirst: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
    },
  }
})

describe('Proteção contra BOLA/IDOR e Isolamento de Recursos (TEN-002)', () => {
  it('deve bloquear edição de produto pertencente a outra loja', async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValueOnce({
      id: 'prod-123',
      lojaID: 'loja-A',
      name: 'Produto da Loja A',
    } as any)

    // Admin da loja-B tenta editar produto da loja-A
    await expect(
      updateProduct('prod-123', { name: 'Novo Nome' }, 'loja-B')
    ).rejects.toThrow('PRODUCT_NOT_FOUND')
  })

  it('deve bloquear deleção de produto pertencente a outra loja', async () => {
    vi.mocked(prisma.product.findUnique).mockResolvedValueOnce({
      id: 'prod-123',
      lojaID: 'loja-A',
    } as any)

    // Admin da loja-B tenta deletar produto da loja-A
    await expect(
      deleteProduct('prod-123', 'loja-B')
    ).rejects.toThrow('PRODUCT_NOT_FOUND')
  })

  it('deve bloquear alteração de status de pedido pertencente a outra loja', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
      id: 'order-999',
      lojaID: 'loja-A', // Pedido da loja A
      status: 'PENDING',
      userID: 'user-1',
      items: [],
    } as any)

    // Admin da loja-B tenta alterar status do pedido da loja-A
    const result = await updateOrderStatus({
      orderId: 'order-999',
      newStatus: 'PAID',
      performedById: 'admin-b',
      lojaID: 'loja-B',
    })

    if (result.success === false) {
      expect(result.code).toBe('NOT_FOUND')
    } else {
      expect.fail('Operação deveria ter sido bloqueada')
    }
  })

  it('deve retornar null para perfil de cliente sem relacionamento com a loja do admin', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null)

    const profile = await getCustomerProfile({
      customerId: 'customer-outside',
      lojaID: 'loja-B',
    })

    expect(profile).toBeNull()
  })
})
