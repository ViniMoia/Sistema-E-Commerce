'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { purchaseClientSchema, purchaseView, type PurchaseClient } from '@/lib/commerce/purchase-client'
import { useCartStore } from '@/store/cart.store'
import { buildWhatsAppMessage, buildWhatsAppUrl } from '@/lib/utils/whatsapp'
import { ContinentalLogo } from '@/components/brand/ContinentalLogo'
import {
  CheckCircle2,
  Clock,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  Sparkles,
  CreditCard,
  FileText,
  ShieldCheck,
  Download,
  ShoppingBag,
  ArrowRight,
  ArrowLeft,
  MessageCircle,
} from 'lucide-react'

export default function CheckoutConfirmationPage() {
  const router = useRouter()
  const context = useCartStore(state => state.context)
  const [recoveryError, setRecoveryError] = useState<string | null>(null)
  const [connectionError, setConnectionError] = useState(false)
  const [order, setOrder] = useState<(PurchaseClient & { orderId: string }) | null>(null)
  const [fresh, setFresh] = useState(false)
  const [requestStartedAt, setRequestStartedAt] = useState(0)
  const [now, setNow] = useState(0)
  const [copiedPix, setCopiedPix] = useState(false)
  const [copiedBoleto, setCopiedBoleto] = useState(false)
  const consumed = useRef<string | null>(null)

  useEffect(() => {
    const intentID = new URL(window.location.href).searchParams.get('intent')
    if (!intentID) { router.replace('/orders'); return }
    let disposed = false, sequence = 0, failures = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let controller: AbortController | undefined
    setOrder(null); setFresh(false); setRecoveryError(null)
    const load = async () => {
      if (document.hidden || disposed || (controller && !controller.signal.aborted)) return
      const revision = ++sequence
      const currentController = new AbortController()
      controller = currentController
      const deadline = setTimeout(() => currentController.abort(), 15000)
      const startedAt = performance.now()
      try {
        const res = await fetch('/api/checkout/intents/' + encodeURIComponent(intentID), { cache: 'no-store', signal: currentController.signal })
        if (!res.ok) throw new Error('Não foi possível recuperar esta compra para a identidade atual.')
        const raw = (await res.json()).data?.result?.order
        if (!raw) throw new Error('A compra ainda não foi concluída. Volte à revisão do checkout.')
        const current = purchaseClientSchema.parse(raw)
        if (disposed || sequence !== revision) return
        if (currentController.signal.aborted) throw new Error('Verificação excedeu o prazo de resposta.')
        const timestamp = performance.now()
        // Include transport time conservatively; a slow response must not extend validity.
        setOrder({ ...current, orderId: current.id }); setRequestStartedAt(startedAt); setNow(timestamp)
        setFresh(true); setConnectionError(false); setRecoveryError(null); failures = 0
        const identity = current.checkoutIntentID + ':' + current.sourceCartID
        if (current.sourceCartID && current.sourceCartVersion != null && consumed.current !== identity) {
          consumed.current = identity
          void useCartStore.getState().consumeCart(current.sourceCartID, current.sourceCartVersion).catch(() => {})
        }
        const view = purchaseView(current)
        timer = setTimeout(() => { void load() }, view.kind === 'approved' ? 15000 : ['cancelled','declined','refunded'].includes(view.kind) ? 30000 : 10000)
      } catch {
        if (disposed || sequence !== revision) return
        setFresh(false); setConnectionError(true); failures++
        timer = setTimeout(() => { void load() }, Math.min(30000, 3500 * 2 ** Math.min(failures, 4)))
      } finally {
        clearTimeout(deadline)
        if (controller === currentController) controller = undefined
      }
    }
    const refresh = () => {
      if (timer) clearTimeout(timer)
      setFresh(false)
      // Hiding the tab suspends instructions. On return, reuse an active
      // verification instead of aborting it again for each focus/pageshow.
      if (document.hidden) { sequence++; controller?.abort(); return }
      void load()
    }
    const clock = setInterval(() => setNow(performance.now()), 1000)
    window.addEventListener('focus', refresh); window.addEventListener('pageshow', refresh)
    document.addEventListener('visibilitychange', refresh)
    void load()
    return () => { disposed = true; sequence++; controller?.abort(); if (timer) clearTimeout(timer); clearInterval(clock)
      window.removeEventListener('focus', refresh); window.removeEventListener('pageshow', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [context?.lojaID, context?.userID, router])

  if (recoveryError) return <main className="p-10"><p>{recoveryError}</p><Link href="/checkout">Voltar ao checkout</Link></main>
  if (!order) return <main className="p-10"><p>{connectionError ? 'Não foi possível verificar a compra. Tentando recuperar o estado atual...' : 'Recuperando compra...'}</p><Link href="/checkout">Voltar ao checkout</Link></main>
  const view = purchaseView(order, now - requestStartedAt)
  const paymentStatus = view.kind === 'approved' ? 'PAID' : 'PENDING'

  const method = order.paymentMethod
  const isCreditCard = method === 'CREDIT_CARD'
  const isBoleto = method === 'BOLETO'
  const isPix = fresh && (view.canPayPix || view.canContact)

  const pixCopyText = order.pixPayload || order.pixKey || ''

  const handleCopyPix = () => {
    if (fresh && (view.canPayPix || view.canContact) && pixCopyText) {
      navigator.clipboard.writeText(pixCopyText)
      setCopiedPix(true)
      setTimeout(() => setCopiedPix(false), 2500)
    }
  }

  const handleCopyBoleto = () => {
    if (fresh && view.canPayBoleto && order.asaasDigitableLine) {
      navigator.clipboard.writeText(order.asaasDigitableLine)
      setCopiedBoleto(true)
      setTimeout(() => setCopiedBoleto(false), 2500)
    }
  }

  const handleWhatsApp = () => {
    if (!fresh || !view.canContact) return
    const msg = buildWhatsAppMessage({
      orderNumber: order.orderNumber,
      customerName: order.customer.name,
      items: order.items,
      deliveryType: order.deliveryType,
      address: order.address,
      freightValue: order.freightValue,
      total: order.total,
      pixKey: order.pixKey ?? null,
    })
    const url = buildWhatsAppUrl(order.whatsappNumber || '', msg)
    window.open(url, '_blank')
  }

  const qrCodeUrl = order.pixQrCode
    ? order.pixQrCode.startsWith('data:')
      ? order.pixQrCode
      : `data:image/png;base64,${order.pixQrCode}`
    : null

  const formattedDueDate = order.asaasDueDate
    ? new Date(order.asaasDueDate).toLocaleDateString('pt-BR')
    : 'Próximo dia útil'

  return (
    <div className="min-h-screen bg-catalog-bg text-catalog-text selection:bg-catalog-gold/30 relative flex flex-col justify-between py-10 px-4 sm:px-6 lg:px-8">
      {/* Glow de Iluminação Continental no Topo */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[450px] bg-[radial-gradient(ellipse_at_top,rgba(240,180,14,0.08),transparent_65%)] pointer-events-none -z-0" />

      {/* Header Centralizado */}
      <div className="relative z-10 flex flex-col items-center mb-8">
        <ContinentalLogo variant="symbol" className="h-10 sm:h-12 w-auto mb-2" />
        <span className="text-[10px] text-catalog-gold uppercase tracking-[0.25em] font-mono font-bold border border-catalog-gold/45 px-3 py-1 rounded-full">
          Ambiente de Confirmação Oficial
        </span>
      </div>

      {/* Card Principal */}
      <div className="relative z-10 max-w-xl w-full mx-auto bg-catalog-card border border-catalog-gold/45 rounded-3xl p-6 md:p-10 shadow-2xl backdrop-blur-2xl flex flex-col items-center animate-in slide-in-from-bottom-6 fade-in duration-500">
        {/* Ícone de Status Superior */}
        {paymentStatus === 'PAID' ? (
          <div className="w-20 h-20 bg-emerald-950/60 border border-emerald-500/50 rounded-full flex items-center justify-center mb-6 relative animate-in zoom-in duration-500">
            <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping opacity-60" />
            <CheckCircle2 className="w-10 h-10 text-emerald-400 relative z-10" />
          </div>
        ) : isCreditCard ? (
          <div className="w-20 h-20 bg-catalog-gold/15 border border-catalog-gold/40 rounded-full flex items-center justify-center mb-6 relative animate-in zoom-in duration-500">
            <CreditCard className="w-9 h-9 text-catalog-gold relative z-10" />
          </div>
        ) : isBoleto ? (
          <div className="w-20 h-20 bg-catalog-gold/15 border border-catalog-gold/40 rounded-full flex items-center justify-center mb-6 relative animate-in zoom-in duration-500">
            <FileText className="w-9 h-9 text-catalog-gold relative z-10" />
          </div>
        ) : (
          <div className="w-20 h-20 bg-catalog-gold/15 border border-catalog-gold/40 rounded-full flex items-center justify-center mb-6 relative animate-in zoom-in duration-500">
            <div className="absolute inset-0 bg-catalog-gold/20 rounded-full animate-pulse opacity-60" />
            <Clock className="w-9 h-9 text-catalog-gold relative z-10" />
          </div>
        )}

        {/* O mesmo estado canônico determina título e instruções. */}
        <h1 className="text-2xl md:text-3xl font-bold text-white text-center mb-2 tracking-tight uppercase font-mono">
          {paymentStatus === 'PAID' && <Sparkles className="w-6 h-6 text-emerald-400 inline mr-2" />}
          {fresh ? view.title : 'Verificando o pagamento'}
        </h1>
        <p className="text-catalog-muted text-center mb-6 text-xs sm:text-sm max-w-md">
          Pedido #{order.orderNumber} · {fresh ? view.canContact ? 'Efetue o PIX com a chave informada e envie o comprovante à loja para conferência manual.' : view.description : 'Aguarde a conferência do estado atual desta compra.'}
          {fresh && view.canPayBoleto && <> Vencimento: {formattedDueDate}.</>}
        </p>
        {!fresh && <p role="alert" className="mb-6 rounded-xl border border-catalog-gold/30 bg-catalog-gold/10 p-4 text-center text-sm text-catalog-text">
          {connectionError ? 'Não foi possível verificar o estado atual. As ações de pagamento estão suspensas enquanto tentamos novamente.' : 'Atualizando o estado da compra...'}
        </p>}

        {/* Resumo do Pedido */}
        <div className="w-full bg-[#0B132B]/70 rounded-2xl p-5 border border-catalog-gold/30 mb-6 space-y-3 font-mono">
          <div className="flex justify-between items-center text-sm pb-3 border-b border-catalog-gold/20">
            <span className="text-catalog-muted uppercase text-xs">Total do Pedido</span>
            <span className="font-bold text-xl sm:text-2xl text-catalog-gold">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.financialTotal ?? order.total)}
            </span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-catalog-muted uppercase">Forma de Pagamento</span>
            <span className="text-white font-medium">
              {isCreditCard
                ? `Cartão de Crédito (${order.installments || 1}x)`
                : isBoleto
                ? 'Boleto Bancário'
                : method === 'WHATSAPP_PIX' ? 'PIX com conferência manual' : 'PIX'}
            </span>
          </div>

          {isCreditCard && order.creditCardLast4 && (
            <div className="flex justify-between items-center text-xs">
              <span className="text-catalog-muted uppercase">Cartão Utilizado</span>
              <span className="text-slate-300">
                {order.creditCardBrand || 'Cartão'} •••• {order.creditCardLast4}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center text-xs">
            <span className="text-catalog-muted uppercase">Modalidade de Envio</span>
            <span className="text-white font-medium">
              {order.deliveryType === 'PICKUP' ? 'Retirada no Balcão' : order.deliveryType === 'NONE' ? 'A combinar com a loja' : order.shippingServiceName || 'Entrega'}
            </span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-catalog-muted uppercase">Status do Pedido</span>
            {!fresh ? (
              <span className="text-catalog-gold">Verificando</span>
            ) : paymentStatus === 'PAID' ? (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-500/50 font-bold uppercase text-[10px]">
                Aprovado / Pago
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-catalog-gold/15 text-catalog-gold border border-catalog-gold/40 font-bold uppercase text-[10px] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-catalog-gold animate-pulse" />
                {view.title}
              </span>
            )}
          </div>
        </div>

        {/* BLOCO ESPECÍFICO DE PIX CANÔNICO CONTINENTAL */}
        {isPix && paymentStatus === 'PENDING' && (
          <div className="w-full bg-[#0B132B]/80 rounded-2xl p-6 border border-catalog-gold/30 mb-6 flex flex-col items-center space-y-5">
            <div className="text-center space-y-1">
              <p className="text-[10px] uppercase font-mono tracking-[0.2em] text-catalog-gold font-bold">
                {view.canContact ? 'PIX com conferência da loja' : 'Pague com o QR Code desta cobrança'}
              </p>
              <p className="text-xs text-catalog-muted font-light">{view.canContact ? 'Utilize a chave abaixo no aplicativo do seu banco.' : 'Abra o app do seu banco e aponte a câmera.'}</p>
            </div>

            {/* Container Palco Branco Puro do QR Code (Diretriz 5.3 item 3) */}
            {qrCodeUrl && (
              <div className="p-4 bg-white rounded-2xl shadow-2xl inline-block border-4 border-catalog-gold">
                <img src={qrCodeUrl} alt="QR Code PIX Dinâmico" className="w-48 h-48 sm:w-56 sm:h-56 object-contain" />
              </div>
            )}

            {/* Código Copia e Cola com Botão Shimmer Compacto */}
            {pixCopyText && (
              <div className="w-full space-y-2">
                <p className="text-xs font-mono font-bold uppercase tracking-wider text-catalog-gold">
                  {view.canContact ? 'Chave PIX da loja:' : 'Código PIX Copia e Cola:'}
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-[#050B14] border border-catalog-gold/30 rounded-xl px-3.5 py-2.5 font-mono text-xs text-slate-300 truncate select-all">
                    {pixCopyText}
                  </div>
                  <button
                    onClick={handleCopyPix}
                    className="btn-shimmer shrink-0 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#F0B40E] to-[#E5A805] text-[#010E31] font-bold text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(240,180,14,0.3)] border border-[#F5BD1E]/40 flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedPix ? (
                      <>
                        <Check className="w-4 h-4 text-[#010E31]" />
                        <span>Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-[#010E31]" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Indicador de Escuta em Tempo Real */}
            <div className="flex items-center gap-2 text-xs font-mono text-catalog-muted pt-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-catalog-gold" />
              <span>{view.canContact ? 'Aguardando a conferência do pagamento pela loja.' : 'Aguardando confirmação do pagamento.'}</span>
            </div>
          </div>
        )}

        {/* BLOCO ESPECÍFICO DE BOLETO BANCÁRIO */}
        {fresh && view.canPayBoleto && paymentStatus === 'PENDING' && (
          <div className="w-full bg-[#0B132B]/80 rounded-2xl p-6 border border-catalog-gold/30 mb-6 space-y-5">
            <div className="text-center space-y-1">
              <p className="text-[10px] uppercase font-mono tracking-[0.2em] text-catalog-gold font-bold">
                Boleto Bancário Oficial Asaas
              </p>
              <p className="text-xs text-catalog-muted font-mono">Vencimento: {formattedDueDate}</p>
            </div>

            {order.asaasBankSlipUrl && (
              <button
                onClick={() => window.open(order.asaasBankSlipUrl!, '_blank')}
                className="btn-shimmer w-full py-3.5 rounded-full bg-gradient-to-r from-[#F0B40E] to-[#E5A805] text-[#010E31] font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(240,180,14,0.3)] border border-[#F5BD1E]/40 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Visualizar / Imprimir Boleto em PDF
              </button>
            )}

            {order.asaasDigitableLine && (
              <div className="w-full space-y-2">
                <p className="text-xs font-mono font-bold uppercase tracking-wider text-catalog-gold">Linha Digitável:</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-[#050B14] border border-catalog-gold/30 rounded-xl px-3.5 py-2.5 font-mono text-xs text-slate-300 truncate select-all">
                    {order.asaasDigitableLine}
                  </div>
                  <button
                    onClick={handleCopyBoleto}
                    className="btn-shimmer shrink-0 px-4 py-2.5 rounded-full bg-gradient-to-r from-[#F0B40E] to-[#E5A805] text-[#010E31] font-bold text-xs uppercase tracking-wider border border-[#F5BD1E]/40"
                  >
                    {copiedBoleto ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Ações Finais */}
        <div className="w-full space-y-3">
          {paymentStatus === 'PAID' ? (
            <>
              <Link
                href="/profile"
                className="btn-shimmer w-full py-4 rounded-full bg-gradient-to-r from-[#F0B40E] to-[#E5A805] text-[#010E31] font-bold text-sm tracking-widest uppercase shadow-[0_0_25px_rgba(240,180,14,0.4)] border border-[#F5BD1E]/40 flex items-center justify-center gap-2"
              >
                <span>Acompanhar Meus Pedidos</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/"
                className="w-full py-3.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-medium border border-white/10 backdrop-blur-md transition-colors text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-2 group cursor-pointer"
              >
                <span className="group-hover:-translate-x-1 transition-transform duration-300">
                  <ArrowLeft className="w-4 h-4 text-catalog-gold" />
                </span>
                <span>Voltar à Página Inicial</span>
              </Link>
            </>
          ) : (
            <>
              {fresh && view.canContact && order.whatsappNumber && (
                <button
                  type="button"
                  onClick={handleWhatsApp}
                  className="w-full py-3.5 rounded-full bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#25D366] font-mono font-bold text-xs uppercase tracking-wider border border-[#25D366]/40 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Enviar Comprovante via WhatsApp</span>
                </button>
              )}
              <Link
                href="/"
                className="w-full py-3.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-medium border border-white/10 backdrop-blur-md transition-colors text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-2 group cursor-pointer"
              >
                <span className="group-hover:-translate-x-1 transition-transform duration-300">
                  <ArrowLeft className="w-4 h-4 text-catalog-gold" />
                </span>
                <span>Voltar para o Catálogo Continental</span>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Footer Fixo */}
      <div className="relative z-10 text-center mt-8 text-xs font-mono text-catalog-muted">
        <p>© {new Date().getFullYear()} Continental Produtos Estéticos Automotivos. Todos os direitos reservados.</p>
      </div>
    </div>
  )
}
