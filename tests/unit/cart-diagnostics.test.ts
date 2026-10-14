import { it, expect, vi } from 'vitest';
import { observeCartRequest } from '@/lib/commerce/cart-diagnostics';
import { logger } from '@/lib/logger';
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn() } }));

it('correlates a failure using only safe metadata and retains its status and body', async () => {
  const request = new Request('http://local/api/cart', { method: 'POST', body: 'private request', headers: { Cookie: 'secret' } });
  const response = await observeCartRequest(request, async () => Response.json({ code: 'CONFLICT' }, { status: 409 }));
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ code: 'CONFLICT' });
  expect(response.headers.get('server-timing')).toMatch(/^cart;dur=\d+$/);
  expect(logger.warn).toHaveBeenCalledWith(expect.any(String), {
    action: 'CART_HTTP', requestId: response.headers.get('x-request-id'), method: 'POST', status: 409, durationMs: expect.any(Number),
  });
  expect(JSON.stringify(vi.mocked(logger.warn).mock.calls)).not.toMatch(/secret|private request/);
});
