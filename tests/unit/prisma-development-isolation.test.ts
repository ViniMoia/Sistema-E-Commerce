import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const clients = vi.hoisted(() => ({ created: 0 }))
vi.mock('@prisma/client', () => ({ PrismaClient: class {
  constructor() { clients.created++ }
  $use = vi.fn()
  $disconnect = vi.fn(async () => {})
} }))

function configure(id = 'a'.repeat(32)) {
  vi.stubEnv('NODE_ENV', 'development')
  vi.stubEnv('TEST_RUN_ID', id)
  vi.stubEnv('TEST_DATABASE_URL', `postgresql://ecommerce_test:fixture@127.0.0.1:5432/ecommerce_test_${id}?connection_limit=4`)
}

beforeEach(() => {
  vi.resetModules(); clients.created = 0
  delete globalThis.prismaDevelopmentTest
  configure()
})
afterEach(() => {
  delete globalThis.prismaDevelopmentTest
  vi.unstubAllEnvs(); vi.resetModules()
})

describe('isolated Next dev Prisma lifetime', () => {
  it('reuses the exact disposable client across module recompilations', async () => {
    const first = (await import('@/lib/prisma')).default
    vi.resetModules()
    expect((await import('@/lib/prisma')).default).toBe(first)
    expect(clients.created).toBe(1)
  })
  it('refuses a different run instead of returning a client from the previous database', async () => {
    await import('@/lib/prisma')
    configure('b'.repeat(32)); vi.resetModules()
    await expect(import('@/lib/prisma')).rejects.toThrow('Test datasource changed')
    expect(clients.created).toBe(1)
  })
  it('still validates the datasource policy before looking up the cached client', async () => {
    await import('@/lib/prisma')
    vi.stubEnv('TEST_DATABASE_URL', 'postgresql://ecommerce_test:fixture@remote.invalid:5432/production')
    vi.resetModules()
    await expect(import('@/lib/prisma')).rejects.toThrow()
    expect(clients.created).toBe(1)
  })
  it('does not reuse the dev cache in test fixture processes', async () => {
    const dev = (await import('@/lib/prisma')).default
    vi.stubEnv('NODE_ENV', 'test'); vi.resetModules()
    const first = (await import('@/lib/prisma')).default
    vi.resetModules()
    const second = (await import('@/lib/prisma')).default
    expect(first).not.toBe(dev)
    expect(second).not.toBe(first)
    expect(clients.created).toBe(3)
  })
})
