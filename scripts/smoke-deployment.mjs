const baseUrlValue = process.env.SMOKE_BASE_URL?.trim()
if (!baseUrlValue) throw new Error('SMOKE_BASE_URL é obrigatória')

const baseUrl = new URL(baseUrlValue)
const localHost = ['localhost', '127.0.0.1', '::1'].includes(baseUrl.hostname)
if (!localHost && process.env.ALLOW_REMOTE_SMOKE !== 'true') {
  throw new Error('Smoke remoto exige ALLOW_REMOTE_SMOKE=true em ambiente autorizado')
}

async function check(path, expectedStatus, headers = {}) {
  const response = await fetch(new URL(path, baseUrl), {
    headers,
    signal: AbortSignal.timeout(5000),
  })
  if (response.status !== expectedStatus) {
    throw new Error(`${path} retornou status inesperado: ${response.status}`)
  }
}

await check('/api/health/live', 200)
await check('/api/health/ready', 200)
await check('/api/internal/metrics', 401)

if (process.env.OBSERVABILITY_TOKEN) {
  await check('/api/internal/metrics', 200, {
    authorization: `Bearer ${process.env.OBSERVABILITY_TOKEN}`,
  })
}

console.log('Smoke read-only concluído sem expor configuração ou credenciais.')
