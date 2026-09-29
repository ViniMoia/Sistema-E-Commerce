import { describe, it, expect } from 'vitest'
import { Logger, sanitizeLogText } from '@/lib/logger'
import {
  createRequestLogContext,
  runWithLogContext,
} from '@/lib/observability/request-context'

describe('Logging Estruturado e Observabilidade (OPS-001)', () => {
  it('deve gerar log estruturado em formato JSON com timestamp e nível', () => {
    const logger = new Logger()
    const entry = logger.info('Checkout iniciado', { action: 'CHECKOUT_START' })

    expect(entry.level).toBe('info')
    expect(entry.message).toBe('Checkout iniciado')
    expect(entry.timestamp).toBeDefined()
    expect(entry.context?.action).toBe('CHECKOUT_START')
  })

  it('deve herdar e enriquecer contexto com withContext', () => {
    const baseLogger = new Logger({ tenantId: 'loja-xyz' })
    const requestLogger = baseLogger.withContext({ userId: 'user-123', requestId: 'req-abc' })

    const entry = requestLogger.warn('Tentativa de acesso não autorizado')

    expect(entry.level).toBe('warn')
    expect(entry.context?.tenantId).toBe('loja-xyz')
    expect(entry.context?.userId).toBe('user-123')
    expect(entry.context?.requestId).toBe('req-abc')
  })

  it('deve estruturar objetos de erro com name, message e stack', () => {
    const logger = new Logger()
    const error = new Error('Falha de conexão com banco de dados')

    const entry = logger.error('Erro de infraestrutura', error, { tenantId: 'loja-xyz' })

    expect(entry.level).toBe('error')
    expect(entry.error?.name).toBe('Error')
    expect(entry.error?.message).toBe('Falha de conexão com banco de dados')
    expect(entry.error?.stack).toBeDefined()
    expect(entry.context?.tenantId).toBe('loja-xyz')
  })

  it('deve mascarar automaticamente CPF/CNPJ e redigir credenciais em logs (LGPD)', () => {
    const logger = new Logger()
    const entry = logger.info('Dados de cliente recebidos', {
      orderId: 'ord-1234',
      correlationId: 'corr-5678',
      asaasPaymentId: 'pay-9999',
      customer: {
        cpfCnpj: '52998224725',
        cnpj: '11222333000181',
        email: 'cliente.sensivel@exemplo.test',
      },
      asaasApiKey: '$aact_fixture_not_a_secret',
      webhookToken: 'whsec_secret_123',
    })

    expect(entry.context?.orderId).toBe('ord-1234')
    expect(entry.context?.correlationId).toBe('corr-5678')
    expect(entry.context?.asaasPaymentId).toBe('pay-9999')
    // PII removido do contexto operacional
    expect((entry.context?.customer as any)?.cpfCnpj).toBe('[PII_REDACTED]')
    expect((entry.context?.customer as any)?.cnpj).toBe('[PII_REDACTED]')
    expect((entry.context?.customer as any)?.email).toBe('[PII_REDACTED]')
    // Segredos redigidos
    expect(entry.context?.asaasApiKey).toBe('[REDACTED]')
    expect(entry.context?.webhookToken).toBe('[REDACTED]')
  })

  it('deve sanear PII e bearer embutidos em mensagem e stack de erro', () => {
    const logger = new Logger()
    const error = new Error(
      'Falha para vitima@exemplo.test CPF 529.982.247-25 com Bearer segredo e token=abc123'
    )

    const entry = logger.error('Erro de cliente vitima@exemplo.test', error)
    const serialized = JSON.stringify(entry)

    expect(serialized).not.toContain('vitima@exemplo.test')
    expect(serialized).not.toContain('529.982.247-25')
    expect(serialized).not.toContain('Bearer segredo')
    expect(serialized).not.toContain('token=abc123')
    expect(serialized).toContain('[EMAIL_REDACTED]')
  })

  it('preserva UUID de correlação sem deixar de redigir telefone', () => {
    const requestId = 'e1308079-2979-4ac1-a7e6-fb93cd1c5da4'

    expect(sanitizeLogText(requestId)).toBe(requestId)
    expect(sanitizeLogText('telefone (11) 99876-5432')).toBe('telefone [PHONE_REDACTED]')
  })

  it('deve remover PII, payloads, cookies e segredos aninhados do contexto', () => {
    const logger = new Logger()
    const entry = logger.error('Falha controlada', new Error(
      'telefone (11) 99876-5432; cookie=session=abc; resetToken=reset-secret'
    ), {
      orderId: 'ord-observability-1',
      customer: {
        email: 'cliente@exemplo.test',
        phone: '(11) 99876-5432',
        address: 'Rua Privada, 123',
      },
      payload: { password: 'senha', cardNumber: '4111111111111111' },
    })
    const serialized = JSON.stringify(entry)

    expect(serialized).toContain('ord-observability-1')
    for (const marker of [
      'cliente@exemplo.test',
      '99876-5432',
      'Rua Privada',
      '4111111111111111',
      'reset-secret',
      'session=abc',
    ]) {
      expect(serialized).not.toContain(marker)
    }
  })

  it('deve propagar o mesmo contexto em chamadas assÃ­ncronas sem aceitar header arbitrÃ¡rio', async () => {
    const invalid = createRequestLogContext(new Headers({
      'x-request-id': '<script>'.repeat(40),
    }))
    expect(invalid.requestId).toMatch(/^[0-9a-f-]{36}$/)
    expect(invalid.externalRequestId).toBeUndefined()

    const safe = createRequestLogContext(new Headers({
      'x-request-id': 'edge-request-12345678',
    }))
    const entries = await runWithLogContext(safe, async () => [
      new Logger().info('checkout', { action: 'CHECKOUT_STARTED' }),
      await Promise.resolve(new Logger().info('estoque', { action: 'INVENTORY_RESERVED' })),
      new Logger().info('webhook', {
        action: 'ASAAS_WEBHOOK_PROCESSED',
        orderId: 'ord-observability-1',
      }),
      new Logger().info('pontos', {
        action: 'LOYALTY_EFFECT_COMMITTED',
        orderId: 'ord-observability-1',
      }),
    ])

    expect(safe.externalRequestId).toBe('edge-request-12345678')
    expect(new Set(entries.map(entry => entry.context?.requestId))).toEqual(
      new Set([safe.requestId])
    )
    expect(entries.slice(2).every(entry => entry.context?.orderId === 'ord-observability-1')).toBe(true)
  })
})

