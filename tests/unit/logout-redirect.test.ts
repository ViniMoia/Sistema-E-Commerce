import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const { deleteSession } = vi.hoisted(() => ({ deleteSession: vi.fn() }));
vi.mock('@/lib/session', () => ({ deleteSession }));
import { POST } from '@/app/api/auth/logout/route';

beforeEach(() => { deleteSession.mockReset(); deleteSession.mockResolvedValue(undefined); });
afterEach(() => vi.restoreAllMocks());

describe('Logout through a hosting proxy', () => {
  it.each(['https://0.0.0.0:8080/api/auth/logout', 'https://preview.vercel.app/api/auth/logout',
    'https://shop.run.app/api/auth/logout'])('keeps the browser on its own origin for %s', async url => {
    const response = await POST(new Request(url, { method: 'POST', headers: {
      'x-forwarded-host': 'attacker.example', 'x-forwarded-proto': 'http',
    } }));
    expect(deleteSession).toHaveBeenCalledOnce();
    expect(response.status).toBe(303);
    expect(response.headers.get('Location')).toBe('/');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(new URL(response.headers.get('Location')!, 'https://public-shop.run.app/api/auth/logout').origin)
      .toBe('https://public-shop.run.app');
  });

  it('also avoids internal/open redirects on a session cleanup failure', async () => {
    deleteSession.mockRejectedValue(new Error('SESSION_STORE_UNAVAILABLE'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await POST(new Request('https://0.0.0.0:8080/api/auth/logout', { method: 'POST' }));
    expect(response.status).toBe(303);
    expect(response.headers.get('Location')).toBe('/');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});
