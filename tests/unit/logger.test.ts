import { describe, it, expect } from 'vitest'
import { Logger } from '@/lib/logger'

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
      },
      asaasApiKey: '$aact_prod_secret_token_123',
      webhookToken: 'whsec_secret_123',
    })

    expect(entry.context?.orderId).toBe('ord-1234')
    expect(entry.context?.correlationId).toBe('corr-5678')
    expect(entry.context?.asaasPaymentId).toBe('pay-9999')
    // PII mascarado
    expect((entry.context?.customer as any)?.cpfCnpj).toBe('529.***.***-25')
    expect((entry.context?.customer as any)?.cnpj).toBe('11.***.***/****-81')
    // Segredos redigidos
    expect(entry.context?.asaasApiKey).toBe('[REDACTED]')
    expect(entry.context?.webhookToken).toBe('[REDACTED]')
  })
})

