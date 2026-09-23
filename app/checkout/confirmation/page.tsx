'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useCartStore } from '@/store/cart.store'
import { Button } from '@/components/ui'
import { buildWhatsAppMessage, buildWhatsAppUrl } from '@/lib/utils/whatsapp'
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

  // 1. Polling de status em tempo real
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

  // Simulação de pagamento para homologação e testes
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
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-zinc-950 text-zinc-100">
      <div className="max-w-xl w-full bg-[#111111] border border-white/10 rounded-3xl p-6 md:p-10 shadow-2xl flex flex-col items-center animate-in slide-in-from-bottom-6 fade-in duration-500">
        {/* Ícone de Status Superior */}
        {paymentStatus === 'PAID' ? (
          <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mb-6 relative animate-in zoom-in duration-500">
            <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping opacity-60" />
            <CheckCircle2 className="w-10 h-10 text-emerald-400 relative z-10" />
          </div>
        ) : isCreditCard ? (
          <div className="w-20 h-20 bg-blue-500/10 border border-blue-500/30 rounded-full flex items-center justify-center mb-6 relative animate-in zoom-in duration-500">
            <CreditCard className="w-9 h-9 text-blue-400 relative z-10" />
          </div>
        ) : isBoleto ? (
          <div className="w-20 h-20 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center mb-6 relative animate-in zoom-in duration-500">
            <FileText className="w-9 h-9 text-amber-400 relative z-10" />
          </div>
        ) : (
          <div className="w-20 h-20 bg-[#dbb501]/10 border border-[#dbb501]/30 rounded-full flex items-center justify-center mb-6 relative animate-in zoom-in duration-500">
            <div className="absolute inset-0 bg-[#dbb501]/20 rounded-full animate-pulse opacity-60" />
            <Clock className="w-9 h-9 text-[#dbb501] relative z-10" />
          </div>
        )}

        {/* Título e Subtítulo */}
        {paymentStatus === 'PAID' ? (
          <>
            <h1 className="text-2xl md:text-3xl font-bold text-white text-center mb-2 tracking-tight flex items-center justify-center gap-2">
              <Sparkles className="w-6 h-6 text-emerald-400" />
              Pagamento Confirmado!
            </h1>
            <p className="text-zinc-400 text-center mb-6 text-sm max-w-md">
              Excelente! Seu pagamento foi processado com sucesso. Já estamos preparando seu pedido{' '}
              <strong>#{order.orderNumber}</strong>.
            </p>
          </>
        ) : isCreditCard ? (
          <>
            <h1 className="text-2xl md:text-3xl font-bold text-white text-center mb-2 tracking-tight">
              Pedido #{order.orderNumber} em Análise
            </h1>
            <p className="text-zinc-400 text-center mb-6 text-sm max-w-md">
              Sua transação no cartão está sendo validada pelo banco emissor. Você receberá a confirmação por e-mail.
            </p>
          </>
        ) : isBoleto ? (
          <>
            <h1 className="text-2xl md:text-3xl font-bold text-white text-center mb-2 tracking-tight">
              Boleto do Pedido #{order.orderNumber} Gerado!
            </h1>
            <p className="text-zinc-400 text-center mb-6 text-sm max-w-md">
              Efetue o pagamento até o vencimento (<strong>{formattedDueDate}</strong>) para liberação do envio.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl md:text-3xl font-bold text-white text-center mb-2 tracking-tight">
              Pedido #{order.orderNumber} Realizado!
            </h1>
            <p className="text-zinc-400 text-center mb-6 text-sm">
              Efetue o pagamento via <strong>PIX</strong> para aprovação imediata do seu pedido.
            </p>
          </>
        )}

        {/* Resumo do Pedido */}
        <div className="w-full bg-white/[0.02] rounded-2xl p-5 border border-white/5 mb-6 space-y-3">
          <div className="flex justify-between items-center text-sm pb-3 border-b border-white/5">
            <span className="text-zinc-400">Total</span>
            <span className="font-bold text-white text-xl text-[#dbb501]">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total)}
            </span>
          </div>

          <div className="flex justify-between items-center text-xs text-zinc-400">
            <span>Forma de Pagamento</span>
            <span className="font-medium text-zinc-200">
              {isCreditCard
                ? `Cartão de Crédito (${order.installments || 1}x)`
                : isBoleto
                ? 'Boleto Bancário (D+1)'
                : 'PIX Instantâneo'}
            </span>
          </div>

          {isCreditCard && order.creditCardLast4 && (
            <div className="flex justify-between items-center text-xs text-zinc-400">
              <span>Cartão Utilizado</span>
              <span className="font-mono text-zinc-300">
                {order.creditCardBrand || 'Cartão'} •••• {order.creditCardLast4}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center text-xs text-zinc-400">
            <span>Modalidade de Entrega</span>
            <span className="font-medium text-zinc-200">
              {order.deliveryType === 'PICKUP' ? 'Retirada na Loja' : 'Entrega no Endereço'}
            </span>
          </div>

          <div className="flex justify-between items-center text-xs text-zinc-400">
            <span>Status do Pedido</span>
            {paymentStatus === 'PAID' ? (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                Aprovado / Pago
              </span>
            ) : isCreditCard ? (
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                Em Análise
              </span>
            ) : isBoleto ? (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Aguardando Pagamento
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-semibold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                Aguardando PIX
              </span>
            )}
          </div>
        </div>

        {/* BLOCO ESPECÍFICO DE BOLETO BANCÁRIO */}
        {isBoleto && paymentStatus === 'PENDING' && (
          <div className="w-full bg-black/40 rounded-2xl p-6 border border-white/10 mb-6 space-y-5">
            <div className="text-center space-y-1">
              <p className="text-xs uppercase font-mono tracking-widest text-[#dbb501]">
                Boleto Bancário Oficial Asaas
              </p>
              <p className="text-xs text-zinc-400">Vencimento: {formattedDueDate}</p>
            </div>

            {/* Botão de Abrir PDF do Boleto */}
            {order.asaasBankSlipUrl && (
              <Button
                onClick={() => window.open(order.asaasBankSlipUrl!, '_blank')}
                className="w-full bg-[#dbb501] hover:bg-[#c49b02] text-black font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Visualizar / Imprimir Boleto em PDF
              </Button>
            )}

            {/* Linha Digitável Copia e Cola */}
            {order.asaasDigitableLine && (
              <div className="w-full space-y-2">
                <p className="text-xs font-medium text-zinc-300">Linha Digitável (Código de Barras):</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 font-mono text-xs text-zinc-300 truncate select-all">
                    {order.asaasDigitableLine}
                  </div>
                  <button
                    onClick={handleCopyBoleto}
                    className="shrink-0 px-3.5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-zinc-700"
                  >
                    {copiedBoleto ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copiar
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            <div className="p-3 bg-white/[0.03] rounded-xl border border-white/5 text-xs text-zinc-400 space-y-1">
              <p className="font-semibold text-zinc-300">Informações Importantes:</p>
              <p>• A compensação bancária é realizada em 1 a 3 dias úteis pelo Banco Central.</p>
              <p>• Assim que compensado, seu pedido será liberado automaticamente.</p>
            </div>
          </div>
        )}

        {/* BLOCO ESPECÍFICO DE PIX */}
        {isPix && paymentStatus === 'PENDING' && (
          <div className="w-full bg-black/40 rounded-2xl p-6 border border-white/10 mb-6 flex flex-col items-center space-y-5">
            <div className="text-center space-y-1">
              <p className="text-xs uppercase font-mono tracking-widest text-zinc-400">
                Pague com QR Code ou Copia e Cola
              </p>
              <p className="text-xs text-zinc-500">Abra o aplicativo do seu banco e aponte a câmera</p>
            </div>

            {/* Imagem do QR Code */}
            {qrCodeUrl && (
              <div className="p-3 bg-white rounded-2xl shadow-lg inline-block border-2 border-[#dbb501]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrCodeUrl} alt="QR Code PIX" className="w-48 h-48 sm:w-56 sm:h-56 object-contain" />
              </div>
            )}

            {/* Código Copia e Cola */}
            {pixCopyText && (
              <div className="w-full space-y-2">
                <p className="text-xs font-medium text-zinc-300">Código PIX Copia e Cola:</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 font-mono text-xs text-zinc-300 truncate select-all">
                    {pixCopyText}
                  </div>
                  <button
                    onClick={handleCopyPix}
                    className="shrink-0 px-3.5 py-2.5 bg-[#dbb501] hover:bg-[#c49b02] text-black font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedPix ? (
                      <>
                        <Check className="w-4 h-4" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copiar
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Indicador de Escuta em Tempo Real */}
            <div className="flex items-center gap-2 text-xs text-zinc-400 pt-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#dbb501]" />
              <span>Verificando pagamento em tempo real...</span>
            </div>
          </div>
        )}

        {/* Botão de Teste / Simulação Local (Dev Only) */}
        {process.env.NODE_ENV !== 'production' && paymentStatus === 'PENDING' && (
          <div className="mb-6 w-full">
            <button
              type="button"
              onClick={handleSimulatePayment}
              disabled={isSimulating}
              className="w-full text-[11px] font-mono text-zinc-500 hover:text-amber-400 py-1.5 px-3 rounded-lg border border-dashed border-zinc-800 hover:border-amber-500/40 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              title="Simula o recebimento do webhook Asaas para testes imediatos sem transação bancária"
            >
              {isSimulating ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <span>⚡ Testar Aprovação Automática (Simular Webhook Asaas - Dev Only)</span>
              )}
            </button>
          </div>
        )}

        {/* Ações Finais */}
        <div className="w-full space-y-3">
          {paymentStatus === 'PAID' ? (
            <>
              <Button
                className="w-full bg-[#dbb501] hover:bg-[#c49b02] text-black font-semibold py-3.5 rounded-xl transition-all shadow-lg"
                onClick={() => router.push('/profile')}
              >
                Acompanhar Meus Pedidos
              </Button>
              <Button
                variant="outline"
                className="w-full py-3.5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl"
                onClick={() => router.push('/')}
              >
                Voltar para a Loja
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                className="w-full py-3 border-white/10 text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl text-xs flex items-center justify-center gap-2"
                onClick={handleWhatsApp}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" />
                  <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1Z" />
                  <path d="M14 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1Z" />
                  <path d="M9.5 13.5c1.5 1 3.5 1 5 0" />
                </svg>
                Dúvidas sobre o pedido? Fale conosco no WhatsApp
              </Button>
              <Button
                variant="ghost"
                className="w-full py-2.5 text-xs text-zinc-500 hover:text-zinc-300"
                onClick={() => router.push('/')}
              >
                Continuar comprando
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
