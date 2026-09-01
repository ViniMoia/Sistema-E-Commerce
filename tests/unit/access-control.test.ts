import { describe, it, expect, vi } from 'vitest'
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
