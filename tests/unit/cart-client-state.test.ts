import { describe, it, expect, vi } from 'vitest';
import { createCartStore, type CartType } from '@/store/cart.store';
const scope = { userID: 'user-A', lojaID: 'store-A' };
const cart = (version = 1, items: CartType['items'] = []) => ({ ...scope, id: 'cart-A', status: 'ACTIVE' as const, version, items });
const item = { id: 'item-A', cartID: 'cart-A', productID: 'product-A', variantID: 'variant-A', quantity: 1, productName: 'Produto', price: 100, color: 'Padrão', size: 'Único', imageUrl: '' };
const json = (body: unknown, status = 200) => Response.json(body, { status });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; }
async function setup(transport = vi.fn<typeof fetch>()) {
  const store = createCartStore(transport); store.getState().setContext(scope);
  transport.mockResolvedValueOnce(json(cart(1, [item]))); await store.getState().fetchCart(); return { store, transport };
}
describe('WF-15 cart client uses identity, command and authoritative revision', () => {
  it('joins concurrent refreshes without queuing repeated GETs', async () => {
    const { store, transport } = await setup(); const waiting = deferred<Response>(); transport.mockReturnValueOnce(waiting.promise);
    const reads = [store.getState().fetchCart(), store.getState().fetchCart(), store.getState().fetchCart()];
    await Promise.resolve();
    expect(transport).toHaveBeenCalledTimes(2);
    waiting.resolve(json(cart(2, [item]))); await Promise.all(reads);
    expect(transport).toHaveBeenCalledTimes(2); expect(store.getState().isLoading).toBe(false);
  });
  it('does not join a pre-mutation read when a refresh must observe the subsequent write', async () => {
    const { store, transport } = await setup(); const waiting = deferred<Response>(); transport.mockReturnValueOnce(waiting.promise);
    transport.mockResolvedValueOnce(json(cart(2, [{ ...item, quantity: 2 }])));
    transport.mockResolvedValueOnce(json(cart(2, [{ ...item, quantity: 2 }])));
    const before = store.getState().fetchCart();
    const update = store.getState().updateQuantity(item.variantID, 2);
    const after = store.getState().fetchCart();
    waiting.resolve(json(cart(1, [item]))); await Promise.all([before, update, after]);
    expect(transport.mock.calls.map(([, init]) => init?.method ?? 'GET')).toEqual(['GET', 'GET', 'PATCH', 'GET']);
    expect(store.getState().cart?.items[0].quantity).toBe(2);
  });
  it('a new identity starts its own read instead of joining an obsolete request', async () => {
    const { store, transport } = await setup(); const waiting = deferred<Response>(); transport.mockReturnValueOnce(waiting.promise);
    const before = store.getState().fetchCart(); await Promise.resolve();
    store.getState().setContext({ lojaID: 'store-B', userID: 'user-B' });
    transport.mockResolvedValueOnce(json({ ...cart(1, [item]), userID: 'user-B', lojaID: 'store-B', id: 'cart-B' }));
    await store.getState().fetchCart();
    waiting.resolve(json(cart(99, [item]))); await before;
    expect(transport).toHaveBeenCalledTimes(3);
    expect(store.getState().cart).toMatchObject({ userID: 'user-B', lojaID: 'store-B', id: 'cart-B' });
  });
  it('completion of an obsolete read cannot discard the newer identity pending read', async () => {
    const { store, transport } = await setup(); const old = deferred<Response>(); const next = deferred<Response>();
    transport.mockReturnValueOnce(old.promise);
    const before = store.getState().fetchCart(); await Promise.resolve();
    store.getState().setContext({ lojaID: 'store-B', userID: 'user-B' });
    transport.mockReturnValueOnce(next.promise);
    const after = store.getState().fetchCart(); await Promise.resolve();
    old.resolve(json(cart(99, [item]))); await before;
    const duplicate = store.getState().fetchCart(); await Promise.resolve();
    expect(transport).toHaveBeenCalledTimes(3);
    next.resolve(json({ ...cart(), userID: 'user-B', lojaID: 'store-B', id: 'cart-B' }));
    await Promise.all([after, duplicate]);
    expect(store.getState()).toMatchObject({ cart: { id: 'cart-B' }, isLoading: false, loadState: 'ready' });
  });
  it('loads explicitly and distinguishes HTTP failure from an empty cart', async () => {
    const { store, transport } = await setup(); transport.mockResolvedValueOnce(json({ error: 'unavailable' }, 503));
    await store.getState().fetchCart(); expect(store.getState().loadState).toBe('error'); expect(store.getState().cart?.items).toHaveLength(1);
    transport.mockResolvedValueOnce(json({ id: null, version: null, items: [] })); await store.getState().fetchCart();
    expect(store.getState()).toMatchObject({ cart: null, loadState: 'ready', error: null });
  });
  it('serializes update then removal without whole-cart rollback', async () => {
    const { store, transport } = await setup(); const first = deferred<Response>(); transport.mockReturnValueOnce(first.promise);
    transport.mockResolvedValueOnce(json(cart(1, [item]))); transport.mockResolvedValueOnce(json(cart(2)));
    const update = store.getState().updateQuantity(item.variantID, 2).catch(error => error);
    const remove = store.getState().removeItem(item.variantID); await Promise.resolve();
    expect(transport).toHaveBeenCalledTimes(2); first.resolve(json({ error: 'conflict' }, 409)); await update; await remove;
    expect(store.getState().cart?.items).toHaveLength(0);
    const init = transport.mock.calls[3][1]; expect(init?.method).toBe('DELETE');
    expect(JSON.parse(init!.body as string)).toMatchObject({ cartId: 'cart-A', expectedVersion: 1, variantID: item.variantID });
  });
  it('uses the preceding successful revision for the next queued mutation', async () => {
    const { store, transport } = await setup(); transport.mockResolvedValueOnce(json(cart(2, [{ ...item, quantity: 2 }]))); transport.mockResolvedValueOnce(json(cart(3)));
    await Promise.all([store.getState().updateQuantity(item.variantID, 2), store.getState().removeItem(item.variantID)]);
    expect(JSON.parse(transport.mock.calls[2][1]!.body as string).expectedVersion).toBe(2); expect(store.getState().isLoading).toBe(false);
  });
  it('a lost response repeats the exact same command rather than adding twice', async () => {
    const { store, transport } = await setup(); transport.mockRejectedValueOnce(new TypeError('response lost')); transport.mockResolvedValueOnce(json(cart(2, [{ ...item, quantity: 2 }])));
    await store.getState().addToCart(item.variantID, item.productID, 1);
    expect(transport.mock.calls[1][1]!.body).toBe(transport.mock.calls[2][1]!.body);
    expect(JSON.parse(transport.mock.calls[1][1]!.body as string).commandId).toMatch(/^[a-f0-9-]{36}$/);
  });
  it('conflict refreshes, does not automatically reapply against a different revision', async () => {
    const { store, transport } = await setup(); transport.mockResolvedValueOnce(json({ error: 'conflict' }, 409)); transport.mockResolvedValueOnce(json(cart(7, [item])));
    await expect(store.getState().updateQuantity(item.variantID, 9)).rejects.toThrow('mudou');
    expect(transport.mock.calls.filter(([, init]) => init?.method === 'PATCH')).toHaveLength(1); expect(store.getState().cart?.version).toBe(7);
  });
  it('an old read cannot restore another identity after context reset', async () => {
    const { store, transport } = await setup(); const waiting = deferred<Response>(); transport.mockReturnValueOnce(waiting.promise);
    const read = store.getState().fetchCart(); await Promise.resolve(); store.getState().setContext({ lojaID: 'store-B', userID: 'user-B' });
    waiting.resolve(json(cart(99, [item]))); await read; expect(store.getState().cart).toBeNull(); expect(store.getState().context?.userID).toBe('user-B');
  });
  it('queued operations from the old identity are never sent under the new one', async () => {
    const { store, transport } = await setup(); const waiting = deferred<Response>(); transport.mockReturnValueOnce(waiting.promise);
    const a = store.getState().updateQuantity(item.variantID, 2).catch(() => {}); const b = store.getState().removeItem(item.variantID).catch(() => {});
    await Promise.resolve(); store.getState().setContext({ lojaID: scope.lojaID, userID: 'user-B' }); waiting.resolve(json(cart(2, [item]))); await Promise.all([a,b]);
    expect(transport.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(0); expect(store.getState().cart).toBeNull();
  });
  it('consumed receipt cannot resurrect COMPLETED cart and loads a new ACTIVE', async () => {
    const { store, transport } = await setup(); const next = { ...cart(), id: 'new-cart', items: [{ ...item, cartID: 'new-cart' }] };
    transport.mockResolvedValueOnce(json({ ...cart(2), status: 'COMPLETED', replay: true })); transport.mockResolvedValueOnce(json(next));
    await store.getState().addToCart(item.variantID, item.productID, 1); expect(store.getState().cart?.id).toBe('new-cart');
  });
  it('opening an old confirmation preserves another cart created afterwards', async () => {
    const { store, transport } = await setup(); const next = { ...cart(3, [item]), id: 'new-cart' }; store.setState({ cart: next });
    const waiting = deferred<Response>(); transport.mockReturnValueOnce(waiting.promise);
    const consumed = store.getState().consumeCart('cart-A', 1); expect(store.getState().cart?.id).toBe('new-cart');
    waiting.resolve(json(next)); await consumed; expect(store.getState().cart?.items).toHaveLength(1);
  });
  it('consumption fences a read started before the purchase commit', async () => {
    const { store, transport } = await setup(); const old = deferred<Response>(); transport.mockReturnValueOnce(old.promise); transport.mockResolvedValueOnce(json({ id: null, items: [] }));
    const read = store.getState().fetchCart(); await Promise.resolve(); const consumed = store.getState().consumeCart('cart-A', 1);
    old.resolve(json(cart(1, [item]))); await Promise.all([read,consumed]); expect(store.getState().cart).toBeNull(); expect(store.getState().loadState).toBe('ready');
  });
  it('401 removes cached identity/cart rather than displaying purchased items', async () => {
    const { store, transport } = await setup(); transport.mockResolvedValueOnce(json({}, 401)); await store.getState().fetchCart();
    expect(store.getState().cart).toBeNull(); expect(store.getState().context).toBeNull(); expect(store.getState().loadState).toBe('error');
  });
  it('a tenant-mismatched response is never adopted', async () => {
    const { store, transport } = await setup(); transport.mockResolvedValueOnce(json({ ...cart(), lojaID: 'store-B' })); await store.getState().fetchCart(); expect(store.getState().cart).toBeNull();
    expect(store.getState().context).toBeNull(); expect(store.getState().loadState).toBe('error');
  });
});
