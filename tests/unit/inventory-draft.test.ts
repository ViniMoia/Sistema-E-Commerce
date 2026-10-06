import { describe, it, expect, vi } from 'vitest';
import { prepareInventoryAttempt } from '@/lib/commerce/inventory-draft';
import { inventoryCommandSchema } from '@/lib/commerce/inventory-command';
import { getVariantOptions, resolveCatalogVariant } from '@/lib/product-variants';

describe('Administrative inventory boundaries', () => {
  it('lost response plus refreshed revision reuses exact request instead of a second delta', () => {
    const draft = { productId: 'product', variantId: 'variant', mode: 'DELTA' as const, quantity: 3, reason: ' Reposição ' };
    const newId = vi.fn().mockReturnValueOnce('first').mockReturnValueOnce('second');
    const first = prepareInventoryAttempt(null, draft, 10, newId);
    const retry = prepareInventoryAttempt(first, { ...draft, reason: 'Reposição' }, 11, newId);
    expect(retry).toBe(first); expect(retry.body).toMatchObject({ commandId: 'first', expectedVersion: 10 });
    expect(newId).toHaveBeenCalledTimes(1);
    const changed = prepareInventoryAttempt(retry, { ...draft, quantity: 4 }, 11, newId);
    expect(changed.body).toMatchObject({ commandId: 'second', expectedVersion: 11, quantity: 4 });
  });
  it('absolute writes require revision; external fields and fractional/negative results are not counts', () => {
    const body = { commandId: 'command', mode: 'ABSOLUTE', quantity: 3, reason: 'Contagem' };
    expect(inventoryCommandSchema.safeParse(body).success).toBe(false);
    for (const quantity of [-1, 0.5, 2147483648]) expect(inventoryCommandSchema.safeParse({ ...body, quantity, expectedVersion: 0 }).success).toBe(false);
    expect(inventoryCommandSchema.safeParse({ ...body, expectedVersion: 0, actorId: 'forged' }).success).toBe(false);
    expect(inventoryCommandSchema.safeParse({ ...body, expectedVersion: 0 }).success).toBe(true);
  });
  it('retired variant with stale positive stock cannot become a purchase selection', () => {
    const variants = [{ id: 'retired', size: 'M', color: 'Azul', stock: 5, retiredAt: new Date() }, { id: 'active', size: 'G', color: 'Azul', stock: 1 }];
    expect(getVariantOptions(variants).sizes).toEqual(['G']);
    expect(resolveCatalogVariant(variants, 'M', 'Azul')?.id).not.toBe('retired');
  });
});
