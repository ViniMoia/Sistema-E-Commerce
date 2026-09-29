"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { CartContext } from "@/components/providers/cart-context";
import { CART_RECONCILE_STORAGE_KEY, useCartStore } from "@/store/cart.store";

const CartDrawer = dynamic(() => import("@/components/cart/CartDrawer").then(mod => mod.CartDrawer), {
  ssr: false,
});

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const setIsOpen = useCallback((open: boolean) => {
    if (open) triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpen(open);
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === CART_RECONCILE_STORAGE_KEY && event.newValue) {
        void useCartStore.getState().fetchCart();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return (
    <CartContext.Provider value={{ isOpen, setIsOpen, triggerRef }}>
      {children}
      <CartDrawer />
    </CartContext.Provider>
  );
}
