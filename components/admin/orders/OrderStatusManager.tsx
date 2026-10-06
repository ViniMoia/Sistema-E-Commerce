'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AlertBanner, Spinner } from '@/components/ui'
import { Check, Truck, Clock, CheckCircle2, XCircle, ArrowRight } from 'lucide-react'
import type { allowedOrderActions } from '@/lib/commerce/order-fulfillment'

type OrderStatus = 'PENDING' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'

export interface OrderStatusManagerProps {
  orderId: string
  currentStatus: OrderStatus
  version: number
  deliveryType: 'DELIVERY' | 'PICKUP' | 'NONE'
  trackingCode: string | null
  actions: ReturnType<typeof allowedOrderActions>
  isOpen: boolean
  onClose: () => void
  onSuccess: () => Promise<void>
  onConflict: () => Promise<void>
}

const statusMap: Record<OrderStatus, { label: string; icon: any; color: string }> = {
  PENDING: { label: 'Pendente', icon: Clock, color: 'text-catalog-gold border-catalog-gold/40 bg-catalog-gold/15' },
  PAID: { label: 'Pago', icon: CheckCircle2, color: 'text-emerald-400 border-emerald-500/50 bg-emerald-950/60' },
  SHIPPED: { label: 'Despachado / Enviado', icon: Truck, color: 'text-sky-400 border-sky-500/50 bg-sky-950/60' },
  DELIVERED: { label: 'Entregue ao Cliente', icon: Check, color: 'text-emerald-400 border-emerald-500/50 bg-emerald-950/60' },
  CANCELLED: { label: 'Cancelado', icon: XCircle, color: 'text-red-400 border-red-500/50 bg-red-950/60' }
}

export function OrderStatusManager({
  orderId,
  currentStatus,
  version,
  deliveryType,
  trackingCode: savedTrackingCode,
  actions,
  isOpen,
  onClose,
  onSuccess,
  onConflict
}: OrderStatusManagerProps) {
  const [selectedStatus, setSelectedStatus] = React.useState<OrderStatus | null>(null)
  const [trackingCode, setTrackingCode] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const availableTransitions = actions.statuses
  const command = React.useRef<{ content: string; id: string } | null>(null)

  React.useEffect(() => {
    if (isOpen) {
      setSelectedStatus(null)
      setTrackingCode(savedTrackingCode || '')
      command.current = null
    }
  }, [isOpen, currentStatus, version, savedTrackingCode])
  React.useEffect(() => {
    if (isOpen) { setError(null); setIsLoading(false) }
  }, [isOpen])

  const handleConfirm = async () => {
    if (!selectedStatus || isLoading) return

    try {
      setIsLoading(true)
      setError(null)

      const payload = { newStatus: selectedStatus, expectedVersion: version,
        ...(selectedStatus === 'SHIPPED' ? { trackingCode: trackingCode.trim() || null, shippingProvider: actions.tracking.provider } : {}) }
      const content = JSON.stringify(payload)
      if (!command.current || command.current.content !== content) command.current = { content, id: crypto.randomUUID() }
      const body = { ...payload, commandId: command.current.id }

      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        if (res.status === 409) await onConflict()
        throw new Error(data?.error || 'Erro ao atualizar status do pedido.')
      }

      await onSuccess()
      onClose()
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Ocorreu um erro desconhecido.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isLoading) onClose() }}>
      <DialogContent className="sm:max-w-md bg-catalog-card border border-catalog-gold/45 text-white rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-2xl">
        <DialogHeader className="border-b border-catalog-gold/20 pb-4">
          <span className="text-[10px] text-catalog-gold font-mono tracking-[0.2em] uppercase font-bold">
            Transição Operacional
          </span>
          <DialogTitle className="text-xl font-bold uppercase font-mono tracking-tight text-white flex items-center gap-2">
            <span>Atualizar Status do Pedido</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {error && <AlertBanner variant="error" message={error} />}

          {/* Status Atual */}
          <div className="p-3.5 rounded-xl bg-[#0B132B]/80 border border-catalog-gold/25 flex items-center justify-between text-xs font-mono">
            <span className="text-catalog-muted uppercase">Status Atual:</span>
            <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] border ${statusMap[currentStatus]?.color}`}>
              {statusMap[currentStatus]?.label}
            </span>
          </div>

          {/* Seleção do Novo Status */}
          <div className="space-y-2.5">
            <label className="text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase block">
              Próximo Status Permitido:
            </label>

            {availableTransitions.length === 0 ? (
              <p className="text-xs font-mono text-catalog-muted italic py-3 text-center bg-[#0B132B]/50 rounded-xl border border-white/5">
                Nenhuma transição disponível para a modalidade e a situação financeira atuais.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {availableTransitions.map((st) => {
                  const isSelected = selectedStatus === st
                  const Icon = statusMap[st]?.icon || ArrowRight
                  return (
                    <button
                      key={st}
                      type="button"
                      disabled={isLoading}
                      onClick={() => setSelectedStatus(st)}
                      className={`p-3.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer font-mono text-xs ${
                        isSelected
                          ? 'border-2 border-catalog-gold bg-catalog-gold/20 text-white shadow-[0_0_15px_rgba(240,180,14,0.2)]'
                          : 'border-catalog-gold/30 bg-[#0B132B]/60 text-slate-300 hover:border-catalog-gold/60 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4 text-catalog-gold" />
                        <span className="font-bold uppercase tracking-wider">{st === 'DELIVERED' && deliveryType !== 'DELIVERY' ? 'Concluir retirada / entrega ao cliente' : statusMap[st]?.label}</span>
                      </div>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-catalog-gold shadow-[0_0_6px_#F0B40E]" />
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Campo de Código de Rastreio quando Despachado */}
          {selectedStatus === 'SHIPPED' && (
            <div className="space-y-1.5 pt-2 border-t border-catalog-gold/20 animate-in fade-in duration-300">
              <label className="text-xs font-mono font-bold tracking-wider text-catalog-gold uppercase flex items-center justify-between">
                <span>Código de Rastreamento ({actions.tracking.required ? 'Obrigatório' : 'Opcional'})</span>
                <span className="text-[10px] text-catalog-muted font-light">{actions.tracking.provider || 'Transportadora não informada'}</span>
              </label>
              <input
                type="text"
                name="shippingTrackingCode"
                disabled={isLoading}
                maxLength={128}
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value)}
                placeholder="Ex: AA123456789BR"
                className="w-full bg-[#050B14] border border-catalog-gold/30 text-white placeholder-gray-500 rounded-xl px-4 py-2.5 text-xs font-mono focus:outline-none focus:border-catalog-gold uppercase"
              />
            </div>
          )}
        </div>

        {/* Rodapé do Modal */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-catalog-gold/20">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-5 py-2.5 rounded-full border border-catalog-gold/30 text-slate-300 hover:text-white hover:bg-white/5 text-xs font-mono uppercase tracking-wider transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedStatus || isLoading || (selectedStatus === 'SHIPPED' && actions.tracking.required && !trackingCode.trim())}
            className="btn-shimmer px-6 py-2.5 rounded-full bg-gradient-to-r from-[#F0B40E] to-[#E5A805] text-[#010E31] font-bold text-xs font-mono uppercase tracking-wider shadow-[0_0_20px_rgba(240,180,14,0.3)] border border-[#F5BD1E]/40 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isLoading && <Spinner className="w-3.5 h-3.5" />}
            Confirmar Transição
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
