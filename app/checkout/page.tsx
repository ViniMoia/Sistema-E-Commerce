'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCartStore } from '@/store/cart.store'
import { CheckoutForm, type CheckoutResult } from '@/components/checkout/CheckoutForm'
import { Spinner } from '@/components/ui'
import { ContinentalLogo } from '@/components/brand/ContinentalLogo'
import { ShieldCheck, ShoppingBag, ArrowLeft } from 'lucide-react'

export default function CheckoutPage() {
  const router = useRouter()
  const { cart, fetchCart, loadState, error: cartError, context, isLoading } = useCartStore()
  const items = cart?.items || []
  const [loja, setLoja] = useState<{ id: string; name?: string; pixKey?: string; whatsappNumber?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)


  useEffect(() => {
    let disposed = false
    const controller = new AbortController()
    const loadSettings = async () => {
      setError(null)
      try {
        const response = await fetch('/api/loja/active', { cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw new Error('Loja não encontrada')
        const data = await response.json()
        if (typeof data?.id !== 'string') throw new Error('Loja inválida')
        await fetchCart()
        if (!disposed) { setLoja(data); setLoading(false) }
      } catch { if (!disposed) { setError('Erro ao carregar configurações da loja'); setLoading(false) } }
    }
    void loadSettings()
    const intentID = new URL(window.location.href).searchParams.get('intent')
    if (intentID) fetch('/api/checkout/intents/' + encodeURIComponent(intentID), { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Falha na recuperação')
        const data = (await response.json()).data
        if (!disposed && data?.result?.order) router.replace('/checkout/confirmation?intent=' + encodeURIComponent(intentID))
      }).catch(() => { if (!disposed) setError('Não foi possível recuperar a compra. Tente carregar a página novamente.') })
    return () => { disposed = true; controller.abort() }
  }, [router, fetchCart, context?.lojaID, context?.userID, reload])

  if (loading || !cart && (loadState === 'idle' || loadState === 'loading')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-catalog-bg text-catalog-text">
        <div className="text-center space-y-3">
          <Spinner className="h-10 w-10 text-catalog-gold mx-auto" />
          <p className="text-xs font-mono uppercase tracking-widest text-catalog-gold">
            Carregando ambiente de checkout seguro...
          </p>
        </div>
      </div>
    )
  }

  if (error || loadState === 'error' && !cart) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-catalog-bg text-catalog-text px-4">
        <div className="max-w-md w-full bg-catalog-card border border-red-500/40 rounded-3xl p-8 text-center shadow-2xl backdrop-blur-xl">
          <p className="text-red-400 font-mono text-sm mb-6">{error || cartError}</p>
          <button onClick={() => { setLoading(true); setReload(value => value + 1) }} className="mb-4 text-white">Tentar carregar novamente</button>
          <button
            onClick={() => router.push('/')}
            className="btn-shimmer px-6 py-3 rounded-full bg-gradient-to-r from-[#F0B40E] to-[#E5A805] text-[#010E31] font-bold text-xs uppercase tracking-widest"
          >
            Voltar para a Loja
          </button>
        </div>
      </div>
    )
  }

  if (!loja) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-catalog-bg text-catalog-text">
        <div className="text-center space-y-3">
          <Spinner className="h-8 w-8 text-catalog-gold mx-auto" />
          <p className="text-xs font-mono uppercase tracking-widest text-catalog-gold">
            Configurando loja...
          </p>
        </div>
      </div>
    )
  }

  // Handle form submission
  const handleOrderCreated = (result: CheckoutResult) => {
    if (!result.checkoutIntentID) return
    // Recovery authority remains in the backend; storage is optional navigation support.
    try { sessionStorage.setItem('last_checkout_intent', result.checkoutIntentID); sessionStorage.removeItem('last_order') } catch {}
    router.push('/checkout/confirmation?intent=' + encodeURIComponent(result.checkoutIntentID))
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
                {loja?.name || 'Continental Estética'}
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
      <div className="relative z-10 flex-1 flex flex-col justify-center">
        {cart && loadState === 'error' && <div role="alert" className="p-4 text-red-400 text-center">
          <p>{cartError}</p><button onClick={() => { void fetchCart().catch(() => {}) }}>Tentar atualizar o carrinho</button>
        </div>}
        {items.length === 0 ? (
          <div className="max-w-lg mx-auto px-4 py-16 text-center animate-in fade-in zoom-in duration-500">
            <div className="bg-catalog-card border border-catalog-gold/45 rounded-3xl p-8 sm:p-12 shadow-2xl backdrop-blur-2xl space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-catalog-gold/15 border border-catalog-gold/30 flex items-center justify-center text-catalog-gold mx-auto shadow-[0_0_20px_rgba(240,180,14,0.2)]">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-bold text-white uppercase font-mono tracking-tight">
                  Seu Carrinho está Vazio
                </h2>
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
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full">
            <CheckoutForm
              key={loja.id + ':' + (context?.userID ?? 'guest') + ':' + cart?.id}
              sourcePending={isLoading || loadState !== 'ready'}
        cartID={cart?.id}
        cartVersion={cart?.version}
              lojaID={loja.id}
              pixKey={loja.pixKey || ''}
              whatsappNumber={loja.whatsappNumber || ''}
              items={items}
              onOrderCreated={handleOrderCreated}
            />
          </main>
        )}
      </div>

      {/* Footer Fixo */}
      <footer className="relative z-10 w-full border-t border-catalog-gold/15 bg-[#000000]/80 py-6 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left text-xs font-mono text-catalog-muted">
          <p>© {new Date().getFullYear()} {loja?.name || 'Continental'}. Todos os direitos reservados.</p>
          <p className="text-[11px] text-catalog-gold">Estética Automotiva de Alta Precisão</p>
        </div>
      </footer>
    </div>
  )
}
