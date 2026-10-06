import { testServerConfig } from '@/lib/testing/database-policy'
import { request as httpRequest } from 'node:http'

export async function verifyTestServer(): Promise<void> {
  const config = testServerConfig()
  const response = await fetch(`${config.baseUrl}/api/test-environment`, {
    headers: { 'x-test-environment-token': config.token },
    redirect: 'error', signal: AbortSignal.timeout(10000), cache: 'no-store',
  })
  if (!response.ok) throw new Error('Servidor não confirmou o ambiente isolado. Requisição de teste bloqueada.')
  const identity = await response.json()
  if (identity.runId !== config.runId || identity.database !== config.database) {
    throw new Error('Servidor e fixtures usam ambientes diferentes. Requisição de teste bloqueada.')
  }
}

interface RequestOptions {
  headers?: Record<string, string>
  query?: Record<string, string>
}

interface ResponseData {
  status: number
  body: unknown
  headers?: Record<string, string>
}

function hasVirtualHost(options?: RequestOptions): boolean {
  return Object.keys(options?.headers || {}).some(key => key.toLowerCase() === 'host')
}

// Native HTTP keeps an explicit Host for virtual-tenant tests. Fetch may replace
// that header with the URL authority. The socket still uses the verified local
// origin from buildUrl: the supplied Host never changes the network destination.
function requestWithVirtualHost(url: string, method: string, options?: RequestOptions, body?: unknown): Promise<ResponseData> {
  const config = testServerConfig()
  if (new URL(url).origin !== config.baseUrl || new URL(url).protocol !== 'http:') {
    throw new Error('Origem de teste HTTP virtual divergente.')
  }
  return new Promise((resolve, reject) => {
    const req = httpRequest(url, { method, headers: { 'Content-Type': 'application/json', ...options?.headers } }, response => {
      const chunks: Buffer[] = []
      let bytes = 0
      response.on('error', reject)
      response.on('data', chunk => {
        bytes += chunk.length
        if (bytes > 10 * 1024 * 1024) req.destroy(new Error('Resposta de teste excede o limite.'))
        else chunks.push(chunk)
      })
      response.on('end', () => {
        const status = response.statusCode || 500
        if (status >= 300 && status < 400) { reject(new Error('Redirect de teste bloqueado.')); return }
        const content = Buffer.concat(chunks).toString('utf8')
        try { resolve({ status,
          headers: Object.fromEntries(Object.entries(response.headers).filter(([, value]) => value !== undefined).map(([key, value]) => [key, Array.isArray(value) ? value.join(', ') : value!])),
          body: response.headers['content-type']?.includes('application/json') ? JSON.parse(content) : content }) }
        catch (error) { reject(error) }
      })
    })
    req.on('error', reject)
    req.setTimeout(10000, () => req.destroy(new Error('Timeout de teste HTTP.')))
    req.end(body === undefined ? undefined : JSON.stringify(body))
  })
}

function buildUrl(path: string, query?: Record<string, string>): string {
  const config = testServerConfig()
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Path de teste deve ser relativo ao servidor isolado.')
  const url = new URL(path, config.baseUrl)
  if (url.origin !== config.baseUrl) throw new Error('Origem externa de teste bloqueada.')

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      url.searchParams.append(key, value)
    })
  }

  return url.toString()
}

export async function get(
  path: string,
  options?: RequestOptions
): Promise<ResponseData> {
  const url = buildUrl(path, options?.query)
  await verifyTestServer()
  if (hasVirtualHost(options)) return requestWithVirtualHost(url, 'GET', options)

  const response = await fetch(url, {
    method: 'GET',
    redirect: 'error',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    },
    credentials: 'include'
  })

  let body: unknown
  const contentType = response.headers.get('content-type')

  if (contentType?.includes('application/json')) {
    body = await response.json()
  } else {
    body = await response.text()
  }

  return {
    status: response.status,
    body
  }
}

export async function patch(
  path: string,
  body: unknown,
  options?: RequestOptions
): Promise<ResponseData> {
  const url = buildUrl(path)
  await verifyTestServer()
  if (hasVirtualHost(options)) return requestWithVirtualHost(url, 'PATCH', options, body)

  const response = await fetch(url, {
    method: 'PATCH',
    redirect: 'error',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    },
    body: JSON.stringify(body),
    credentials: 'include'
  })

  let responseBody: unknown
  const contentType = response.headers.get('content-type')

  if (contentType?.includes('application/json')) {
    responseBody = await response.json()
  } else {
    responseBody = await response.text()
  }

  return {
    status: response.status,
    body: responseBody
  }
}

export async function post(
  path: string,
  body: unknown,
  options?: RequestOptions
): Promise<ResponseData> {
  const url = buildUrl(path)
  await verifyTestServer()
  if (hasVirtualHost(options)) return requestWithVirtualHost(url, 'POST', options, body)

  const response = await fetch(url, {
    method: 'POST',
    redirect: 'error',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    },
    body: JSON.stringify(body),
    credentials: 'include'
  })

  let responseBody: unknown
  const contentType = response.headers.get('content-type')

  if (contentType?.includes('application/json')) {
    responseBody = await response.json()
  } else {
    responseBody = await response.text()
  }

  return {
    status: response.status,
    body: responseBody
  }
}

export async function del(
  path: string,
  options?: RequestOptions
): Promise<ResponseData> {
  const url = buildUrl(path)
  await verifyTestServer()
  if (hasVirtualHost(options)) return requestWithVirtualHost(url, 'DELETE', options)

  const response = await fetch(url, {
    method: 'DELETE',
    redirect: 'error',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    },
    credentials: 'include'
  })

  let responseBody: unknown
  const contentType = response.headers.get('content-type')

  if (contentType?.includes('application/json')) {
    responseBody = await response.json()
  } else {
    responseBody = await response.text()
  }

  return {
    status: response.status,
    body: responseBody
  }
}

export async function put(path: string, body: unknown, options?: RequestOptions): Promise<ResponseData> {
  const url = buildUrl(path)
  await verifyTestServer()
  if (hasVirtualHost(options)) return requestWithVirtualHost(url, 'PUT', options, body)
  const response = await fetch(url, {
    method: 'PUT', redirect: 'error',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(body), credentials: 'include',
  })
  return { status: response.status, body: response.headers.get('content-type')?.includes('application/json')
    ? await response.json() : await response.text() }
}
