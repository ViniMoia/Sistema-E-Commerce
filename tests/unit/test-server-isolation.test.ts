import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { post, verifyTestServer } from '@/tests/helpers/request'

const runId = 'a'.repeat(32)
const database = `ecommerce_test_${runId}`
beforeEach(() => {
  vi.stubEnv('TEST_RUN_ID', runId)
  vi.stubEnv('TEST_DATABASE_URL', `postgresql://ecommerce_test:secret@127.0.0.1:5432/${database}`)
  vi.stubEnv('TEST_BASE_URL', 'http://127.0.0.1:45123')
  vi.stubEnv('TEST_HTTP_TOKEN', 'f'.repeat(64))
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('LA-006: proteção das requisições de integração', () => {
  it.each([
    { runId: 'b'.repeat(32), database },
    { runId, database: 'other_database' },
  ])('não envia POST quando o servidor aponta para outra execução/banco', async identity => {
    const fetch = vi.fn().mockResolvedValue(Response.json(identity))
    vi.stubGlobal('fetch', fetch)
    await expect(post('/api/orders', { items: [] })).rejects.toThrow('ambientes diferentes')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][0]).toContain('/api/test-environment')
  })
  it('não envia POST ao servidor comum sem handshake autenticado', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 404 }))
    vi.stubGlobal('fetch', fetch)
    await expect(post('/api/orders', {})).rejects.toThrow('não confirmou')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('paths não conseguem escolher um segundo host', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await expect(post('//production.invalid/api/orders', {})).rejects.toThrow()
    await expect(post('https://production.invalid/api/orders', {})).rejects.toThrow()
    expect(fetch).not.toHaveBeenCalled()
  })
  it('o handshake não segue redirects', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ runId, database }))
    vi.stubGlobal('fetch', fetch)
    await verifyTestServer()
    expect(fetch.mock.calls[0][1].redirect).toBe('error')
  })
})
