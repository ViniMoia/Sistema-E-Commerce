import { z } from 'zod';
import type { VariantMappingInput } from './nuvemshop-variant-mapping';

const remoteId = z.union([
  z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  z.string().regex(/^[1-9]\d*$/),
]).transform(String);
const localized = z.record(z.string(), z.string());
const productSchema = z.object({
  id: remoteId, attributes: z.array(localized), published: z.boolean(),
  visibility: z.enum(['visible', 'unlisted', 'hidden']).optional(),
  updated_at: z.string().min(1),
  variants: z.array(z.object({
    id: remoteId, product_id: remoteId, sku: z.string().nullable(),
    barcode: z.string().nullable().optional(), values: z.array(localized),
    stock: z.number().int().nonnegative().nullable(), stock_management: z.boolean(),
  })).min(1),
});

const configSchema = z.object({
  // Explicitly pinned to the v1 contract observed in the historical integration.
  // No silent migration to the newer multi-inventory API.
  apiVersion: z.literal('v1'),
  storeId: z.string().regex(/^[1-9]\d*$/),
  environment: z.string().trim().min(1),
  accessToken: z.string().trim().min(1).regex(/^[^\s]+$/),
  userAgent: z.string().trim().min(1).regex(/^[^\r\n]+$/),
  locale: z.enum(['pt', 'es', 'en']).default('pt'),
  pageSize: z.number().int().min(1).max(200).default(100),
  maxPages: z.number().int().min(1).max(100).default(20),
  timeoutMs: z.number().int().min(1).max(30000).default(15000),
});

export type CatalogReaderConfig = z.input<typeof configSchema>;
export type CatalogReadErrorCode = 'CONFIG_INVALID' | 'REQUEST_FAILED' | 'TIMEOUT'
  | 'HTTP_ERROR' | 'INVALID_JSON' | 'INVALID_PAYLOAD' | 'STORE_MISMATCH'
  | 'PAGINATION_INVALID' | 'CATALOG_CHANGED' | 'DUPLICATE_ID' | 'PAGE_LIMIT';

export class CatalogReadError extends Error {
  constructor(public readonly code: CatalogReadErrorCode, public readonly status?: number) {
    // Never include provider bodies, credentials, URLs or original exception causes.
    super(code);
    this.name = 'CatalogReadError';
  }
}

export interface CatalogTranslationIssue {
  productId: string;
  code: 'ATTRIBUTE_UNSUPPORTED' | 'ATTRIBUTE_DUPLICATE' | 'LOCALE_MISSING'
    | 'VALUE_COUNT_MISMATCH' | 'VARIANT_PARENT_MISMATCH';
}

export interface CatalogReadResult {
  purpose: 'IDENTITY_REVIEW_ONLY';
  canApply: false;
  // A product omitted here may have a translation issue, NOT have been deleted.
  // Consumers must inspect issues/translationComplete before interpreting absence.
  remote: VariantMappingInput['remote'];
  issues: CatalogTranslationIssue[];
  observations: {
    productId: string; published: boolean; visibility: 'visible' | 'unlisted' | 'hidden' | null; providerUpdatedAt: string;
    variants: { variantId: string; stock: number | null; stockManagement: boolean }[];
  }[];
  scan: { pages: number; productCount: number; requestCount: number;
    startedAt: string; completedAt: string; readComplete: true; translationComplete: boolean;
    atomicSnapshot: false };
}

type RawProduct = z.infer<typeof productSchema>;
const normalizeLabel = (value: string) => value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const attributeNames: Record<string, 'size' | 'color'> = {
  tamanho: 'size', size: 'size', talla: 'size', talle: 'size',
  cor: 'color', color: 'color', colour: 'color',
};

function translateProduct(product: RawProduct, storeId: string, locale: string): {
  product?: VariantMappingInput['remote']['products'][number]; issue?: CatalogTranslationIssue;
} {
  const reject = (code: CatalogTranslationIssue['code']) => ({ issue: { productId: product.id, code } });
  const attributes: ('size' | 'color')[] = [];
  for (const attribute of product.attributes) {
    const label = attribute[locale]?.trim();
    if (!label) return reject('LOCALE_MISSING');
    const key = normalizeLabel(label);
    const dimension = Object.hasOwn(attributeNames, key) ? attributeNames[key] : undefined;
    if (!dimension) return reject('ATTRIBUTE_UNSUPPORTED');
    if (attributes.includes(dimension)) return reject('ATTRIBUTE_DUPLICATE');
    attributes.push(dimension);
  }
  const variants: VariantMappingInput['remote']['products'][number]['variants'] = [];
  for (const variant of product.variants) {
    if (variant.product_id !== product.id) return reject('VARIANT_PARENT_MISMATCH');
    if (variant.values.length !== attributes.length) return reject('VALUE_COUNT_MISMATCH');
    const dimensions = { size: 'Único', color: 'Padrão' };
    for (let i = 0; i < attributes.length; i++) {
      const value = variant.values[i][locale]?.trim();
      if (!value) return reject('LOCALE_MISSING');
      // Index pairs the provider's attribute with its value, never a remote
      // variant with a local variant. Local identity is resolved by the planner.
      dimensions[attributes[i]] = value;
    }
    variants.push({ id: variant.id, productId: product.id, sku: variant.sku,
      barcode: variant.barcode ?? null, ...dimensions });
  }
  return { product: { id: product.id, storeId, variants } };
}

type Dependencies = { fetch?: typeof fetch; wait?: (milliseconds: number) => Promise<void> };

/** Read-only, bounded diagnostic scan. Explicit config only; no .env, DB, logs or writer.
 * HTTP failures abort the scan, without returning a partial catalog as complete.
 * Separate reader instances do not implement a distributed rate limiter.
 */
export async function readNuvemshopCatalog(config: CatalogReaderConfig, dependencies: Dependencies = {}): Promise<CatalogReadResult> {
  const parsed = configSchema.safeParse(config);
  if (!parsed.success) throw new CatalogReadError('CONFIG_INVALID');
  const settings = parsed.data;
  const request = dependencies.fetch ?? globalThis.fetch;
  const wait = dependencies.wait ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const base = `https://api.nuvemshop.com.br/v1/${settings.storeId}`;
  let requestCount = 0;
  const startedAt = new Date().toISOString();
  async function get(url: string): Promise<{ data: unknown; headers: Headers }> {
    if (requestCount) await wait(600);
    requestCount++;
    const signal = AbortSignal.timeout(settings.timeoutMs);
    let response: Response;
    try {
      response = await request(url, { method: 'GET', redirect: 'error', cache: 'no-store', signal,
        headers: { Authentication: `bearer ${settings.accessToken}`, 'User-Agent': settings.userAgent, Accept: 'application/json' } });
    } catch {
      throw new CatalogReadError(signal.aborted ? 'TIMEOUT' : 'REQUEST_FAILED');
    }
    if (!response.ok || response.redirected) {
      await response.body?.cancel().catch(() => undefined);
      throw new CatalogReadError('HTTP_ERROR', response.status);
    }
    try { return { data: await response.json(), headers: response.headers }; }
    catch { throw new CatalogReadError(signal.aborted ? 'TIMEOUT' : 'INVALID_JSON'); }
  }

  const identity = z.object({ id: remoteId }).safeParse((await get(`${base}/store?fields=id`)).data);
  if (!identity.success) throw new CatalogReadError('INVALID_PAYLOAD');
  if (identity.data.id !== settings.storeId) throw new CatalogReadError('STORE_MISMATCH');

  const remote: VariantMappingInput['remote'] = { environment: settings.environment, storeId: settings.storeId, products: [] };
  const issues: CatalogTranslationIssue[] = [], observations: CatalogReadResult['observations'] = [];
  const productIds = new Set<string>(), variantIds = new Set<string>();
  let expectedTotal: number | undefined;
  const first = new URL(`${base}/products`);
  first.search = new URLSearchParams({ page: '1', per_page: String(settings.pageSize),
    // The live v1 endpoint adds visibility to sparse fieldsets containing published.
    // Request it explicitly so pagination retains an exact, bounded fieldset.
    fields: 'id,attributes,variants,published,updated_at,visibility', sort_by: 'created-at-ascending' }).toString();
  let url = first.href;

  for (let page = 1; page <= settings.maxPages; page++) {
    const { data, headers } = await get(url);
    const totalHeader = headers.get('x-total-count');
    if (!totalHeader || !/^\d+$/.test(totalHeader) || !Number.isSafeInteger(Number(totalHeader))) throw new CatalogReadError('PAGINATION_INVALID');
    const total = Number(totalHeader);
    if (expectedTotal !== undefined && total !== expectedTotal) throw new CatalogReadError('CATALOG_CHANGED');
    expectedTotal = total;
    const result = z.array(productSchema).max(settings.pageSize).safeParse(data);
    if (!result.success) throw new CatalogReadError('INVALID_PAYLOAD');
    for (const product of result.data) {
      if (productIds.has(product.id)) throw new CatalogReadError('DUPLICATE_ID');
      productIds.add(product.id);
      for (const variant of product.variants) {
        if (variantIds.has(variant.id)) throw new CatalogReadError('DUPLICATE_ID');
        variantIds.add(variant.id);
      }
      const translated = translateProduct(product, settings.storeId, settings.locale);
      if (translated.issue) issues.push(translated.issue);
      else remote.products.push(translated.product!);
      observations.push({ productId: product.id, published: product.published, visibility: product.visibility ?? null, providerUpdatedAt: product.updated_at,
        variants: product.variants.map(v => ({ variantId: v.id, stock: v.stock, stockManagement: v.stock_management })) });
    }
    // Commas inside <URL> (for example fields=id,variants) are not link separators.
    const nextLinks = (headers.get('link') ?? '').split(/,(?=\s*<)/).filter(link => /;\s*rel\s*=\s*"?next"?(?:\s|;|$)/i.test(link));
    if (nextLinks.length > 1) throw new CatalogReadError('PAGINATION_INVALID');
    if (productIds.size > total) throw new CatalogReadError('CATALOG_CHANGED');
    if (productIds.size === total) {
      if (nextLinks.length) throw new CatalogReadError('PAGINATION_INVALID');
      return { purpose: 'IDENTITY_REVIEW_ONLY', canApply: false, remote, issues, observations,
        scan: { pages: page, productCount: total, requestCount, startedAt, completedAt: new Date().toISOString(),
          readComplete: true, translationComplete: issues.length === 0, atomicSnapshot: false } };
    }
    if (result.data.length !== settings.pageSize) throw new CatalogReadError('CATALOG_CHANGED');
    // Prefer the provider link, validating origin, scope, pagination and filters
    // before attaching credentials. If absent, use our fixed scoped URL.
    const next = new URL(first);
    next.searchParams.set('page', String(page + 1));
    if (nextLinks.length) {
      const linkUrl = nextLinks[0].match(/<([^>]+)>/)?.[1];
      let supplied: URL;
      try { supplied = new URL(linkUrl ?? ''); } catch { throw new CatalogReadError('PAGINATION_INVALID'); }
      const sortedQuery = (u: URL) => [...u.searchParams.entries()].sort().map(entry => JSON.stringify(entry)).join('|');
      if (supplied.origin !== next.origin || supplied.pathname !== next.pathname || supplied.username || supplied.password || supplied.hash
        || sortedQuery(supplied) !== sortedQuery(next)) throw new CatalogReadError('PAGINATION_INVALID');
      url = supplied.href;
    } else url = next.href;
  }
  throw new CatalogReadError('PAGE_LIMIT');
}
