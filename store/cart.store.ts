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
  fetchCart: () => Promise<void>;
  addToCart: (variantID: string, productID: string, quantity: number) => Promise<void>;
  updateQuantity: (variantID: string, quantity: number) => Promise<void>;
  removeItem: (variantID: string) => Promise<void>;
  clearCart: () => void;
}

export const useCartStore = create<CartStore>((set, get) => ({
  cart: null,
  isLoading: false,
  clearCart: () => set({ cart: null }),
  fetchCart: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch("/api/cart");
      if (res.ok) {
        const data = await res.json();
        set({ cart: data });
      }
    } catch (error) {
      console.error(error);
    } finally {
      set({ isLoading: false });
    }
  },
  addToCart: async (variantID, productID, quantity) => {
    set({ isLoading: true });
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantID, productID, quantity }),
      });
      if (res.ok) {
        const data = await res.json();
        set({ cart: data });
      } else if (res.status === 401) {
        window.location.href = "/login";
      } else {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to add to cart");
      }
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },
  updateQuantity: async (variantID, quantity) => {
    const previousCart = get().cart;
    
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
      
      if (!res.ok) throw new Error("Failed to update");
      
      const data = await res.json();
      set({ cart: data });
    } catch (error) {
      console.error("Optimistic update failed, reverting...", error);
      set({ cart: previousCart });
    }
  },
  removeItem: async (variantID) => {
    const previousCart = get().cart;

    // Optimistic update
    if (previousCart) {
      const updatedItems = previousCart.items.filter(item => item.variantID !== variantID);
      set({ cart: { ...previousCart, items: updatedItems } });
    }

    try {
      const res = await fetch(`/api/cart?variantID=${variantID}`, {
        method: "DELETE",
      });
      
      if (!res.ok) throw new Error("Failed to delete");

      const data = await res.json();
      set({ cart: data });
    } catch (error) {
      console.error("Optimistic delete failed, reverting...", error);
      set({ cart: previousCart });
    }
  },
}));
