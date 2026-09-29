import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'

export type RequestLogContext = Record<string, unknown> & {
  requestId: string
  correlationId: string
  externalRequestId?: string
}

const requestContext = new AsyncLocalStorage<Record<string, unknown>>()
const SAFE_EXTERNAL_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/

function safeExternalRequestId(headers: Headers): string | undefined {
  const candidate = headers.get('x-request-id') || headers.get('x-correlation-id')
  return candidate && SAFE_EXTERNAL_ID.test(candidate) ? candidate : undefined
}

export function createRequestLogContext(headers: Headers): RequestLogContext {
  const requestId = randomUUID()
  const externalRequestId = safeExternalRequestId(headers)

  return {
    requestId,
    correlationId: externalRequestId || requestId,
    ...(externalRequestId ? { externalRequestId } : {}),
  }
}

export function runWithLogContext<T>(
  context: Record<string, unknown>,
  callback: () => T
): T {
  return requestContext.run({ ...context }, callback)
}

export function enrichLogContext(context: Record<string, unknown>): void {
  const active = requestContext.getStore()
  if (active) Object.assign(active, context)
}

export function getLogContext(): Record<string, unknown> {
  return requestContext.getStore() || {}
}

export function attachRequestId(response: Response, requestId: string): Response {
  response.headers.set('x-request-id', requestId)
  return response
}
