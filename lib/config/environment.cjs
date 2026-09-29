const DEPLOYED_ENVIRONMENTS = new Set(['preview', 'staging', 'production'])
const VALID_APP_ENVIRONMENTS = new Set(['development', 'test', ...DEPLOYED_ENVIRONMENTS])
const VALID_PROXY_PROVIDERS = new Set(['', 'vercel', 'cloudflare', 'generic'])

class EnvironmentValidationError extends Error {
  constructor(errors) {
    super(`Configuração de ambiente inválida: ${errors.join('; ')}`)
    this.name = 'EnvironmentValidationError'
    this.errors = errors
  }
}

function isPlaceholder(value) {
  return /(?:substitua|sua[_-]|seu[_-]|placeholder|change[_-]?me|configure-no|example|exemplo)/i.test(value)
}

function isValidUrl(value, protocols) {
  try {
    const parsed = new URL(value)
    return protocols.includes(parsed.protocol) && Boolean(parsed.hostname)
  } catch {
    return false
  }
}

function validateEnvironment(env = process.env, options = {}) {
  const errors = []
  const targetEnvironment = options.targetEnvironment || env.APP_ENV || ''
  const requireMigration = options.requireMigration === true

  if (!VALID_APP_ENVIRONMENTS.has(targetEnvironment)) {
    errors.push('APP_ENV deve ser development, test, preview, staging ou production')
  }

  const deployed = DEPLOYED_ENVIRONMENTS.has(targetEnvironment)
  const production = targetEnvironment === 'production'

  if (env.NODE_ENV === 'production' && !deployed) {
    errors.push('APP_ENV deve representar ambiente implantado quando NODE_ENV=production')
  }

  function required(name, minimumLength = 1) {
    const value = env[name]?.trim() || ''
    if (!value) {
      errors.push(`${name} é obrigatória`)
      return ''
    }
    if (value.length < minimumLength) errors.push(`${name} não atende ao tamanho mínimo`)
    if (isPlaceholder(value)) errors.push(`${name} contém placeholder`)
    return value
  }

  function optionalNumber(name, fallback, { min, max, integer = false }) {
    const raw = env[name]?.trim() || String(fallback)
    const value = Number(raw)
    if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
      errors.push(`${name} está fora do formato ou faixa permitida`)
    }
  }

  for (const name of [
    'INSTALLMENT_ABSORB_FEES',
    'ENABLE_DIRECT_UPLOAD',
    'ENABLE_WEBHOOK_SIMULATOR',
    'NEXT_PUBLIC_ENABLE_WEBHOOK_SIMULATOR',
    'ALLOW_ADMIN_BOOTSTRAP',
  ]) {
    const value = env[name]?.trim()
    if (value && value !== 'true' && value !== 'false') errors.push(`${name} deve ser true ou false`)
  }

  optionalNumber('INSTALLMENT_MIN_VALUE', 20, { min: 0.01, max: 100000 })
  optionalNumber('INSTALLMENT_MAX_COUNT', 12, { min: 1, max: 24, integer: true })
  optionalNumber('INSTALLMENT_MONTHLY_RATE', 0.0299, { min: 0, max: 1 })
  optionalNumber('BOLETO_DUE_DAYS', 1, { min: 1, max: 30, integer: true })
  optionalNumber('ASAAS_MIN_VALUE', 5, { min: 0.01, max: 100000 })
  optionalNumber('EMAIL_PROVIDER_TIMEOUT_MS', 8000, { min: 100, max: 30000, integer: true })
  optionalNumber('READINESS_TIMEOUT_MS', 2000, { min: 100, max: 10000, integer: true })

  const proxyProvider = env.TRUSTED_PROXY_PROVIDER?.trim().toLowerCase() || ''
  if (!VALID_PROXY_PROVIDERS.has(proxyProvider)) {
    errors.push('TRUSTED_PROXY_PROVIDER deve estar na allowlist')
  }

  if (deployed) {
    const databaseUrl = required('DATABASE_URL')
    const appUrl = required('NEXT_PUBLIC_APP_URL')
    const asaasUrl = required('ASAAS_API_URL')
    const emailFrom = required('EMAIL_FROM')

    required('PLATFORM_DOMAIN')
    required('FREIGHT_QUOTE_SECRET', 32)
    required('ASAAS_API_KEY', 16)
    required('ASAAS_WEBHOOK_TOKEN', 16)
    required('CRON_SECRET', 32)
    required('RESEND_API_KEY', 16)
    required('OBSERVABILITY_TOKEN', 32)

    if (databaseUrl && !isValidUrl(databaseUrl, ['postgresql:', 'postgres:'])) {
      errors.push('DATABASE_URL deve ser uma URL PostgreSQL válida')
    }
    if (appUrl && !isValidUrl(appUrl, production ? ['https:'] : ['https:', 'http:'])) {
      errors.push('NEXT_PUBLIC_APP_URL deve usar protocolo permitido para o ambiente')
    }
    if (asaasUrl && !isValidUrl(asaasUrl, ['https:'])) {
      errors.push('ASAAS_API_URL deve ser uma URL HTTPS válida')
    }
    if (production && asaasUrl.includes('sandbox.asaas.com')) {
      errors.push('ASAAS_API_URL de produção não pode apontar para sandbox')
    }
    if (emailFrom && !/^.+<[^<>\s]+@[^<>\s]+>$/.test(emailFrom)) {
      errors.push('EMAIL_FROM deve conter nome e endereço entre sinais de menor/maior')
    }

    for (const name of ['ENABLE_WEBHOOK_SIMULATOR', 'NEXT_PUBLIC_ENABLE_WEBHOOK_SIMULATOR', 'ALLOW_ADMIN_BOOTSTRAP']) {
      if (env[name] === 'true') errors.push(`${name} deve permanecer false em ambiente implantado`)
    }

    if (env.ENABLE_DIRECT_UPLOAD === 'true') {
      const supabaseUrl = required('NEXT_PUBLIC_SUPABASE_URL')
      required('NEXT_PUBLIC_SUPABASE_ANON_KEY', 16)
      required('SUPABASE_SERVICE_ROLE_KEY', 16)
      if (supabaseUrl && !isValidUrl(supabaseUrl, ['https:'])) {
        errors.push('NEXT_PUBLIC_SUPABASE_URL deve ser uma URL HTTPS válida')
      }
    }
  }

  if (requireMigration) {
    const directUrl = required('DIRECT_URL')
    if (directUrl && !isValidUrl(directUrl, ['postgresql:', 'postgres:'])) {
      errors.push('DIRECT_URL deve ser uma URL PostgreSQL válida')
    }
  }

  if (errors.length) throw new EnvironmentValidationError(errors)
  return { appEnvironment: targetEnvironment, deployed, production }
}

function validateRuntimeEnvironment(env = process.env) {
  if (env.SKIP_RUNTIME_ENV_VALIDATION === 'build-only') return { skipped: true }
  return validateEnvironment(env)
}

module.exports = {
  EnvironmentValidationError,
  validateEnvironment,
  validateRuntimeEnvironment,
}
