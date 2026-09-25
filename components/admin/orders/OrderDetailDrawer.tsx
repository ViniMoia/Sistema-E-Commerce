'use client'

import * as React from 'react'
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button, AlertBanner, Spinner, Badge } from '@/components/ui'
import { Skeleton } from '@/components/ui/skeleton'
import { OrderStatus } from '@prisma/client'
import { OrderStatusManager } from './OrderStatusManager'
import { X, ExternalLink } from 'lucide-react'
import { getTrackingInfo } from '@/lib/freight/tracking-url'

export interface OrderDetail {
  id: string
  orderNumber: number
  status: OrderStatus
  createdAt: string
  updatedAt: string
  total: number
  subtotal?: number
  freightValue: number | null
  shippingCost?: number
  shippingProvider?: string | null
  shippingServiceName?: string | null
  shippingEstimatedDays?: number | null
  deliveryType: 'DELIVERY' | 'PICKUP' | 'NONE'
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
    cep?: string
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

    const fetchOrder = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const res = await fetch(`/api/admin/orders/${orderId}`)
        if (!res.ok) {
          throw new Error('Falha ao carregar detalhes do pedido')
        }
        const data = await res.json()
        setOrder(data)
        setNotesValue(data.adminNotes || '')
        setTrackingValue(data.trackingCode || '')
      } catch (err: any) {
        setError(err.message || 'Erro inesperado')
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
        throw new Error('Falha ao salvar código de rastreamento')
      }
      setOrder({ ...order, trackingCode: trackingValue })
      setIsEditingTracking(false)
      onStatusUpdate()
    } catch (err) {
      console.error(err)
    } finally {
      setIsSavingTracking(false)
    }
  }

  return (
    <Sheet open={Boolean(orderId)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl p-0 overflow-y-auto bg-catalog-card border-l border-catalog-gold/45 text-catalog-text">
        {/* Título e descrição acessíveis incondicionalmente presentes para conformidade estrita com o Radix UI */}
        <div className="sr-only">
          <SheetTitle>
            {order ? `Detalhes do Pedido #${order.orderNumber}` : 'Carregando Detalhes do Pedido'}
          </SheetTitle>
          <SheetDescription>
            Painel lateral de visualização e gerenciamento do pedido selecionado
          </SheetDescription>
        </div>

        {isLoading && (
          <div className="p-6 space-y-6">
            <Skeleton className="h-8 w-1/3 bg-white/5" />
            <Skeleton className="h-24 w-full bg-white/5" />
            <Skeleton className="h-40 w-full bg-white/5" />
          </div>
        )}

        {error && (
          <div className="p-6">
            <AlertBanner variant="error" title="Erro" message={error} />
          </div>
        )}

        {order && (
          <div className="flex flex-col min-h-full">
            {/* 1. HEADER */}
            <div className="px-6 py-6 border-b border-catalog-gold/20 bg-[#050B14] sticky top-0 z-10">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-2xl font-bold tracking-tight text-white uppercase font-mono">
                      Pedido #{order.orderNumber}
                    </h2>
                    <Badge status={order.status} />
                  </div>
                  <p className="text-sm font-mono text-catalog-muted">
                    {formatDate(order.createdAt)}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="rounded-full p-2 hover:bg-catalog-gold/15 text-catalog-gold transition-colors focus:outline-none focus:ring-1 focus:ring-catalog-gold"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 p-6 space-y-8">
              {/* 2. CLIENTE */}
              <section className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-catalog-gold border-b border-catalog-gold/20 pb-2 font-mono">
                  Cliente
                </h3>
                <div className="bg-[#0B132B]/70 rounded-xl p-4 border border-catalog-gold/25">
                  <p className="font-medium text-white">{order.customer?.name || order.user?.name || 'Cliente desconhecido'}</p>
                  <p className="text-sm text-catalog-muted mt-1 font-mono">{order.customer?.email || order.user?.email}</p>
                  {(order.customer?.phone || order.user?.phone) && (
                    <p className="text-sm text-catalog-muted mt-1 font-mono">{order.customer?.phone || order.user?.phone}</p>
                  )}
                </div>
              </section>

              {/* 3. PRODUTOS */}
              <section className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-catalog-gold border-b border-catalog-gold/20 pb-2 font-mono">
                  Produtos
                </h3>
                <div className="bg-[#0B132B]/70 rounded-xl border border-catalog-gold/25 overflow-hidden">
                  <div className="divide-y divide-catalog-gold/15">
                    {order.items.map(item => (
                      <div key={item.id} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm text-white">{item.name}</p>
                          <p className="text-xs text-catalog-muted mt-0.5 font-mono">
                            {item.quantity}x {formatCurrency(item.price)}
                            {item.color && ` • Cor: ${item.color}`}
                            {item.size && ` • Tam: ${item.size}`}
                          </p>
                        </div>
                        <span className="font-bold text-sm text-white font-mono">
                          {formatCurrency(item.quantity * item.price)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-[#050B14] p-4 flex justify-between border-t border-catalog-gold/20">
                    <span className="text-sm font-mono text-catalog-muted">Subtotal Produtos</span>
                    <span className="text-sm font-mono font-bold text-white">
                      {formatCurrency(order.items.reduce((acc, item) => acc + (item.quantity * item.price), 0))}
                    </span>
                  </div>
                </div>
              </section>

              {/* 4. ENDEREÇO & MODALIDADE DE ENVIO */}
              <section className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-catalog-gold border-b border-catalog-gold/20 pb-2 font-mono">
                  Modalidade & Entrega
                </h3>
                <div className="bg-[#0B132B]/70 rounded-xl p-4 border border-catalog-gold/25 space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-catalog-muted font-mono">Serviço de Envio:</span>
                    <span className="font-semibold text-white">
                      {order.shippingServiceName || (order.deliveryType === 'PICKUP' ? 'Retirada na Loja' : order.deliveryType === 'NONE' ? 'A Combinar via WhatsApp' : 'Entrega')}
                    </span>
                  </div>

                  {order.shippingEstimatedDays ? (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-catalog-muted font-mono">Prazo Prometido:</span>
                      <span className="text-slate-300 font-medium font-mono">
                        {order.shippingEstimatedDays} dias úteis
                      </span>
                    </div>
                  ) : null}

                  {order.deliveryType === 'DELIVERY' && order.address && (
                    <div className="pt-2 border-t border-catalog-gold/15">
                      <p className="text-xs text-catalog-gold mb-1 font-mono font-bold uppercase">Endereço de Destino:</p>
                      <p className="text-sm text-slate-300 leading-relaxed">
                        {order.address.street}, {order.address.number}
                        {order.address.complement && ` - ${order.address.complement}`}
                        <br />
                        {order.address.neighborhood}
                        <br />
                        {order.address.city} - {order.address.state}
                        {order.address.cep && ` (CEP: ${order.address.cep})`}
                      </p>
                    </div>
                  )}
                </div>
              </section>

              {/* 5. RESUMO FINANCEIRO */}
              <section className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-catalog-gold border-b border-catalog-gold/20 pb-2 font-mono">
                  Resumo Financeiro
                </h3>
                <div className="bg-[#0B132B]/70 rounded-xl p-4 border border-catalog-gold/25 space-y-2">
                  <div className="flex justify-between text-sm text-catalog-muted font-mono">
                    <span>Subtotal Produtos</span>
                    <span className="text-white">{formatCurrency(order.items.reduce((acc, item) => acc + (item.quantity * item.price), 0))}</span>
                  </div>
                  <div className="flex justify-between text-sm text-catalog-muted font-mono">
                    <span>Frete ({order.shippingServiceName || 'Envio'})</span>
                    <span className="font-medium text-white">
                      {order.freightValue && order.freightValue > 0 ? formatCurrency(order.freightValue) : 'Grátis (R$ 0,00)'}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-lg text-white font-mono pt-2 border-t border-catalog-gold/20 mt-2">
                    <span className="text-catalog-gold">Total do Pedido</span>
                    <span>{formatCurrency(order.total)}</span>
                  </div>
                </div>
              </section>

              {/* 6. RASTREAMENTO E CÓDIGO DE ENVIO */}
              <section className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-catalog-gold border-b border-catalog-gold/20 pb-2 font-mono">
                  Código de Rastreamento (Correios / Transportadora)
                </h3>
                <div className="bg-[#0B132B]/70 rounded-xl p-4 border border-catalog-gold/25">
                  {isEditingTracking ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={trackingValue}
                        onChange={(e) => setTrackingValue(e.target.value)}
                        placeholder="Ex: AA123456789BR"
                        className="h-10 flex-1 rounded-xl border border-catalog-gold/30 bg-[#050B14] px-3 text-sm font-mono text-white focus:border-catalog-gold outline-none"
                      />
                      <Button size="sm" onClick={handleSaveTracking} disabled={isSavingTracking} className="bg-gradient-to-r from-[#F0B40E] to-[#E5A805] text-[#010E31] font-bold">
                        {isSavingTracking ? <Spinner className="w-3 h-3" /> : 'Salvar'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setIsEditingTracking(false)} className="border-catalog-gold/30 text-slate-300">
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {order.trackingCode ? (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-semibold text-emerald-400">
                              {order.trackingCode}
                            </span>
                            {(() => {
                              const info = getTrackingInfo(order.trackingCode, order.shippingServiceName || order.shippingProvider);
                              return info?.carrier ? (
                                <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-catalog-gold/15 text-catalog-gold border border-catalog-gold/30">
                                  {info.carrier}
                                </span>
                              ) : null;
                            })()}
                          </div>
                          <div className="flex items-center gap-2">
                            {(() => {
                              const info = getTrackingInfo(order.trackingCode, order.shippingServiceName || order.shippingProvider);
                              return info?.trackingUrl ? (
                                <a
                                  href={info.trackingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-catalog-gold hover:text-white px-2.5 py-1.5 rounded-lg bg-catalog-gold/10 border border-catalog-gold/30 hover:bg-catalog-gold/20 transition-colors"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  Rastrear Objeto
                                </a>
                              ) : null;
                            })()}
                            <Button size="sm" variant="outline" onClick={() => setIsEditingTracking(true)} className="border-catalog-gold/30 hover:border-catalog-gold hover:text-catalog-gold text-slate-300">
                              Alterar
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <span className="text-catalog-muted italic text-sm font-mono">Nenhum código cadastrado</span>
                          <Button size="sm" variant="outline" onClick={() => setIsEditingTracking(true)} className="border-catalog-gold/30 hover:border-catalog-gold hover:text-catalog-gold text-slate-300">
                            Adicionar Rastreio
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </section>

              {/* 7. NOTAS INTERNAS */}
              <section className="space-y-3">
                <div className="flex items-center justify-between border-b border-catalog-gold/20 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-catalog-gold font-mono">
                    Notas Internas
                  </h3>
                  {!isEditingNotes && (
                    <button
                      onClick={() => setIsEditingNotes(true)}
                      className="text-xs text-catalog-gold hover:underline font-mono"
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
                      className="w-full rounded-xl border border-catalog-gold/30 bg-[#050B14] p-3 text-sm text-white focus:outline-none focus:border-catalog-gold resize-none"
                      placeholder="Adicione observações sobre o pedido..."
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setIsEditingNotes(false)} className="border-catalog-gold/30 text-slate-300">
                        Cancelar
                      </Button>
                      <Button size="sm" onClick={handleSaveNotes} disabled={isSavingNotes} className="bg-gradient-to-r from-[#F0B40E] to-[#E5A805] text-[#010E31] font-bold">
                        {isSavingNotes ? <Spinner className="w-4 h-4 mr-2" /> : null}
                        Salvar Notas
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#0B132B]/70 rounded-xl p-4 border border-catalog-gold/25 text-sm text-slate-300 whitespace-pre-wrap font-mono">
                    {order.adminNotes || <span className="italic text-catalog-muted">Nenhuma nota interna adicionada.</span>}
                  </div>
                )}
              </section>

              {/* 8. HISTÓRICO DE STATUS */}
              <section className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-catalog-gold border-b border-catalog-gold/20 pb-2 font-mono">
                  Histórico de Status
                </h3>
                <div className="relative pl-4 space-y-6 pt-2 before:absolute before:inset-y-0 before:left-[11px] before:w-[2px] before:bg-catalog-gold/20">
                  {(order.statusHistory || []).map((history) => (
                    <div key={history.id} className="relative">
                      <div className="absolute -left-6 w-3 h-3 rounded-full bg-[#F0B40E] ring-4 ring-[#0F172A] mt-1.5" />
                      <div>
                        <p className="text-sm font-medium text-white font-mono">
                          Status atualizado para <span className="font-bold text-catalog-gold">{statusMap[history.status]?.label}</span>
                        </p>
                        <p className="text-xs text-catalog-muted mt-0.5 font-mono">
                          {formatDate(history.createdAt)} por {history.performedBy?.name || 'Sistema'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* 9. FOOTER ACTIONS */}
            <div className="flex justify-end px-6 py-4 border-t border-catalog-gold/20 bg-[#050B14] sticky bottom-0 z-10">
              <button
                onClick={() => setIsStatusManagerOpen(true)}
                className="btn-shimmer px-6 py-2.5 rounded-full bg-gradient-to-r from-[#F0B40E] to-[#E5A805] text-[#010E31] font-bold text-xs tracking-widest uppercase shadow-[0_0_20px_rgba(240,180,14,0.3)] border border-[#F5BD1E]/40"
              >
                Atualizar Status
              </button>
              <OrderStatusManager
                orderId={order.id}
                currentStatus={order.status}
                isOpen={isStatusManagerOpen}
                onClose={() => setIsStatusManagerOpen(false)}
                onSuccess={() => {
                  onStatusUpdate()
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
