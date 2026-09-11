"use client";

import { ShoppingCart } from "lucide-react";
import { useCart } from "@/components/providers/CartProvider";
import { useCartStore } from "@/store/cart.store";

interface CartButtonProps {
  className?: string;
  iconClassName?: string;
}

export function CartButton({ className = "", iconClassName = "w-5 h-5" }: CartButtonProps) {
  const { setIsOpen } = useCart();
  const { cart } = useCartStore();
  
  const itemCount = cart?.items?.reduce((total, item) => total + item.quantity, 0) || 0;

  return (
    <button 
      onClick={() => setIsOpen(true)}
      className={`relative inline-flex items-center justify-center p-1.5 text-white/90 hover:text-brand-yellow transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow/60 rounded-sm cursor-pointer group ${className}`}
      aria-label={`Carrinho de compras (${itemCount} ${itemCount === 1 ? "item" : "itens"})`}
    >
      <ShoppingCart className={`${iconClassName} transition-transform duration-200 group-hover:scale-110`} />
      {itemCount > 0 && (
        <span className="absolute -top-1.5 -right-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-black bg-brand-yellow rounded-full shadow-[0_0_8px_rgba(240,180,14,0.6)] animate-in">
          {itemCount}
        </span>
      )}
    </button>
  );
}
