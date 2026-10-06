import { afterAll, describe, expect, it } from 'vitest'
import prisma from '@/lib/prisma'
import { setupTestDb, seedTestData, cleanupTestDb } from '@/tests/setup/db'

// A dedicated trusted provisioner intentionally withholds or corrupts its
// sentinel. Never toggle this on a persistent database: the client still guards.
describe.skipIf(!process.env.TEST_INVALID_SENTINEL)('WF-01: nenhuma escrita sem sentinela válida', () => {
  it('bloqueia setup, criação direta, seed e cleanup antes de efeitos', async () => {
    await expect(setupTestDb()).rejects.toThrow()
    await expect(prisma.loja.create({ data: { name: 'Must not exist', slug: 'blocked', description: '', coverImageUrl: '' } })).rejects.toThrow()
    await expect(seedTestData('blocked')).rejects.toThrow()
    await expect(cleanupTestDb()).rejects.toThrow()
  })
  afterAll(async () => { await prisma.$disconnect() })
})
