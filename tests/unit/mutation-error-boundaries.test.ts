import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST as freightPost } from '@/app/api/admin/freight/route'
import { PATCH, DELETE } from '@/app/api/admin/freight/[id]/route'
import { POST as addressPost } from '@/app/api/address/set-default/route'
import { createFreightRule, updateFreightRule, deleteFreightRule } from '@/services/freight.service'
import { setDefaultAddress } from '@/services/address.service'
import { registerSchema } from '@/lib/validators/auth'

vi.mock('@/lib/auth/guards', () => ({
  requireAdmin: vi.fn().mockResolvedValue({ user: { id: 'admin', lojaID: 'store' } }),
  requireAuth: vi.fn().mockResolvedValue({ user: { id: 'customer', lojaID: 'store' } }),
}))
vi.mock('@/services/freight.service', () => ({ createFreightRule: vi.fn(), updateFreightRule: vi.fn(), deleteFreightRule: vi.fn() }))
vi.mock('@/services/address.service', () => ({ setDefaultAddress: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))
const request = (method: string, body?: unknown) => new Request('http://fixture.invalid/api', {
  method, headers: { 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}),
})
describe('mutation error boundaries', () => {
  beforeEach(() => vi.clearAllMocks())
  it('hides unexpected provider/database details for freight mutations and address selection', async () => {
    for (const fn of [createFreightRule, updateFreightRule, deleteFreightRule, setDefaultAddress]) vi.mocked(fn).mockRejectedValue(new Error('postgresql://private:password@internal/db')) // fictional fixture
    const context = { params: Promise.resolve({ id: 'fixture' }) }
    const responses = await Promise.all([
      freightPost(request('POST', { cityName: 'Fixture', value: 10 })),
      PATCH(request('PATCH', { value: 10 }), context),
      DELETE(request('DELETE'), context),
      addressPost(request('POST', { addressId: 'fixture' })),
    ])
    for (const response of responses) {
      expect(response.status).toBe(500)
      expect(JSON.stringify(await response.json())).not.toMatch(/postgresql|private|password|internal/)
    }
  })
  it('preserves existing duplicate and ownership-denial contracts', async () => {
    vi.mocked(createFreightRule).mockRejectedValue(new Error('Regra de frete já existe para esta loja e cidade.'))
    vi.mocked(setDefaultAddress).mockRejectedValue(new Error('Endereço não encontrado ou acesso não autorizado'))
    expect((await freightPost(request('POST', { cityName: 'Fixture', value: 10 }))).status).toBe(409)
    expect((await addressPost(request('POST', { addressId: 'foreign' }))).status).toBe(400)
  })
  it.each([{ name: ' '.repeat(2) }, { name: 'x'.repeat(151) }, { phone: '1'.repeat(21) }])('rejects invalid persisted registration fields %o', extra => {
    expect(registerSchema.safeParse({ name: 'Fixture', email: 'fixture@example.test', password: 'fixture-password', ...extra }).success).toBe(false)
  })
})
