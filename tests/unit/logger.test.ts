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
})
