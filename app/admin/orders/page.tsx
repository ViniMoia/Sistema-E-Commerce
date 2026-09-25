'use client'

import * as React from 'react'
import { OrdersTable, OrderRow } from '@/components/admin/orders/OrdersTable'
import { AlertBanner } from '@/components/ui'
import { OrderDetailDrawer } from '@/components/admin/orders/OrderDetailDrawer'
import { Search, ShoppingCart, Filter } from 'lucide-react'

export default function OrdersPage() {
  const [orders, setOrders] = React.useState<OrderRow[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [selectedOrderId, setSelectedOrderId] = React.useState<string | null>(null)

  const [statusFilter, setStatusFilter] = React.useState<string>('ALL')
  const [searchTerm, setSearchTerm] = React.useState('')

  const fetchOrders = React.useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const res = await fetch('/api/admin/orders')
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Erro ao carregar pedidos')
      }
      const json = await res.json()

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
          orderNumber: typeof o.orderNumber === 'number' ? o.orderNumber : (parseInt(o.id.replace(/\D/g, '')) || 0),
          createdAt: o.createdAt,
          customerName: o.customer?.name || o.user?.name || 'Sem nome',
          customerEmail: o.customer?.email || o.user?.email || '',
          status: o.status,
          deliveryType: o.deliveryType || 'DELIVERY',
          total: typeof o.total === 'number' ? o.total : parseFloat(o.total || '0'),
          freightValue: typeof o.freightValue === 'number' ? o.freightValue : parseFloat(o.freightValue || '0')
        }))
        setOrders(mapped)
      } else {
        throw new Error('Formato inválido de resposta da API.')
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Ocorreu um erro desconhecido ao carregar pedidos.')
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const filteredOrders = React.useMemo(() => {
    return orders.filter(order => {
      const matchStatus = statusFilter === 'ALL' || order.status === statusFilter
      const matchSearch =
        searchTerm === '' ||
        order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(order.orderNumber).includes(searchTerm)
      return matchStatus && matchSearch
    })
  }, [orders, statusFilter, searchTerm])

  const statusCounts = React.useMemo(() => {
    return {
      ALL: orders.length,
      PENDING: orders.filter(o => o.status === 'PENDING').length,
      PAID: orders.filter(o => o.status === 'PAID').length,
      SHIPPED: orders.filter(o => o.status === 'SHIPPED').length,
      CANCELLED: orders.filter(o => o.status === 'CANCELLED').length,
    }
  }, [orders])

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
            {filteredOrders.length}
          </span>
        </div>
      </div>

      {error && <AlertBanner variant="error" message={error} />}

      {/* Barra de Filtros e Busca */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Pílulas de Filtro de Status */}
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'ALL', label: 'Todos', count: statusCounts.ALL },
              { id: 'PENDING', label: 'Pendentes', count: statusCounts.PENDING },
              { id: 'PAID', label: 'Pagos', count: statusCounts.PAID },
              { id: 'SHIPPED', label: 'Enviados', count: statusCounts.SHIPPED },
              { id: 'CANCELLED', label: 'Cancelados', count: statusCounts.CANCELLED },
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
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isActive ? 'bg-catalog-gold text-[#010E31] font-bold' : 'bg-[#050B14] text-catalog-muted'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Campo de Busca Rápida */}
          <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-catalog-gold" />
            <input
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
          data={filteredOrders}
          isLoading={isLoading}
          onSelectOrder={(id) => setSelectedOrderId(id)}
        />
      </div>

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
