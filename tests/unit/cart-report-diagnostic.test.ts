import { it, expect, vi, afterEach } from 'vitest';
import { createCartStore } from '@/store/cart.store';

const scope = { userID: 'diagnostic-user', lojaID: 'diagnostic-store' };
const item = { id: 'item', cartID: 'cart', productID: 'product', variantID: 'variant', quantity: 1,
  productName: 'Diagnostic', price: 10, color: 'Default', size: 'Default', imageUrl: '' };
const snapshot = (version: number, quantity = 0) => ({ ...scope, id: 'cart', status: 'ACTIVE', version,
  items: quantity ? [{ ...item, quantity }] : [] });
const response = (version: number, quantity = 0) => Response.json(snapshot(version, quantity));
afterEach(() => { vi.unstubAllGlobals(); });

it('diagnostic: a stale revision fails, refreshes, then a second add succeeds', async () => {
  const transport = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(response(1))
    .mockResolvedValueOnce(Response.json({ code: 'CONFLICT' }, { status: 409 }))
    .mockResolvedValueOnce(response(2))
    .mockResolvedValueOnce(response(3, 1));
  const store = createCartStore(transport); store.getState().setContext(scope);
  await store.getState().fetchCart();
  await expect(store.getState().addToCart('variant', 'product', 1)).rejects.toThrow('mudou');
  await store.getState().addToCart('variant', 'product', 1);
  expect(transport.mock.calls.map(([, init]) => init?.method ?? 'GET')).toEqual(['GET', 'POST', 'GET', 'POST']);
  expect(JSON.parse(transport.mock.calls[3][1]!.body as string).expectedVersion).toBe(2);
  expect(store.getState().cart?.items[0].quantity).toBe(1);
});

it('a background read keeps the mutation flag free for a purchase intention', async () => {
  let release!: (value: Response) => void;
  const transport = vi.fn<typeof fetch>().mockResolvedValueOnce(response(1));
  const store = createCartStore(transport); store.getState().setContext(scope);
  await store.getState().fetchCart();
  transport.mockReturnValueOnce(new Promise(resolve => { release = resolve; }));
  const pending = store.getState().fetchCart();
  expect(store.getState().isLoading).toBe(true);
  expect(store.getState().isMutating).toBe(false);
  expect(store.getState().cart?.version).toBe(1);
  release(response(1)); await pending;
  expect(store.getState().isLoading).toBe(false);
});

it('recovers an unreadable success response with the same command and without adding another unit', async () => {
  const transport = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(response(1))
    .mockResolvedValueOnce(new Response('{', { status: 200 }))
    .mockResolvedValueOnce(response(2, 1));
  const store = createCartStore(transport); store.getState().setContext(scope);
  await store.getState().fetchCart();
  await store.getState().addToCart('variant', 'product', 1);
  expect(store.getState().cart?.items[0].quantity).toBe(1);
  const first = JSON.parse(transport.mock.calls[1][1]!.body as string);
  const second = JSON.parse(transport.mock.calls[2][1]!.body as string);
  expect(second).toEqual(first);
  expect(store.getState().hasUnresolvedMutation).toBe(false);
});

it('retains an ambiguous command through a failed recovery and prevents unrelated writes', async () => {
  const transport = vi.fn<typeof fetch>().mockResolvedValueOnce(response(1))
    .mockRejectedValueOnce(new TypeError('offline')).mockRejectedValueOnce(new TypeError('offline'))
    .mockResolvedValueOnce(response(2, 1));
  const store = createCartStore(transport); store.getState().setContext(scope);
  await store.getState().fetchCart();
  await expect(store.getState().addToCart('variant', 'product', 1)).rejects.toThrow();
  expect(store.getState().hasUnresolvedMutation).toBe(true);
  await expect(store.getState().addToCart('other', 'product', 1)).rejects.toThrow('pendente');
  expect(transport).toHaveBeenCalledTimes(4);
  transport.mockResolvedValueOnce(response(2, 1));
  await Promise.all([store.getState().retryMutation(), store.getState().retryMutation()]);
  expect(transport.mock.calls[4][1]!.body).toEqual(transport.mock.calls[1][1]!.body);
  expect(transport).toHaveBeenCalledTimes(5);
  expect(store.getState().hasUnresolvedMutation).toBe(false);
});

it('a rejected retry cannot erase an earlier ambiguous submission', async () => {
  const transport = vi.fn<typeof fetch>().mockResolvedValueOnce(response(1))
    .mockRejectedValueOnce(new TypeError('lost response'))
    .mockResolvedValueOnce(Response.json({ code: 'RATE_LIMIT' }, { status: 429 }))
    .mockResolvedValueOnce(response(2, 1));
  const store = createCartStore(transport); store.getState().setContext(scope);
  await store.getState().fetchCart();
  await expect(store.getState().addToCart('variant', 'product', 1)).rejects.toThrow();
  expect(store.getState().hasUnresolvedMutation).toBe(true);
  transport.mockResolvedValueOnce(response(2, 1));
  await store.getState().retryMutation();
  expect(transport.mock.calls[4][1]!.body).toEqual(transport.mock.calls[1][1]!.body);
  expect(store.getState().cart?.items[0].quantity).toBe(1);
});

it('uses a recent authoritative snapshot without a redundant opening read', async () => {
  const transport = vi.fn<typeof fetch>().mockResolvedValueOnce(response(1));
  const store = createCartStore(transport); store.getState().setContext(scope);
  await store.getState().fetchCart();
  await store.getState().fetchCart({ maxAgeMs: 5000 });
  expect(transport).toHaveBeenCalledTimes(1);
});

it('accepts one inclusion during a background read and uses the refreshed revision', async () => {
  let release!: (value: Response) => void;
  const transport = vi.fn<typeof fetch>().mockResolvedValueOnce(response(1))
    .mockImplementationOnce(() => new Promise(resolve => { release = resolve; }))
    .mockResolvedValueOnce(response(3, 1));
  const store = createCartStore(transport); store.getState().setContext(scope);
  await store.getState().fetchCart();
  const reading = store.getState().fetchCart();
  const adding = store.getState().addToCart('variant', 'product', 1);
  expect(store.getState().isMutating).toBe(true);
  await Promise.resolve();
  expect(transport.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
  release(response(2)); await Promise.all([reading, adding]);
  expect(JSON.parse(transport.mock.calls[2][1]!.body as string).expectedVersion).toBe(2);
  expect(store.getState().cart?.items[0].quantity).toBe(1);
});

it('restores an unresolved command after reload only for its original identity', async () => {
  const values = new Map<string, string>();
  vi.stubGlobal('window', { dispatchEvent: vi.fn() });
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  const transport = vi.fn<typeof fetch>().mockResolvedValueOnce(response(1))
    .mockRejectedValueOnce(new Error('offline')).mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(response(2, 1));
  const first = createCartStore(transport); first.getState().setContext(scope);
  await first.getState().fetchCart();
  await expect(first.getState().addToCart('variant', 'product', 1)).rejects.toThrow();
  const originalBody = transport.mock.calls[1][1]!.body;
  const reloaded = createCartStore(transport); reloaded.getState().setContext({ ...scope, userID: 'other-user' });
  expect(reloaded.getState().hasUnresolvedMutation).toBe(false);
  reloaded.getState().setContext(scope);
  expect(reloaded.getState().hasUnresolvedMutation).toBe(true);
  transport.mockResolvedValueOnce(response(2, 1));
  await reloaded.getState().retryMutation();
  expect(transport.mock.calls[4][1]!.body).toBe(originalBody);
  expect(values.size).toBe(0);
});
