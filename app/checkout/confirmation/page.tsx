'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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

interface ConfirmationOrder {
  orderId?: string
  orderNumber: number
  customer: { name: string; phone: string }
  items: Array<{ name: string; quantity: number; price: number; color?: string; size?: string }>
  deliveryType: string
  address?: { street: string; number: string; city: string; state: string }
  freightValue: number | null
  total: number
  pixKey: string | null
  paymentMethod?: string | null
  pixQrCode?: string | null
  pixPayload?: string | null
  creditCardBrand?: string | null
  creditCardLast4?: string | null
  installments?: number | null
  installmentValue?: number | null
  asaasBankSlipUrl?: string | null
  asaasDigitableLine?: string | null
  asaasBarCode?: string | null
  asaasDueDate?: string | null
  asaasPaymentId?: string | null
  whatsappNumber: string
}

export default function CheckoutConfirmationPage() {
  const router = useRouter()
  const { clearCart } = useCartStore()
  const [order, setOrder] = useState<ConfirmationOrder | null>(null)
  const [copiedPix, setCopiedPix] = useState(false)
  const [copiedBoleto, setCopiedBoleto] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<'PENDING' | 'PAID'>('PENDING')
  const [isSimulating, setIsSimulating] = useState(false)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const rawData = sessionStorage.getItem('last_order')
    if (!rawData) {
      router.push('/')
      return
    }

    try {
      const data = JSON.parse(rawData) as ConfirmationOrder
      setOrder(data)
      clearCart()
    } catch {
      router.push('/')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Polling de status em tempo real
  useEffect(() => {
    if (!order?.orderId || paymentStatus === 'PAID') return

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/orders/${order.orderId}/status`)
        if (res.ok) {
          const data = await res.json()
          if (
            data?.order?.status === 'PAID' ||
            data?.order?.status === 'SHIPPED' ||
            data?.order?.status === 'DELIVERED'
          ) {
            setPaymentStatus('PAID')
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current)
            }
          }
        }
      } catch (err) {
        console.warn('Erro no polling de status do pedido:', err)
      }
    }

    checkStatus()
    pollingIntervalRef.current = setInterval(checkStatus, 3500)

    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)
    }
  }, [order?.orderId, paymentStatus])

  if (!order) return null

  const method = order.paymentMethod || 'PIX'
  const isCreditCard = method === 'CREDIT_CARD'
  const isBoleto = method === 'BOLETO'
  const isPix = method === 'PIX' || method === 'WHATSAPP_PIX'

  const pixCopyText = order.pixPayload || order.pixKey || ''

  const handleCopyPix = () => {
    if (pixCopyText) {
      navigator.clipboard.writeText(pixCopyText)
      setCopiedPix(true)
      setTimeout(() => setCopiedPix(false), 2500)
    }
  }

  const handleCopyBoleto = () => {
    if (order.asaasDigitableLine) {
      navigator.clipboard.writeText(order.asaasDigitableLine)
      setCopiedBoleto(true)
      setTimeout(() => setCopiedBoleto(false), 2500)
    }
  }

  const handleSimulatePayment = async () => {
    if (!order.orderId || isSimulating) return
    setIsSimulating(true)
    try {
      const res = await fetch('/api/webhooks/asaas/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.orderId }),
      })
      if (res.ok) {
        setPaymentStatus('PAID')
      }
    } catch (err) {
      console.error('Erro ao simular pagamento:', err)
    } finally {
      setIsSimulating(false)
    }
  }

  const handleWhatsApp = () => {
    const msg = buildWhatsAppMessage({
      orderNumber: order.orderNumber,
      customerName: order.customer.name,
      items: order.items,
      deliveryType: order.deliveryType,
      address: order.address,
      freightValue: order.freightValue,
      total: order.total,
      pixKey: order.pixKey,
    })
    const url = buildWhatsAppUrl(order.whatsappNumber || '', msg)
    window.open(url, '_blank')
  }

  const qrCodeUrl = order.pixQrCode
    ? order.pixQrCode.startsWith('data:')
      ? order.pixQrCode
      : `data:image/png;base64,${order.pixQrCode}`
    : order.pixPayload
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(
        order.pixPayload
      )}`
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

        {/* Título e Subtítulo */}
        {paymentStatus === 'PAID' ? (
          <>
            <h1 className="text-2xl md:text-3xl font-bold text-white text-center mb-2 tracking-tight uppercase font-mono flex items-center justify-center gap-2">
              <Sparkles className="w-6 h-6 text-emerald-400" />
              Pagamento Confirmado!
            </h1>
            <p className="text-catalog-muted text-center mb-6 text-xs sm:text-sm max-w-md font-light">
              Excelente! Seu pagamento foi processado com sucesso. Já estamos separando seu pedido{' '}
              <strong className="text-white font-mono">#{order.orderNumber}</strong> no estoque.
            </p>
          </>
        ) : isCreditCard ? (
          <>
            <h1 className="text-2xl md:text-3xl font-bold text-white text-center mb-2 tracking-tight uppercase font-mono">
              Pedido #{order.orderNumber} em Análise
            </h1>
            <p className="text-catalog-muted text-center mb-6 text-xs sm:text-sm max-w-md font-light">
              Sua transação no cartão está sendo validada pela operadora. Você receberá o comprovante por e-mail e WhatsApp.
            </p>
          </>
        ) : isBoleto ? (
          <>
            <h1 className="text-2xl md:text-3xl font-bold text-white text-center mb-2 tracking-tight uppercase font-mono">
              Boleto do Pedido #{order.orderNumber} Gerado!
            </h1>
            <p className="text-catalog-muted text-center mb-6 text-xs sm:text-sm max-w-md font-light">
              Efetue o pagamento até o vencimento (<strong className="text-catalog-gold font-mono">{formattedDueDate}</strong>) para liberação automática do envio.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl md:text-3xl font-bold text-white text-center mb-2 tracking-tight uppercase font-mono">
              Pedido #{order.orderNumber} Realizado!
            </h1>
            <p className="text-catalog-muted text-center mb-6 text-xs sm:text-sm font-light">
              Efetue o pagamento via <strong className="text-catalog-gold">PIX Dinâmico</strong> para aprovação imediata do seu pedido.
            </p>
          </>
        )}

        {/* Resumo do Pedido */}
        <div className="w-full bg-[#0B132B]/70 rounded-2xl p-5 border border-catalog-gold/30 mb-6 space-y-3 font-mono">
          <div className="flex justify-between items-center text-sm pb-3 border-b border-catalog-gold/20">
            <span className="text-catalog-muted uppercase text-xs">Total do Pedido</span>
            <span className="font-bold text-xl sm:text-2xl text-catalog-gold">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total)}
            </span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-catalog-muted uppercase">Forma de Pagamento</span>
            <span className="text-white font-medium">
              {isCreditCard
                ? `Cartão de Crédito (${order.installments || 1}x)`
                : isBoleto
                ? 'Boleto Bancário (D+1)'
                : 'PIX Instantâneo'}
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
              {order.deliveryType === 'PICKUP' ? 'Retirada no Balcão' : 'Entrega Correios / J&T'}
            </span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-catalog-muted uppercase">Status do Pedido</span>
            {paymentStatus === 'PAID' ? (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-500/50 font-bold uppercase text-[10px]">
                Aprovado / Pago
              </span>
            ) : isCreditCard ? (
              <span className="px-2.5 py-0.5 rounded-full bg-catalog-gold/15 text-catalog-gold border border-catalog-gold/40 font-bold uppercase text-[10px] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-catalog-gold animate-pulse" />
                Em Análise
              </span>
            ) : isBoleto ? (
              <span className="px-2.5 py-0.5 rounded-full bg-catalog-gold/15 text-catalog-gold border border-catalog-gold/40 font-bold uppercase text-[10px] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-catalog-gold animate-pulse" />
                Aguardando Pagamento
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-catalog-gold/15 text-catalog-gold border border-catalog-gold/40 font-bold uppercase text-[10px] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-catalog-gold animate-pulse" />
                Aguardando PIX
              </span>
            )}
          </div>
        </div>

        {/* BLOCO ESPECÍFICO DE PIX CANÔNICO CONTINENTAL */}
        {isPix && paymentStatus === 'PENDING' && (
          <div className="w-full bg-[#0B132B]/80 rounded-2xl p-6 border border-catalog-gold/30 mb-6 flex flex-col items-center space-y-5">
            <div className="text-center space-y-1">
              <p className="text-[10px] uppercase font-mono tracking-[0.2em] text-catalog-gold font-bold">
                Pague com QR Code Oficial Banco Central
              </p>
              <p className="text-xs text-catalog-muted font-light">Abra o app do seu banco e aponte a câmera</p>
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
                  Código PIX Copia e Cola:
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
              <span>Aguardando liquidação em tempo real...</span>
            </div>
          </div>
        )}

        {/* BLOCO ESPECÍFICO DE BOLETO BANCÁRIO */}
        {isBoleto && paymentStatus === 'PENDING' && (
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

        {/* Simulação em Homologação / Testes Dev */}
        {process.env.NODE_ENV !== 'production' && paymentStatus === 'PENDING' && (
          <div className="mb-6 w-full">
            <button
              type="button"
              onClick={handleSimulatePayment}
              disabled={isSimulating}
              className="w-full text-[11px] font-mono text-catalog-muted hover:text-catalog-gold py-2 px-3 rounded-xl border border-dashed border-catalog-gold/30 hover:border-catalog-gold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isSimulating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <span>⚡ Testar Aprovação Automática (Simular Webhook - Dev Only)</span>
              )}
            </button>
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
              {order.whatsappNumber && (
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
