import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

import { POST } from '@/app/api/admin/orders/[orderId]/refund/route'
import { requireAdmin } from '@/lib/auth/guards'
import { requestOrderRefund } from '@/services/refund.service'

vi.mock('@/lib/auth/guards', () => ({ requireAdmin: vi.fn() }))
vi.mock('@/services/refund.service', () => ({
  RefundError: class RefundError extends Error {
    constructor(public code: string, message: string) { super(message) }
  },
  requestOrderRefund: vi.fn(),
}))

const context = { params: Promise.resolve({ orderId: 'order-1' }) }

describe('admin refund endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAdmin).mockResolvedValue({
      user: { id: 'admin-1', lojaID: 'store-1', role: 'ADMIN', status: 'ACTIVE' },
    } as any)
  })

  it('exige idempotencia antes de chamar o dominio', async () => {
    const response = await POST(new Request('http://localhost/api/admin/orders/order-1/refund', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'Cancelamento' }),
    }), context)

    expect(response.status).toBe(400)
    expect(requestOrderRefund).not.toHaveBeenCalled()
  })

  it('responde 202 e nao apresenta pedido como reembolsado antes da confirmacao', async () => {
    vi.mocked(requestOrderRefund).mockResolvedValueOnce({
      id: 'refund-1', orderId: 'order-1', amount: 100, kind: 'FULL',
      status: 'PROCESSING', providerStatus: 'REFUND_IN_PROGRESS',
    } as any)
    const response = await POST(new Request('http://localhost/api/admin/orders/order-1/refund', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': 'refund-key-123' },
      body: JSON.stringify({ reason: 'Cancelamento solicitado pelo cliente' }),
    }), context)
    const body = await response.json()

    expect(response.status).toBe(202)
    expect(body.data.status).toBe('PROCESSING')
    expect(JSON.stringify(body)).not.toContain('REFUNDED')
    expect(requestOrderRefund).toHaveBeenCalledWith(expect.objectContaining({
      orderId: 'order-1', lojaID: 'store-1', requestedById: 'admin-1',
      operationKey: 'refund-key-123',
    }))
  })

  it('interrompe antes do dominio para usuario sem perfil administrativo', async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce(
      NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    )
    const response = await POST(new Request('http://localhost/api/admin/orders/order-1/refund', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': 'refund-key-123' },
      body: JSON.stringify({ reason: 'Cancelamento' }),
    }), context)
    expect(response.status).toBe(403)
    expect(requestOrderRefund).not.toHaveBeenCalled()
  })
})
