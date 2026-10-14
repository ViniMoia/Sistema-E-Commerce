import { describe, expect, it, vi, afterEach } from 'vitest';
import { normalizeHost, selectRequestHost, getLojaFromHeaders } from '@/lib/tenant';
import { logger } from '@/lib/logger';
import prisma from '@/lib/prisma';

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers({ host: 'forged.vercel.app' })) }));
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock('@/lib/prisma', () => ({ default: { loja: { findUnique: vi.fn(), findFirst: vi.fn() } } }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe('V-03: fronteiras de host e logs', () => {
  it.each(['shop.example/evil', 'shop<script>.example', 'shop.example\r\ninjected', 'shop.example:bad', 'shop..example', 'shop.example:65536'])('recusa host inválido sem transformá-lo em outro domínio: %s', host => {
    expect(normalizeHost(host)).toBe('');
  });
  it('ignora forwarded host sem proxy declarado, inclusive no Cloud Run', () => {
    expect(selectRequestHost('shop.example', 'other.example', '')).toBe('shop.example');
    expect(selectRequestHost('shop.example', 'other.example', 'google')).toBe('shop.example');
    expect(selectRequestHost('shop.example', 'other.example,third.example', 'generic')).toBe('');
  });
  it('não transforma domínio Vercel arbitrário em loja padrão fora do Preview', async () => {
    vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('VERCEL', ''); vi.stubEnv('VERCEL_ENV', '');
    vi.mocked(prisma.loja.findUnique).mockResolvedValue({ id: 'default-store' } as never);
    vi.mocked(prisma.loja.findFirst).mockResolvedValue(null);
    expect(await getLojaFromHeaders()).toBeNull();
    expect(prisma.loja.findUnique).not.toHaveBeenCalled();
  });
  it('redige instrumento completo, PAN/CVV numéricos e credenciais em objetos', () => {
    const result = logger.info('teste', { creditCard: { number: '4111111111111111', ccv: '123' },
      pan: 4111111111111111, cvv: 123, headers: { cookie: 'session_id=secret', authorization: 'secret' },
      secret: { value: 'secret' }, cardToken: ['secret'] });
    const text = JSON.stringify(result.context);
    expect(text).not.toContain('4111111111111111'); expect(text).not.toContain('123');
    expect(text).not.toContain('session_id=secret'); expect(result.context?.secret).toBe('[REDACTED]');
    expect(result.context?.creditCard).toBe('[REDACTED]');
  });
  it('redige PAN/CVV em mensagem e erro sem ocultar status operacional', () => {
    const result = logger.error('number=4111111111111111 ccv=123', new Error('PAN: 4111 1111 1111 1111 CVV: 456'), { status: 'PENDING' });
    expect(result.message + result.error?.message).not.toMatch(/4111|123|456/);
    expect(result.context?.status).toBe('PENDING');
  });
});
