import { z } from 'zod';
import { getVariantCombinationKey } from '@/lib/product-variants';

const id = z.string().min(1).refine(value => value.trim() === value);
const code = z.string().trim().nullable();
const dimensions = { size: z.string(), color: z.string() };
const lifecycle = z.enum(['ACTIVE', 'RETIRED', 'UNKNOWN']);

// This is a normalized diagnostic DTO, not the Nuvemshop HTTP payload.
// An adapter must explicitly map remote attributes to size/color; never use array position.
const inputSchema = z.object({
  expected: z.object({ environment: id, localStoreId: id, remoteStoreId: id }),
  local: z.object({
    environment: id, storeId: id,
    products: z.array(z.object({
      id, storeId: id, remoteProductId: id.nullable(), sku: code,
      catalogVersion: z.number().int().nonnegative().nullable(), lifecycle,
      variants: z.array(z.object({ id, productId: id, remoteVariantId: id.nullable(), sku: code,
        ...dimensions, lifecycle })),
    })),
  }),
  remote: z.object({
    environment: id, storeId: id,
    products: z.array(z.object({
      id, storeId: id,
      variants: z.array(z.object({ id, productId: id, sku: code, barcode: code, ...dimensions })),
    })),
  }),
});

export type VariantMappingInput = z.infer<typeof inputSchema>;
export type MappingReason =
  | 'INVALID_INPUT' | 'SCOPE_MISMATCH' | 'DUPLICATE_IDENTITY'
  | 'REMOTE_PRODUCT_MISSING' | 'PARENT_MISMATCH' | 'LIFECYCLE_REVIEW'
  | 'VERSION_UNKNOWN' | 'VARIANT_COUNT_MISMATCH' | 'DUPLICATE_COMBINATION'
  | 'PERSISTED_ID_CONFLICT' | 'CODE_CONFLICT' | 'CODE_MISSING'
  | 'AMBIGUOUS_CODE' | 'DIMENSION_CONFLICT' | 'REMOTE_VARIANT_REUSED';

export interface VariantIdentityCandidate {
  localVariantId: string;
  remoteVariantId: string;
  matchedBy: 'PERSISTED_ID' | 'VARIANT_CODE' | 'SINGLE_PRODUCT_CODE';
}

export interface ProductMappingResult {
  localProductId: string;
  remoteProductId: string | null;
  catalogVersion: number | null;
  status: 'CANDIDATE' | 'REVIEW_REQUIRED';
  reasons: MappingReason[];
  variants: VariantIdentityCandidate[];
}

export interface VariantMappingPlan {
  purpose: 'IDENTITY_REVIEW_ONLY';
  canApply: false;
  scope: VariantMappingInput['expected'] | null;
  errors: MappingReason[];
  products: ProductMappingResult[];
}

const nonempty = (value: string | null) => value !== null && value !== '';
function duplicates(values: (string | null)[]): Set<string> {
  const seen = new Set<string>(), repeated = new Set<string>();
  for (const value of values) {
    if (!nonempty(value)) continue;
    if (seen.has(value!)) repeated.add(value!);
    seen.add(value!);
  }
  return repeated;
}

/** Pure, side-effect-free identity proposal. No persistence, stock selection, or API calls.
 * A future writer must re-read the destination under product locks, check versions,
 * audit existing links and revalidate identity. This plan is never write authorization.
 */
export function planNuvemshopVariantMapping(input: unknown): VariantMappingPlan {
  const plan: VariantMappingPlan = {
    purpose: 'IDENTITY_REVIEW_ONLY', canApply: false, scope: null, errors: [], products: [],
  };
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ...plan, errors: ['INVALID_INPUT'] };
  const { expected, local, remote } = parsed.data;
  plan.scope = expected;
  if (local.environment !== expected.environment || remote.environment !== expected.environment
    || local.storeId !== expected.localStoreId || remote.storeId !== expected.remoteStoreId) {
    return { ...plan, errors: ['SCOPE_MISMATCH'] };
  }
  const duplicateLocalProducts = duplicates(local.products.map(p => p.id));
  const duplicateParents = duplicates(local.products.map(p => p.remoteProductId));
  const duplicateRemoteProducts = duplicates(remote.products.map(p => p.id));
  const duplicateLocalVariants = duplicates(local.products.flatMap(p => p.variants.map(v => v.id)));
  const duplicateRemoteVariants = duplicates(remote.products.flatMap(p => p.variants.map(v => v.id)));
  const duplicateBindings = duplicates(local.products.flatMap(p => p.variants.map(v => v.remoteVariantId)));
  const remoteProducts = new Map(remote.products.map(p => [p.id, p]));

  for (const product of local.products) {
    const reasons = new Set<MappingReason>();
    const candidates: VariantIdentityCandidate[] = [];
    const counterpart = product.remoteProductId ? remoteProducts.get(product.remoteProductId) : undefined;
    if (product.storeId !== expected.localStoreId || (counterpart && counterpart.storeId !== expected.remoteStoreId)) reasons.add('SCOPE_MISMATCH');
    if (duplicateLocalProducts.has(product.id) || duplicateParents.has(product.remoteProductId!)
      || duplicateRemoteProducts.has(product.remoteProductId!)
      || product.variants.some(v => duplicateLocalVariants.has(v.id) || duplicateBindings.has(v.remoteVariantId!))
      || counterpart?.variants.some(v => duplicateRemoteVariants.has(v.id))) reasons.add('DUPLICATE_IDENTITY');
    if (!counterpart) reasons.add('REMOTE_PRODUCT_MISSING');
    if (product.lifecycle !== 'ACTIVE' || product.variants.some(v => v.lifecycle !== 'ACTIVE')) reasons.add('LIFECYCLE_REVIEW');
    if (product.catalogVersion === null) reasons.add('VERSION_UNKNOWN');
    if (product.variants.some(v => v.productId !== product.id)
      || counterpart?.variants.some(v => v.productId !== counterpart.id)) reasons.add('PARENT_MISMATCH');
    if (!product.variants.length || product.variants.length !== counterpart?.variants.length) reasons.add('VARIANT_COUNT_MISMATCH');
    if (duplicates(product.variants.map(getVariantCombinationKey)).size
      || (counterpart && duplicates(counterpart.variants.map(getVariantCombinationKey)).size)) reasons.add('DUPLICATE_COMBINATION');

    if (!reasons.size && counterpart) {
      const used = new Set<string>();
      const singleton = product.variants.length === 1 && counterpart.variants.length === 1;
      for (const variant of product.variants) {
        // The legacy import stored barcode at PRODUCT level. Only use it for a
        // single neutral variant, never to choose a size/color of a varied product.
        const neutral = getVariantCombinationKey(variant) === getVariantCombinationKey({ size: 'Único', color: 'Padrão' });
        const productCode = singleton && neutral && nonempty(product.sku) ? product.sku : null;
        const codes = [variant.sku, productCode].filter(nonempty) as string[];
        const matchesCode = (v: typeof counterpart.variants[number]) =>
          codes.every(c => c === v.sku || c === v.barcode);
        let selected: typeof counterpart.variants[number] | undefined;
        let matchedBy: VariantIdentityCandidate['matchedBy'] = 'PERSISTED_ID';
        if (variant.remoteVariantId) {
          selected = counterpart.variants.find(v => v.id === variant.remoteVariantId);
          if (!selected) { reasons.add('PERSISTED_ID_CONFLICT'); continue; }
          if (codes.length && !matchesCode(selected)) { reasons.add('CODE_CONFLICT'); continue; }
        } else {
          if (!codes.length) { reasons.add('CODE_MISSING'); continue; }
          const matches = counterpart.variants.filter(matchesCode);
          if (!matches.length) { reasons.add('CODE_CONFLICT'); continue; }
          if (matches.length !== 1) { reasons.add('AMBIGUOUS_CODE'); continue; }
          selected = matches[0];
          matchedBy = nonempty(variant.sku) ? 'VARIANT_CODE' : 'SINGLE_PRODUCT_CODE';
        }
        if (getVariantCombinationKey(variant) !== getVariantCombinationKey(selected)) {
          reasons.add('DIMENSION_CONFLICT'); continue;
        }
        if (used.has(selected.id)) { reasons.add('REMOTE_VARIANT_REUSED'); continue; }
        used.add(selected.id);
        candidates.push({ localVariantId: variant.id, remoteVariantId: selected.id, matchedBy });
      }
    }
    // Never publish a partial mapping for a product whose other variants conflict.
    plan.products.push({ localProductId: product.id, remoteProductId: product.remoteProductId,
      catalogVersion: product.catalogVersion, status: reasons.size ? 'REVIEW_REQUIRED' : 'CANDIDATE',
      reasons: [...reasons].sort(), variants: reasons.size ? [] : candidates.sort((a, b) => a.localVariantId.localeCompare(b.localVariantId)) });
  }
  plan.products.sort((a, b) => a.localProductId.localeCompare(b.localProductId));
  return plan;
}
