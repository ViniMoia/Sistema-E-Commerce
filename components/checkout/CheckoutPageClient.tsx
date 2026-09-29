'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useCartStore } from '@/store/cart.store'
import { Spinner } from '@/components/ui'
import { ContinentalLogo } from '@/components/brand/ContinentalLogo'
import { ShieldCheck, ShoppingBag, ArrowLeft, AlertCircle } from 'lucide-react'

const CheckoutForm = dynamic(
  () => import('@/components/checkout/CheckoutForm').then(module => module.CheckoutForm),
  {
    loading: () => (
      <div className="flex min-h-64 items-center justify-center" role="status">
        <Spinner className="h-8 w-8 text-catalog-gold" />
        <span className="sr-only">Carregando formulário de checkout</span>
      </div>
    ),
  }
)

export interface CheckoutStoreView {
  id: string
  name: string
  pixKey: string
  whatsappNumber: string
}

export function CheckoutPageClient({ loja }: { loja: CheckoutStoreView }) {
  const router = useRouter()
  const { cart, status, error, fetchCart, reconcileAfterCheckout } = useCartStore()
  const items = cart?.items || []

  useEffect(() => {
    if (status === 'idle') void fetchCart()
  }, [fetchCart, status])

  // Handle form submission
  const handleOrderCreated = async (result: any, sourceCartId: string) => {
    sessionStorage.setItem(
      'last_order',
      JSON.stringify({
        orderId: result.id || result.orderId,
        orderNumber: result.orderNumber,
        customer: {
          name: result.customer.name,
          phone: result.customer.phone,
        },
        items: result.items,
        deliveryType: result.deliveryType,
        address: result.address || undefined,
        freightValue: result.freightValue,
        total: result.total,
        pixKey: result.pixKey,
        pixQrCode: result.pixQrCode || null,
        pixPayload: result.pixPayload || null,
        asaasPaymentId: result.asaasPaymentId || null,
        paymentMethod: result.paymentMethod,
        creditCardBrand: result.creditCardBrand,
        creditCardLast4: result.creditCardLast4,
        installments: result.installments,
        installmentValue: result.installmentValue,
        asaasBankSlipUrl: result.asaasBankSlipUrl,
        asaasDigitableLine: result.asaasDigitableLine,
        asaasBarCode: result.asaasBarCode,
        asaasDueDate: result.asaasDueDate,
        whatsappNumber: loja.whatsappNumber || '',
      })
    )

    await reconcileAfterCheckout(sourceCartId)

    router.push('/checkout/confirmation')
  }

  return (
    <div className="min-h-screen bg-catalog-bg text-catalog-text selection:bg-catalog-gold/30 relative flex flex-col">
      {/* Glow de Iluminação Continental no Topo */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[450px] bg-[radial-gradient(ellipse_at_top,rgba(240,180,14,0.08),transparent_65%)] pointer-events-none -z-0" />

      {/* Header Fixo / Barra Superior de Checkout */}
      <header className="relative z-20 w-full bg-[#000000]/90 backdrop-blur-xl border-b border-catalog-gold/20 py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* ContinentalLogo já renderiza Link interno para "/" */}
            <ContinentalLogo variant="symbol" className="h-9 sm:h-10 w-auto" />
            <Link href="/" className="hidden sm:block group">
              <span className="block text-sm font-bold tracking-widest text-white uppercase group-hover:text-catalog-gold transition-colors font-mono">
                {loja.name}
              </span>
              <span className="block text-[10px] font-mono tracking-wider text-catalog-gold uppercase">
                Checkout Seguro Oficial
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs font-mono text-catalog-muted border border-catalog-gold/30 bg-[#0B132B]/60 px-3 py-1.5 rounded-full">
              <ShieldCheck className="w-3.5 h-3.5 text-catalog-gold" />
              <span className="hidden sm:inline">Ambiente Seguro</span>
              <span className="text-emerald-400 font-bold">256-BIT</span>
            </div>

            <Link
              href="/"
              className="inline-flex items-center text-catalog-muted hover:text-white transition-colors group w-fit cursor-pointer"
            >
              <span className="group-hover:-translate-x-1 transition-transform duration-300">
                <ArrowLeft className="w-4 h-4 text-catalog-gold" />
              </span>
              <span className="ml-2 tracking-widest uppercase text-xs font-bold font-mono whitespace-nowrap">
                <span className="hidden md:inline">Continuar Comprando</span>
                <span className="md:hidden">Voltar</span>
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="relative z-10 flex-1 flex flex-col justify-center">
        {status === 'idle' || status === 'loading' ? (
          <div className="flex min-h-80 items-center justify-center gap-3" role="status">
            <Spinner className="h-8 w-8 text-catalog-gold" />
            <span className="text-sm text-catalog-muted">Carregando seu carrinho...</span>
          </div>
        ) : status === 'error' ? (
          <div className="max-w-lg mx-auto px-4 py-16 text-center" role="alert">
            <div className="rounded-3xl border border-red-500/40 bg-red-950/30 p-8 space-y-5">
              <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
              <h1 className="text-xl font-bold text-white">Não foi possível carregar o carrinho</h1>
              <p className="text-sm text-red-200">{error}</p>
              <button type="button" onClick={() => fetchCart()} className="min-h-11 rounded-full bg-catalog-gold px-6 text-xs font-bold uppercase tracking-wider text-black">Tentar novamente</button>
            </div>
          </div>
        ) : status === 'unauthorized' ? (
          <div className="max-w-lg mx-auto px-4 py-16 text-center">
            <div className="rounded-3xl border border-catalog-gold/40 bg-catalog-card p-8 space-y-5">
              <ShoppingBag className="mx-auto h-12 w-12 text-catalog-gold" />
              <h1 className="text-xl font-bold text-white">Entre para continuar</h1>
              <p className="text-sm text-catalog-muted">Seu carrinho é associado à sua conta.</p>
              <Link href="/login?next=/checkout" className="inline-flex min-h-11 items-center rounded-full bg-catalog-gold px-6 text-xs font-bold uppercase tracking-wider text-black">Entrar</Link>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="max-w-lg mx-auto px-4 py-16 text-center animate-in fade-in zoom-in duration-500">
            <div className="bg-catalog-card border border-catalog-gold/45 rounded-3xl p-8 sm:p-12 shadow-2xl backdrop-blur-2xl space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-catalog-gold/15 border border-catalog-gold/30 flex items-center justify-center text-catalog-gold mx-auto shadow-[0_0_20px_rgba(240,180,14,0.2)]">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h1 className="text-xl sm:text-2xl font-bold text-white uppercase font-mono tracking-tight">
                  Seu Carrinho está Vazio
                </h1>
                <p className="text-xs sm:text-sm text-catalog-muted font-light leading-relaxed">
                  Adicione produtos automotivos de alta performance ao carrinho para prosseguir com a finalização do seu pedido.
                </p>
              </div>
              <Link
                href="/"
                className="btn-shimmer inline-flex items-center justify-center px-8 py-3.5 rounded-full bg-gradient-to-r from-[#F0B40E] to-[#E5A805] text-[#010E31] font-bold text-xs uppercase tracking-widest shadow-[0_0_25px_rgba(240,180,14,0.4)] border border-[#F5BD1E]/40 transition-transform hover:scale-105"
              >
                Explorar Catálogo Continental
              </Link>
            </div>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full">
            <CheckoutForm
              lojaID={loja.id}
              cartId={cart.id}
              pixKey={loja.pixKey || ''}
              whatsappNumber={loja.whatsappNumber || ''}
              items={items.map((item) => ({
                productId: item.productID,
                variantId: item.variantID || undefined,
                name: item.productName,
                productName: item.productName,
                quantity: item.quantity,
                price: item.price,
                color: item.color,
                size: item.size,
                imageUrl: item.imageUrl,
              }))}
              onOrderCreated={handleOrderCreated}
            />
          </div>
        )}
      </main>

      {/* Footer Fixo */}
      <footer className="relative z-10 w-full border-t border-catalog-gold/15 bg-[#000000]/80 py-6 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left text-xs font-mono text-catalog-muted">
          <p>© {new Date().getFullYear()} {loja.name}. Todos os direitos reservados.</p>
          <p className="text-[11px] text-catalog-gold">Estética Automotiva de Alta Precisão</p>
        </div>
      </footer>
    </div>
  )
}
