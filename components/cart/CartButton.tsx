"use client";

import { ShoppingCart } from "lucide-react";
import { useCart } from "@/components/providers/CartProvider";
import { useCartStore } from "@/store/cart.store";

export function CartButton() {
  const { setIsOpen } = useCart();
  const { cart } = useCartStore();
  
  const itemCount = cart?.items?.reduce((total, item) => total + item.quantity, 0) || 0;

  return (
    <button 
      onClick={() => setIsOpen(true)}
      className="relative p-2 text-zinc-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-full"
      aria-label="Open cart"
    >
      <ShoppingCart className="w-5 h-5" />
      {itemCount > 0 && (
        <span className="absolute top-0 right-0 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-black bg-primary rounded-full">
          {itemCount}
        </span>
      )}
    </button>
  );
}
