'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Award, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react'
import {
  readLoyaltySimulation,
  readLoyaltyWallet,
  type LoyaltySimulationView,
  type LoyaltyWalletView,
} from '@/lib/loyalty-client'

interface LoyaltyPointsWidgetProps {
  lojaID: string
  subtotal: number
  onPointsApplied: (applied: { pointsToRedeem: number; discountValue: number }) => void
}

export function LoyaltyPointsWidget({
  lojaID,
  subtotal,
  onPointsApplied,
}: LoyaltyPointsWidgetProps) {
  const [wallet, setWallet] = useState<LoyaltyWalletView | null>(null)
  const [loading, setLoading] = useState(true)
  const [usePoints, setUsePoints] = useState(false)
  const [requestedPoints, setRequestedPoints] = useState<number>(0)
  const [simulation, setSimulation] = useState<LoyaltySimulationView | null>(null)
  const [isSimulating, setIsSimulating] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(true)
  const [walletError, setWalletError] = useState<string | null>(null)
  const [simulationError, setSimulationError] = useState<string | null>(null)

  // 1. Carregar carteira do cliente autenticado
  const loadWallet = useCallback(async () => {
    if (!lojaID) {
      setLoading(false)
      return
    }
    setLoading(true)
    setWalletError(null)
    try {
      const res = await fetch('/api/loyalty/wallet')
      if (res.status === 401) {
        setIsAuthenticated(false)
        setWallet(null)
        return
      }
      const walletData = await readLoyaltyWallet(res)
      setIsAuthenticated(true)
      setWallet(walletData)
      setRequestedPoints(walletData.balance)
    } catch {
      setWallet(null)
      setWalletError('Não foi possível consultar seu saldo de pontos. O checkout pode continuar sem resgate.')
    } finally {
      setLoading(false)
    }
  }, [lojaID])

  useEffect(() => {
    void loadWallet()
  }, [loadWallet])

  // 2. Simular desconto de pontos sempre que subtotal, usePoints ou requestedPoints mudar
  useEffect(() => {
    async function runSimulation() {
      if (!lojaID || subtotal <= 0) return

      setIsSimulating(true)
      setSimulationError(null)
      try {
        const res = await fetch('/api/loyalty/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subtotal,
            requestedPoints: usePoints ? requestedPoints : 0,
          }),
        })

        const simulationData = await readLoyaltySimulation(res)
        setSimulation(simulationData)
          if (usePoints && simulationData.eligible) {
            onPointsApplied({
              pointsToRedeem: simulationData.pointsToRedeem,
              discountValue: simulationData.discountValue,
            })
          } else {
            onPointsApplied({
              pointsToRedeem: 0,
              discountValue: 0,
            })
          }
      } catch {
        setSimulation(null)
        setSimulationError('Não foi possível validar o desconto de pontos. Nenhum desconto foi aplicado.')
        onPointsApplied({ pointsToRedeem: 0, discountValue: 0 })
      } finally {
        setIsSimulating(false)
      }
    }

    runSimulation()
  }, [lojaID, onPointsApplied, subtotal, usePoints, requestedPoints])

  if (loading) {
    return (
      <div className="rounded-2xl border border-catalog-gold/20 p-4 bg-[#0B132B]/50 animate-pulse">
        <div className="h-4 bg-catalog-gold/20 rounded w-1/3 mb-2" />
        <div className="h-3 bg-catalog-gold/10 rounded w-1/2" />
      </div>
    )
  }

  // Se não estiver logado, exibe banner informativo no padrão Continental
  if (!isAuthenticated) {
    return (
      <div className="rounded-2xl border border-catalog-gold/30 bg-[#0B132B]/60 p-4.5 transition-all">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-catalog-gold/15 text-catalog-gold border border-catalog-gold/30 shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div className="flex-1 text-xs">
            <p className="font-bold text-white uppercase font-mono tracking-wider text-xs flex items-center gap-1.5">
              Programa de Pontos & Fidelidade
              <Sparkles className="w-3.5 h-3.5 text-catalog-gold" />
            </p>
            <p className="text-catalog-muted mt-1 leading-relaxed">
              Você acumulará pontos nesta compra! Faça login para resgatar saldos e descontos exclusivos na finalização.
            </p>
            {simulation && simulation.projectedEarnedPoints > 0 && (
              <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-catalog-gold/15 border border-catalog-gold/40 text-catalog-gold font-mono font-bold text-[11px]">
                +{simulation.projectedEarnedPoints} pontos previstos após a compra
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (walletError) {
    return (
      <div className="rounded-2xl border border-red-500/40 bg-red-950/30 p-4" role="alert">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <div>
            <p className="text-sm font-bold text-white">Saldo de pontos indisponível</p>
            <p className="mt-1 text-xs text-red-200">{walletError}</p>
            <button type="button" onClick={loadWallet} className="mt-3 min-h-11 rounded-full border border-red-300/40 px-4 text-xs font-bold uppercase tracking-wider text-white hover:bg-white/10">
              Tentar novamente
            </button>
          </div>
        </div>
      </div>
    )
  }

  const hasPoints = wallet && wallet.balance > 0

  return (
    <div className="rounded-2xl border border-catalog-gold/30 bg-[#0B132B]/70 backdrop-blur-md p-5 shadow-sm space-y-4">
      {/* Header do Card */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-catalog-gold/15 border border-catalog-gold/30 flex items-center justify-center text-catalog-gold shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
              Programa de Fidelidade
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-catalog-gold/20 text-catalog-gold font-mono font-bold border border-catalog-gold/40">
                VIP
              </span>
            </h4>
            <p className="text-xs text-catalog-muted font-mono mt-0.5">
              Saldo: <strong className="text-white font-bold">{wallet?.balance ?? 0} pontos</strong>
              {wallet && wallet.monetaryBalance > 0 && (
                <span className="text-catalog-gold"> (R$ {wallet.monetaryBalance.toFixed(2).replace('.', ',')})</span>
              )}
            </p>
          </div>
        </div>

        {/* Toggle para usar pontos */}
        {hasPoints && (
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              aria-label="Usar pontos de fidelidade nesta compra"
              checked={usePoints}
              onChange={(e) => setUsePoints(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-[#050B14] border border-catalog-gold/30 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#F0B40E] peer-checked:border-[#F0B40E]" />
          </label>
        )}
      </div>

      {/* Seção quando o toggle está ativo */}
      {usePoints && hasPoints && (
        <div className="pt-3 border-t border-catalog-gold/20 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-catalog-muted uppercase">Quantidade de pontos a resgatar:</span>
            <span className="font-bold text-catalog-gold">
              {requestedPoints} pts
            </span>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="range"
              aria-label="Quantidade de pontos a resgatar"
              min={1}
              max={wallet.balance}
              value={requestedPoints}
              onChange={(e) => setRequestedPoints(Number(e.target.value))}
              className="w-full h-2 bg-[#050B14] rounded-lg appearance-none cursor-pointer accent-[#F0B40E] border border-catalog-gold/20"
            />
            <button
              type="button"
              onClick={() => setRequestedPoints(wallet.balance)}
              className="px-3 py-1 text-[11px] font-mono font-bold uppercase rounded-lg bg-catalog-gold/15 text-catalog-gold border border-catalog-gold/40 hover:bg-catalog-gold/25 transition-colors shrink-0"
            >
              Usar Tudo
            </button>
          </div>

          {/* Resultado da Simulação */}
          {simulation && (
            <div className="mt-2">
              {simulation.eligible ? (
                <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-400 text-xs font-mono flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>Desconto de fidelidade aplicado:</span>
                  </div>
                  <strong className="font-bold text-sm">
                    - R$ {simulation.discountValue.toFixed(2).replace('.', ',')}
                  </strong>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-400 text-xs font-mono flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{simulation.reason || 'Pontos insuficientes para esta compra.'}</span>
                </div>
              )}
            </div>
          )}
          {simulationError && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs font-mono flex items-center gap-2" role="alert">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{simulationError}</span>
            </div>
          )}
        </div>
      )}

      {/* Rodapé Informativo: Projeção de Acúmulo Futuro */}
      {simulation && simulation.projectedEarnedPoints > 0 && (
        <div className="flex items-center justify-between text-[11px] font-mono text-catalog-muted pt-2 border-t border-catalog-gold/15">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-catalog-gold" />
            Bônus acumulado nesta compra:
          </span>
          <span className="font-bold text-catalog-gold">
            +{simulation.projectedEarnedPoints} pontos
          </span>
        </div>
      )}
    </div>
  )
}
