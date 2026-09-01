import { describe, it, expect } from 'vitest'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

describe('Mecanismo de Rate Limiting e Proteção de Borda (SEC-005)', () => {
  it('deve permitir requisições dentro do limite configurado', () => {
    const key = `test_user_${Date.now()}`
    const res1 = rateLimit(key, 3, 5000)
    expect(res1.success).toBe(true)
    expect(res1.remaining).toBe(2)

    const res2 = rateLimit(key, 3, 5000)
    expect(res2.success).toBe(true)
    expect(res2.remaining).toBe(1)

    const res3 = rateLimit(key, 3, 5000)
    expect(res3.success).toBe(true)
    expect(res3.remaining).toBe(0)
  })

  it('deve bloquear requisições quando o limite for excedido', () => {
    const key = `blocked_user_${Date.now()}`
    rateLimit(key, 2, 5000)
    rateLimit(key, 2, 5000)

    const blocked = rateLimit(key, 2, 5000)
    expect(blocked.success).toBe(false)
    expect(blocked.remaining).toBe(0)
    expect(blocked.retryAfter).toBeGreaterThan(0)
  })

  it('deve extrair o IP correto a partir de x-forwarded-for', () => {
    const req = new Request('http://localhost:3000/api/auth/login', {
      headers: {
        'x-forwarded-for': '203.0.113.195, 70.41.3.18, 150.172.238.178',
      },
    })
    const ip = getClientIp(req)
    expect(ip).toBe('203.0.113.195')
  })
})
