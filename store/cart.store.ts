import { create } from 'zustand';
import { z } from 'zod';
const itemSchema = z.object({ id: z.string(), cartID: z.string(), productID: z.string(), variantID: z.string(),
  quantity: z.number().int().min(1).max(99), productName: z.string(), price: z.number().finite().nonnegative(),
  color: z.string(), size: z.string(), imageUrl: z.string() });
const cartSchema = z.object({ id: z.string(), userID: z.string(), lojaID: z.string(), status: z.literal('ACTIVE'),
  version: z.number().int().nonnegative(), items: z.array(itemSchema) });
export type CartItemType = z.infer<typeof itemSchema>;
export type CartType = z.infer<typeof cartSchema>;
export type CartContext = { lojaID: string; userID: string | null };
export type CartLoadState = 'idle' | 'loading' | 'ready' | 'guest' | 'error';
interface CartStore {
  cart: CartType | null; context: CartContext | null; loadState: CartLoadState; error: string | null; isLoading: boolean;
  setContext: (context: CartContext) => void;
  fetchCart: () => Promise<void>;
  addToCart: (variantID: string | null | undefined, productID: string, quantity: number) => Promise<void>;
  updateQuantity: (variantID: string, quantity: number) => Promise<void>;
  removeItem: (variantID: string) => Promise<void>;
  consumeCart: (id: string, version: number) => Promise<void>;
  clearCart: () => void;
}
function announce() { if (typeof window !== 'undefined') window.dispatchEvent(new Event('commerce-cart-changed')); }

/** One queue per identity; no optimistic whole-object rollback. */
export function createCartStore(transport: typeof fetch = (input, init) => fetch(input, init)) {
  let epoch = 0, queue = Promise.resolve(), pending = 0;
  const controllers = new Set<AbortController>();
  return create<CartStore>((set, get) => {
    const reset = (context: CartContext | null, cart: CartType | null = null) => {
      epoch++; for (const c of controllers) c.abort(); controllers.clear(); queue = Promise.resolve(); pending = 0;
      set({ context, cart, isLoading: false, error: null, loadState: context?.userID ? 'idle' : context ? 'guest' : 'idle' });
    };
    const enqueue = (work: (current: () => boolean, signal: AbortSignal) => Promise<void>) => {
      const generation = epoch; pending++; set({ isLoading: true });
      const result = queue.then(async () => {
        const current = () => generation === epoch;
        if (!current()) throw new Error('Identidade alterada; confira o carrinho atual.');
        const c = new AbortController(); controllers.add(c);
        try { await work(current, c.signal); } finally { controllers.delete(c); }
      });
      queue = result.catch(() => {});
      return result.finally(() => { if (generation === epoch) { pending--; set({ isLoading: pending > 0 }); } });
    };
    const read = async (current: () => boolean, signal: AbortSignal) => {
      const context = get().context;
      if (!context?.userID) { if (current()) set({ cart: null, loadState: context ? 'guest' : 'idle', error: null }); return; }
      const response = await transport('/api/cart', { cache: 'no-store', signal });
      if (!current()) return;
      if (response.status === 401 || response.status === 403) {
        reset(null); set({ loadState: 'error', error: 'Sua sessão mudou. Entre novamente ou atualize a página.' }); return;
      }
      if (!response.ok) throw new Error('Não foi possível carregar o carrinho. Tente novamente.');
      const raw = await response.json(); if (!current()) return;
      if (raw?.id === null && Array.isArray(raw.items) && raw.items.length === 0) { set({ cart: null, loadState: 'ready', error: null }); return; }
      const cart = cartSchema.parse(raw);
      if (cart.userID !== context.userID || cart.lojaID !== context.lojaID) {
        reset(null); set({ loadState: 'error', error: 'Identidade alterada; atualize a página para continuar.' }); return;
      }
      if (get().cart?.id === cart.id && get().cart!.version > cart.version) return;
      set({ cart, loadState: 'ready', error: null });
    };
    const mutate = (method: 'POST' | 'PATCH' | 'DELETE', parameters: object) => enqueue(async (current, signal) => {
      const context = get().context;
      if (!context?.userID) throw new Error('Entre na sua conta para usar o carrinho.');
      if (get().loadState !== 'ready') await read(current, signal);
      if (!current()) return;
      const cart = get().cart;
      if (method !== 'POST' && !cart) throw new Error('O carrinho mudou. Confira os itens atuais.');
      const body = JSON.stringify({ ...parameters, commandId: crypto.randomUUID(),
        ...(cart ? { cartId: cart.id, expectedVersion: cart.version } : {}) });
      try {
        let response: Response | undefined;
        // Exact command survives ambiguous transport failure; 409 is not retried.
        for (let retry = 0; retry < 2; retry++) {
          try { response = await transport('/api/cart', { method, headers: { 'Content-Type': 'application/json' }, body, signal }); break; }
          catch (error) { if (retry || !current() || signal.aborted) throw error; }
        }
        if (!current() || !response) return;
        if (!response.ok) throw new Error(response.status === 409 ? 'O carrinho mudou em outra operação. Confira os itens antes de repetir.' : 'Não foi possível alterar o carrinho. Confira os dados atuais.');
        const raw = await response.json(); if (!current()) return;
        if (raw?.status !== 'ACTIVE') { await read(current, signal); announce(); return; }
        const next = cartSchema.parse(raw);
        if (next.userID !== context.userID || next.lojaID !== context.lojaID) throw new Error('Identidade do carrinho incompatível.');
        if (get().cart?.id !== next.id || next.version >= get().cart!.version) set({ cart: next, loadState: 'ready', error: null });
        announce();
      } catch (error) {
        if (!current()) return;
        try { await read(current, signal); } catch { if (current()) set({ loadState: 'error' }); }
        if (current()) set({ error: error instanceof Error ? error.message : 'Falha ao alterar carrinho.' });
        throw error;
      }
    });
    return { cart: null, context: null, loadState: 'idle', error: null, isLoading: false,
      setContext: context => { if (JSON.stringify(context) !== JSON.stringify(get().context)) reset(context); },
      clearCart: () => reset(get().context),
      fetchCart: () => enqueue(async (current, signal) => {
        if (current()) set({ loadState: 'loading', error: null });
        try { await read(current, signal); }
        catch (error) { if (current()) set({ loadState: 'error', error: error instanceof Error ? error.message : 'Falha ao carregar carrinho.' }); }
      }),
      addToCart: (variantID, productID, quantity) => mutate('POST', { variantID, productID, quantity }),
      updateQuantity: (variantID, quantity) => mutate('PATCH', { variantID, quantity }),
      removeItem: variantID => mutate('DELETE', { variantID }),
      consumeCart: async (id, version) => {
        const cart = get().cart;
        reset(get().context, cart?.id === id && cart.version <= version + 1 ? null : cart);
        announce(); await get().fetchCart();
      },
    };
  });
}
export const useCartStore = createCartStore();
