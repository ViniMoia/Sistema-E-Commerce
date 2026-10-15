import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { proxy, config } from '@/proxy';
import { applicationMaintenanceActive } from '@/lib/application-maintenance';

afterEach(() => vi.unstubAllEnvs());
describe('exclusive application maintenance', () => {
  it.each([undefined, 'false'])('does not change normal runtime for %s', value => {
    vi.stubEnv('APP_MAINTENANCE_MODE', value);
    expect(applicationMaintenanceActive()).toBe(false);
  });
  it.each(['true', '', 'FALSE', 'invalid'])('closes on configured value %s', value => {
    vi.stubEnv('APP_MAINTENANCE_MODE', value);
    expect(applicationMaintenanceActive()).toBe(true);
  });
  it.each([
    ['GET', '/api/checkout/intents'], ['PATCH', '/api/checkout/intents'],
    ['GET', '/api/cart'], ['POST', '/api/cart'], ['GET', '/api/cron/payments'],
    ['POST', '/api/cron/payments'], ['GET', '/api/cron/orders-timeout'],
    ['POST', '/api/cron/loyalty-expiration'], ['POST', '/api/webhooks/asaas'],
    ['POST', '/api/auth/login'], ['DELETE', '/api/products/id'],
    ['PUT', '/api/loja/settings'], ['PATCH', '/api/admin/orders/id/status'],
    ['POST', '/api/future-route.png'], ['OPTIONS', '/api/checkout'],
  ])('blocks %s %s before auth or handlers', async (method, path) => {
    vi.stubEnv('APP_MAINTENANCE_MODE', 'true');
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: path })).toBe(true);
    const result = await proxy(new NextRequest('https://example.invalid' + path, { method,
      headers: { cookie: 'session_id=valid-looking-session', 'x-app-maintenance-mode': 'false' } }));
    expect(result.status).toBe(503);
    expect(result.headers.get('cache-control')).toContain('no-store');
    expect(result.headers.get('set-cookie')).toBeNull();
    expect(await result.json()).toEqual({ success: false, error: 'APP_MAINTENANCE' });
  });
  it.each(['/', '/admin', '/profile', '/checkout', '/_next/static/file.js'])('serves self-contained maintenance for %s', async path => {
    vi.stubEnv('APP_MAINTENANCE_MODE', 'true');
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: path })).toBe(true);
    const result = await proxy(new NextRequest('https://example.invalid' + path));
    expect(result.status).toBe(503);
    expect(result.headers.get('location')).toBeNull();
    expect(await result.text()).toContain('Estamos em manutenção');
  });
  it('preserves admin authentication and checkout-only drain after reopening', async () => {
    vi.stubEnv('APP_MAINTENANCE_MODE', 'false');
    vi.stubEnv('CHECKOUT_PAUSED', 'true');
    expect((await proxy(new NextRequest('https://example.invalid/admin'))).headers.get('location')).toBe('https://example.invalid/login');
    expect((await proxy(new NextRequest('https://example.invalid/api/webhooks/asaas', { method: 'POST' }))).headers.get('x-middleware-next')).toBe('1');
  });
});
