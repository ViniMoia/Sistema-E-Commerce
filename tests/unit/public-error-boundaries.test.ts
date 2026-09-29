import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/auth/register/route'
import { registerUser } from '@/services/auth.service'

vi.mock('@/services/auth.service', () => ({ registerUser: vi.fn() }))
vi.mock('@/lib/session', () => ({ createSession: vi.fn() }))
vi.mock('@/lib/tenant', () => ({ getLojaFromHeaders: vi.fn().mockResolvedValue({ id: 'store' }) }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: vi.fn().mockReturnValue(null) }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))

describe('public registration error boundary', () => {
  beforeEach(() => vi.clearAllMocks())
  it('does not return database/provider errors to the caller', async () => {
    vi.mocked(registerUser).mockRejectedValue(new Error('postgresql://secret:password@private/db')) // fictional fixture
    const result = await POST(new Request('http://fixture.invalid/api/auth/register', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Fixture', email: 'fixture@example.test', password: 'fixture-password' }),
    }))
    expect(result.status).toBe(500)
    expect(JSON.stringify(await result.json())).not.toMatch(/postgresql|secret|password|private/)
  })
})
