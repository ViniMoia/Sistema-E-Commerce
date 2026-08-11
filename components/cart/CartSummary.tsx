"use client";

import { Button } from "@/components/ui/button";

interface CartSummaryProps {
  subtotal: number;
  total: number;
  onCheckout?: () => void;
  onContinueShopping?: () => void;
}

function AnimatedCheckoutButton({ onClick }: { onClick?: () => void }) {
  return (
    <div className="group relative scale-100">
      {/* Glow Behind */}
      <div className="-inset-1 group-hover:opacity-100 transition duration-500 bg-neutral-600/30 opacity-0 absolute blur-md pointer-events-none" />
      
      {/* Outer Spin Border */}
      <div className="absolute -inset-[1px] overflow-hidden opacity-0 group-hover:opacity-100 transition duration-500 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300%] h-[300%] bg-[conic-gradient(from_0deg,transparent_0_340deg,white_360deg)] animate-[spin_2s_linear_infinite]" />
      </div>

      <button 
        onClick={onClick}
        className="group relative z-10 flex w-full items-center justify-center overflow-hidden p-[1px] leading-none"
      >
        <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0_340deg,white_360deg)]" />
        <span className="relative flex h-full w-full items-center justify-center bg-black py-4 ring-1 ring-white/10 hover:bg-neutral-900 transition-colors">
          <span className="absolute inset-0 overflow-hidden">
            <span className="absolute top-0 left-0 h-full w-full -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:animate-shimmer group-hover:opacity-100" />
          </span>
          <span className="relative z-10 flex items-center gap-2">
            <span className="text-sm font-bold tracking-widest text-white uppercase">Checkout</span>
          </span>
        </span>
      </button>
    </div>
  );
}

export function CartSummary({ 
  subtotal, 
  total,
  onCheckout,
  onContinueShopping
}: CartSummaryProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-3 text-sm font-light text-neutral-300">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span className="font-mono text-white">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(subtotal)}
          </span>
        </div>
        <div className="h-[1px] w-full bg-white/10 my-2" />
        <div className="flex justify-between text-base font-medium text-white pt-2">
          <span>Total</span>
          <span className="font-mono">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <AnimatedCheckoutButton onClick={onCheckout} />

        <Button 
          variant="outline" 
          onClick={onContinueShopping}
          className="w-full rounded-none border-white/10 bg-transparent text-white hover:bg-white/10 hover:text-white uppercase tracking-widest text-xs py-6"
        >
          Continue Shopping
        </Button>
      </div>
    </div>
  );
}
