import { request as httpRequest } from 'node:http'

function getBaseUrl(): string {
  const value = process.env.TEST_BASE_URL
  if (!value || process.env.NODE_ENV !== 'test') throw new Error('Explicit isolated TEST_BASE_URL required')
  const url = new URL(value)
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.protocol !== 'http:' || url.username || url.password) {
    throw new Error('TEST_BASE_URL must target a local isolated HTTP server')
  }
  return url.origin
}
interface RequestOptions {
  headers?: Record<string, string>
  query?: Record<string, string>
}
interface ResponseData { status: number; body: unknown }

function buildUrl(path: string, query?: Record<string, string>): URL {
  const url = new URL(path, getBaseUrl())
  if (url.origin !== getBaseUrl()) throw new Error('Cross-origin test request blocked')
  for (const [key, value] of Object.entries(query ?? {})) url.searchParams.append(key, value)
  return url
}

function request(method: string, path: string, body?: unknown, options?: RequestOptions): Promise<ResponseData> {
  const url = buildUrl(path, options?.query)
  const payload = body === undefined ? undefined : JSON.stringify(body)
  // Node 22 fetch ignores a custom Host header. Native HTTP preserves tenant
  // selection while the actual TCP destination remains the validated loopback URL.
  return new Promise((resolve, reject) => {
    const req = httpRequest(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...options?.headers,
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}) },
    }, response => {
      const chunks: Buffer[] = []
      response.on('data', chunk => chunks.push(chunk))
      response.on('error', reject)
      response.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8')
        try {
          resolve({ status: response.statusCode ?? 0, body: response.headers['content-type']?.includes('application/json') ? JSON.parse(raw) : raw })
        } catch (error) { reject(error) }
      })
    })
    req.on('error', reject)
    req.setTimeout(15000, () => req.destroy(new Error('Isolated HTTP test timed out')))
    req.end(payload)
  })
}
export const get = (path: string, options?: RequestOptions) => request('GET', path, undefined, options)
export const patch = (path: string, body: unknown, options?: RequestOptions) => request('PATCH', path, body, options)
export const post = (path: string, body: unknown, options?: RequestOptions) => request('POST', path, body, options)
export const del = (path: string, options?: RequestOptions) => request('DELETE', path, undefined, options)
