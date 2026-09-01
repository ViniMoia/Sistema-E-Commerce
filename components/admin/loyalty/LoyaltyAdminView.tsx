'use client'

import React, { useState, useEffect } from 'react'
import {
  Award,
  Settings,
  DollarSign,
  TrendingUp,
  Users,
  ShieldCheck,
  Sparkles,
  Save,
  PlusCircle,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { LoyaltySettings } from '@/types/loyalty.types'

interface ReportData {
  settings: LoyaltySettings
  metrics: {
    totalCirculatingPoints: number
    projectedFinancialLiability: number
    activeCustomersWithPoints: number
    totalLifetimeEarnedPoints: number
    totalRedeemedPoints: number
    totalRedeemedMonetaryValue: number
  }
  recentTransactions: Array<{
    id: string
    userName: string
    userEmail: string
    type: string
    points: number
    balanceAfter: number
    monetaryValue: number | null
    description: string
    orderId: string | null
    createdAt: string
  }>
}

export function LoyaltyAdminView() {
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [adjusting, setAdjusting] = useState(false)
  const [activeTab, setActiveTab] = useState<'config' | 'adjust' | 'history'>('config')

  // Form State para Configurações
  const [configForm, setConfigForm] = useState<LoyaltySettings>({
    loyaltyEnabled: false,
    loyaltyEarnRate: 0.5,
    loyaltyPointValue: 0.05,
    loyaltyMinPointsRedeem: 100,
    loyaltyMaxDiscountPct: 50.0,
    loyaltyPointsExpiryDays: 365,
  })

  // Form State para Ajuste Manual
  const [adjustForm, setAdjustForm] = useState({
    userID: '',
    points: 100,
    description: '',
  })

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/loyalty/reports')
      const json = await res.json()
      if (json.success && json.data) {
        setReport(json.data)
        setConfigForm(json.data.settings)
      }
    } catch (err) {
      console.error('Erro ao carregar dados de fidelidade:', err)
      toast.error('Erro ao carregar métricas de fidelidade.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/admin/loyalty/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loyaltyEnabled: configForm.loyaltyEnabled,
          loyaltyEarnRate: Number(configForm.loyaltyEarnRate),
          loyaltyPointValue: Number(configForm.loyaltyPointValue),
          loyaltyMinPointsRedeem: Number(configForm.loyaltyMinPointsRedeem),
          loyaltyMaxDiscountPct: Number(configForm.loyaltyMaxDiscountPct),
          loyaltyPointsExpiryDays: configForm.loyaltyPointsExpiryDays
            ? Number(configForm.loyaltyPointsExpiryDays)
            : null,
        }),
      })

      const data = await res.json()
      if (data.success) {
        toast.success('Configurações de fidelidade atualizadas com sucesso!')
        loadData()
      } else {
        toast.error(data.error || 'Erro ao salvar configurações.')
      }
    } catch (err) {
      console.error('Erro ao salvar:', err)
      toast.error('Erro de conexão ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  const handleManualAdjust = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adjustForm.userID || !adjustForm.description || adjustForm.points === 0) {
      toast.error('Preencha todos os campos do ajuste.')
      return
    }

    setAdjusting(true)
    try {
      const res = await fetch('/api/admin/loyalty/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userID: adjustForm.userID.trim(),
          points: Number(adjustForm.points),
          description: adjustForm.description.trim(),
        }),
      })

      const data = await res.json()
      if (data.success) {
        toast.success(`Ajuste de saldo realizado! Novo saldo: ${data.data.newBalance} pts`)
        setAdjustForm({ userID: '', points: 100, description: '' })
        loadData()
      } else {
        toast.error(data.error || 'Erro ao executar ajuste.')
      }
    } catch (err) {
      console.error('Erro ao ajustar:', err)
      toast.error('Erro de conexão ao executar ajuste.')
    } finally {
      setAdjusting(false)
    }
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
              <Award className="w-6 h-6" />
            </div>
            Gestão do Programa de Fidelidade & Pontos
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Configure taxas de acúmulo e resgate, acompanhe o passivo financeiro e audite movimentações.
          </p>
        </div>
      </div>

      {/* Cards de Métricas em Destaque */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Passivo Financeiro Projetado */}
        <div className="rounded-2xl bg-gradient-to-br from-amber-500/15 via-zinc-900/60 to-zinc-950 p-6 border border-amber-500/20 shadow-lg">
          <div className="flex items-center justify-between text-xs text-amber-400 font-medium uppercase tracking-wider">
            <span>Passivo Financeiro</span>
            <DollarSign className="w-4 h-4" />
          </div>
          <div className="mt-3">
            <p className="text-3xl font-bold text-white font-mono">
              R$ {(report?.metrics.projectedFinancialLiability ?? 0).toFixed(2).replace('.', ',')}
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              Valor nominal total dos pontos em circulação
            </p>
          </div>
        </div>

        {/* Pontos em Circulação */}
        <div className="rounded-2xl bg-zinc-900/60 p-6 border border-white/5">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-medium uppercase tracking-wider">
            <span>Pontos em Circulação</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3">
            <p className="text-3xl font-bold text-zinc-100 font-mono">
              {(report?.metrics.totalCirculatingPoints ?? 0).toLocaleString('pt-BR')}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Disponíveis nas carteiras dos clientes
            </p>
          </div>
        </div>

        {/* Clientes com Pontos Ativos */}
        <div className="rounded-2xl bg-zinc-900/60 p-6 border border-white/5">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-medium uppercase tracking-wider">
            <span>Clientes Engajados</span>
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-3">
            <p className="text-3xl font-bold text-zinc-100 font-mono">
              {report?.metrics.activeCustomersWithPoints ?? 0}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Carteiras ativas com saldo &gt; 0
            </p>
          </div>
        </div>

        {/* Total Economizado por Clientes */}
        <div className="rounded-2xl bg-zinc-900/60 p-6 border border-white/5">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-medium uppercase tracking-wider">
            <span>Total Resgatado</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3">
            <p className="text-3xl font-bold text-emerald-400 font-mono">
              R$ {(report?.metrics.totalRedeemedMonetaryValue ?? 0).toFixed(2).replace('.', ',')}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              {(report?.metrics.totalRedeemedPoints ?? 0).toLocaleString('pt-BR')} pontos resgatados
            </p>
          </div>
        </div>
      </div>

      {/* Tabs de Navegação */}
      <div className="flex border-b border-white/10 gap-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab('config')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'config'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Settings className="w-4 h-4" />
          Parâmetros do Programa
        </button>

        <button
          onClick={() => setActiveTab('adjust')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'adjust'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <PlusCircle className="w-4 h-4" />
          Ajuste Manual de Saldo
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'history'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          Últimas Movimentações
        </button>
      </div>

      {/* TAB 1: Configurações */}
      {activeTab === 'config' && (
        <form onSubmit={handleSaveConfig} className="glass-panel rounded-2xl p-8 space-y-6 max-w-3xl">
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5">
            <div>
              <h3 className="font-semibold text-white">Ativação do Programa de Pontos</h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Habilita o acúmulo e resgate de pontos nas compras desta loja.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={configForm.loyaltyEnabled}
                onChange={(e) =>
                  setConfigForm((prev) => ({ ...prev, loyaltyEnabled: e.target.checked }))
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500" />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Taxa de Acúmulo */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Taxa de Acúmulo (Earn Rate)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={configForm.loyaltyEarnRate}
                  onChange={(e) =>
                    setConfigForm((prev) => ({ ...prev, loyaltyEarnRate: Number(e.target.value) }))
                  }
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
              <p className="text-[11px] text-zinc-500">
                Multiplicador por R$ gasto (ex: 0.5 = 1 pt a cada R$ 2,00).
              </p>
            </div>

            {/* Valor do Ponto */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Valor do Ponto em Reais (Burn Rate)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={configForm.loyaltyPointValue}
                  onChange={(e) =>
                    setConfigForm((prev) => ({
                      ...prev,
                      loyaltyPointValue: Number(e.target.value),
                    }))
                  }
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
              <p className="text-[11px] text-zinc-500">
                Valor em R$ de cada ponto (ex: 0.05 = R$ 0,05 por ponto).
              </p>
            </div>

            {/* Saldo Mínimo para Resgate */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Resgate Mínimo (Pontos)
              </label>
              <input
                type="number"
                min="0"
                value={configForm.loyaltyMinPointsRedeem}
                onChange={(e) =>
                  setConfigForm((prev) => ({
                    ...prev,
                    loyaltyMinPointsRedeem: Number(e.target.value),
                  }))
                }
                className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-amber-500 transition-colors"
              />
              <p className="text-[11px] text-zinc-500">
                Quantidade mínima exigida para liberar opção de desconto.
              </p>
            </div>

            {/* Teto Máximo de Desconto % */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Teto Máximo de Desconto (%)
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={configForm.loyaltyMaxDiscountPct}
                onChange={(e) =>
                  setConfigForm((prev) => ({
                    ...prev,
                    loyaltyMaxDiscountPct: Number(e.target.value),
                  }))
                }
                className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-amber-500 transition-colors"
              />
              <p className="text-[11px] text-zinc-500">
                Limite percentual de abatimento no subtotal (ex: 50%).
              </p>
            </div>

            {/* Validade dos Pontos */}
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Validade dos Pontos (Dias)
              </label>
              <input
                type="number"
                min="1"
                value={configForm.loyaltyPointsExpiryDays ?? ''}
                onChange={(e) =>
                  setConfigForm((prev) => ({
                    ...prev,
                    loyaltyPointsExpiryDays: e.target.value ? Number(e.target.value) : null,
                  }))
                }
                placeholder="Ex: 365 (deixe em branco para sem expiração)"
                className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-amber-500 transition-colors"
              />
              <p className="text-[11px] text-zinc-500">
                Prazo em dias após a compra para expirar os pontos (opcional).
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-white/5 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 font-semibold text-zinc-950 shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: Ajuste Manual de Saldo */}
      {activeTab === 'adjust' && (
        <form onSubmit={handleManualAdjust} className="glass-panel rounded-2xl p-8 space-y-6 max-w-2xl">
          <div>
            <h3 className="font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-500" />
              Ajuste Manual Auditado
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Conceda pontos bônus, cortesias ou realize correções contábeis no saldo de um cliente.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                ID do Cliente (User ID)
              </label>
              <input
                type="text"
                required
                value={adjustForm.userID}
                onChange={(e) => setAdjustForm((prev) => ({ ...prev, userID: e.target.value }))}
                placeholder="Cole o UUID do usuário"
                className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Quantidade de Pontos (+ para Crédito, - para Débito)
              </label>
              <input
                type="number"
                required
                value={adjustForm.points}
                onChange={(e) => setAdjustForm((prev) => ({ ...prev, points: Number(e.target.value) }))}
                className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Justificativa Contábil (Obrigatória)
              </label>
              <textarea
                required
                rows={3}
                value={adjustForm.description}
                onChange={(e) =>
                  setAdjustForm((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Ex: Crédito de cortesia por atraso de entrega no pedido #1234"
                className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors resize-none"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-white/5 flex justify-end">
            <button
              type="submit"
              disabled={adjusting}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 font-semibold text-zinc-950 shadow-md transition-all disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              {adjusting ? 'Processando Ajuste...' : 'Efetivar Ajuste no Ledger'}
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: Histórico Recente de Movimentações */}
      {activeTab === 'history' && (
        <div className="rounded-2xl bg-zinc-900/40 border border-white/5 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-base font-semibold text-white">Últimas Movimentações na Loja</h3>
          </div>

          {!report?.recentTransactions || report.recentTransactions.length === 0 ? (
            <div className="p-12 text-center text-zinc-500">
              Nenhuma movimentação de pontos registrada nesta loja.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/[0.02] text-xs font-semibold uppercase text-zinc-400 border-b border-white/5">
                  <tr>
                    <th className="px-6 py-3.5">Cliente</th>
                    <th className="px-6 py-3.5">Descrição</th>
                    <th className="px-6 py-3.5 text-center">Tipo</th>
                    <th className="px-6 py-3.5 text-center">Pontos</th>
                    <th className="px-6 py-3.5 text-right">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {report.recentTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-medium text-white">{tx.userName}</p>
                        <p className="text-xs text-zinc-500">{tx.userEmail}</p>
                      </td>
                      <td className="px-6 py-4 text-xs text-zinc-300">{tx.description}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-zinc-300 font-semibold">
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-mono font-semibold">
                        <span className={tx.points > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {tx.points > 0 ? `+${tx.points}` : tx.points} pts
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-xs text-zinc-400 whitespace-nowrap">
                        {new Date(tx.createdAt).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
