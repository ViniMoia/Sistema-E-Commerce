import { create } from "zustand";

export interface CartItemType {
  id: string;
  cartID: string;
  productID: string;
  variantID: string;
  quantity: number;
  productName: string;
  price: number;
  color: string;
  size: string;
  imageUrl: string;
}

export interface CartType {
  id: string;
  userID: string;
  status: string;
  items: CartItemType[];
}

interface CartStore {
  cart: CartType | null;
  isLoading: boolean;
  status: "idle" | "loading" | "success" | "empty" | "error" | "unauthorized";
  error: string | null;
  fetchCart: () => Promise<void>;
  addToCart: (variantID: string | null | undefined, productID: string, quantity: number) => Promise<void>;
  updateQuantity: (variantID: string, quantity: number) => Promise<void>;
  removeItem: (variantID: string) => Promise<void>;
  reconcileAfterCheckout: (sourceCartID: string) => Promise<void>;
  clearCart: () => void;
}

export const CART_RECONCILE_STORAGE_KEY = "continental:cart-reconciled";

export class CartRequestError extends Error {
  constructor(message: string, public readonly code: "AUTH_REQUIRED" | "REQUEST_FAILED") {
    super(message);
    this.name = "CartRequestError";
  }
}

function cartErrorMessage(status: number, operation: "load" | "add" | "update" | "remove") {
  if (status === 401) return "Entre na sua conta para acessar o carrinho.";
  if (status === 409) return "O estoque mudou. Atualize o carrinho e tente novamente.";
  if (status === 422 || status === 400) return "Não foi possível validar os itens do carrinho.";
  const action = operation === "load" ? "carregar" : operation === "add" ? "adicionar o item ao" : operation === "update" ? "atualizar o" : "remover o item do";
  return `Não foi possível ${action} carrinho. Tente novamente.`;
}

export const useCartStore = create<CartStore>((set, get) => ({
  cart: null,
  isLoading: false,
  status: "idle",
  error: null,
  clearCart: () => set({ cart: null, status: "empty", error: null }),
  reconcileAfterCheckout: async (sourceCartID) => {
    if (get().cart?.id === sourceCartID) {
      set({ status: "loading", error: null });
    }
    await get().fetchCart();
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(
          CART_RECONCILE_STORAGE_KEY,
          JSON.stringify({ sourceCartID, reconciledAt: Date.now(), nonce: crypto.randomUUID() })
        );
      } catch {
        // A sincronização da aba atual já ocorreu; storage pode estar indisponível.
      }
    }
  },
  fetchCart: async () => {
    set({ isLoading: true, status: "loading", error: null });
    try {
      const res = await fetch("/api/cart");
      if (res.status === 401) {
        set({ cart: null, status: "unauthorized", error: cartErrorMessage(401, "load") });
        return;
      }
      if (!res.ok) throw new CartRequestError(cartErrorMessage(res.status, "load"), "REQUEST_FAILED");
      const data = await res.json();
      if (!data || !Array.isArray(data.items)) {
        throw new CartRequestError("O carrinho retornou uma resposta inválida. Tente novamente.", "REQUEST_FAILED");
      }
      set({ cart: data, status: data.items.length > 0 ? "success" : "empty", error: null });
    } catch (error) {
      const message = error instanceof CartRequestError
        ? error.message
        : "Não foi possível carregar o carrinho. Verifique sua conexão e tente novamente.";
      set({ status: "error", error: message });
    } finally {
      set({ isLoading: false });
    }
  },
  addToCart: async (variantID, productID, quantity) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantID, productID, quantity }),
      });
      if (res.ok) {
        const data = await res.json();
        set({ cart: data, status: data.items?.length ? "success" : "empty", error: null });
      } else if (res.status === 401) {
        throw new CartRequestError(cartErrorMessage(401, "add"), "AUTH_REQUIRED");
      } else {
        throw new CartRequestError(cartErrorMessage(res.status, "add"), "REQUEST_FAILED");
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : cartErrorMessage(500, "add") });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },
  updateQuantity: async (variantID, quantity) => {
    const previousCart = get().cart;
    set({ error: null });
    
    // Optimistic update
    if (previousCart) {
      const updatedItems = previousCart.items.map(item => 
        item.variantID === variantID ? { ...item, quantity } : item
      );
      set({ cart: { ...previousCart, items: updatedItems } });
    }

    try {
      const res = await fetch("/api/cart", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantID, quantity }),
      });
      
      if (!res.ok) throw new CartRequestError(cartErrorMessage(res.status, "update"), res.status === 401 ? "AUTH_REQUIRED" : "REQUEST_FAILED");
      
      const data = await res.json();
      set({ cart: data, status: data.items?.length ? "success" : "empty", error: null });
    } catch (error) {
      set({
        cart: previousCart,
        error: error instanceof Error ? error.message : cartErrorMessage(500, "update"),
      });
    }
  },
  removeItem: async (variantID) => {
    const previousCart = get().cart;
    set({ error: null });

    // Optimistic update
    if (previousCart) {
      const updatedItems = previousCart.items.filter(item => item.variantID !== variantID);
      set({ cart: { ...previousCart, items: updatedItems } });
    }

    try {
      const res = await fetch(`/api/cart?variantID=${variantID}`, {
        method: "DELETE",
      });
      
      if (!res.ok) throw new CartRequestError(cartErrorMessage(res.status, "remove"), res.status === 401 ? "AUTH_REQUIRED" : "REQUEST_FAILED");

      const data = await res.json();
      set({ cart: data, status: data.items?.length ? "success" : "empty", error: null });
    } catch (error) {
      set({
        cart: previousCart,
        error: error instanceof Error ? error.message : cartErrorMessage(500, "remove"),
      });
    }
  },
}));
