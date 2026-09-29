import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import prisma from '@/lib/prisma'
import { createAdminToken } from '@/tests/setup/auth'

vi.mock('@/lib/prisma', () => ({ default: {
  user: { findFirst: vi.fn() },
  session: { create: vi.fn(), upsert: vi.fn() },
} }))

describe('HTTP session fixtures use the production token contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'fixture-admin' } as never)
    vi.mocked(prisma.session.create).mockImplementation((({ data }) => Promise.resolve(data)) as never)
    vi.mocked(prisma.session.upsert).mockImplementation((({ create }) => Promise.resolve(create)) as never)
  })

  it('returns a random bearer while persisting only its SHA-256 digest', async () => {
    const token = await createAdminToken('fixture-store')
    const calls = vi.mocked(prisma.session.create).mock.calls
    const stored = calls[0]?.[0].data ?? vi.mocked(prisma.session.upsert).mock.calls[0]?.[0].create
    expect(token).toMatch(/^[a-f0-9]{64}$/)
    expect(stored?.id).toBe(createHash('sha256').update(token).digest('hex'))
    expect(stored?.id).not.toBe(token)
    expect(await createAdminToken('fixture-store')).not.toBe(token)
  })
})
