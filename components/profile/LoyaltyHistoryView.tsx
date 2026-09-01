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
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <ArrowDownLeft className="w-3.5 h-3.5" />
            +{points} pts
          </span>
        )
      case 'REDEEM':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <ArrowUpRight className="w-3.5 h-3.5" />
            {points} pts
          </span>
        )
      case 'REFUND_EARN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <RefreshCw className="w-3.5 h-3.5" />
            Estorno {points} pts
          </span>
        )
      case 'REFUND_REDEEM':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/20">
            <RefreshCw className="w-3.5 h-3.5" />
            Devolução +{points} pts
          </span>
        )
      case 'ADMIN_ADJUSTMENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-500 border border-purple-500/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            Ajuste {points > 0 ? `+${points}` : points} pts
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
            {points > 0 ? `+${points}` : points} pts
          </span>
        )
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header com Título */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Award className="w-6 h-6" />
            </div>
            Programa de Fidelidade & Pontos
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Acompanhe seu saldo acumulado, resgates e extrato detalhado de recompensas.
          </p>
        </div>
      </div>

      {/* Cards de Métricas em Destaque */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Saldo Disponível */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500/15 via-zinc-900/60 to-zinc-950 p-6 border border-amber-500/25 shadow-[0_0_25px_rgba(245,158,11,0.08)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-400 tracking-wider uppercase flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Saldo Disponível
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold tracking-widest uppercase">
              Ativo
            </span>
          </div>
          <div className="mt-4">
            <p className="text-4xl font-black text-white font-mono tracking-tight">
              {statement?.wallet.balance.toLocaleString('pt-BR') ?? 0}
              <span className="text-lg font-sans font-medium text-amber-400 ml-1.5">pts</span>
            </p>
            <p className="text-xs text-zinc-400 mt-1.5 flex items-center gap-1">
              Equivalente a{' '}
              <strong className="text-white font-semibold font-mono">
                R$ {(statement?.wallet.monetaryBalance ?? 0).toFixed(2).replace('.', ',')}
              </strong>{' '}
              em descontos
            </p>
          </div>
        </div>

        {/* Card 2: Pontos Pendentes */}
        <div className="rounded-2xl bg-zinc-900/50 p-6 border border-white/5 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400 tracking-wider uppercase flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-zinc-400" />
              Pontos Pendentes
            </span>
          </div>
          <div className="mt-4">
            <p className="text-3xl font-bold text-zinc-300 font-mono tracking-tight">
              {statement?.wallet.pending.toLocaleString('pt-BR') ?? 0}
              <span className="text-sm font-sans font-medium text-zinc-500 ml-1.5">pts</span>
            </p>
            <p className="text-xs text-zinc-500 mt-1.5">
              Liberados automaticamente após confirmação de pagamento
            </p>
          </div>
        </div>

        {/* Card 3: Total Vitalício Acumulado */}
        <div className="rounded-2xl bg-zinc-900/50 p-6 border border-white/5 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400 tracking-wider uppercase flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              Total Já Acumulado
            </span>
          </div>
          <div className="mt-4">
            <p className="text-3xl font-bold text-zinc-200 font-mono tracking-tight">
              {statement?.wallet.lifetimeEarn.toLocaleString('pt-BR') ?? 0}
              <span className="text-sm font-sans font-medium text-zinc-500 ml-1.5">pts</span>
            </p>
            <p className="text-xs text-zinc-500 mt-1.5">
              Histórico vitalício de fidelidade nesta loja
            </p>
          </div>
        </div>
      </div>

      {/* Tabela de Extrato de Movimentações */}
      <div className="rounded-2xl bg-zinc-900/40 border border-white/5 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">Extrato de Movimentações</h3>
          <span className="text-xs text-zinc-400">
            Total de {statement?.total ?? 0} registros
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-zinc-500 animate-pulse">
            Carregando extrato de fidelidade...
          </div>
        ) : !statement?.items || statement.items.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 space-y-3">
            <AlertCircle className="w-10 h-10 mx-auto text-zinc-600 stroke-[1.5]" />
            <p className="text-sm">Nenhuma movimentação de pontos registrada até o momento.</p>
            <p className="text-xs text-zinc-600">
              Faça compras na loja para começar a acumular pontos e resgatar descontos!
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.02] text-xs font-semibold uppercase text-zinc-400 border-b border-white/5">
                <tr>
                  <th className="px-6 py-3.5">Data / Hora</th>
                  <th className="px-6 py-3.5">Descrição</th>
                  <th className="px-6 py-3.5 text-center">Movimentação</th>
                  <th className="px-6 py-3.5 text-right">Saldo Após</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
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
                    <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-zinc-400">
                        <div className="font-medium text-zinc-300">{formattedDate}</div>
                        <div className="text-[11px] text-zinc-500">{formattedTime}</div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-white">{item.description}</p>
                        {item.monetaryValue && item.monetaryValue > 0 && (
                          <span className="text-xs text-zinc-400">
                            Valor equivalente: R$ {item.monetaryValue.toFixed(2).replace('.', ',')}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        {getBadgeForType(item.type, item.points)}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap font-mono font-semibold text-zinc-300">
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
          <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between text-xs text-zinc-400">
            <span>
              Página {statement.page} de {statement.totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(statement.totalPages, p + 1))}
                disabled={page >= statement.totalPages || loading}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-colors"
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
