/** Fail closed: a test URL is supplied by the disposable database provisioner. */
export function testDatabaseConfig(env: Record<string, string | undefined> = process.env) {
  const runId = env.TEST_RUN_ID
  if (!runId || !/^[a-f0-9]{32}$/.test(runId) || !env.TEST_DATABASE_URL) {
    throw new Error('Banco de testes não provisionado. Use npm run test:integration:isolated.')
  }
  let url: URL
  try { url = new URL(env.TEST_DATABASE_URL) } catch {
    throw new Error('TEST_DATABASE_URL inválida.')
  }
  const database = `ecommerce_test_${runId}`
  const role = 'ecommerce_test'
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    || decodeURIComponent(url.pathname) !== `/${database}`
    || decodeURIComponent(url.username) !== role
    || !url.password || !url.port || url.hash
    || [...url.searchParams.keys()].some(key => !['schema', 'connection_limit', 'connect_timeout'].includes(key))
    || [...url.searchParams.keys()].some(key => url.searchParams.getAll(key).length !== 1)
    || (url.searchParams.has('schema') && url.searchParams.get('schema') !== 'public')) {
    throw new Error('Conexão de teste não corresponde ao banco descartável desta execução.')
  }
  return { url: url.toString(), database, role, runId }
}

export interface TestDatabaseIdentity {
  database: string
  role: string
  runId: string
  superuser: boolean
  createDb: boolean
}

export function assertTestDatabaseIdentity(identity: TestDatabaseIdentity | undefined, env: Record<string, string | undefined> = process.env) {
  const expected = testDatabaseConfig(env)
  if (!identity || identity.database !== expected.database || identity.role !== expected.role
    || identity.runId !== expected.runId || identity.superuser || identity.createDb) {
    throw new Error('Identidade/sentinela do banco de testes divergente. Operação bloqueada.')
  }
  return expected
}

export function testServerConfig(env: Record<string, string | undefined> = process.env) {
  const database = testDatabaseConfig(env)
  if (!env.TEST_BASE_URL || !env.TEST_HTTP_TOKEN || !/^[a-f0-9]{64}$/.test(env.TEST_HTTP_TOKEN)) {
    throw new Error('Servidor isolado de testes não configurado.')
  }
  const url = new URL(env.TEST_BASE_URL)
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    || !url.port || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('TEST_BASE_URL deve identificar exclusivamente o servidor descartável local.')
  }
  return { ...database, baseUrl: url.origin, token: env.TEST_HTTP_TOKEN }
}
