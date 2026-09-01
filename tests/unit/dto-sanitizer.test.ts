import { describe, it, expect } from 'vitest'
import { sanitizeUser } from '@/lib/utils/dto-sanitizer'

describe('DTO Sanitizer (SEC-006)', () => {
  it('deve remover hashes de senha e tokens sensíveis de objetos de usuário', () => {
    const rawUser = {
      id: 'usr-123',
      name: 'João Silva',
      email: 'joao@loja.com',
      password: '$2b$10$hashedPasswordHereVerySecret',
      resetToken: 'secret-reset-token-xyz',
      resetTokenExpires: new Date(Date.now() + 3600000),
      emailVerified: new Date(),
      role: 'CUSTOMER',
      status: 'ACTIVE',
      lojaID: 'loja-1',
      phone: '11999999999',
    }

    const sanitized = sanitizeUser(rawUser)

    expect((sanitized as any).password).toBeUndefined()
    expect((sanitized as any).resetToken).toBeUndefined()
    expect((sanitized as any).resetTokenExpires).toBeUndefined()
    expect((sanitized as any).emailVerified).toBeUndefined()
    expect(sanitized.id).toBe('usr-123')
    expect(sanitized.name).toBe('João Silva')
    expect(sanitized.email).toBe('joao@loja.com')
    expect(sanitized.role).toBe('CUSTOMER')
    expect(sanitized.status).toBe('ACTIVE')
    expect(sanitized.lojaID).toBe('loja-1')
  })
})
