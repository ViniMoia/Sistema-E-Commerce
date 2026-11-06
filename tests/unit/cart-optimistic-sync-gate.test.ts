import { describe, it, expect, vi } from 'vitest';
import { createCartStore, type CartType } from '@/store/cart.store';

const scope = { userID: 'user-A', lojaID: 'store-A' };
const cart = (version = 1, items: CartType['items'] = []) => ({
  ...scope,
  id: 'cart-A',
  status: 'ACTIVE' as const,
  version,
  items,
});

const item1 = {
  id: 'item-1',
  cartID: 'cart-A',
  productID: 'prod-1',
  variantID: 'var-1',
  quantity: 1,
  productName: 'Shampoo 5L',
  price: 50,
  color: 'Padrão',
  size: 'Único',
  imageUrl: '',
};

const item2 = {
  id: 'item-2',
  cartID: 'cart-A',
  productID: 'prod-2',
  variantID: 'var-2',
  quantity: 2,
  productName: 'Cera 500ml',
  price: 30,
  color: 'Padrão',
  size: 'Único',
  imageUrl: '',
};

const json = (body: unknown, status = 200) => Response.json(body, { status });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}

describe('Optimistic UI & Sync Gate (ARQUITETURA_OPTIMISTIC_UI_E_SYNC_GATE_CARRINHO.md)', () => {
  it('0ms Optimistic UI: removes item from local store immediately before network response', async () => {
    const transport = vi.fn<typeof fetch>();
    const store = createCartStore(transport);
    store.getState().setContext(scope);

    // Initial cart with 2 items
    transport.mockResolvedValueOnce(json(cart(1, [item1, item2])));
    await store.getState().fetchCart();
    expect(store.getState().cart?.items).toHaveLength(2);

    // Network delay for DELETE
    const networkGate = deferred<Response>();
    transport.mockReturnValueOnce(networkGate.promise);

    // Call removeItem
    const removePromise = store.getState().removeItem('var-1');

    // 0ms Check: item-1 must already be gone from memory!
    expect(store.getState().cart?.items).toHaveLength(1);
    expect(store.getState().cart?.items[0].variantID).toBe('var-2');
    expect(store.getState().isMutating).toBe(true);

    // Now resolve network response
    networkGate.resolve(json(cart(2, [item2])));
    await removePromise;

    expect(store.getState().cart?.items).toHaveLength(1);
    expect(store.getState().isMutating).toBe(false);
  });

  it('0ms Optimistic UI: updates item quantity immediately before network response', async () => {
    const transport = vi.fn<typeof fetch>();
    const store = createCartStore(transport);
    store.getState().setContext(scope);

    transport.mockResolvedValueOnce(json(cart(1, [item1])));
    await store.getState().fetchCart();

    const networkGate = deferred<Response>();
    transport.mockReturnValueOnce(networkGate.promise);

    const updatePromise = store.getState().updateQuantity('var-1', 5);

    // 0ms Check: quantity must already be updated to 5 locally!
    expect(store.getState().cart?.items[0].quantity).toBe(5);
    expect(store.getState().isMutating).toBe(true);

    // Resolve network response with version 2
    networkGate.resolve(json(cart(2, [{ ...item1, quantity: 5 }])));
    await updatePromise;

    expect(store.getState().cart?.items[0].quantity).toBe(5);
    expect(store.getState().isMutating).toBe(false);
  });

  it('Sync Gate: waitForIdle blocks until in-flight background operations complete', async () => {
    const transport = vi.fn<typeof fetch>();
    const store = createCartStore(transport);
    store.getState().setContext(scope);

    transport.mockResolvedValueOnce(json(cart(1, [item1, item2])));
    await store.getState().fetchCart();

    const networkGate = deferred<Response>();
    transport.mockReturnValueOnce(networkGate.promise);

    // User removes an item
    void store.getState().removeItem('var-2');
    expect(store.getState().isMutating).toBe(true);

    // User clicks "Finalizar Compra" immediately: waitForIdle is triggered
    let idleResolved = false;
    const idlePromise = store.getState().waitForIdle().then(() => {
      idleResolved = true;
    });

    // Should still be waiting while network is pending
    await Promise.resolve();
    expect(idleResolved).toBe(false);

    // Network finishes
    networkGate.resolve(json(cart(2, [item1])));
    await idlePromise;

    expect(idleResolved).toBe(true);
    expect(store.getState().isMutating).toBe(false);
    expect(store.getState().cart?.items).toHaveLength(1);
  });

  it('Error Rollback: restores authoritative server state if mutation fails', async () => {
    const transport = vi.fn<typeof fetch>();
    const store = createCartStore(transport);
    store.getState().setContext(scope);

    transport.mockResolvedValueOnce(json(cart(1, [item1, item2])));
    await store.getState().fetchCart();

    // Mock 409 Conflict on DELETE followed by GET recovery read
    transport.mockResolvedValueOnce(json({ error: 'Conflict' }, 409));
    transport.mockResolvedValueOnce(json(cart(1, [item1, item2])));

    await expect(store.getState().removeItem('var-1')).rejects.toThrow();

    // Authoritative items are restored!
    expect(store.getState().cart?.items).toHaveLength(2);
  });
});
