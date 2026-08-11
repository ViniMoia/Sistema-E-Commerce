'use client'

import * as React from 'react'
import {
  DataTable,
  ColumnDef,
  Button,
  EmptyState
} from '@/components/ui'

interface CustomerRow {
  id: string
  name: string
  email: string
  phone: string | null
  totalOrders: number
  totalSpent: number
  lastOrderAt: string | null
  createdAt: string
}

interface CustomersTableProps {
  data: CustomerRow[]
  isLoading: boolean
  onSelectCustomer: (customerId: string) => void
}

function formatRelativeDate(isoString: string | null): string {
  if (!isoString) return '\u2014'

  const now = new Date()
  const date = new Date(isoString)
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'hoje'
  if (diffDays === 1) return 'ontem'
  if (diffDays < 7) return `h\u00e1 ${diffDays} dias`
  if (diffDays < 30) return `h\u00e1 ${Math.floor(diffDays / 7)} semanas`
  if (diffDays < 365) return `h\u00e1 ${Math.floor(diffDays / 30)} meses`
  return `h\u00e1 ${Math.floor(diffDays / 365)} anos`
}

export function CustomersTable({ data, isLoading, onSelectCustomer }: CustomersTableProps) {
  const columns: ColumnDef<CustomerRow>[] = [
    {
      key: 'name',
      header: 'Cliente',
      render: (val) => (
        <span className="font-medium text-zinc-100">
          {String(val)}
        </span>
      )
    },
    {
      key: 'email',
      header: 'Email',
      render: (val) => (
        <span className="text-zinc-400">
          {String(val)}
        </span>
      )
    },
    {
      key: 'phone',
      header: 'Telefone',
      render: (val) => (
        <span className="text-zinc-400">
          {val ? String(val) : '\u2014'}
        </span>
      )
    },
    {
      key: 'totalOrders',
      header: 'Pedidos',
      align: 'center',
      render: (val) => (
        <span className="font-medium text-zinc-100">
          {String(val)}
        </span>
      )
    },
    {
      key: 'totalSpent',
      header: 'Total Gasto',
      align: 'right',
      render: (val) => {
        const amount = typeof val === 'number' ? val : 0
        return (
          <span className="font-medium text-zinc-100">
            {new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL'
            }).format(amount)}
          </span>
        )
      }
    },
    {
      key: 'lastOrderAt',
      header: '\u00daltimo Pedido',
      render: (val) => (
        <span className="text-zinc-400">
          {formatRelativeDate(val as string | null)}
        </span>
      )
    },
    {
      key: 'createdAt',
      header: 'Membro desde',
      render: (val) => {
        const date = new Date(val as string)
        return (
          <span className="text-zinc-400">
            {new Intl.DateTimeFormat('pt-BR', {
              dateStyle: 'long'
            }).format(date)}
          </span>
        )
      }
    },
    {
      key: 'id',
      header: 'A\u00e7\u00f5es',
      align: 'center',
      render: (_, row) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSelectCustomer(row.id)}
          className="text-xs transition-all hover:border-[#dbb501] hover:text-[#dbb501]"
        >
          Ver perfil
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
        emptyState={
          <EmptyState
            title="Nenhum cliente encontrado"
            description="Tente ajustar os filtros ou realizar uma nova busca."
          />
        }
      />
    </div>
  )
}