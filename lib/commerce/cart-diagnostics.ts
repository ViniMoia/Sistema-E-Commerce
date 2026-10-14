import { logger } from '@/lib/logger';

/** Correlate HTTP failures without logging a cart, session, user or request body. */
export async function observeCartRequest(request: Request, handler: (request: Request) => Promise<Response>): Promise<Response> {
  const requestId = crypto.randomUUID();
  const started = performance.now();
  const response = await handler(request);
  const durationMs = Math.round(performance.now() - started);
  response.headers.set('X-Request-Id', requestId);
  response.headers.set('Server-Timing', `cart;dur=${durationMs}`);
  response.headers.set('Cache-Control', 'no-store');
  const context = { action: 'CART_HTTP', requestId, method: request.method, status: response.status, durationMs };
  if (!response.ok) logger.warn('Falha na requisição do carrinho', context);
  else if (durationMs >= 1000) logger.info('Requisição lenta do carrinho', context);
  return response;
}
