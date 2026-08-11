'use client'

import * as React from 'react'
import { StatCard } from '@/components/ui'
import { SkeletonRow } from '@/components/ui'
import { ShoppingBag, DollarSign, ChartBar, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CustomerMetrics {
  totalOrders: number
  totalSpent: number
  averageOrderValue: number
  firstOrderAt: string | null
  lastOrderAt: string | null
  mostBoughtProduct: string | null
  preferredDeliveryType: 'DELIVERY' | 'PICKUP' | null
  cancelledOrders: number
}

interface CustomerMetricsPanelProps {
  metrics: CustomerMetrics
  isLoading: boolean
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value)
}

function formatDate(isoString: string | null): string {
  if (!isoString) return 'N/A'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'long'
  }).format(new Date(isoString))
}

function formatPreferredDelivery(type: CustomerMetrics['preferredDeliveryType']): string {
  if (!type) return 'N/A'
  return type === 'DELIVERY' ? 'Entrega' : 'Retirada'
}

export function CustomerMetricsPanel({ metrics, isLoading }: CustomerMetricsPanelProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 mb-6">
        {[0, 1, 2, 3].map((_, index) => (
          <div key={`skeleton-${index}`} className="h-[100px] w-full bg-zinc-200/60 dark:bg-white/5 animate-pulse rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 mb-6">
        <StatCard
          title="Total de Pedidos"
          value={metrics.totalOrders}
          icon={<ShoppingBag className="h-4 w-4 text-zinc-400" />}
        />
        <StatCard
          title="Total Gasto"
          value={formatCurrency(metrics.totalSpent)}
          icon={<DollarSign className="h-4 w-4 text-zinc-400" />}
        />
        <StatCard
          title="Ticket Médio"
          value={formatCurrency(metrics.averageOrderValue)}
          icon={<ChartBar className="h-4 w-4 text-zinc-400" />}
        />
        <StatCard
          title="Pedidos Cancelados"
          value={metrics.cancelledOrders}
          icon={<X className="h-4 w-4" />}
          className={cn(
            metrics.cancelledOrders > 0 && 'border-red-400'
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 text-zinc-400 text-sm">
        <div>
          <p className="font-medium mb-1">Produto mais comprado</p>
          <p>{metrics.mostBoughtProduct ?? 'N/A'}</p>
        </div>
        <div>
          <p className="font-medium mb-1">Entrega preferida</p>
          <p>{formatPreferredDelivery(metrics.preferredDeliveryType)}</p>
        </div>
        <div>
          <p className="font-medium mb-1">Primeiro pedido</p>
          <p>{formatDate(metrics.firstOrderAt)}</p>
        </div>
        <div>
          <p className="font-medium mb-1">Último pedido</p>
          <p>{formatDate(metrics.lastOrderAt)}</p>
        </div>
      </div>
    </div>
  )
}