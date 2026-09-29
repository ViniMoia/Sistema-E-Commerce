import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('admin refund presentation', () => {
  it('mantem uma chave por tentativa e nao confunde aceite com confirmacao', () => {
    const manager = source('components/admin/orders/OrderStatusManager.tsx')
    const drawer = source('components/admin/orders/OrderDetailDrawer.tsx')

    expect(manager).toContain('admin-refund-${crypto.randomUUID()}')
    expect(manager).toContain("'Idempotency-Key': refundOperationKey")
    expect(manager).toContain('A solicitacao nao cancela o pedido')
    expect(drawer).toContain("refund.status === 'CONFIRMED'")
    expect(drawer).toContain("? 'Confirmado'")
    expect(drawer).toContain(": 'Em processamento'")
  })
})
