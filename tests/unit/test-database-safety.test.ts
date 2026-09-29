import { afterEach, describe, expect, it } from 'vitest'
import { validateTestEnvironment } from '@/tests/setup/db'

const originalDatabaseUrl = process.env.DATABASE_URL
const originalTestDatabaseUrl = process.env.TEST_DATABASE_URL

afterEach(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL
  else process.env.DATABASE_URL = originalDatabaseUrl
  if (originalTestDatabaseUrl === undefined) delete process.env.TEST_DATABASE_URL
  else process.env.TEST_DATABASE_URL = originalTestDatabaseUrl
})

function configure(url: string | undefined, applicationUrl = url) {
  if (url === undefined) delete process.env.TEST_DATABASE_URL
  else process.env.TEST_DATABASE_URL = url
  if (applicationUrl === undefined) delete process.env.DATABASE_URL
  else process.env.DATABASE_URL = applicationUrl
}

describe('TST-005: proteção do banco descartável', () => {
  it('aceita somente a URL local exclusiva esperada e vinculada ao Prisma da aplicação', () => {
    const url = 'postgresql://test_user:test_password@127.0.0.1:5432/ecommerce_test?schema=public'
    configure(url)
    expect(validateTestEnvironment()).toBe(url)
  })

  it.each([
    ['sem TEST_DATABASE_URL', undefined, undefined],
    ['URLs divergentes', 'postgresql://test_user:test_password@127.0.0.1:5432/ecommerce_test?schema=public', 'postgresql://test_user:test_password@127.0.0.1:5432/outro?schema=public'],
    ['host remoto contendo test', 'postgresql://test_user:test_password@db.test.example/ecommerce_test?schema=public', undefined],
    ['localhost com banco incorreto', 'postgresql://test_user:test_password@localhost:5432/production_test?schema=public', undefined],
    ['schema incorreto', 'postgresql://test_user:test_password@localhost:5432/ecommerce_test?schema=shared', undefined],
    ['URL inválida', 'não-é-uma-url-test', undefined],
  ])('rejeita %s antes de conectar ou limpar', (_label, testUrl, applicationUrl) => {
    configure(testUrl, applicationUrl === undefined ? testUrl : applicationUrl)
    expect(() => validateTestEnvironment()).toThrow('[TEST_DATABASE_BLOCKED]')
  })
})
