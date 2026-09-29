"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCartStore } from "@/store/cart.store";
import { useCart } from "@/components/providers/cart-context";
import { ShoppingCart, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { CartItem } from "./CartItem";
import { CartSummary } from "./CartSummary";

export function CartDrawer() {
  const router = useRouter();
  const { isOpen, setIsOpen, triggerRef } = useCart();
  const { 
    cart, 
    fetchCart, 
    updateQuantity, 
    removeItem, 
    isLoading,
    status,
    error,
  } = useCartStore();

  // Fetch cart data when drawer is opened
  useEffect(() => {
    if (isOpen) {
      fetchCart();
    }
  }, [isOpen, fetchCart]);

  const items = cart?.items || [];
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0);
  const total = subtotal;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent
        onCloseAutoFocus={(event) => {
          if (triggerRef.current?.isConnected) {
            event.preventDefault();
            triggerRef.current.focus();
          }
        }}

        className="w-full sm:max-w-lg bg-neutral-900/90 backdrop-blur-xl border-l border-white/10 text-white flex flex-col p-0"
      >
        <SheetHeader className="p-6 border-b border-white/10 flex flex-row justify-between items-center space-y-0">
          <SheetTitle className="text-white flex items-center gap-2 text-xl font-medium tracking-tight">
            <ShoppingCart className="w-5 h-5" />
            Seu Carrinho
          </SheetTitle>
          <span className="text-xs uppercase tracking-[0.25em] font-mono text-neutral-400 flex items-center gap-2">
            {isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
            {itemCount} {itemCount === 1 ? 'item' : 'itens'}
          </span>
        </SheetHeader>

        <ScrollArea className="flex-1 p-6">
          {status === "loading" && !cart ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4 opacity-70 mt-32">
              <Loader2 className="w-10 h-10 animate-spin text-neutral-500" />
              <p className="text-neutral-400 font-light" role="status">Carregando carrinho...</p>
            </div>
          ) : status === "unauthorized" ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4 mt-32 text-center">
              <ShoppingCart className="w-16 h-16 text-neutral-500" />
              <p className="text-neutral-300">Entre na sua conta para acessar o carrinho.</p>
              <Link href="/login?next=/checkout" onClick={() => setIsOpen(false)} className="rounded-full bg-catalog-gold px-5 py-3 text-xs font-bold uppercase tracking-wider text-black">
                Entrar
              </Link>
            </div>
          ) : status === "error" && !cart ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4 mt-32 text-center" role="alert">
              <AlertCircle className="w-12 h-12 text-red-400" />
              <p className="max-w-xs text-sm text-red-300">{error}</p>
              <button type="button" onClick={() => fetchCart()} className="min-h-11 rounded-full border border-white/20 px-5 text-xs font-bold uppercase tracking-wider hover:bg-white/10">
                Tentar novamente
              </button>
            </div>
          ) : status === "empty" ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4 opacity-70 mt-32">
              <ShoppingCart className="w-16 h-16 text-neutral-500" />
              <p className="text-neutral-400 font-light">Seu carrinho está vazio</p>
            </div>
          ) : (
            <div className="space-y-6 relative">
              {error && (
                <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-xs text-red-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              {items.map((item) => (
                <CartItem 
                  key={item.id} 
                  item={item} 
                  onRemove={removeItem}
                  onUpdateQuantity={updateQuantity}
                  isLoading={isLoading}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {items.length > 0 && (
          <div className="border-t border-white/10 p-6 bg-black/40 backdrop-blur-md">
            <CartSummary 
              subtotal={subtotal} 
              total={total} 
              onCheckout={() => {
                setIsOpen(false);
                router.push("/checkout");
              }}
              onContinueShopping={() => setIsOpen(false)}
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}


