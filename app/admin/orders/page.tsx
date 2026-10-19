'use client'

import * as React from 'react'
import { OrdersTable, OrderRow } from '@/components/admin/orders/OrdersTable'
import { AlertBanner } from '@/components/ui'
import { OrderDetailDrawer } from '@/components/admin/orders/OrderDetailDrawer'
import { Search } from 'lucide-react'

export default function OrdersPage() {
  const [orders, setOrders] = React.useState<OrderRow[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [selectedOrderId, setSelectedOrderId] = React.useState<string | null>(null)

  const [statusFilter, setStatusFilter] = React.useState<string>('ALL')
  const [searchTerm, setSearchTerm] = React.useState('')
  const [reportingScope, setReportingScope] = React.useState<'COMMERCIAL' | 'TEST' | 'ALL'>('COMMERCIAL')
  const [nextCursor, setNextCursor] = React.useState<string | null>(null)
  const [totalCount, setTotalCount] = React.useState(0)
  const activeRequest = React.useRef<AbortController | null>(null)

  const fetchOrders = React.useCallback(async (cursor?: string) => {
    activeRequest.current?.abort()
    const controller = new AbortController()
    activeRequest.current = controller
    if (!cursor) { setOrders([]); setNextCursor(null); setTotalCount(0) }
    try {
      setIsLoading(true)
      setError(null)
      const query = new URLSearchParams({ reportingScope, pageSize: '100' })
      if (statusFilter !== 'ALL') query.set('status', statusFilter)
      if (searchTerm.trim()) query.set('search', searchTerm.trim())
      if (cursor) query.set('cursor', cursor)
      const res = await fetch('/api/admin/orders?' + query, { signal: controller.signal, cache: 'no-store' })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Erro ao carregar pedidos')
      }
      const json = await res.json()
      if (controller.signal.aborted) return

      let ordersArray = null
      if (json.success) {
        if (Array.isArray(json.data)) ordersArray = json.data
        else if (json.data && Array.isArray(json.data.data)) ordersArray = json.data.data
        else if (json.data && Array.isArray(json.data.orders)) ordersArray = json.data.orders
      } else if (Array.isArray(json)) {
        ordersArray = json
      }

      if (ordersArray) {
        const mapped = ordersArray.map((o: any) => ({
          id: o.id,
          isTest: Boolean(o.reportingExclusion),
          orderNumber: typeof o.orderNumber === 'number' ? o.orderNumber : (parseInt(o.id.replace(/\D/g, '')) || 0),
          createdAt: o.createdAt,
          customerName: o.customer?.name || o.user?.name || 'Sem nome',
          customerEmail: o.customer?.email || o.user?.email || '',
          status: o.status,
          deliveryType: o.deliveryType || 'DELIVERY',
          total: typeof o.total === 'number' ? o.total : parseFloat(o.total || '0'),
          freightValue: typeof o.freightValue === 'number' ? o.freightValue : parseFloat(o.freightValue || '0')
        }))
        setOrders(previous => cursor ? [...previous, ...mapped] : mapped)
        setNextCursor(json.data?.nextCursor ?? null)
        setTotalCount(json.data?.totalCount ?? mapped.length)
      } else {
        throw new Error('Formato inválido de resposta da API.')
      }
    } catch (err: unknown) {
      if (controller.signal.aborted) return
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Ocorreu um erro desconhecido ao carregar pedidos.')
      }
    } finally {
      if (!controller.signal.aborted) setIsLoading(false)
    }
  }, [reportingScope, statusFilter, searchTerm])

  React.useEffect(() => {
    void fetchOrders()
    return () => activeRequest.current?.abort()
  }, [fetchOrders])

  return (
    <div className="p-6 md:p-10 space-y-8 min-h-screen bg-catalog-bg text-catalog-text">
      {/* Header Operacional */}
      <div className="border-b border-catalog-gold/20 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="text-[10px] text-catalog-gold font-mono tracking-[0.25em] uppercase border border-catalog-gold/45 px-2.5 py-1 rounded inline-block mb-2 font-bold">
            Fluxo de Vendas & Faturamento
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white uppercase font-mono">
            Gestão de Pedidos
          </h1>
          <p className="text-catalog-muted mt-1 text-xs sm:text-sm font-light">
            Acompanhe pedidos gerados, pagamentos via PIX, cartões e despachos em tempo real.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-catalog-muted">
          <span>Pedidos filtrados:</span>
          <span className="font-bold text-catalog-gold px-2.5 py-0.5 rounded-full bg-catalog-gold/15 border border-catalog-gold/40">
            {totalCount}
          </span>
        </div>
      </div>

      {error && <AlertBanner variant="error" message={error} />}

      <div className="flex flex-wrap gap-3" role="group" aria-label="Origem dos pedidos">
        {([{ id: 'COMMERCIAL', label: 'Comerciais' }, { id: 'TEST', label: 'Histórico de testes' }, { id: 'ALL', label: 'Todos' }] as const).map(scope => (
          <button key={scope.id} type="button" aria-pressed={reportingScope === scope.id}
            onClick={() => setReportingScope(scope.id)}
            className={reportingScope === scope.id ? 'rounded-lg border border-catalog-gold px-4 py-2 text-catalog-gold' : 'rounded-lg border border-catalog-gold/25 px-4 py-2 text-catalog-muted'}>
            {scope.label}
          </button>
        ))}
      </div>
      {reportingScope === 'TEST' && <p className="text-sm text-catalog-muted">Pedidos de teste preservados para consulta. Não entram nos indicadores comerciais.</p>}
      {/* Barra de Filtros e Busca */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Pílulas de Filtro de Status */}
          <div className="flex flex-wrap gap-2" role="group" aria-label="Status dos pedidos">
            {[
              { id: 'ALL', label: 'Todos' },
              { id: 'PENDING', label: 'Pendentes' },
              { id: 'PAID', label: 'Pagos' },
              { id: 'SHIPPED', label: 'Enviados' },
              { id: 'DELIVERED', label: 'Entregues' },
              { id: 'CANCELLED', label: 'Cancelados' },
            ].map((tab) => {
              const isActive = statusFilter === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-mono uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                    isActive
                      ? 'bg-catalog-gold/20 text-catalog-gold font-bold border-2 border-catalog-gold shadow-[0_0_15px_rgba(240,180,14,0.2)]'
                      : 'bg-[#0B132B]/60 text-catalog-muted border border-catalog-gold/25 hover:border-catalog-gold/50 hover:text-white'
                  }`}
                >
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* Campo de Busca Rápida */}
          <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-catalog-gold" />
            <input
                name="orderSearch"
                aria-label="Buscar por cliente ou número do pedido"
              type="text"
              placeholder="Buscar por cliente ou nº..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#0B132B]/70 border border-catalog-gold/30 rounded-xl text-white placeholder-gray-400 text-xs font-mono focus:outline-none focus:border-catalog-gold transition-all"
            />
          </div>
        </div>

        {/* Tabela Canônica de Pedidos */}
        <OrdersTable
          data={orders}
          isLoading={isLoading}
          onSelectOrder={(id) => setSelectedOrderId(id)}
        />
      </div>

      {nextCursor && <button type="button" disabled={isLoading} onClick={() => void fetchOrders(nextCursor)}
        className="rounded-lg border border-catalog-gold px-4 py-2 text-catalog-gold">Carregar mais pedidos</button>}

      {/* Drawer de Detalhes do Pedido Canônico Continental */}
      {selectedOrderId && (
        <OrderDetailDrawer
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
          onStatusUpdate={() => {
            fetchOrders()
          }}
        />
      )}
    </div>
  )
}
