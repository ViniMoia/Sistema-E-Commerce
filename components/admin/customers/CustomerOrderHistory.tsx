'use client'

import * as React from 'react'
import {
  DataTable,
  ColumnDef,
  Badge,
  EmptyState
} from '@/components/ui'
import { OrderStatus } from '@prisma/client'

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
  { value: 'PENDING', label: 'Pendente' },
  { value: 'PAID', label: 'Pago' },
  { value: 'SHIPPED', label: 'Enviado' },
  { value: 'DELIVERED', label: 'Entregue' },
  { value: 'CANCELLED', label: 'Cancelado' },
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
          throw new Error('Formato de resposta inv\u00e1lido')
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
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    )
  }

  const columns: ColumnDef<OrderHistoryItem>[] = [
    {
      key: 'orderNumber',
      header: '#',
      render: (val) => (
        <span className="font-medium text-zinc-100">
          {String(val)}
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
      header: 'Data',
      render: (val) => (
        <span className="text-zinc-400">
          {new Intl.DateTimeFormat('pt-BR', {
            dateStyle: 'short',
            timeStyle: 'short'
          }).format(new Date(String(val)))}
        </span>
      )
    },
    {
      key: 'itemCount',
      header: 'Itens',
      align: 'center',
      render: (val) => (
        <span className="text-zinc-400">
          {String(val)}
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
          <span className="text-zinc-400">
            {value === null || value === 0
              ? 'Gr\u00e1tis'
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
      header: 'Total',
      align: 'right',
      render: (val) => {
        const total = typeof val === 'number' ? val : parseFloat(String(val || '0'))
        return (
          <span className="font-medium text-zinc-100">
            {new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL'
            }).format(total)}
          </span>
        )
      }
    },
    {
      key: 'deliveryType',
      header: 'Entrega',
      render: (val) => (
        <span className="text-zinc-400">
          {String(val) === 'DELIVERY' ? 'Entrega' : 'Retirada'}
        </span>
      )
    }
  ]

  return (
    <div className="space-y-4">
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        className="flex h-9 w-full max-w-[200px] items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#dbb501] focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {statusOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <DataTable
        columns={columns}
        data={filteredOrders}
        keyExtractor={(row) => row.id}
        isLoading={isLoading}
        emptyState={
          <EmptyState
            title="Nenhum pedido encontrado para este cliente"
          />
        }
      />
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