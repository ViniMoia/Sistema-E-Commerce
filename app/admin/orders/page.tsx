'use client'

import * as React from 'react'
import { OrdersTable, OrderRow } from '@/components/admin/orders/OrdersTable'
import { AlertBanner } from '@/components/ui'
import { OrderDetailDrawer } from '@/components/admin/orders/OrderDetailDrawer'
import { OrderStatus } from '@prisma/client'

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
        // Map to standard OrderRow shape
        const mapped = ordersArray.map((o: any) => ({
          id: o.id,
          orderNumber: parseInt(o.id.replace(/\D/g, '')) || 0, // Extract numeric part or default to 0
          createdAt: o.createdAt,
          customerName: o.customer?.name || o.user?.name || 'Sem nome',
          customerEmail: o.customer?.email || o.user?.email || '',
          status: o.status,
          deliveryType: o.deliveryType || 'DELIVERY', // Use API value or default
          total: typeof o.total === 'number' ? o.total : parseFloat(o.total || '0'),
          freightValue: typeof o.freightValue === 'number' ? o.freightValue : parseFloat(o.freightValue || '0')
        }))
        setOrders(mapped)
      } else {
        throw new Error('Formato inválido: ' + JSON.stringify(json).substring(0, 100))
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Ocorreu um erro desconhecido')
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
      const matchSearch = searchTerm === '' || order.customerName.toLowerCase().includes(searchTerm.toLowerCase())
      return matchStatus && matchSearch
    })
  }, [orders, statusFilter, searchTerm])

  return (
    <div className="flex-1 space-y-8 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Pedidos
          </h2>
          <p className="text-muted-foreground mt-2 text-zinc-500">
            Gerencie e acompanhe todos os pedidos da loja.
          </p>
        </div>
      </div>

      {error && (
        <AlertBanner
          variant="error"
          title="Erro"
          message={error}
        />
      )}

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <input
          type="text"
          placeholder="Buscar por nome do cliente..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-offset-zinc-950 dark:placeholder:text-zinc-400 dark:focus-visible:ring-zinc-300 sm:max-w-sm"
        />
        
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="flex h-10 w-full items-center justify-between rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-offset-zinc-950 dark:placeholder:text-zinc-400 dark:focus:ring-zinc-300 sm:max-w-[200px]"
        >
          <option value="ALL">Todos os Status</option>
          <option value="PENDING">Pendente</option>
          <option value="PAID">Pago</option>
          <option value="SHIPPED">Enviado</option>
          <option value="DELIVERED">Entregue</option>
          <option value="CANCELLED">Cancelado</option>
        </select>
      </div>

      <OrdersTable
        data={filteredOrders}
        isLoading={isLoading}
        onSelectOrder={setSelectedOrderId}
      />

       {selectedOrderId && (
         <OrderDetailDrawer
           orderId={selectedOrderId}
           onClose={() => setSelectedOrderId(null)}
           onStatusUpdate={fetchOrders}
         />
       )}
    </div>
  )
}
