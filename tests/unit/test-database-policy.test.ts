import { describe, expect, it } from 'vitest'
import { assertTestDatabaseIdentity, testDatabaseConfig, testServerConfig } from '@/lib/testing/database-policy'

const runId = 'a'.repeat(32)
const database = `ecommerce_test_${runId}`
const env = {
  TEST_RUN_ID: runId,
  TEST_DATABASE_URL: `postgresql://ecommerce_test:secret@127.0.0.1:5432/${database}`,
  DATABASE_URL: 'postgresql://production:production@production.example:5432/production',
}

describe('LA-006: identidade do ambiente de teste', () => {
  it('usa exclusivamente a URL de teste mesmo com DATABASE_URL proibida', () => {
    expect(testDatabaseConfig(env).url).toBe(env.TEST_DATABASE_URL)
    expect(() => testDatabaseConfig({ ...env, TEST_DATABASE_URL: undefined })).toThrow()
  })
  it.each([
    `postgresql://test:test@production.example:5432/${database}`,
    'postgresql://ecommerce_test:contains_test@127.0.0.1:5432/production',
    'postgresql://ecommerce_test:test@localhost:5432/ecommerce_test',
    `postgresql://postgres:test@127.0.0.1:5432/${database}`,
    `postgresql://ecommerce_test:test@127.0.0.1:5432/${database}?host=production.example`,
    `postgresql://ecommerce_test:test@127.0.0.1:5432/${database}?schema=production`,
    `postgresql://ecommerce_test:test@127.0.0.1:5432/${database}?schema=public&schema=production`,
    `postgresql://ecommerce_test:test@127.0.0.1:5432/${database}wrong`,
  ])('recusa configurações fora do escopo: %s', url => {
    expect(() => testDatabaseConfig({ ...env, TEST_DATABASE_URL: url })).toThrow()
  })
  it.each([
    undefined,
    { database, role: 'ecommerce_test', runId: 'b'.repeat(32), superuser: false, createDb: false },
    { database: 'production', role: 'ecommerce_test', runId, superuser: false, createDb: false },
    { database, role: 'postgres', runId, superuser: true, createDb: false },
    { database, role: 'ecommerce_test', runId, superuser: false, createDb: true },
  ])('recusa metadados ausentes ou divergentes', identity => {
    expect(() => assertTestDatabaseIdentity(identity, env)).toThrow()
  })
  it('aceita somente metadados do papel restrito e da execução atual', () => {
    expect(assertTestDatabaseIdentity({ database, role: 'ecommerce_test', runId, superuser: false, createDb: false }, env).database).toBe(database)
  })
  it('não escolhe um servidor implicitamente nem aceita um servidor externo', () => {
    expect(() => testServerConfig(env)).toThrow()
    expect(() => testServerConfig({ ...env, TEST_HTTP_TOKEN: 'f'.repeat(64), TEST_BASE_URL: 'https://production.example' })).toThrow()
    expect(testServerConfig({ ...env, TEST_HTTP_TOKEN: 'f'.repeat(64), TEST_BASE_URL: 'http://127.0.0.1:45123' }).baseUrl).toBe('http://127.0.0.1:45123')
  })
})
