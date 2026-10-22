import { describe, expect, it } from 'vitest';
import { planNuvemshopVariantMapping as plan, type VariantMappingInput } from '@/lib/integrations/nuvemshop-variant-mapping';

function fixture(): VariantMappingInput {
  return {
    expected: { environment: 'isolated', localStoreId: 'local-store', remoteStoreId: 'remote-store' },
    local: { environment: 'isolated', storeId: 'local-store', products: [{
      id: 'p1', storeId: 'local-store', remoteProductId: 'rp1', sku: '001234',
      catalogVersion: 7, lifecycle: 'ACTIVE',
      variants: [{ id: 'v1', productId: 'p1', remoteVariantId: null, sku: null,
        size: 'Único', color: 'Padrão', lifecycle: 'ACTIVE' }],
    }] },
    remote: { environment: 'isolated', storeId: 'remote-store', products: [{
      id: 'rp1', storeId: 'remote-store', variants: [{ id: 'rv1', productId: 'rp1', sku: null,
        barcode: '001234', size: 'default', color: 'Padrão' }],
    }] },
  };
}

function varied(): VariantMappingInput {
  const f = fixture();
  f.local.products[0].variants = ['P', 'G'].map((size, i) => ({
    id: `v${i + 1}`, productId: 'p1', remoteVariantId: null, sku: `code-${size}`,
    size, color: 'Azul', lifecycle: 'ACTIVE',
  }));
  f.remote.products[0].variants = ['G', 'P'].map(size => ({
    id: `remote-${size}`, productId: 'rp1', sku: `code-${size}`, barcode: null,
    size, color: 'Azul',
  }));
  return f;
}

function expectReview(f: VariantMappingInput, reason: string) {
  const result = plan(f);
  expect(result.canApply).toBe(false);
  expect(result.products[0].status).toBe('REVIEW_REQUIRED');
  expect(result.products[0].reasons).toContain(reason);
  expect(result.products[0].variants).toEqual([]);
}

describe('Nuvemshop identity planning without persistence or provider calls', () => {
  it('M01: matches legacy product SKU to barcode without changing local identity', () => {
    const result = plan(fixture());
    expect(result.errors).toEqual([]);
    expect(result.products[0]).toEqual({
      localProductId: 'p1', remoteProductId: 'rp1', catalogVersion: 7,
      status: 'CANDIDATE', reasons: [], variants: [{ localVariantId: 'v1', remoteVariantId: 'rv1', matchedBy: 'SINGLE_PRODUCT_CODE' }],
    });
    expect(result.purpose).toBe('IDENTITY_REVIEW_ONLY');
    expect(result.canApply).toBe(false);
  });

  it('M02: rejects changed barcode under the same product ID (synthetic replacement case)', () => {
    const f = fixture();
    f.remote.products[0].variants[0].barcode = '009999';
    expectReview(f, 'CODE_CONFLICT');
  });

  it('M03: never chooses the sole remote variant without identity evidence', () => {
    const f = fixture(); f.local.products[0].sku = null;
    expectReview(f, 'CODE_MISSING');
  });

  it('M04: matches multiple sizes by variant codes, independently of array order', () => {
    const result = plan(varied());
    expect(result.products[0].variants).toEqual([
      { localVariantId: 'v1', remoteVariantId: 'remote-P', matchedBy: 'VARIANT_CODE' },
      { localVariantId: 'v2', remoteVariantId: 'remote-G', matchedBy: 'VARIANT_CODE' },
    ]);
  });

  it.each(['local-environment', 'remote-environment', 'local-store', 'remote-store'])('M05/M12: refuses mismatched %s', field => {
    const f = fixture();
    if (field === 'local-environment') f.local.environment = 'production';
    if (field === 'remote-environment') f.remote.environment = 'production';
    if (field === 'local-store') f.local.storeId = 'other';
    if (field === 'remote-store') f.remote.storeId = 'other';
    expect(plan(f)).toMatchObject({ errors: ['SCOPE_MISMATCH'], products: [], canApply: false });
  });

  it.each(['local', 'remote'] as const)('M05: checks the %s product tenant as well as its envelope', side => {
    const f = fixture(); f[side].products[0].storeId = 'other';
    expectReview(f, 'SCOPE_MISMATCH');
  });

  it.each(['local', 'remote'] as const)('M05: rejects a %s variant attached to another parent', side => {
    const f = fixture(); f[side].products[0].variants[0].productId = 'other';
    expectReview(f, 'PARENT_MISMATCH');
  });

  it('M06: preserves leading zeroes and code case', () => {
    const f = fixture(); f.remote.products[0].variants[0].barcode = '1234';
    expectReview(f, 'CODE_CONFLICT');
    f.local.products[0].sku = 'AbC'; f.remote.products[0].variants[0].barcode = 'abc';
    expectReview(f, 'CODE_CONFLICT');
  });

  it('M07: uses domain normalization for neutral dimensions and trims codes', () => {
    const f = fixture(); f.local.products[0].sku = ' 001234 ';
    f.local.products[0].variants[0].size = ' PADRÃO ';
    f.local.products[0].variants[0].color = ' DEFAULT ';
    expect(plan(f).products[0].status).toBe('CANDIDATE');
  });

  it('M08: missing persisted variant ID is a conflict, even when code matches another', () => {
    const f = fixture(); f.local.products[0].variants[0].remoteVariantId = 'removed';
    expectReview(f, 'PERSISTED_ID_CONFLICT');
  });

  it('M08: does not let a persisted ID override contradictory code evidence', () => {
    const f = fixture(); f.local.products[0].variants[0].remoteVariantId = 'rv1';
    f.remote.products[0].variants[0].barcode = 'different';
    expectReview(f, 'CODE_CONFLICT');
  });

  it('retains a consistent persisted ID and reports the existing version', () => {
    const f = fixture(); f.local.products[0].variants[0].remoteVariantId = 'rv1';
    expect(plan(f).products[0]).toMatchObject({ catalogVersion: 7, variants: [{
      localVariantId: 'v1', remoteVariantId: 'rv1', matchedBy: 'PERSISTED_ID',
    }] });
  });

  it('requires review when product and variant codes disagree about the candidate', () => {
    const f = fixture(); f.local.products[0].variants[0].sku = 'other';
    expectReview(f, 'CODE_CONFLICT');
  });

  it('M09: identifying an item with zero stock does not grant sale or apply authorization', () => {
    const f = fixture();
    const withStock = { ...f, local: { ...f.local, products: f.local.products.map(p => ({
      ...p, stock: 0, variants: p.variants.map(v => ({ ...v, stock: 0 })),
    })) } };
    expect(plan(withStock).products[0].status).toBe('CANDIDATE');
    expect(plan(withStock).canApply).toBe(false);
    expect(plan(withStock).purpose).toBe('IDENTITY_REVIEW_ONLY');
    // No availability field or checkout selector is produced by this module.
    expect(plan(withStock).products[0]).not.toHaveProperty('stock');
  });

  it.each(['ACTIVE', 'UNKNOWN', 'RETIRED'] as const)('M10: handles lifecycle %s explicitly', state => {
    const f = fixture(); f.local.products[0].variants[0].lifecycle = state;
    if (state === 'ACTIVE') expect(plan(f).products[0].status).toBe('CANDIDATE');
    else expectReview(f, 'LIFECYCLE_REVIEW');
  });

  it('M10: a retired parent cannot be made active by an external event', () => {
    const f = fixture(); f.local.products[0].lifecycle = 'RETIRED';
    expectReview(f, 'LIFECYCLE_REVIEW');
  });

  it('M11: duplicate local bindings to a remote product are both rejected', () => {
    const f = fixture(); f.local.products.push({ ...f.local.products[0], id: 'p2',
      variants: [{ ...f.local.products[0].variants[0], id: 'v2', productId: 'p2' }] });
    const result = plan(f);
    expect(result.products).toHaveLength(2);
    for (const p of result.products) expect(p).toMatchObject({ status: 'REVIEW_REQUIRED', reasons: ['DUPLICATE_IDENTITY'], variants: [] });
  });

  it('M11: rejects repeated variant IDs across remote products', () => {
    const f = fixture(); f.remote.products.push({ ...f.remote.products[0], id: 'rp2',
      variants: [{ ...f.remote.products[0].variants[0], productId: 'rp2' }] });
    expectReview(f, 'DUPLICATE_IDENTITY');
  });

  it('M11: rejects normalized duplicate combinations instead of creating another variant', () => {
    const f = varied();
    f.local.products[0].variants[1].size = ' p ';
    expectReview(f, 'DUPLICATE_COMBINATION');
  });

  it('M13: an unversioned legacy snapshot is not a writable candidate', () => {
    const f = fixture(); f.local.products[0].catalogVersion = null;
    expectReview(f, 'VERSION_UNKNOWN');
  });

  it('rejects code ambiguity even when dimensions could pick a position', () => {
    const f = varied();
    f.remote.products[0].variants[0].sku = 'code-P';
    expectReview(f, 'AMBIGUOUS_CODE');
  });

  it('requires dimensions to agree, including for existing external IDs', () => {
    const f = fixture(); f.local.products[0].variants[0].remoteVariantId = 'rv1';
    f.remote.products[0].variants[0].size = '40x40';
    expectReview(f, 'DIMENSION_CONFLICT');
  });

  it('does not use a parent code to infer a multi-variant mapping', () => {
    const f = varied(); f.local.products[0].variants.forEach(v => { v.sku = null; });
    expectReview(f, 'CODE_MISSING');
  });

  it('never publishes partial mappings when another variant fails', () => {
    const f = varied(); f.remote.products[0].variants[0].sku = 'unknown';
    expectReview(f, 'CODE_CONFLICT');
  });

  it('does not import unmatched remote products or invent absent local bindings', () => {
    const f = fixture(); f.local.products[0].remoteProductId = null;
    expectReview(f, 'REMOTE_PRODUCT_MISSING');
    f.local.products = [];
    expect(plan(f).products).toEqual([]);
  });

  it('rejects removed variants without deleting or renumbering the local rows', () => {
    const f = varied(); f.remote.products[0].variants.pop();
    expectReview(f, 'VARIANT_COUNT_MISMATCH');
    expect(f.local.products[0].variants.map(v => v.id)).toEqual(['v1', 'v2']);
  });

  it('is deterministic across replays and does not mutate frozen inputs', () => {
    const f = varied(), before = structuredClone(f);
    function freeze(value: object) {
      Object.values(value).forEach(v => { if (v && typeof v === 'object') freeze(v); });
      Object.freeze(value);
    }
    freeze(f);
    const first = plan(f);
    expect(plan(f)).toEqual(first);
    expect(f).toEqual(before);
    const reordered = structuredClone(before);
    reordered.local.products[0].variants.reverse();
    reordered.remote.products[0].variants.reverse();
    expect(plan(reordered)).toEqual(first);
  });

  it.each([null, {}, { expected: 'store' }])('rejects malformed input without leaking its content', value => {
    expect(plan(value)).toEqual({ purpose: 'IDENTITY_REVIEW_ONLY', canApply: false, scope: null,
      errors: ['INVALID_INPUT'], products: [] });
  });

  it('requires explicit remote attribute translation, not a raw API payload', () => {
    const f = fixture();
    const raw = { ...f, remote: { ...f.remote, products: [{ id: 'rp1', storeId: 'remote-store',
      variants: [{ id: 'rv1', productId: 'rp1', sku: null, barcode: '001234', values: [] }] }] } };
    expect(plan(raw).errors).toEqual(['INVALID_INPUT']);
  });
});
