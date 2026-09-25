'use client'

import * as React from 'react'
import {
  DataTable,
  ColumnDef,
  EmptyState
} from '@/components/ui'
import { User, Phone, Mail, ShoppingBag, Calendar, Eye, Search } from 'lucide-react'

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
  if (!isoString) return '—'

  const now = new Date()
  const date = new Date(isoString)
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Hoje'
  if (diffDays === 1) return 'Ontem'
  if (diffDays < 7) return `Há ${diffDays} dias`
  if (diffDays < 30) return `Há ${Math.floor(diffDays / 7)} sem.`
  if (diffDays < 365) return `Há ${Math.floor(diffDays / 30)} meses`
  return `Há ${Math.floor(diffDays / 365)} anos`
}

export function CustomersTable({ data, isLoading, onSelectCustomer }: CustomersTableProps) {
  const columns: ColumnDef<CustomerRow>[] = [
    {
      key: 'name',
      header: 'Cliente',
      render: (val, row) => {
        const initials = String(val)
          .split(' ')
          .slice(0, 2)
          .map((n) => n[0])
          .join('')
          .toUpperCase()

        return (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0B132B] to-[#1E293B] border border-catalog-gold/40 flex items-center justify-center text-catalog-gold font-bold text-xs shrink-0 shadow-[0_0_10px_rgba(240,180,14,0.15)]">
              {initials}
            </div>
            <div className="min-w-0">
              <span className="font-semibold text-white block truncate hover:text-catalog-gold transition-colors">
                {String(val)}
              </span>
              <span className="text-[11px] text-catalog-muted font-mono flex items-center gap-1 sm:hidden">
                <Mail className="w-3 h-3 text-catalog-gold/70" />
                {row.email}
              </span>
            </div>
          </div>
        )
      }
    },
    {
      key: 'email',
      header: 'Email / Contato',
      render: (val, row) => (
        <div className="space-y-0.5">
          <div className="text-neutral-300 font-mono text-xs flex items-center gap-1.5">
            <Mail className="w-3 h-3 text-catalog-gold/70 shrink-0" />
            <span className="truncate max-w-[200px]">{String(val)}</span>
          </div>
          {row.phone && (
            <div className="text-catalog-muted font-mono text-[11px] flex items-center gap-1.5">
              <Phone className="w-2.5 h-2.5 text-catalog-gold/50 shrink-0" />
              <span>{row.phone}</span>
            </div>
          )}
        </div>
      )
    },
    {
      key: 'totalOrders',
      header: 'Pedidos',
      align: 'center',
      render: (val) => {
        const count = Number(val || 0)
        return (
          <span
            className={`font-mono font-bold text-xs px-2.5 py-0.5 rounded-full border ${
              count > 0
                ? 'bg-catalog-gold/15 text-catalog-gold border-catalog-gold/40'
                : 'bg-white/5 text-neutral-400 border-white/10'
            }`}
          >
            {count} {count === 1 ? 'pedido' : 'pedidos'}
          </span>
        )
      }
    },
    {
      key: 'totalSpent',
      header: 'Total Gasto (LTV)',
      align: 'right',
      render: (val) => {
        const amount = typeof val === 'number' ? val : 0
        return (
          <span className="font-mono font-bold text-catalog-gold text-sm">
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
      header: 'Último Pedido',
      render: (val) => (
        <span className="text-catalog-muted font-mono text-xs">
          {formatRelativeDate(val as string | null)}
        </span>
      )
    },
    {
      key: 'createdAt',
      header: 'Membro Desde',
      render: (val) => {
        const date = new Date(val as string)
        return (
          <span className="text-catalog-muted font-mono text-xs">
            {new Intl.DateTimeFormat('pt-BR', {
              dateStyle: 'medium'
            }).format(date)}
          </span>
        )
      }
    },
    {
      key: 'id',
      header: 'Ações',
      align: 'center',
      render: (_, row) => (
        <button
          onClick={() => onSelectCustomer(row.id)}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-mono font-semibold bg-white/5 border border-catalog-gold/30 text-white hover:text-catalog-gold hover:border-catalog-gold hover:bg-catalog-gold/10 transition-all shadow-[0_0_10px_rgba(240,180,14,0.05)] hover:shadow-[0_0_15px_rgba(240,180,14,0.25)] cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5 text-catalog-gold" />
          <span>Ver Perfil</span>
        </button>
      )
    }
  ]

  return (
    <div className="bg-catalog-card border border-catalog-gold/30 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl">
      <DataTable
        columns={columns}
        data={data}
        keyExtractor={(row) => row.id}
        isLoading={isLoading}
        emptyState={
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-white/5 border border-catalog-gold/30 flex items-center justify-center mx-auto text-catalog-gold">
              <Search className="w-5 h-5" />
            </div>
            <p className="text-white font-semibold text-sm">Nenhum cliente localizado</p>
            <p className="text-xs text-catalog-muted max-w-sm mx-auto font-light">
              Tente refinar sua busca por nome ou e-mail para encontrar o registro desejado.
            </p>
          </div>
        }
      />
    </div>
  )
}