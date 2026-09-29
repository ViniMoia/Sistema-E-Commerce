import { afterAll, describe, expect, it } from 'vitest'
import prisma from '@/lib/prisma'
import { cleanupTestDb, seedTestData } from '@/tests/setup/db'

const runId = `harness-${Date.now()}-${Math.random().toString(16).slice(2)}`
const ownedStoreId = `${runId}-owned`
const sentinelStoreId = `${runId}-sentinel`

describe.sequential('TST-005: isolamento da limpeza do harness', () => {
  afterAll(async () => {
    await prisma.loja.deleteMany({ where: { id: sentinelStoreId } })
    await prisma.$disconnect()
  })

  it('remove somente a fixture registrada e preserva sentinel de outro run', async () => {
    await prisma.loja.create({
      data: {
        id: sentinelStoreId,
        name: 'Sentinel de outro run',
        slug: sentinelStoreId,
        description: 'não deve ser removido pelo cleanup testado',
        coverImageUrl: '/sentinel.jpg',
      },
    })
    await seedTestData(ownedStoreId)

    await cleanupTestDb()

    expect(await prisma.loja.findUnique({ where: { id: ownedStoreId } })).toBeNull()
    expect(await prisma.loja.findUnique({ where: { id: sentinelStoreId } })).not.toBeNull()
  })
})
