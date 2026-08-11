'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCartStore } from '@/store/cart.store'
import { Button } from '@/components/ui'
import { buildWhatsAppMessage, buildWhatsAppUrl } from '@/lib/utils/whatsapp'

interface ConfirmationOrder {
  orderNumber: number
  customer: { name: string; phone: string }
  items: Array<{ name: string; quantity: number; price: number; color?: string; size?: string }>
  deliveryType: string
  address?: { street: string; number: string; city: string; state: string }
  freightValue: number | null
  total: number
  pixKey: string | null
  whatsappNumber: string
}

export default function CheckoutConfirmationPage() {
  const router = useRouter()
  const { clearCart } = useCartStore()
  const [order, setOrder] = useState<ConfirmationOrder | null>(null)
  const [copied, setCopied] = useState(false)

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

  if (!order) return null

  const handleCopyPix = () => {
    if (order.pixKey) {
      navigator.clipboard.writeText(order.pixKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
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

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-xl w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 md:p-12 shadow-2xl flex flex-col items-center animate-in slide-in-from-bottom-8 fade-in duration-700">
        <div className="w-20 h-20 bg-[#dbb501]/10 rounded-full flex items-center justify-center mb-6 relative animate-in zoom-in duration-500 delay-200">
          <div className="absolute inset-0 bg-[#dbb501]/20 rounded-full animate-ping opacity-75" />
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#dbb501" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="relative z-10">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>

        <h1 className="text-2xl md:text-3xl font-semibold text-zinc-900 dark:text-zinc-50 text-center mb-2 tracking-tight">
          Pedido realizado com sucesso!
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-center mb-8">
          Falta pouco! Agora é só confirmar o pagamento pelo WhatsApp.
        </p>

        <div className="w-full bg-zinc-50 dark:bg-zinc-950/50 rounded-2xl p-6 border border-zinc-100 dark:border-zinc-800/50 mb-8 space-y-4">
          <div className="flex justify-between items-center text-sm pb-4 border-b border-zinc-200 dark:border-zinc-800">
            <span className="text-zinc-500 dark:text-zinc-400">Total do Pedido</span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-lg">R$ {order.total.toFixed(2)}</span>
          </div>

          <div className="space-y-3 pt-2">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Chave Pix para Pagamento:</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 font-mono text-sm text-zinc-600 dark:text-zinc-400 truncate select-all">
                {order.pixKey || 'Chave não informada'}
              </div>
              <button
                onClick={handleCopyPix}
                className="shrink-0 p-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl transition-colors text-zinc-600 dark:text-zinc-300"
              >
                {copied ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dbb501" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                  </svg>
                )}
              </button>
            </div>
            {copied && <p className="text-xs text-[#dbb501] animate-in fade-in">Chave copiada!</p>}
          </div>
        </div>

        <div className="w-full space-y-3">
          <Button
            className="w-full bg-[#dbb501] hover:bg-[#dbb501]/90 text-zinc-950 text-base py-6 font-semibold shadow-[0_0_20px_rgba(219,181,1,0.3)] hover:shadow-[0_0_25px_rgba(219,181,1,0.4)] transition-all flex gap-2 items-center justify-center group"
            onClick={handleWhatsApp}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:scale-110">
              <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" />
              <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1Z" />
              <path d="M14 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1Z" />
              <path d="M9.5 13.5c1.5 1 3.5 1 5 0" />
            </svg>
            Confirmar pelo WhatsApp
          </Button>
          <Button
            variant="outline"
            className="w-full py-6 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            onClick={() => router.push('/')}
          >
            Continuar comprando
          </Button>
        </div>
      </div>
    </div>
  )
}
