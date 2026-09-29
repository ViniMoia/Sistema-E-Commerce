import { describe, expect, it } from 'vitest'
import { findPotentialSecrets } from '@/scripts/scan-secrets.mjs'

const { validateEnvironment } = require('../../lib/config/environment.cjs')

const validProductionEnvironment = {
  APP_ENV: 'production',
  DATABASE_URL: 'postgresql://app:local-fixture@db.invalid:5432/shop',
  DIRECT_URL: 'postgresql://migrator:local-fixture@db.invalid:5432/shop',
  PLATFORM_DOMAIN: 'shops.invalid',
  NEXT_PUBLIC_APP_URL: 'https://shops.invalid',
  FREIGHT_QUOTE_SECRET: 'f'.repeat(32),
  ASAAS_API_KEY: '$aact_fixture_not_a_real_key',
  ASAAS_API_URL: 'https://api.asaas.com/v3',
  ASAAS_WEBHOOK_TOKEN: 'w'.repeat(32),
  CRON_SECRET: 'c'.repeat(32),
  RESEND_API_KEY: 're_fixture_not_a_real_key',
  EMAIL_FROM: 'Loja <no-reply@shops.invalid>',
  OBSERVABILITY_TOKEN: 'o'.repeat(32),
  ENABLE_DIRECT_UPLOAD: 'false',
  ENABLE_WEBHOOK_SIMULATOR: 'false',
  NEXT_PUBLIC_ENABLE_WEBHOOK_SIMULATOR: 'false',
  ALLOW_ADMIN_BOOTSTRAP: 'false',
}

describe('contrato operacional de ambiente (INF-006/INF-010)', () => {
  it('aceita contrato completo sem devolver valores sensíveis', () => {
    expect(validateEnvironment(validProductionEnvironment, { requireMigration: true }))
      .toMatchObject({ appEnvironment: 'production', deployed: true })
  })

  it('falha fechado e informa somente nomes/regras', () => {
    let message = ''
    try {
      validateEnvironment({ APP_ENV: 'production', ASAAS_API_KEY: 'valor-super-secreto' })
    } catch (error) {
      message = (error as Error).message
    }

    expect(message).toContain('DATABASE_URL')
    expect(message).toContain('RESEND_API_KEY')
    expect(message).not.toContain('valor-super-secreto')
  })

  it('rejeita sandbox e ferramentas mutáveis em produção', () => {
    expect(() => validateEnvironment({
      ...validProductionEnvironment,
      ASAAS_API_URL: 'https://sandbox.asaas.com/api/v3',
      ENABLE_WEBHOOK_SIMULATOR: 'true',
    })).toThrow(/ASAAS_API_URL de produção|ENABLE_WEBHOOK_SIMULATOR/)
  })

  it('não permite degradar um runtime production para contrato local/test', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'production', APP_ENV: 'test' }))
      .toThrow(/APP_ENV deve representar ambiente implantado/)
  })

  it('valida faixas numéricas antes de aceitar tráfego', () => {
    expect(() => validateEnvironment({
      ...validProductionEnvironment,
      INSTALLMENT_MAX_COUNT: 'NaN',
      BOLETO_DUE_DAYS: '0',
    })).toThrow(/INSTALLMENT_MAX_COUNT|BOLETO_DUE_DAYS/)
  })
})

describe('scanner local sem exposição do valor (INF-005/INF-013)', () => {
  it('reporta somente caminho e linha para padrão suspeito', () => {
    const value = ['postgresql://user:credential', 'db.invalid/shop'].join(String.fromCharCode(64))
    const findings = findPotentialSecrets('docs/example.md', `prefix\n${value}\nsuffix`)
    expect(findings).toEqual([{ path: 'docs/example.md', line: 2 }])
    expect(JSON.stringify(findings)).not.toContain('credential')
  })

  it('aceita placeholders declarados', () => {
    expect(findPotentialSecrets('.env.example', 'RESEND_API_KEY="re_sua_chave_aqui"')).toEqual([])
  })
})
