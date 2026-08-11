import { describe, it, expect } from 'vitest'
import { listCustomersSchema, customerIdSchema } from '@/lib/validators/customer.validators'

describe('listCustomersSchema', () => {
  it('deve aceitar objeto vazio (todos opcionais)', () => {
    const result = listCustomersSchema.safeParse({})
    expect(result.success).toBe(true)
    expect(result.data).toEqual({
      limit: 20
    })
  })

  it('deve aceitar string de busca até 100 caracteres', () => {
    const search = 'a'.repeat(100)
    const result = listCustomersSchema.safeParse({ search })
    expect(result.success).toBe(true)
    expect(result.data.search).toBe(search)
  })

  it('deve rejeitar string de busca acima de 100 caracteres', () => {
    const search = 'a'.repeat(101)
    const result = listCustomersSchema.safeParse({ search })
    expect(result.success).toBe(false)
  })

  it('deve coerce limit de string "20" para número 20', () => {
    const result = listCustomersSchema.safeParse({ limit: '20' })
    expect(result.success).toBe(true)
    expect(result.data.limit).toBe(20)
    expect(typeof result.data.limit).toBe('number')
  })

  it('deve rejeitar limit acima de 100', () => {
    const result = listCustomersSchema.safeParse({ limit: 101 })
    expect(result.success).toBe(false)
  })

  it('deve rejeitar limit abaixo de 1', () => {
    const result = listCustomersSchema.safeParse({ limit: 0 })
    expect(result.success).toBe(false)
  })

  it('deve default limit para 20 quando não fornecido', () => {
    const result = listCustomersSchema.safeParse({})
    expect(result.success).toBe(true)
    expect(result.data.limit).toBe(20)
  })
})

describe('customerIdSchema', () => {
  it('deve aceitar string não-válida válida', () => {
    const result = customerIdSchema.safeParse({ customerId: 'abc123' })
    expect(result.success).toBe(true)
    expect(result.data.customerId).toBe('abc123')
  })

  it('deve rejeitar string vazia', () => {
    const result = customerIdSchema.safeParse({ customerId: '' })
    expect(result.success).toBe(false)
  })

  it('deve rejeitar undefined', () => {
    const result = customerIdSchema.safeParse({ customerId: undefined })
    expect(result.success).toBe(false)
  })
})