'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge, Button, AlertBanner, Spinner } from '@/components/ui'

type OrderStatus = 'PENDING' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'

export interface OrderStatusManagerProps {
  orderId: string
  currentStatus: OrderStatus
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['PAID', 'CANCELLED'],
  PAID: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: []
}

const statusLabels: Record<OrderStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'outline' }> = {
  PENDING: { label: 'Pendente', variant: 'warning' },
  PAID: { label: 'Pago', variant: 'success' },
  SHIPPED: { label: 'Enviado', variant: 'default' },
  DELIVERED: { label: 'Entregue', variant: 'success' },
  CANCELLED: { label: 'Cancelado', variant: 'error' }
}

export function OrderStatusManager({
  orderId,
  currentStatus,
  isOpen,
  onClose,
  onSuccess
}: OrderStatusManagerProps) {
  const [selectedStatus, setSelectedStatus] = React.useState<OrderStatus | null>(null)
  const [trackingCode, setTrackingCode] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const availableTransitions = VALID_TRANSITIONS[currentStatus] || []

  React.useEffect(() => {
    if (isOpen) {
      setSelectedStatus(null)
      setTrackingCode('')
      setError(null)
      setIsLoading(false)
    }
  }, [isOpen, currentStatus])

  const handleConfirm = async () => {
    if (!selectedStatus) return

    try {
      setIsLoading(true)
      setError(null)

      const body: any = { newStatus: selectedStatus }
      if (selectedStatus === 'SHIPPED' && trackingCode.trim() !== '') {
        body.trackingCode = trackingCode.trim()
      }

      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao atualizar status do pedido.')
      }

      onSuccess()
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
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Atualizar Status do Pedido
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Status Atual:</span>
            <Badge status={currentStatus} />
          </div>

          {error && (
            <AlertBanner variant="error" title="Erro" message={error} />
          )}

          <div className="space-y-3">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Novo Status:</span>
            {availableTransitions.length === 0 ? (
              <div className="rounded-md bg-zinc-100 dark:bg-zinc-900 p-4 text-center">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Nenhuma transição disponível
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {availableTransitions.map((status) => (
                  <button
                    key={status}
                    onClick={() => setSelectedStatus(status)}
                    className={`flex items-center justify-center rounded-md border p-3 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-[#dbb501] focus:ring-offset-1 dark:focus:ring-offset-zinc-950 ${
                      selectedStatus === status
                        ? 'border-[#dbb501] bg-[#dbb501]/10 text-[#dbb501]'
                        : 'border-zinc-200 bg-white text-zinc-700 hover:border-[#dbb501]/50 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-[#dbb501]/50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {statusLabels[status].label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedStatus === 'SHIPPED' && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <label htmlFor="trackingCode" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Código de Rastreio <span className="text-zinc-400 font-normal">(Opcional)</span>
              </label>
              <input
                id="trackingCode"
                type="text"
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value)}
                placeholder="Ex: BR123456789BR"
                className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#dbb501] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-offset-zinc-950 dark:placeholder:text-zinc-400"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-zinc-200 dark:border-zinc-800 pt-4">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            {availableTransitions.length === 0 ? 'Fechar' : 'Cancelar'}
          </Button>
          {availableTransitions.length > 0 && (
            <Button
              onClick={handleConfirm}
              disabled={isLoading || !selectedStatus}
              className="bg-[#dbb501] text-zinc-950 hover:bg-[#c2a001]"
            >
              {isLoading ? <Spinner className="w-4 h-4 mr-2" /> : null}
              Confirmar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
