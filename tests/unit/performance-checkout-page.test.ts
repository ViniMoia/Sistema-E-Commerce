import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

describe('PERF-004: checkout sem waterfall de configuração', () => {
  it('resolve o tenant no servidor e envia apenas o DTO necessário', () => {
    const source = fs.readFileSync(path.join(root, 'app/checkout/page.tsx'), 'utf8')

    expect(source).toContain('await getLojaFromHeaders()')
    expect(source).toContain('<CheckoutPageClient')
    expect(source).not.toContain("'use client'")
    expect(source).not.toContain('/api/loja/active')
  })

  it('não refaz configuração após hydration, hidrata o carrinho e carrega o formulário sob demanda', () => {
    const source = fs.readFileSync(
      path.join(root, 'components/checkout/CheckoutPageClient.tsx'),
      'utf8'
    )

    expect(source).toContain("dynamic(")
    expect(source).toContain("import('@/components/checkout/CheckoutForm')")
    expect(source).not.toContain('/api/loja/active')
    expect(source).toContain("if (status === 'idle') void fetchCart()")
  })
})
