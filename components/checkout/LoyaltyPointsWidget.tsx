'use client'

import React, { useState, useEffect } from 'react'
import { Award, Sparkles, AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react'

interface LoyaltyPointsWidgetProps {
  lojaID: string
  subtotal: number
  onPointsApplied: (applied: { pointsToRedeem: number; discountValue: number }) => void
}

interface WalletData {
  balance: number
  monetaryBalance: number
  pending: number
}

interface SimulationData {
  eligible: boolean
  pointsToRedeem: number
  discountValue: number
  subtotalAfterDiscount: number
  projectedEarnedPoints: number
  reason?: string
}

export function LoyaltyPointsWidget({
  lojaID,
  subtotal,
  onPointsApplied,
}: LoyaltyPointsWidgetProps) {
  const [wallet, setWallet] = useState<WalletData | null>(null)
  const [loading, setLoading] = useState(true)
  const [usePoints, setUsePoints] = useState(false)
  const [requestedPoints, setRequestedPoints] = useState<number>(0)
  const [simulation, setSimulation] = useState<SimulationData | null>(null)
  const [isSimulating, setIsSimulating] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(true)

  // 1. Carregar carteira do cliente autenticado
  useEffect(() => {
    async function loadWallet() {
      if (!lojaID) return
      setLoading(true)
      try {
        const res = await fetch('/api/loyalty/wallet')
        if (res.status === 401) {
          setIsAuthenticated(false)
          setLoading(false)
          return
        }
        const data = await res.json()
        if (data.success && data.data?.wallet) {
          setWallet(data.data.wallet)
          setRequestedPoints(data.data.wallet.balance)
        }
      } catch (err) {
        console.error('Erro ao carregar carteira de pontos:', err)
      } finally {
        setLoading(false)
      }
    }
    loadWallet()
  }, [lojaID])

  // 2. Simular desconto de pontos sempre que subtotal, usePoints ou requestedPoints mudar
  useEffect(() => {
    async function runSimulation() {
      if (!lojaID || subtotal <= 0) return

      setIsSimulating(true)
      try {
        const res = await fetch('/api/loyalty/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lojaID,
            subtotal,
            requestedPoints: usePoints ? requestedPoints : 0,
          }),
        })

        const json = await res.json()
        if (json.success && json.data) {
          setSimulation(json.data)
          if (usePoints && json.data.eligible) {
            onPointsApplied({
              pointsToRedeem: json.data.pointsToRedeem,
              discountValue: json.data.discountValue,
            })
          } else {
            onPointsApplied({
              pointsToRedeem: 0,
              discountValue: 0,
            })
          }
        }
      } catch (err) {
        console.error('Erro ao simular pontos:', err)
      } finally {
        setIsSimulating(false)
      }
    }

    runSimulation()
  }, [lojaID, subtotal, usePoints, requestedPoints])

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 bg-zinc-50 dark:bg-zinc-900/40 animate-pulse">
        <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3 mb-2" />
        <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2" />
      </div>
    )
  }

  // Se não estiver logado, exibe banner informativo sutil sobre os pontos
  if (!isAuthenticated) {
    return (
      <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent p-4.5 transition-all">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div className="flex-1 text-xs">
            <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm flex items-center gap-1.5">
              Programa de Pontos & Fidelidade
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            </p>
            <p className="text-zinc-600 dark:text-zinc-400 mt-0.5 leading-relaxed">
              Você acumulará pontos nesta compra! Faça login para resgatar saldos e descontos exclusivos.
            </p>
            {simulation && simulation.projectedEarnedPoints > 0 && (
              <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium text-[11px]">
                +{simulation.projectedEarnedPoints} pontos previstos após o pagamento
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const hasPoints = wallet && wallet.balance > 0

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/50 backdrop-blur-md p-5 shadow-sm space-y-4">
      {/* Header do Card */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/20 flex items-center justify-center text-amber-500">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              Programa de Fidelidade
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-mono font-medium">
                VIP
              </span>
            </h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Você possui <strong className="text-zinc-900 dark:text-zinc-200">{wallet?.balance ?? 0} pontos</strong>
              {wallet && wallet.monetaryBalance > 0 && (
                <span> (equivalente a R$ {wallet.monetaryBalance.toFixed(2).replace('.', ',')})</span>
              )}
            </p>
          </div>
        </div>

        {/* Toggle para usar pontos */}
        {hasPoints && (
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={usePoints}
              onChange={(e) => setUsePoints(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-zinc-300 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500" />
          </label>
        )}
      </div>

      {/* Seção quando o toggle está ativo */}
      {usePoints && hasPoints && (
        <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800/60 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-600 dark:text-zinc-400">Quantidade de pontos a resgatar:</span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100 font-mono">
              {requestedPoints} pts
            </span>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={wallet.balance}
              value={requestedPoints}
              onChange={(e) => setRequestedPoints(Number(e.target.value))}
              className="w-full h-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <button
              type="button"
              onClick={() => setRequestedPoints(wallet.balance)}
              className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-colors shrink-0"
            >
              Usar Tudo
            </button>
          </div>

          {/* Resultado da Simulação */}
          {simulation && (
            <div className="mt-2">
              {simulation.eligible ? (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Desconto de fidelidade aplicado:</span>
                  </div>
                  <strong className="font-mono text-sm">
                    - R$ {simulation.discountValue.toFixed(2).replace('.', ',')}
                  </strong>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{simulation.reason || 'Pontos insuficientes para esta compra.'}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Rodapé Informativo: Projeção de Acúmulo Futuro */}
      {simulation && simulation.projectedEarnedPoints > 0 && (
        <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 pt-2 border-t border-zinc-200/50 dark:border-zinc-800/40">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" />
            Bônus acumulado nesta compra:
          </span>
          <span className="font-semibold text-amber-500 font-mono">
            +{simulation.projectedEarnedPoints} pontos
          </span>
        </div>
      )}
    </div>
  )
}
