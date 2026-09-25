'use client'

import * as React from 'react'
import {
  DataTable,
  ColumnDef,
  Badge
} from '@/components/ui'
import { OrderStatus } from '@prisma/client'
import { ShoppingCart, Filter, AlertCircle, Package } from 'lucide-react'

interface OrderHistoryItem {
  id: string
  orderNumber: number
  status: string
  createdAt: string
  total: number
  freightValue: number | null
  deliveryType: 'DELIVERY' | 'PICKUP'
  itemCount: number
}

interface CustomerOrderHistoryProps {
  customerId: string
}

const statusOptions = [
  { value: 'ALL', label: 'Todos os Status' },
  { value: 'PENDING', label: 'Pendentes' },
  { value: 'PAID', label: 'Pagos' },
  { value: 'SHIPPED', label: 'Enviados' },
  { value: 'DELIVERED', label: 'Entregues' },
  { value: 'CANCELLED', label: 'Cancelados' },
] as const

export function CustomerOrderHistory({ customerId }: CustomerOrderHistoryProps) {
  const [orders, setOrders] = React.useState<OrderHistoryItem[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [statusFilter, setStatusFilter] = React.useState('ALL')

  React.useEffect(() => {
    async function fetchOrders() {
      try {
        setIsLoading(true)
        setError(null)
        const res = await fetch(`/api/admin/orders?customerId=${encodeURIComponent(customerId)}`)
        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.error || 'Erro ao carregar pedidos')
        }
        const json = await res.json()
        if (json.success && json.data && Array.isArray(json.data.data)) {
          const mapped = json.data.data.map(mapOrder)
          setOrders(mapped)
        } else {
          throw new Error('Formato de resposta inválido')
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
    }
    fetchOrders()
  }, [customerId])

  const filteredOrders = React.useMemo(() => {
    if (statusFilter === 'ALL') return orders
    return orders.filter(order => order.status === statusFilter)
  }, [orders, statusFilter])

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-950/40 p-4 text-xs font-mono text-red-400 flex items-center gap-2">
        <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
        <span>{error}</span>
      </div>
    )
  }

  const columns: ColumnDef<OrderHistoryItem>[] = [
    {
      key: 'orderNumber',
      header: 'Pedido #',
      render: (val) => (
        <span className="font-mono font-bold text-catalog-gold text-xs">
          #{String(val).padStart(5, '0')}
        </span>
      )
    },
    {
      key: 'status',
      header: 'Status',
      render: (val) => (
        <Badge status={String(val) as OrderStatus} />
      )
    },
    {
      key: 'createdAt',
      header: 'Data / Hora',
      render: (val) => (
        <span className="text-catalog-muted font-mono text-[11px]">
          {new Intl.DateTimeFormat('pt-BR', {
            dateStyle: 'short',
            timeStyle: 'short'
          }).format(new Date(String(val)))}
        </span>
      )
    },
    {
      key: 'deliveryType',
      header: 'Entrega',
      render: (val) => (
        <span className="text-neutral-300 font-mono text-xs">
          {String(val) === 'DELIVERY' ? 'Domicílio' : 'Retirada'}
        </span>
      )
    },
    {
      key: 'freightValue',
      header: 'Frete',
      align: 'right',
      render: (val) => {
        const value = val != null
          ? (typeof val === 'number' ? val : parseFloat(String(val)))
          : null
        return (
          <span className="text-catalog-muted font-mono text-xs">
            {value === null || value === 0
              ? 'Grátis'
              : new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL'
                }).format(value)}
          </span>
        )
      }
    },
    {
      key: 'total',
      header: 'Total Pago',
      align: 'right',
      render: (val) => {
        const total = typeof val === 'number' ? val : parseFloat(String(val || '0'))
        return (
          <span className="font-mono font-bold text-white text-xs">
            {new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL'
            }).format(total)}
          </span>
        )
      }
    }
  ]

  return (
    <div className="space-y-3">
      {/* Barra de Filtro de Status */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-catalog-gold" />
          <span className="text-xs font-mono uppercase text-catalog-muted tracking-wider">
            Filtrar:
          </span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 rounded-lg border border-catalog-gold/30 bg-[#0B132B] px-3 text-xs font-mono text-white focus:outline-none focus:border-catalog-gold transition-all"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value} className="bg-[#050B14] text-white">
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <span className="text-xs font-mono text-catalog-muted">
          {filteredOrders.length} {filteredOrders.length === 1 ? 'pedido' : 'pedidos'}
        </span>
      </div>

      {/* Tabela do Histórico */}
      <div className="bg-[#050B14] border border-catalog-gold/20 rounded-xl overflow-hidden shadow-lg">
        <DataTable
          columns={columns}
          data={filteredOrders}
          keyExtractor={(row) => row.id}
          isLoading={isLoading}
          emptyState={
            <div className="py-10 text-center space-y-2">
              <Package className="w-6 h-6 text-catalog-gold/60 mx-auto" />
              <p className="text-xs font-mono text-catalog-muted">
                Nenhum pedido encontrado com este critério.
              </p>
            </div>
          }
        />
      </div>
    </div>
  )
}

function mapOrder(raw: Record<string, unknown>): OrderHistoryItem {
  return {
    id: String(raw.id || ''),
    orderNumber: Number(raw.orderNumber || 0),
    status: String(raw.status || ''),
    createdAt: String(raw.createdAt || ''),
    total: typeof raw.total === 'number' ? raw.total : parseFloat(String(raw.total || '0')),
    freightValue: raw.freightValue != null
      ? (typeof raw.freightValue === 'number' ? raw.freightValue : parseFloat(String(raw.freightValue)))
      : null,
    deliveryType: raw.deliveryType === 'DELIVERY' ? 'DELIVERY' : 'PICKUP',
    itemCount: 0
  }
}