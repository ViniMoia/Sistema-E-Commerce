"use client";

import { useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCartStore } from "@/store/cart.store";
import { useCart } from "@/components/providers/CartProvider";
import { ShoppingCart, Loader2 } from "lucide-react";
import { CartItem } from "./CartItem";
import { CartSummary } from "./CartSummary";

export function CartDrawer() {
  const { isOpen, setIsOpen } = useCart();
  const { 
    cart, 
    fetchCart, 
    updateQuantity, 
    removeItem, 
    isLoading, isMutating, hasUnresolvedMutation, retryMutation, loadState, error
  } = useCartStore();

  // Fetch cart data when drawer is opened
  useEffect(() => {
    if (isOpen && !useCartStore.getState().isMutating) {
      void fetchCart({ maxAgeMs: 5000 }).catch(() => {});
    }
  }, [isOpen, fetchCart]);

  const items = cart?.items || [];
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0);
  const total = subtotal;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent 

        className="w-full sm:max-w-lg bg-neutral-900/90 backdrop-blur-xl border-l border-white/10 text-white flex flex-col p-0 data-[state=open]:duration-150 data-[state=closed]:duration-150 motion-reduce:animate-none"
      >
        <SheetHeader className="shrink-0 p-6 border-b border-white/10 flex flex-row justify-between items-center space-y-0">
          <SheetTitle className="text-white flex items-center gap-2 text-xl font-medium tracking-tight">
            <ShoppingCart className="w-5 h-5" />
            Seu carrinho
          </SheetTitle>
          <span className="text-xs uppercase tracking-[0.25em] font-mono text-neutral-400 flex items-center gap-2">
            {isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
            {itemCount} {itemCount === 1 ? 'item' : 'itens'}
          </span>
        </SheetHeader>

        {isMutating && <p role="status" className="px-6 pt-3 text-sm">Atualizando carrinho...</p>}
        {hasUnresolvedMutation && !isMutating && <div role="alert" className="px-6 pt-3 text-sm">
          <p>A alteração ainda precisa ser confirmada. Confira o resultado antes de continuar.</p>
          <button type="button" className="underline" onClick={() => void retryMutation().catch(() => {})}>Conferir alteração</button>
        </div>}

        <ScrollArea className="min-h-0 flex-1 p-6">
          {loadState === 'error' ? <div role="alert"><p>{error}</p><button onClick={() => void fetchCart().catch(() => {})}>Tentar novamente</button></div>
          : loadState === 'guest' ? <p>Entre na sua conta para acessar o carrinho.</p>
          : (loadState === 'idle' || loadState === 'loading') && !cart ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4 opacity-70 mt-32">
              <Loader2 className="w-10 h-10 animate-spin text-neutral-500" />
              <p className="text-neutral-400 font-light">Carregando carrinho...</p>
            </div>
          ) : items.length === 0 && !isMutating ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4 opacity-70 mt-32">
              <ShoppingCart className="w-16 h-16 text-neutral-500" />
              <p className="text-neutral-400 font-light">Seu carrinho está vazio</p>
            </div>
          ) : (
            <div className="space-y-6 relative">
              {items.map((item) => (
                <CartItem 
                  key={item.id} 
                  item={item} 
                  onRemove={id => { void removeItem(id).catch(() => {}); }}
                  onUpdateQuantity={(id, quantity) => { void updateQuantity(id, quantity).catch(() => {}); }}
                  isLoading={isMutating || hasUnresolvedMutation}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {error && loadState !== 'error' && <p role="alert" className="px-6 text-red-400">{error}</p>}
        {items.length > 0 && (
          <div className="shrink-0 border-t border-white/10 p-6 bg-black/40 backdrop-blur-md">
            <CartSummary 
              subtotal={subtotal} 
              total={total} 
              disabled={isMutating || hasUnresolvedMutation}
              onCheckout={() => {
                const state = useCartStore.getState();
                if (state.isMutating || state.hasUnresolvedMutation || !state.cart) return;
                setIsOpen(false);
                // Checkout starts from the persisted cart/session. A document
                // navigation also avoids racing an in-flight storefront RSC
                // refresh that can leave client navigation on the product view.
                window.location.assign("/checkout");
              }}
              onContinueShopping={() => setIsOpen(false)}
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}


