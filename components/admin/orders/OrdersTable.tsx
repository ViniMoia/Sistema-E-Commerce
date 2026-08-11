'use client'

import * as React from 'react'
import {
  DataTable,
  ColumnDef,
  Badge,
  Button,
  EmptyState,
  Pagination
} from '@/components/ui'
import { OrderStatus } from '@prisma/client'

export interface OrderRow {
  id: string
  orderNumber: number
  createdAt: string
  customerName: string
  customerEmail: string
  status: OrderStatus
  deliveryType: 'DELIVERY' | 'PICKUP'
  total: number
  freightValue: number | null
}

export interface OrdersTableProps {
  data: OrderRow[]
  isLoading: boolean
  onSelectOrder: (orderId: string) => void
}

const statusMap: Record<OrderStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'outline' }> = {
  PENDING: { label: 'Pendente', variant: 'warning' },
  PAID: { label: 'Pago', variant: 'success' },
  SHIPPED: { label: 'Enviado', variant: 'default' },
  DELIVERED: { label: 'Entregue', variant: 'success' },
  CANCELLED: { label: 'Cancelado', variant: 'error' }
}

export function OrdersTable({ data, isLoading, onSelectOrder }: OrdersTableProps) {
  const columns: ColumnDef<OrderRow>[] = [
    {
      key: 'orderNumber',
      header: '#',
      render: (val) => <span className="font-medium text-zinc-900 dark:text-zinc-100">{String(val)}</span>
    },
    {
      key: 'customerName',
      header: 'Cliente'
    },
    {
      key: 'customerEmail',
      header: 'Email',
      render: (val) => <span className="text-zinc-500 dark:text-zinc-400">{String(val)}</span>
    },
    {
      key: 'status',
      header: 'Status',
      render: (val) => {
        const status = val as OrderStatus
        return <Badge status={status} />
      }
    },
    {
      key: 'deliveryType',
      header: 'Entrega',
      render: (val) => (
        <span className="text-sm">
          {val === 'DELIVERY' ? 'Entrega' : 'Retirada'}
        </span>
      )
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      render: (val) => {
        const total = typeof val === 'number' ? val : 0
        return (
          <span className="font-medium">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}
          </span>
        )
      }
    },
    {
      key: 'createdAt',
      header: 'Data',
      render: (val) => {
        const date = new Date(val as string)
        return (
          <span className="text-zinc-500 dark:text-zinc-400">
            {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)}
          </span>
        )
      }
    },
    {
      key: 'id',
      header: 'Ações',
      align: 'center',
      render: (val, row) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSelectOrder(row.id)}
          className="text-xs transition-transform hover:scale-105 active:scale-95"
        >
          Ver detalhes
        </Button>
      )
    }
  ]

  return (
    <div className="space-y-4">
      <DataTable
        columns={columns}
        data={data}
        keyExtractor={(row) => row.id}
        isLoading={isLoading}
        emptyState={<EmptyState title="Nenhum pedido encontrado" description="Tente ajustar os filtros ou realizar uma nova busca." />}
      />
    </div>
  )
}
