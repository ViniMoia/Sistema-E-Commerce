import { describe, it, expect } from 'vitest'
import { normalizeHost } from '@/lib/tenant'

describe('Tenant Resolver & Host Normalization (TEN-003)', () => {
  it('deve remover a porta do host', () => {
    expect(normalizeHost('loja1.plataforma.com:3000')).toBe('loja1.plataforma.com')
    expect(normalizeHost('localhost:8080')).toBe('localhost')
  })

  it('deve converter host para minúsculas', () => {
    expect(normalizeHost('LOJA-TESTE.PLATAFORMA.COM')).toBe('loja-teste.plataforma.com')
    expect(normalizeHost('MinhaLoja.Com')).toBe('minhaloja.com')
  })

  it('deve remover trailing dot (ponto final) do host', () => {
    expect(normalizeHost('loja1.com.')).toBe('loja1.com')
    expect(normalizeHost('sub.dominio.com.:3000')).toBe('sub.dominio.com')
  })

  it('deve sanitizar caracteres perigosos e cabeçalhos forjados', () => {
    expect(normalizeHost('loja1.com/evil/path')).toBe('loja1.comevilpath')
    expect(normalizeHost('loja1<script>.com')).toBe('loja1script.com')
    expect(normalizeHost('loja1.com\r\ninjected')).toBe('loja1.cominjected')
  })

  it('deve retornar string vazia para host vazio ou nulo', () => {
    expect(normalizeHost('')).toBe('')
    expect(normalizeHost(undefined as unknown as string)).toBe('')
  })
})
