"use client";

import React, { createContext, useContext, useState, useLayoutEffect, useEffect } from "react";
import dynamic from "next/dynamic";
import { useCartStore } from '@/store/cart.store';
import { useRouter } from 'next/navigation';

const CartDrawer = dynamic(() => import("@/components/cart/CartDrawer").then(mod => mod.CartDrawer), {
  ssr: false,
});

type CartContextType = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children, lojaID, userID }: { children: React.ReactNode; lojaID: string; userID: string | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  useLayoutEffect(() => { useCartStore.getState().setContext({ lojaID, userID }); }, [lojaID, userID]);
  useEffect(() => {
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('commerce-cart-v1') : null;
    const refresh = () => { void useCartStore.getState().fetchCart().catch(() => {}); router.refresh(); };
    const publish = () => channel?.postMessage({ type: 'invalidate' });
    const focus = () => { if (!document.hidden) refresh(); };
    if (channel) channel.onmessage = refresh;
    window.addEventListener('commerce-cart-changed', publish);
    window.addEventListener('focus', focus);
    window.addEventListener('pageshow', focus);
    document.addEventListener('visibilitychange', focus);
    refresh();
    return () => { channel?.close(); window.removeEventListener('commerce-cart-changed', publish);
      window.removeEventListener('focus', focus); window.removeEventListener('pageshow', focus); document.removeEventListener('visibilitychange', focus); };
  }, [lojaID, userID, router]);

  return (
    <CartContext.Provider value={{ isOpen, setIsOpen }}>
      {children}
      <CartDrawer />
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
