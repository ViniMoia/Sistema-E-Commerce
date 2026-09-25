'use client'

import * as React from 'react'
import {
  ShoppingBag,
  DollarSign,
  TrendingUp,
  XCircle,
  Package,
  Truck,
  Store,
  Calendar,
  Clock
} from 'lucide-react'

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
  if (!isoString) return 'Não registrado'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium'
  }).format(new Date(isoString))
}

function formatPreferredDelivery(type: CustomerMetrics['preferredDeliveryType']): { label: string; icon: React.ReactNode } {
  if (type === 'DELIVERY') {
    return {
      label: 'Entrega em Domicílio',
      icon: <Truck className="w-3.5 h-3.5 text-catalog-gold" />
    }
  }
  if (type === 'PICKUP') {
    return {
      label: 'Retirada na Loja',
      icon: <Store className="w-3.5 h-3.5 text-catalog-gold" />
    }
  }
  return {
    label: 'Não definida',
    icon: <Truck className="w-3.5 h-3.5 text-catalog-muted" />
  }
}

export function CustomerMetricsPanel({ metrics, isLoading }: CustomerMetricsPanelProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((_, index) => (
            <div
              key={`skeleton-metric-${index}`}
              className="h-24 w-full bg-[#050B14]/80 border border-catalog-gold/15 rounded-xl animate-pulse"
            />
          ))}
        </div>
      </div>
    )
  }

  const deliveryInfo = formatPreferredDelivery(metrics.preferredDeliveryType)

  return (
    <div className="space-y-4">
      {/* 4 Cards de Métricas Principais */}
      <div className="grid grid-cols-2 gap-3">
        {/* Total de Pedidos */}
        <div className="p-4 rounded-xl bg-[#050B14] border border-catalog-gold/25 shadow-lg relative overflow-hidden group hover:border-catalog-gold/50 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-catalog-muted">
              Total de Pedidos
            </span>
            <div className="w-7 h-7 rounded-lg bg-catalog-gold/15 border border-catalog-gold/30 flex items-center justify-center text-catalog-gold">
              <ShoppingBag className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-white tracking-tight">
            {metrics.totalOrders}
          </div>
          <p className="text-[10px] text-catalog-muted font-mono mt-1">
            {metrics.totalOrders === 1 ? '1 pedido realizado' : `${metrics.totalOrders} pedidos realizados`}
          </p>
        </div>

        {/* Total Gasto / LTV */}
        <div className="p-4 rounded-xl bg-[#050B14] border border-catalog-gold/30 shadow-lg relative overflow-hidden group hover:border-catalog-gold transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-catalog-gold font-semibold">
              Total Gasto (LTV)
            </span>
            <div className="w-7 h-7 rounded-lg bg-catalog-gold/20 border border-catalog-gold/40 flex items-center justify-center text-catalog-gold">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold font-mono text-catalog-gold tracking-tight">
            {formatCurrency(metrics.totalSpent)}
          </div>
          <p className="text-[10px] text-catalog-muted font-mono mt-1">
            Receita acumulada
          </p>
        </div>

        {/* Ticket Médio */}
        <div className="p-4 rounded-xl bg-[#050B14] border border-catalog-gold/25 shadow-lg relative overflow-hidden group hover:border-catalog-gold/50 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-catalog-muted">
              Ticket Médio
            </span>
            <div className="w-7 h-7 rounded-lg bg-catalog-gold/15 border border-catalog-gold/30 flex items-center justify-center text-catalog-gold">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold font-mono text-white tracking-tight">
            {formatCurrency(metrics.averageOrderValue)}
          </div>
          <p className="text-[10px] text-catalog-muted font-mono mt-1">
            Média por pedido
          </p>
        </div>

        {/* Cancelados */}
        <div
          className={`p-4 rounded-xl bg-[#050B14] shadow-lg relative overflow-hidden group transition-all ${
            metrics.cancelledOrders > 0
              ? 'border border-red-500/40 hover:border-red-500/70'
              : 'border border-catalog-gold/25 hover:border-catalog-gold/50'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-catalog-muted">
              Cancelamentos
            </span>
            <div
              className={`w-7 h-7 rounded-lg border flex items-center justify-center ${
                metrics.cancelledOrders > 0
                  ? 'bg-red-500/15 border-red-500/30 text-red-400'
                  : 'bg-white/5 border-white/10 text-neutral-400'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div
            className={`text-2xl font-bold font-mono tracking-tight ${
              metrics.cancelledOrders > 0 ? 'text-red-400' : 'text-neutral-300'
            }`}
          >
            {metrics.cancelledOrders}
          </div>
          <p className="text-[10px] text-catalog-muted font-mono mt-1">
            {metrics.cancelledOrders > 0 ? 'Pedidos não concluídos' : 'Nenhum cancelamento'}
          </p>
        </div>
      </div>

      {/* Grid com detalhes de consumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {/* Produto Mais Comprado */}
        <div className="p-3.5 rounded-xl bg-[#0B132B]/50 border border-catalog-gold/20 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-catalog-gold/10 border border-catalog-gold/30 flex items-center justify-center text-catalog-gold shrink-0 mt-0.5">
            <Package className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-wider text-catalog-gold">
              Produto Favorito
            </p>
            <p className="text-xs font-medium text-white truncate mt-0.5">
              {metrics.mostBoughtProduct ?? 'Sem dados de compra'}
            </p>
          </div>
        </div>

        {/* Entrega Preferida */}
        <div className="p-3.5 rounded-xl bg-[#0B132B]/50 border border-catalog-gold/20 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-catalog-gold/10 border border-catalog-gold/30 flex items-center justify-center text-catalog-gold shrink-0 mt-0.5">
            {deliveryInfo.icon}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-wider text-catalog-gold">
              Modalidade Preferida
            </p>
            <p className="text-xs font-medium text-white truncate mt-0.5">
              {deliveryInfo.label}
            </p>
          </div>
        </div>

        {/* Primeiro Pedido */}
        <div className="p-3.5 rounded-xl bg-[#0B132B]/50 border border-catalog-gold/20 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-catalog-gold/10 border border-catalog-gold/30 flex items-center justify-center text-catalog-gold shrink-0 mt-0.5">
            <Calendar className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-wider text-catalog-gold">
              Primeira Aquisição
            </p>
            <p className="text-xs font-mono text-neutral-300 truncate mt-0.5">
              {formatDate(metrics.firstOrderAt)}
            </p>
          </div>
        </div>

        {/* Último Pedido */}
        <div className="p-3.5 rounded-xl bg-[#0B132B]/50 border border-catalog-gold/20 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-catalog-gold/10 border border-catalog-gold/30 flex items-center justify-center text-catalog-gold shrink-0 mt-0.5">
            <Clock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-wider text-catalog-gold">
              Última Atividade
            </p>
            <p className="text-xs font-mono text-neutral-300 truncate mt-0.5">
              {formatDate(metrics.lastOrderAt)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}