'use client'

import React, { useState, useEffect } from 'react'
import {
  Award,
  Sparkles,
  TrendingUp,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Coins,
  DollarSign
} from 'lucide-react'
import type { LoyaltyStatementResult, LoyaltyStatementItem } from '@/types/loyalty.types'

export function LoyaltyHistoryView() {
  const [statement, setStatement] = useState<LoyaltyStatementResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const limit = 10

  const loadStatement = async (pageNumber: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/loyalty/wallet?page=${pageNumber}&limit=${limit}`)
      const data = await res.json()
      if (data.success && data.data) {
        setStatement(data.data)
      }
    } catch (err) {
      console.error('Erro ao carregar extrato de fidelidade:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatement(page)
  }, [page])

  const getBadgeForType = (type: string, points: number) => {
    switch (type) {
      case 'EARN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <ArrowDownLeft className="w-3.5 h-3.5" />
            +{points} pts
          </span>
        )
      case 'REDEEM':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <ArrowUpRight className="w-3.5 h-3.5" />
            {points} pts
          </span>
        )
      case 'REFUND_EARN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <RefreshCw className="w-3.5 h-3.5" />
            Estorno {points} pts
          </span>
        )
      case 'REFUND_REDEEM':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            <RefreshCw className="w-3.5 h-3.5" />
            Devolução +{points} pts
          </span>
        )
      case 'ADMIN_ADJUSTMENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30">
            <ShieldCheck className="w-3.5 h-3.5" />
            Ajuste {points > 0 ? `+${points}` : points} pts
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-white/5 text-neutral-300 border border-white/10">
            {points > 0 ? `+${points}` : points} pts
          </span>
        )
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header com Título */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-catalog-gold/20 pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-continental-display text-white tracking-tight flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-catalog-gold/15 border border-catalog-gold/30 flex items-center justify-center text-catalog-gold">
              <Award className="w-4 h-4" />
            </div>
            <span>Programa de Fidelidade & Pontos</span>
          </h2>
          <p className="text-xs text-catalog-muted font-light mt-1">
            Acumule pontos em cada pedido e converta seu saldo acumulado em descontos diretos no checkout.
          </p>
        </div>

        <button
          onClick={() => loadStatement(page)}
          disabled={loading}
          className="p-2 rounded-xl bg-white/5 border border-white/10 text-catalog-muted hover:text-catalog-gold hover:border-catalog-gold/40 transition-all cursor-pointer self-start sm:self-auto"
          title="Atualizar extrato"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-catalog-gold' : ''}`} />
        </button>
      </div>

      {/* Cards de Métricas em Destaque */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Saldo Disponível */}
        <div className="rounded-2xl bg-catalog-card p-6 border border-catalog-gold/40 shadow-2xl relative overflow-hidden group hover:border-catalog-gold transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-catalog-gold uppercase tracking-wider flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5" />
              Saldo Disponível
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold tracking-widest uppercase">
              Ativo
            </span>
          </div>
          <div className="mt-4">
            <p className="text-4xl font-bold font-mono text-catalog-gold tracking-tight">
              {statement?.wallet.balance.toLocaleString('pt-BR') ?? 0}
              <span className="text-base font-normal text-white ml-2">pts</span>
            </p>
            <p className="text-xs font-mono text-catalog-muted mt-1.5 flex items-center gap-1.5">
              <span>Equivalente a</span>
              <strong className="text-white font-bold">
                R$ {(statement?.wallet.monetaryBalance ?? 0).toFixed(2).replace('.', ',')}
              </strong>
              <span>em descontos</span>
            </p>
          </div>
        </div>

        {/* Card 2: Pontos Pendentes */}
        <div className="rounded-2xl bg-catalog-card p-6 border border-catalog-gold/25 shadow-xl relative overflow-hidden group hover:border-catalog-gold/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-medium text-catalog-muted uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-catalog-gold" />
              Pontos Pendentes
            </span>
          </div>
          <div className="mt-4">
            <p className="text-3xl font-bold font-mono text-white tracking-tight">
              {statement?.wallet.pending.toLocaleString('pt-BR') ?? 0}
              <span className="text-sm font-normal text-catalog-muted ml-2">pts</span>
            </p>
            <p className="text-[11px] text-catalog-muted font-light mt-1.5">
              Liberados automaticamente após confirmação de pagamento
            </p>
          </div>
        </div>

        {/* Card 3: Total Vitalício Acumulado */}
        <div className="rounded-2xl bg-catalog-card p-6 border border-catalog-gold/25 shadow-xl relative overflow-hidden group hover:border-catalog-gold/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-medium text-catalog-muted uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              Total Já Acumulado
            </span>
          </div>
          <div className="mt-4">
            <p className="text-3xl font-bold font-mono text-emerald-400 tracking-tight">
              {statement?.wallet.lifetimeEarn.toLocaleString('pt-BR') ?? 0}
              <span className="text-sm font-normal text-neutral-300 ml-2">pts</span>
            </p>
            <p className="text-[11px] text-catalog-muted font-light mt-1.5">
              Histórico vitalício de recompensas recebidas na loja
            </p>
          </div>
        </div>
      </div>

      {/* Tabela de Extrato de Movimentações */}
      <div className="bg-catalog-card border border-catalog-gold/30 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl">
        <div className="px-6 py-4 border-b border-catalog-gold/25 bg-[#050B14] flex items-center justify-between">
          <div className="flex items-center gap-2 text-catalog-gold text-xs font-mono uppercase tracking-wider font-semibold">
            <Coins className="w-3.5 h-3.5" />
            <span>Extrato de Movimentações da Carteira</span>
          </div>
          <span className="text-xs font-mono text-catalog-muted">
            Total: {statement?.total ?? 0} registros
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-catalog-muted font-mono text-xs animate-pulse">
            Carregando extrato de fidelidade...
          </div>
        ) : !statement?.items || statement.items.length === 0 ? (
          <div className="p-16 text-center space-y-2">
            <Award className="w-8 h-8 text-catalog-gold/60 mx-auto" />
            <p className="text-white font-semibold text-sm">Nenhuma movimentação registrada</p>
            <p className="text-xs text-catalog-muted font-light max-w-sm mx-auto">
              Realize compras na loja para começar a acumular pontos e resgatar descontos exclusivos!
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#050B14] border-b border-catalog-gold/30">
                  <th className="py-4 px-6 text-[11px] font-mono font-bold uppercase tracking-wider text-catalog-gold">
                    Data / Hora
                  </th>
                  <th className="py-4 px-6 text-[11px] font-mono font-bold uppercase tracking-wider text-catalog-gold">
                    Descrição do Lançamento
                  </th>
                  <th className="py-4 px-6 text-[11px] font-mono font-bold uppercase tracking-wider text-catalog-gold text-center">
                    Movimentação
                  </th>
                  <th className="py-4 px-6 text-[11px] font-mono font-bold uppercase tracking-wider text-catalog-gold text-right">
                    Saldo Resultante
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-catalog-gold/15 text-xs font-mono">
                {statement.items.map((item: LoyaltyStatementItem) => {
                  const date = new Date(item.createdAt)
                  const formattedDate = date.toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })
                  const formattedTime = date.toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })

                  return (
                    <tr key={item.id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="py-4 px-6 whitespace-nowrap text-catalog-muted">
                        <div className="font-semibold text-white">{formattedDate}</div>
                        <div className="text-[10px] text-catalog-muted">{formattedTime}</div>
                      </td>
                      <td className="py-4 px-6 text-neutral-200">
                        <p className="font-medium text-white">{item.description}</p>
                        {item.monetaryValue && item.monetaryValue > 0 && (
                          <span className="text-[11px] text-catalog-gold">
                            Equivalente: R$ {item.monetaryValue.toFixed(2).replace('.', ',')}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-center whitespace-nowrap">
                        {getBadgeForType(item.type, item.points)}
                      </td>
                      <td className="py-4 px-6 text-right whitespace-nowrap font-mono font-bold text-catalog-gold">
                        {item.balanceAfter.toLocaleString('pt-BR')} pts
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginação */}
        {statement && statement.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-catalog-gold/20 bg-[#050B14] flex items-center justify-between text-xs font-mono text-catalog-muted">
            <span>
              Página {statement.page} de {statement.totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="p-1.5 rounded-lg border border-catalog-gold/30 bg-[#0B132B] hover:border-catalog-gold text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(statement.totalPages, p + 1))}
                disabled={page >= statement.totalPages || loading}
                className="p-1.5 rounded-lg border border-catalog-gold/30 bg-[#0B132B] hover:border-catalog-gold text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
