import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  headers: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(),
}));
vi.mock('next/headers', () => ({ headers: mocks.headers }));
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock('@/lib/prisma', () => ({ default: { loja: {
  findFirst: mocks.findFirst, findUnique: mocks.findUnique,
} } }));

import { getLojaFromHeaders, getTenantAliasId, getTenantCanonicalOrigin, type TenantContext } from '@/lib/tenant';

const id = '3a82b33c-3646-4272-9a89-80bb1ba327a5';
const host = 'continental-hml-15531616695.southamerica-east1.run.app';
const alternate = 'continental-hml-jctvprygla-rj.a.run.app';
const vercel = 'continental-prototipo-git-homologacaoteste-vinimoias-projects.vercel.app';
const store = { id, slug: 'continental-homologacao', customDomain: vercel };

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('VERCEL', '');
  vi.stubEnv('TRUSTED_PROXY_PROVIDER', '');
  vi.stubEnv('PLATFORM_DOMAIN', 'plataforma.test');
  vi.stubEnv('TENANT_HOST_ALIASES', JSON.stringify({ [host]: id, [alternate]: id }));
  mocks.headers.mockResolvedValue(new Headers({ host }));
  mocks.findFirst.mockResolvedValue(null);
  mocks.findUnique.mockResolvedValue(store);
});
afterEach(() => vi.unstubAllEnvs());

describe('Explicit server-side tenant aliases', () => {
  it.each([host, alternate, `${host.toUpperCase()}.:443`])('resolves only a configured host: %s', async requestHost => {
    mocks.headers.mockResolvedValue(new Headers({ host: requestHost }));
    expect(await getLojaFromHeaders()).toEqual(store);
    expect(mocks.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id } }));
  });

  it.each(['unknown.run.app', `evil.${host}`, `${host}.attacker.test`])('rejects unknown and suffix-confusion hosts: %s', async requestHost => {
    mocks.headers.mockResolvedValue(new Headers({ host: requestHost }));
    expect(await getLojaFromHeaders()).toBeNull();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it('does not trust a forged forwarded host', async () => {
    mocks.headers.mockResolvedValue(new Headers({ host: 'unknown.run.app', 'x-forwarded-host': host }));
    expect(await getLojaFromHeaders()).toBeNull();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it('preserves the registered Vercel domain and canonical links', async () => {
    mocks.headers.mockResolvedValue(new Headers({ host: vercel }));
    mocks.findFirst.mockResolvedValue(store);
    expect(await getLojaFromHeaders()).toEqual(store);
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(getTenantCanonicalOrigin(store as TenantContext)).toBe(`https://${vercel}`);
  });

  it('does not override a host already owned by another tenant', async () => {
    const other = { ...store, id: 'c5d21465-55fc-446f-afb9-e50a6b1f8443' };
    mocks.findFirst.mockResolvedValue(other);
    expect(await getLojaFromHeaders()).toEqual(other);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it('fails closed if the configured store no longer exists', async () => {
    mocks.findUnique.mockResolvedValue(null);
    expect(await getLojaFromHeaders()).toBeNull();
  });

  it.each([
    '', '{broken', 'null', '[]', '"string"',
    JSON.stringify({ '*.run.app': id }),
    JSON.stringify({ [`https://${host}`]: id }),
    JSON.stringify({ [`${host}:443`]: id }),
    JSON.stringify({ [host]: 'missing-id' }),
    JSON.stringify({ [host]: { id } }),
    JSON.stringify({ [host]: id, [host.toUpperCase()]: id }),
    JSON.stringify(Object.fromEntries(Array.from({ length: 33 }, (_, i) => [`host${i}.run.app`, id]))),
    ' '.repeat(8193),
  ])('rejects absent/malformed/ambiguous alias configuration (%#)', configuration => {
    expect(getTenantAliasId(host, configuration)).toBeNull();
  });
});
