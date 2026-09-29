import { beforeEach, describe, it, expect, vi } from 'vitest'
import { updateUserRole } from '@/services/user.service'
import { setDefaultAddress } from '@/services/address.service'
import prisma from '@/lib/prisma'

vi.mock('@/lib/prisma', () => {
  return {
    default: {
      user: {
        findUnique: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
      },
      address: {
        findUnique: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      $transaction: vi.fn((cb) => (typeof cb === 'function' ? cb(prisma) : cb)),
    },
  }
})

describe('Controle de Acesso & Isolamento Multi-Tenant (TEN-001, SEC-003)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.$transaction).mockImplementation((cb: any) => cb(prisma) as any)
  })

  it('deve bloquear alteração de papel se o usuário pertencer a outra loja (TEN-001)', async () => {
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce({
        id: 'target-1',
        lojaID: 'loja-A',
        role: 'CUSTOMER',
        status: 'ACTIVE',
      } as any)
      .mockResolvedValueOnce({
        id: 'admin-1',
        lojaID: 'loja-B', // Loja diferente!
        role: 'ADMIN',
        status: 'ACTIVE',
      } as any)

    await expect(updateUserRole('target-1', 'admin-1', 'ADMIN')).rejects.toThrow('USER_NOT_FOUND')
  })

  it('deve bloquear auto-alteração de papel (CANNOT_CHANGE_OWN_ROLE)', async () => {
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce({
        id: 'admin-1',
        lojaID: 'loja-A',
        role: 'ADMIN',
        status: 'ACTIVE',
      } as any)
      .mockResolvedValueOnce({
        id: 'admin-1',
        lojaID: 'loja-A',
        role: 'ADMIN',
        status: 'ACTIVE',
      } as any)

    await expect(updateUserRole('admin-1', 'admin-1', 'CUSTOMER')).rejects.toThrow('CANNOT_CHANGE_OWN_ROLE')
  })

  it('protege a remoção do último admin ativo dentro de transação serializável', async () => {
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce({
        id: 'admin-alvo', lojaID: 'loja-A', role: 'ADMIN', status: 'ACTIVE',
      } as any)
      .mockResolvedValueOnce({
        id: 'admin-ator', lojaID: 'loja-A', role: 'ADMIN', status: 'ACTIVE',
      } as any)
    vi.mocked(prisma.user.count).mockResolvedValueOnce(1)

    await expect(updateUserRole('admin-alvo', 'admin-ator', 'CUSTOMER')).rejects.toThrow('LAST_ADMIN')

    expect(prisma.user.count).toHaveBeenCalledWith({
      where: { role: 'ADMIN', status: 'ACTIVE', lojaID: 'loja-A' },
    })
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' },
    )
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('rejeita ator que deixou de ser administrador antes da escrita', async () => {
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce({
        id: 'cliente-alvo', lojaID: 'loja-A', role: 'CUSTOMER', status: 'ACTIVE',
      } as any)
      .mockResolvedValueOnce({
        id: 'ator-rebaixado', lojaID: 'loja-A', role: 'CUSTOMER', status: 'ACTIVE',
      } as any)

    await expect(updateUserRole('cliente-alvo', 'ator-rebaixado', 'ADMIN'))
      .rejects.toThrow('ACTOR_NOT_AUTHORIZED')
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('deve bloquear definição de endereço padrão se o endereço não pertencer ao usuário (SEC-003 IDOR)', async () => {
    vi.mocked(prisma.address.findUnique).mockResolvedValueOnce({
      id: 'addr-xyz',
      userID: 'outro-usuario', // ID diferente!
    } as any)

    await expect(setDefaultAddress('meu-usuario', 'addr-xyz')).rejects.toThrow(
      'Endereço não encontrado ou acesso não autorizado'
    )
  })
})
