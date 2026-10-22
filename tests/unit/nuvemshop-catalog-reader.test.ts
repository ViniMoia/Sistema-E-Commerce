import { afterEach, describe, expect, it, vi } from 'vitest';
import { CatalogReadError, readNuvemshopCatalog as read, type CatalogReaderConfig } from '@/lib/integrations/nuvemshop-catalog-reader';
import { planNuvemshopVariantMapping } from '@/lib/integrations/nuvemshop-variant-mapping';

const config: CatalogReaderConfig = {
  apiVersion: 'v1', environment: 'isolated', storeId: '123', accessToken: 'synthetic-only-token',
  userAgent: 'Isolated tests (test@example.invalid)', pageSize: 2,
};
const product = (id = 10) => ({
  id, published: true, updated_at: '2026-10-20T20:52:02+0000', attributes: [] as Record<string, string>[],
  variants: [{ id: id * 10, product_id: id, sku: null as string | null, barcode: '001234',
    values: [] as Record<string, string>[], stock: 5 as number | null, stock_management: true }],
});
const json = (data: unknown, total?: number, link?: string) => new Response(JSON.stringify(data), {
  headers: { 'Content-Type': 'application/json', ...(total === undefined ? {} : { 'x-total-count': String(total) }), ...(link ? { link } : {}) },
});
function harness(...responses: Response[]) {
  const fetch = vi.fn<typeof globalThis.fetch>(async () => {
    const response = responses.shift();
    if (!response) throw new Error('UNEXPECTED_REQUEST');
    return response;
  });
  const wait = vi.fn(async (_milliseconds: number) => undefined);
  return { fetch, wait };
}
const identity = () => json({ id: 123 });
function nextLink(page: number) {
  const u = new URL('https://api.nuvemshop.com.br/v1/123/products');
  u.search = new URLSearchParams({ page: String(page), per_page: '2', fields: 'id,attributes,variants,published,updated_at,visibility', sort_by: 'created-at-ascending' }).toString();
  return `<${u.href}>; rel="next"`;
}
afterEach(() => vi.useRealTimers());

describe('Nuvemshop bounded GET catalog reader with synthetic responses', () => {
  it('handles live-style sparse fieldsets and unescaped commas without weakening pagination scope', async () => {
    const next = nextLink(2).replaceAll('%2C', ',');
    const last = next.replace('rel="next"', 'rel="last"');
    const deps = harness(identity(), json([product(10), product(11)], 3, `${next}, ${last}`),
      json([{ ...product(12), published: false, visibility: 'unlisted' }], 3));
    const result = await read(config, deps);
    expect(result.scan).toMatchObject({ pages: 2, productCount: 3 });
    expect(new URL(String(deps.fetch.mock.calls[1][0])).searchParams.get('fields')).toBe('id,attributes,variants,published,updated_at,visibility');
    expect(result.observations[2]).toMatchObject({ published: false, visibility: 'unlisted' });
    expect(result.observations[0].visibility).toBeNull();
    expect(result.canApply).toBe(false);
  });

  it('validates identity, reads every page and produces the existing planner DTO', async () => {
    const deps = harness(identity(), json([product(10), product(11)], 3, nextLink(2)), json([product(12)], 3));
    const result = await read(config, deps);
    expect(result.scan).toMatchObject({ pages: 2, productCount: 3, requestCount: 3, readComplete: true, translationComplete: true, atomicSnapshot: false });
    expect(result.remote.products[0]).toEqual({ id: '10', storeId: '123', variants: [
      { id: '100', productId: '10', sku: null, barcode: '001234', size: 'Único', color: 'Padrão' },
    ] });
    expect(result.canApply).toBe(false);
    expect(deps.wait.mock.calls).toEqual([[600], [600]]);
    for (const [url, init] of deps.fetch.mock.calls) {
      expect(String(url)).toMatch(/^https:\/\/api\.nuvemshop\.com\.br\/v1\/123\//);
      expect(init).toMatchObject({ method: 'GET', redirect: 'error', cache: 'no-store',
        headers: { Authentication: 'bearer synthetic-only-token', 'User-Agent': config.userAgent } });
      expect(init).not.toHaveProperty('body');
    }
    const plan = planNuvemshopVariantMapping({
      expected: { environment: 'isolated', localStoreId: 'local', remoteStoreId: '123' },
      local: { environment: 'isolated', storeId: 'local', products: [{ id: 'local-p', storeId: 'local',
        remoteProductId: '10', sku: '001234', catalogVersion: 1, lifecycle: 'ACTIVE',
        variants: [{ id: 'local-v', productId: 'local-p', remoteVariantId: null, sku: null,
          size: 'Único', color: 'Padrão', lifecycle: 'ACTIVE' }] }] }, remote: result.remote,
    });
    expect(plan.products[0].variants).toEqual([{ localVariantId: 'local-v', remoteVariantId: '100', matchedBy: 'SINGLE_PRODUCT_CODE' }]);
  });

  it('maps reversed attribute order by labels, preserving values for domain normalization', async () => {
    const p = product(); p.attributes = [{ pt: ' Cor ' }, { pt: 'Tamanho' }];
    p.variants[0].values = [{ pt: 'Azul' }, { pt: ' G ' }];
    const result = await read(config, harness(identity(), json([p], 1)));
    expect(result.remote.products[0].variants[0]).toMatchObject({ size: 'G', color: 'Azul' });
  });

  it.each(['Material', 'constructor', 'Voltagem'])('reports unsupported attribute %s without guessing its dimension', async label => {
    const p = product(); p.attributes = [{ pt: label }]; p.variants[0].values = [{ pt: 'X' }];
    const result = await read(config, harness(identity(), json([p], 1)));
    expect(result.issues).toEqual([{ productId: '10', code: 'ATTRIBUTE_UNSUPPORTED' }]);
    expect(result.remote.products).toEqual([]);
    expect(result.scan).toMatchObject({ readComplete: true, translationComplete: false, productCount: 1 });
  });

  it('rejects two attributes translated to the same dimension', async () => {
    const p = product(); p.attributes = [{ pt: 'Cor' }, { pt: 'Color' }];
    p.variants[0].values = [{ pt: 'Azul' }, { pt: 'Branco' }];
    expect((await read(config, harness(identity(), json([p], 1)))).issues[0].code).toBe('ATTRIBUTE_DUPLICATE');
  });

  it.each(['attribute', 'value'])('requires the configured locale for every %s', async target => {
    const p = product(); p.attributes = [target === 'attribute' ? { en: 'Size' } : { pt: 'Tamanho' }];
    p.variants[0].values = [target === 'value' ? { en: 'Small' } : { pt: 'P' }];
    expect((await read(config, harness(identity(), json([p], 1)))).issues[0].code).toBe('LOCALE_MISSING');
  });

  it('requires attribute/value cardinality even for a default variant', async () => {
    const p = product(); p.variants[0].values = [{ pt: 'P' }];
    const result = await read(config, harness(identity(), json([p], 1)));
    expect(result.issues[0].code).toBe('VALUE_COUNT_MISMATCH');
    expect(result.remote.products).toEqual([]);
  });

  it('does not detach a variant from its provider parent', async () => {
    const p = product(); p.variants[0].product_id = 99;
    expect((await read(config, harness(identity(), json([p], 1)))).issues[0].code).toBe('VARIANT_PARENT_MISMATCH');
  });

  it('preserves hidden publication and unknown stock as observations, without making them sellable', async () => {
    const p = product(); p.published = false; p.variants[0].stock = null; p.variants[0].stock_management = false;
    const result = await read(config, harness(identity(), json([p], 1)));
    expect(result.observations[0]).toMatchObject({ published: false,
      variants: [{ variantId: '100', stock: null, stockManagement: false }] });
    expect(result.remote.products[0].variants[0]).not.toHaveProperty('stock');
    expect(result.canApply).toBe(false);
  });

  it.each(['accessToken', 'userAgent', 'storeId'] as const)('does not request or simulate success with missing %s', async field => {
    const deps = harness();
    await expect(read({ ...config, [field]: '' }, deps)).rejects.toMatchObject({ code: 'CONFIG_INVALID' });
    expect(deps.fetch).not.toHaveBeenCalled();
  });

  it('stops before catalog reads when token resolves to a different store', async () => {
    const deps = harness(json({ id: 999 }));
    await expect(read(config, deps)).rejects.toMatchObject({ code: 'STORE_MISMATCH' });
    expect(deps.fetch).toHaveBeenCalledTimes(1);
  });

  it.each([401, 403, 429, 500, 302])('sanitizes HTTP %s without retrying or logging provider content', async status => {
    const deps = harness(new Response('private provider content with token', { status }));
    await expect(read(config, deps)).rejects.toMatchObject({ code: 'HTTP_ERROR', message: 'HTTP_ERROR', status });
    expect(deps.fetch).toHaveBeenCalledTimes(1);
  });

  it('sanitizes network errors containing credentials', async () => {
    const deps = harness(); deps.fetch.mockRejectedValue(new Error('synthetic-only-token PRIVATE'));
    const error = await read(config, deps).catch(e => e);
    expect(error).toBeInstanceOf(CatalogReadError);
    expect(String(error)).toBe('CatalogReadError: REQUEST_FAILED');
    expect(JSON.stringify(error)).not.toMatch(/token|PRIVATE/);
    expect(error.cause).toBeUndefined();
  });

  it('aborts a request at the configured deadline', async () => {
    // AbortSignal.timeout uses a real timer; fake timers are not needed.
    const deps = harness();
    deps.fetch.mockImplementation(async (_url, init) => new Promise((_resolve, reject) => {
      init!.signal!.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    }));
    await expect(read({ ...config, timeoutMs: 5 }, deps)).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('rejects invalid JSON without exposing its text', async () => {
    await expect(read(config, harness(new Response('invalid secret json')))).rejects.toMatchObject({ code: 'INVALID_JSON' });
  });

  it.each(['attributes', 'variants', 'published'])('rejects incomplete product payload: %s', async field => {
    const p: Record<string, unknown> = product(); delete p[field];
    await expect(read(config, harness(identity(), json([p], 1)))).rejects.toMatchObject({ code: 'INVALID_PAYLOAD' });
  });

  it('rejects unsafe numeric IDs rather than silently rounding them', async () => {
    const p = product(); p.id = Number.MAX_SAFE_INTEGER + 1;
    await expect(read(config, harness(identity(), json([p], 1)))).rejects.toMatchObject({ code: 'INVALID_PAYLOAD' });
  });

  it('supports decimal-string IDs without numeric conversion', async () => {
    const p = product(); const huge = '99999999999999999999';
    const raw = { ...p, id: huge, variants: [{ ...p.variants[0], product_id: huge, id: huge + '1' }] };
    const result = await read(config, harness(identity(), json([raw], 1)));
    expect(result.remote.products[0].id).toBe(huge);
  });

  it('reads an empty catalog explicitly', async () => {
    const result = await read(config, harness(identity(), json([], 0)));
    expect(result.scan.productCount).toBe(0); expect(result.remote.products).toEqual([]);
  });

  it('rejects missing totals instead of treating a short page as a full catalog', async () => {
    await expect(read(config, harness(identity(), json([product()])))).rejects.toMatchObject({ code: 'PAGINATION_INVALID' });
  });

  it('rejects changing counts, duplicate pages and truncated results', async () => {
    await expect(read(config, harness(identity(), json([product(10), product(11)], 3), json([product(12)], 4)))).rejects.toMatchObject({ code: 'CATALOG_CHANGED' });
    await expect(read(config, harness(identity(), json([product(10), product(11)], 3), json([product(10)], 3)))).rejects.toMatchObject({ code: 'DUPLICATE_ID' });
    await expect(read(config, harness(identity(), json([product(10)], 3)))).rejects.toMatchObject({ code: 'CATALOG_CHANGED' });
  });

  it('detects repeated variant IDs across distinct products', async () => {
    const p = product(11); p.variants[0].id = 100;
    await expect(read(config, harness(identity(), json([product(10), p], 2)))).rejects.toMatchObject({ code: 'DUPLICATE_ID' });
  });

  it.each(['https://other.invalid/v1/123/products', 'https://api.nuvemshop.com.br/v1/999/products', 'https://api.nuvemshop.com.br/v1/123/orders'])('refuses a pagination link outside the catalog scope: %s', async target => {
    const deps = harness(identity(), json([product(10), product(11)], 3, `<${target}>; rel="next"`));
    await expect(read(config, deps)).rejects.toMatchObject({ code: 'PAGINATION_INVALID' });
    expect(deps.fetch).toHaveBeenCalledTimes(2);
  });

  it('refuses repeated-page links or unexpected filters', async () => {
    await expect(read(config, harness(identity(), json([product(10), product(11)], 3, nextLink(1))))).rejects.toMatchObject({ code: 'PAGINATION_INVALID' });
    const filtered = nextLink(2).replace('page=2', 'page=2&published=true');
    await expect(read(config, harness(identity(), json([product(10), product(11)], 3, filtered)))).rejects.toMatchObject({ code: 'PAGINATION_INVALID' });
  });

  it('does not declare a bounded partial scan complete', async () => {
    const deps = harness(identity(), json([product(10), product(11)], 3));
    await expect(read({ ...config, maxPages: 1 }, deps)).rejects.toMatchObject({ code: 'PAGE_LIMIT' });
    expect(deps.fetch).toHaveBeenCalledTimes(2);
  });
});
