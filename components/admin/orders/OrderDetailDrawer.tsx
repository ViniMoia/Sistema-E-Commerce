'use client'

import * as React from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button, SkeletonRow, AlertBanner, Spinner, Badge } from '@/components/ui'
import { OrderStatus } from '@prisma/client'
import { OrderStatusManager } from './OrderStatusManager'
import { X } from 'lucide-react'

export interface OrderDetail {
  id: string
  orderNumber: number
  status: OrderStatus
  createdAt: string
  updatedAt: string
  total: number
  freightValue: number | null
  deliveryType: 'DELIVERY' | 'PICKUP'
  trackingCode: string | null
  adminNotes: string | null
  paymentMethod: string | null
  customer?: {
    name: string
    email: string
    phone: string | null
  }
  user?: {
    name: string
    email: string
    phone: string | null
  }
  items: Array<{
    id: string
    name: string
    quantity: number
    price: number
    color: string | null
    size: string | null
  }>
  address: {
    state: string
    city: string
    neighborhood: string
    street: string
    number: string
    complement: string | null
  } | null
  statusHistory: Array<{
    id: string
    status: OrderStatus
    createdAt: string
    performedBy: { name: string }
  }>
}

export interface OrderDetailDrawerProps {
  orderId: string | null
  onClose: () => void
  onStatusUpdate: () => void
}

const statusMap: Record<OrderStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'outline' }> = {
  PENDING: { label: 'Pendente', variant: 'warning' },
  PAID: { label: 'Pago', variant: 'success' },
  SHIPPED: { label: 'Enviado', variant: 'default' },
  DELIVERED: { label: 'Entregue', variant: 'success' },
  CANCELLED: { label: 'Cancelado', variant: 'error' }
}

export function OrderDetailDrawer({ orderId, onClose, onStatusUpdate }: OrderDetailDrawerProps) {
  const [order, setOrder] = React.useState<OrderDetail | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [isEditingNotes, setIsEditingNotes] = React.useState(false)
  const [notesValue, setNotesValue] = React.useState('')
  const [isSavingNotes, setIsSavingNotes] = React.useState(false)

  const [isEditingTracking, setIsEditingTracking] = React.useState(false)
  const [trackingValue, setTrackingValue] = React.useState('')
  const [isSavingTracking, setIsSavingTracking] = React.useState(false)

  const [isStatusManagerOpen, setIsStatusManagerOpen] = React.useState(false)

  React.useEffect(() => {
    if (!orderId) {
      setOrder(null)
      return
    }

    async function fetchOrder() {
      try {
        setIsLoading(true)
        setError(null)
        const res = await fetch(`/api/admin/orders/${orderId}`)
        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.error || 'Erro ao carregar detalhes do pedido')
        }
        const json = await res.json()
        if (json.success && json.data) {
          setOrder(json.data)
          setNotesValue(json.data.adminNotes || '')
          setTrackingValue(json.data.trackingCode || '')
        } else {
          throw new Error('Dados do pedido não encontrados')
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('Ocorreu um erro desconhecido ao carregar o pedido')
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchOrder()
  }, [orderId])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
  }

  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(dateStr))
  }

  const handleSaveNotes = async () => {
    if (!order) return
    try {
      setIsSavingNotes(true)
      const res = await fetch(`/api/admin/orders/${order.id}/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminNotes: notesValue })
      })
      if (!res.ok) {
        throw new Error('Falha ao salvar notas')
      }
      setOrder({ ...order, adminNotes: notesValue })
      setIsEditingNotes(false)
    } catch (err) {
      console.error(err)
    } finally {
      setIsSavingNotes(false)
    }
  }

  const handleSaveTracking = async () => {
    if (!order) return
    try {
      setIsSavingTracking(true)
      const res = await fetch(`/api/admin/orders/${order.id}/tracking`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingCode: trackingValue })
      })
      if (!res.ok) {
        throw new Error('Falha ao salvar código de rastreio')
      }
      setOrder({ ...order, trackingCode: trackingValue })
      setIsEditingTracking(false)
    } catch (err) {
      console.error(err)
    } finally {
      setIsSavingTracking(false)
    }
  }

  const isOpen = !!orderId

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto bg-zinc-50 dark:bg-zinc-950 p-0 border-l border-zinc-200 dark:border-white/10">
        {isLoading && (
          <div className="p-6 space-y-4 mt-8">
            <SkeletonRow columns={1} />
            <SkeletonRow columns={1} />
            <SkeletonRow columns={1} />
            <SkeletonRow columns={1} />
          </div>
        )}

        {error && !isLoading && (
          <div className="p-6 mt-8">
            <AlertBanner variant="error" title="Erro" message={error} />
          </div>
        )}

        {order && !isLoading && !error && (
          <div className="flex flex-col min-h-full">
            {/* 1. HEADER */}
            <div className="px-6 py-6 border-b border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 sticky top-0 z-10">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <SheetTitle className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                      Pedido #{order.orderNumber}
                    </SheetTitle>
                    <Badge status={order.status} />
                  </div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {formatDate(order.createdAt)}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="rounded-full p-2 hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-[#dbb501]"
                >
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>
            </div>

            <div className="flex-1 p-6 space-y-8">
              {/* 2. CLIENTE */}
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-white/10 pb-2">
                  Cliente
                </h3>
                <div className="bg-white dark:bg-zinc-900 rounded-lg p-4 shadow-sm border border-zinc-200 dark:border-white/5">
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">{order.customer?.name || order.user?.name || 'Cliente desconhecido'}</p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{order.customer?.email || order.user?.email}</p>
                  {(order.customer?.phone || order.user?.phone) && (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{order.customer?.phone || order.user?.phone}</p>
                  )}
                </div>
              </section>

              {/* 3. PRODUTOS */}
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-white/10 pb-2">
                  Produtos
                </h3>
                <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-white/5 overflow-hidden">
                  <div className="divide-y divide-zinc-200 dark:divide-white/10">
                    {order.items.map(item => (
                      <div key={item.id} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm text-zinc-900 dark:text-zinc-100">{item.name}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                            {item.quantity}x {formatCurrency(item.price)}
                            {item.color && ` • Cor: ${item.color}`}
                            {item.size && ` • Tam: ${item.size}`}
                          </p>
                        </div>
                        <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                          {formatCurrency(item.quantity * item.price)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-zinc-50 dark:bg-white/[0.02] p-4 flex justify-between border-t border-zinc-200 dark:border-white/10">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Subtotal Produtos</span>
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {formatCurrency(order.items.reduce((acc, item) => acc + (item.quantity * item.price), 0))}
                    </span>
                  </div>
                </div>
              </section>

              {/* 4. ENDEREÇO */}
              {order.deliveryType === 'DELIVERY' && order.address && (
                <section className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-white/10 pb-2">
                    Endereço de Entrega
                  </h3>
                  <div className="bg-white dark:bg-zinc-900 rounded-lg p-4 shadow-sm border border-zinc-200 dark:border-white/5">
                    <p className="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed">
                      {order.address.street}, {order.address.number}
                      {order.address.complement && ` - ${order.address.complement}`}
                      <br />
                      {order.address.neighborhood}
                      <br />
                      {order.address.city} - {order.address.state}
                    </p>
                  </div>
                </section>
              )}

              {/* 5. RESUMO FINANCEIRO */}
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-white/10 pb-2">
                  Resumo Financeiro
                </h3>
                <div className="bg-white dark:bg-zinc-900 rounded-lg p-4 shadow-sm border border-zinc-200 dark:border-white/5 space-y-2">
                  <div className="flex justify-between text-sm text-zinc-600 dark:text-zinc-400">
                    <span>Subtotal</span>
                    <span>{formatCurrency(order.items.reduce((acc, item) => acc + (item.quantity * item.price), 0))}</span>
                  </div>
                  {order.deliveryType === 'DELIVERY' && order.freightValue !== null && (
                    <div className="flex justify-between text-sm text-zinc-600 dark:text-zinc-400">
                      <span>Frete</span>
                      <span>{formatCurrency(order.freightValue)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-medium text-lg text-[#dbb501] pt-2 border-t border-zinc-100 dark:border-white/5 mt-2">
                    <span>Total</span>
                    <span>{formatCurrency(order.total)}</span>
                  </div>
                </div>
              </section>

              {/* 6. INFORMAÇÕES ADICIONAIS */}
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-white/10 pb-2">
                  Informações Adicionais
                </h3>
                <div className="bg-white dark:bg-zinc-900 rounded-lg p-4 shadow-sm border border-zinc-200 dark:border-white/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">Método de Pagamento</span>
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {order.paymentMethod || 'Não definido'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">Tipo de Entrega</span>
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {order.deliveryType === 'DELIVERY' ? 'Entrega' : 'Retirada'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-zinc-100 dark:border-white/5 pt-4">
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">Código de Rastreio</span>
                    {order.status === 'SHIPPED' ? (
                      isEditingTracking ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={trackingValue}
                            onChange={(e) => setTrackingValue(e.target.value)}
                            className="h-8 w-32 rounded-md border border-zinc-200 bg-transparent px-2 text-sm text-zinc-900 dark:text-zinc-100 dark:border-zinc-800 focus:outline-none focus:ring-1 focus:ring-[#dbb501]"
                          />
                          <Button size="sm" onClick={handleSaveTracking} disabled={isSavingTracking} className="h-8">
                            {isSavingTracking ? <Spinner className="w-3 h-3" /> : 'Salvar'}
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            {order.trackingCode || 'Não definido'}
                          </span>
                          <button
                            onClick={() => setIsEditingTracking(true)}
                            className="text-xs text-[#dbb501] hover:underline"
                          >
                            Editar
                          </button>
                        </div>
                      )
                    ) : (
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {order.trackingCode || 'N/A'}
                      </span>
                    )}
                  </div>
                </div>
              </section>

              {/* 7. NOTAS INTERNAS */}
              <section className="space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/10 pb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Notas Internas
                  </h3>
                  {!isEditingNotes && (
                    <button
                      onClick={() => setIsEditingNotes(true)}
                      className="text-xs text-[#dbb501] hover:underline"
                    >
                      Editar
                    </button>
                  )}
                </div>
                {isEditingNotes ? (
                  <div className="space-y-2">
                    <textarea
                      value={notesValue}
                      onChange={(e) => setNotesValue(e.target.value)}
                      rows={3}
                      className="w-full rounded-md border border-zinc-200 bg-white p-3 text-sm text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#dbb501] resize-none"
                      placeholder="Adicione observações sobre o pedido..."
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setIsEditingNotes(false)}>
                        Cancelar
                      </Button>
                      <Button size="sm" onClick={handleSaveNotes} disabled={isSavingNotes}>
                        {isSavingNotes ? <Spinner className="w-4 h-4 mr-2" /> : null}
                        Salvar Notas
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-yellow-50/50 dark:bg-yellow-900/10 rounded-lg p-4 border border-yellow-100 dark:border-yellow-900/30 text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                    {order.adminNotes || <span className="italic text-zinc-400">Nenhuma nota interna adicionada.</span>}
                  </div>
                )}
              </section>

              {/* 8. HISTÓRICO DE STATUS */}
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-white/10 pb-2">
                  Histórico de Status
                </h3>
                <div className="relative pl-4 space-y-6 pt-2 before:absolute before:inset-y-0 before:left-[11px] before:w-[2px] before:bg-zinc-200 dark:before:bg-white/10">
                  {(order.statusHistory || []).map((history, idx) => (
                    <div key={history.id} className="relative">
                      <div className="absolute -left-6 w-3 h-3 rounded-full bg-[#dbb501] ring-4 ring-zinc-50 dark:ring-zinc-950 mt-1.5" />
                      <div>
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          Status atualizado para <span className="font-bold">{statusMap[history.status]?.label}</span>
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {formatDate(history.createdAt)} por {history.performedBy.name}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

            </div>

            {/* 9. FOOTER ACTIONS */}
            <div className="flex justify-end px-6 py-4 border-t border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 sticky bottom-0 z-10">
              <Button
                onClick={() => setIsStatusManagerOpen(true)}
                className="bg-[#dbb501] text-zinc-950 hover:bg-[#c2a001]"
              >
                Atualizar Status
              </Button>
              <OrderStatusManager
                orderId={order.id}
                currentStatus={order.status}
                isOpen={isStatusManagerOpen}
                onClose={() => setIsStatusManagerOpen(false)}
                onSuccess={() => {
                  onStatusUpdate()
                  // Opcionalmente recarregar os detalhes do pedido
                  setOrder(null)
                  onClose()
                }}
              />
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
