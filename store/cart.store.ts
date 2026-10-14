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
  isMutating: boolean; hasUnresolvedMutation: boolean;
  setContext: (context: CartContext) => void;
  fetchCart: (options?: { maxAgeMs?: number }) => Promise<void>;
  retryMutation: () => Promise<void>;
  addToCart: (variantID: string | null | undefined, productID: string, quantity: number) => Promise<void>;
  updateQuantity: (variantID: string, quantity: number) => Promise<void>;
  removeItem: (variantID: string) => Promise<void>;
  consumeCart: (id: string, version: number) => Promise<void>;
  clearCart: () => void;
}
function announce() { if (typeof window !== 'undefined') window.dispatchEvent(new Event('commerce-cart-changed')); }
const pendingCommandSchema = z.object({
  method: z.enum(['POST', 'PATCH', 'DELETE']), body: z.string(),
  uncertain: z.boolean().default(false),
  parameters: z.union([
    z.object({ productID: z.string(), variantID: z.string().nullish(), quantity: z.number().int().min(1).max(99) }),
    z.object({ variantID: z.string(), quantity: z.number().int().min(1).max(99) }),
    z.object({ variantID: z.string() }),
  ]),
});
type PendingCommand = z.infer<typeof pendingCommandSchema>;
const pendingKey = (context: CartContext) => `commerce-cart-pending:${JSON.stringify(context)}`;
function savedCommand(context: CartContext | null): PendingCommand | null {
  if (typeof window === 'undefined' || !context?.userID) return null;
  try {
    const command = pendingCommandSchema.parse(JSON.parse(sessionStorage.getItem(pendingKey(context)) ?? 'null'));
    const body = JSON.parse(command.body);
    if (!z.string().uuid().safeParse(body.commandId).success) return null;
    if (!Object.entries(command.parameters).every(([key, value]) => body[key] === value)) return null;
    return command;
  } catch { return null; }
}
function saveCommand(context: CartContext | null, command: PendingCommand | null) {
  if (typeof window === 'undefined' || !context?.userID) return;
  try {
    if (command) sessionStorage.setItem(pendingKey(context), JSON.stringify(command));
    else sessionStorage.removeItem(pendingKey(context));
  } catch { /* Restricted browser storage: retain the command in memory. */ }
}

/** One queue per identity; no optimistic whole-object rollback. */
export function createCartStore(transport: typeof fetch = (input, init) => fetch(input, init)) {
  let epoch = 0, queue = Promise.resolve(), pending = 0;
  let mutations = 0, validatedAt = 0;
  let unresolved: PendingCommand | null = null;
  let pendingRead: Promise<void> | null = null;
  const controllers = new Set<AbortController>();
  return create<CartStore>((set, get) => {
    const reset = (context: CartContext | null, cart: CartType | null = null) => {
      const sameIdentity = JSON.stringify(context) === JSON.stringify(get().context);
      saveCommand(get().context, unresolved);
      epoch++; for (const c of controllers) c.abort(); controllers.clear(); queue = Promise.resolve(); pending = 0; pendingRead = null;
      mutations = 0; validatedAt = 0;
      if (!sameIdentity) unresolved = savedCommand(context);
      set({ context, cart, isLoading: false, isMutating: false, hasUnresolvedMutation: !!unresolved,
        error: null, loadState: context?.userID ? 'idle' : context ? 'guest' : 'idle' });
    };
    const enqueue = (work: (current: () => boolean, signal: AbortSignal) => Promise<void>, mutation = false) => {
      const generation = epoch; pending++; if (mutation) mutations++;
      set({ isLoading: true, isMutating: mutations > 0 });
      const result = queue.then(async () => {
        const current = () => generation === epoch;
        if (!current()) throw new Error('Identidade alterada; confira o carrinho atual.');
        const c = new AbortController(); controllers.add(c);
        try { await work(current, c.signal); } finally { controllers.delete(c); }
      });
      queue = result.catch(() => {});
      return result.finally(() => { if (generation === epoch) {
        pending--; if (mutation) mutations--;
        set({ isLoading: pending > 0, isMutating: mutations > 0 });
      } });
    };
    const request = (init: RequestInit, signal: AbortSignal) => transport('/api/cart', {
      ...init, signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
    });
    const read = async (current: () => boolean, signal: AbortSignal) => {
      const context = get().context;
      if (!context?.userID) { if (current()) set({ cart: null, loadState: context ? 'guest' : 'idle', error: null }); return; }
      const response = await request({ cache: 'no-store' }, signal);
      if (!current()) return;
      if (response.status === 401 || response.status === 403) {
        reset(null); set({ loadState: 'error', error: 'Sua sessão mudou. Entre novamente ou atualize a página.' }); return;
      }
      if (!response.ok) throw new Error('Não foi possível carregar o carrinho. Tente novamente.');
      const raw = await response.json(); if (!current()) return;
      if (raw?.id === null && Array.isArray(raw.items) && raw.items.length === 0) {
        validatedAt = Date.now(); set({ cart: null, loadState: 'ready', error: null }); return;
      }
      const cart = cartSchema.parse(raw);
      if (cart.userID !== context.userID || cart.lojaID !== context.lojaID) {
        reset(null); set({ loadState: 'error', error: 'Identidade alterada; atualize a página para continuar.' }); return;
      }
      if (get().cart?.id === cart.id && get().cart!.version > cart.version) return;
      // A focus read is not an edit. Keep the checkout draft/proposal stable
      // when the complete validated snapshot is identical. Version alone is
      // insufficient: catalog price/attributes can change independently.
      const previous = get().cart;
      validatedAt = Date.now();
      set({ cart: previous && JSON.stringify(previous) === JSON.stringify(cart) ? previous : cart,
        loadState: 'ready', error: null });
    };
    const mutate = (method: 'POST' | 'PATCH' | 'DELETE', parameters: PendingCommand['parameters']) => {
      // A read requested after a write must observe the write's result.
      pendingRead = null;
      return enqueue(async (current, signal) => {
      const context = get().context;
      if (!context?.userID) throw new Error('Entre na sua conta para usar o carrinho.');
      if (unresolved && (unresolved.method !== method || JSON.stringify(unresolved.parameters) !== JSON.stringify(parameters))) {
        throw new Error('Confira a alteração pendente no carrinho antes de fazer outra.');
      }
      if (!unresolved && (get().loadState !== 'ready' || Date.now() - validatedAt > 5000)) await read(current, signal);
      if (!current()) return;
      const cart = get().cart;
      if (!unresolved && method !== 'POST' && !cart) throw new Error('O carrinho mudou. Confira os itens atuais.');
      const body = unresolved?.body ?? JSON.stringify({ ...parameters, commandId: crypto.randomUUID(),
        ...(cart ? { cartId: cart.id, expectedVersion: cart.version } : {}) });
      unresolved = { method, parameters, body, uncertain: unresolved?.uncertain ?? false };
      saveCommand(context, unresolved);
      set({ hasUnresolvedMutation: true, error: null });
      try {
        // Retry the exact command through response decoding too. A malformed
        // success response must never turn the same intention into another ADD.
        for (let retry = 0; retry < 2; retry++) {
          let status: number | null = null, requestId: string | null = null, rejected = false;
          try {
            const response = await request({ method, headers: { 'Content-Type': 'application/json' }, body }, signal);
            status = response.status; requestId = response.headers.get('x-request-id');
            if (!current()) return;
            if (!response.ok) {
              const raw = await response.json().catch(() => null);
              const knownRejection = [400, 401, 403, 404, 409, 422, 429].includes(response.status);
              rejected = knownRejection;
              // A later auth/rate-limit failure says nothing about an earlier
              // ambiguous submission. Preserve its identity for recovery.
              if (knownRejection && !unresolved?.uncertain) {
                unresolved = null; saveCommand(context, null); set({ hasUnresolvedMutation: false });
              }
              console.warn('CART_REQUEST_FAILED', { method, status: response.status,
                code: typeof raw?.code === 'string' && /^[A-Z_]+$/.test(raw.code) ? raw.code : 'HTTP_ERROR',
                requestId: response.headers.get('x-request-id') });
              throw new Error(response.status === 409 ? 'O carrinho mudou em outra operação. Confira os itens antes de repetir.'
                : [401, 403].includes(response.status) ? 'Sua sessão mudou. Entre novamente para continuar.'
                : raw?.code === 'INVALID_INPUT' ? 'Confira a variante, a quantidade e a disponibilidade do produto.'
                : 'Não foi possível confirmar a alteração do carrinho.');
            }
            const raw = await response.json(); if (!current()) return;
            if (raw?.status !== 'ACTIVE') {
              // Only a valid receipt for an already consumed cart is success.
              if (raw?.replay !== true || raw?.status !== 'COMPLETED' || raw.userID !== context.userID || raw.lojaID !== context.lojaID) {
                throw new Error('Resposta inválida do carrinho.');
              }
              await read(current, signal);
            } else {
              const next = cartSchema.parse(raw);
              if (next.userID !== context.userID || next.lojaID !== context.lojaID) throw new Error('Identidade do carrinho incompatível.');
              if (get().cart?.id !== next.id || next.version >= get().cart!.version) set({ cart: next, loadState: 'ready', error: null });
              validatedAt = Date.now();
            }
            if (!current()) return;
            unresolved = null; saveCommand(context, null); set({ hasUnresolvedMutation: false });
            announce(); return;
          } catch (error) {
            if (current() && unresolved && !rejected) {
              unresolved.uncertain = true; saveCommand(context, unresolved);
            }
            if (current() && unresolved) console.warn('CART_RESULT_UNRESOLVED', {
              method, status, requestId, attempt: retry + 1, code: status === null ? 'TRANSPORT_FAILURE' : 'RESPONSE_UNRESOLVED',
            });
            if (retry || rejected || !unresolved || !current() || signal.aborted) throw error;
          }
        }
      } catch (error) {
        if (!current()) return;
        try { await read(current, signal); } catch { if (current()) set({ loadState: 'error' }); }
        if (current()) set({ error: error instanceof Error ? error.message : 'Falha ao alterar carrinho.' });
        throw error;
      }
      }, true);
    };
    return { cart: null, context: null, loadState: 'idle', error: null, isLoading: false, isMutating: false, hasUnresolvedMutation: false,
      setContext: context => { if (JSON.stringify(context) !== JSON.stringify(get().context)) reset(context); },
      clearCart: () => reset(get().context),
      retryMutation: () => unresolved && !get().isMutating ? mutate(unresolved.method, unresolved.parameters) : Promise.resolve(),
      fetchCart: (options) => {
        if (options?.maxAgeMs && get().loadState === 'ready' && Date.now() - validatedAt < options.maxAgeMs) return Promise.resolve();
        if (pendingRead) return pendingRead;
        const result = enqueue(async (current, signal) => {
          if (current()) set({ loadState: 'loading', error: null });
          try { await read(current, signal); }
          catch (error) { if (current()) set({ loadState: 'error', error: error instanceof Error ? error.message : 'Falha ao carregar carrinho.' }); }
        });
        pendingRead = result;
        void result.finally(() => { if (pendingRead === result) pendingRead = null; }).catch(() => {});
        return result;
      },
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
