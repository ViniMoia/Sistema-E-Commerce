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
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Calendar,
  Percent,
  Calculator,
  UserCheck
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

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  }

  const isEnabled = report?.settings?.loyaltyEnabled ?? configForm.loyaltyEnabled

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Cabeçalho Canônico Continental */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-catalog-gold/20 pb-6">
        <div>
          <div className="flex items-center gap-2 text-catalog-gold text-xs font-mono uppercase tracking-widest mb-1.5">
            <Award className="w-3.5 h-3.5" />
            <span>Continental Rewards & Retention</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold font-continental-display tracking-tight text-white flex items-center gap-3">
            Fidelidade & Pontos
          </h1>
          <p className="text-catalog-muted mt-1 text-xs sm:text-sm font-light">
            Configure taxas de acúmulo e resgate, acompanhe o passivo financeiro e audite movimentações do programa.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-catalog-muted hover:text-catalog-gold hover:border-catalog-gold/40 transition-all cursor-pointer"
            title="Atualizar métricas"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-catalog-gold' : ''}`} />
          </button>

          <div className="flex items-center gap-2 text-xs font-mono text-catalog-muted">
            <span>Status do Programa:</span>
            <span
              className={`font-bold px-2.5 py-0.5 rounded-full border text-xs flex items-center gap-1.5 ${
                isEnabled
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              {isEnabled ? 'Ativo' : 'Desativado'}
            </span>
          </div>
        </div>
      </div>

      {/* 4 Cards de Métricas em Destaque */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Passivo Financeiro Projetado */}
        <div className="rounded-2xl bg-catalog-card p-6 border border-catalog-gold/35 shadow-2xl relative overflow-hidden group hover:border-catalog-gold transition-all">
          <div className="flex items-center justify-between text-xs text-catalog-gold font-mono font-semibold uppercase tracking-wider">
            <span>Passivo Financeiro</span>
            <div className="w-8 h-8 rounded-lg bg-catalog-gold/15 border border-catalog-gold/30 flex items-center justify-center text-catalog-gold">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-bold text-catalog-gold font-mono tracking-tight">
              {formatCurrency(report?.metrics.projectedFinancialLiability ?? 0)}
            </p>
            <p className="text-[11px] text-catalog-muted font-light mt-1">
              Valor de resgate dos pontos em circulação
            </p>
          </div>
        </div>

        {/* Pontos em Circulação */}
        <div className="rounded-2xl bg-catalog-card p-6 border border-catalog-gold/25 shadow-xl relative overflow-hidden group hover:border-catalog-gold/50 transition-all">
          <div className="flex items-center justify-between text-xs text-catalog-muted font-mono font-medium uppercase tracking-wider">
            <span>Pontos em Circulação</span>
            <div className="w-8 h-8 rounded-lg bg-catalog-gold/10 border border-catalog-gold/20 flex items-center justify-center text-catalog-gold">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-bold text-white font-mono tracking-tight">
              {(report?.metrics.totalCirculatingPoints ?? 0).toLocaleString('pt-BR')} <span className="text-sm text-catalog-gold font-normal">pts</span>
            </p>
            <p className="text-[11px] text-catalog-muted font-light mt-1">
              Disponíveis nas carteiras dos clientes
            </p>
          </div>
        </div>

        {/* Clientes Engajados */}
        <div className="rounded-2xl bg-catalog-card p-6 border border-catalog-gold/20 shadow-xl relative overflow-hidden group hover:border-catalog-gold/40 transition-all">
          <div className="flex items-center justify-between text-xs text-catalog-muted font-mono font-medium uppercase tracking-wider">
            <span>Clientes Engajados</span>
            <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-neutral-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-bold text-white font-mono tracking-tight">
              {report?.metrics.activeCustomersWithPoints ?? 0}
            </p>
            <p className="text-[11px] text-catalog-muted font-light mt-1">
              Carteiras ativas com saldo acumulado &gt; 0
            </p>
          </div>
        </div>

        {/* Total Economizado por Clientes */}
        <div className="rounded-2xl bg-catalog-card p-6 border border-catalog-gold/20 shadow-xl relative overflow-hidden group hover:border-catalog-gold/40 transition-all">
          <div className="flex items-center justify-between text-xs text-catalog-muted font-mono font-medium uppercase tracking-wider">
            <span>Total Resgatado</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-bold text-emerald-400 font-mono tracking-tight">
              {formatCurrency(report?.metrics.totalRedeemedMonetaryValue ?? 0)}
            </p>
            <p className="text-[11px] text-catalog-muted font-light mt-1">
              {(report?.metrics.totalRedeemedPoints ?? 0).toLocaleString('pt-BR')} pontos convertidos em descontos
            </p>
          </div>
        </div>
      </div>

      {/* Pílulas de Navegação por Abas */}
      <div className="flex flex-wrap gap-2.5 border-b border-catalog-gold/20 pb-4">
        {[
          { id: 'config', label: 'Parâmetros do Programa', icon: Settings },
          { id: 'adjust', label: 'Ajuste Manual de Saldo', icon: PlusCircle },
          { id: 'history', label: 'Últimas Movimentações (Ledger)', icon: Clock },
        ].map((tab) => {
          const isActive = activeTab === tab.id
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-2.5 rounded-xl text-xs font-mono uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                isActive
                  ? 'bg-catalog-gold/20 text-catalog-gold font-bold border-2 border-catalog-gold shadow-[0_0_15px_rgba(240,180,14,0.2)]'
                  : 'bg-[#0B132B]/60 text-catalog-muted border border-catalog-gold/25 hover:border-catalog-gold/50 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* ABA 1: Configurações de Parâmetros */}
      {activeTab === 'config' && (
        <form onSubmit={handleSaveConfig} className="bg-catalog-card border border-catalog-gold/30 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl backdrop-blur-xl max-w-3xl">
          {/* Chave de Ativação do Programa */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-[#050B14] border border-catalog-gold/25">
            <div>
              <h3 className="font-bold text-white text-sm">Habilitar Fidelidade & Pontos</h3>
              <p className="text-xs text-catalog-muted font-light mt-0.5">
                Permite acúmulo em pedidos finalizados e habilita widget de resgate no checkout.
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
              <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-black after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-catalog-gold" />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Taxa de Acúmulo */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-wider text-catalog-gold font-semibold flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5" />
                <span>Taxa de Acúmulo (Earn Rate)</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={configForm.loyaltyEarnRate}
                onChange={(e) =>
                  setConfigForm((prev) => ({ ...prev, loyaltyEarnRate: Number(e.target.value) }))
                }
                className="w-full h-11 px-4 rounded-xl border border-catalog-gold/30 bg-[#0B132B]/80 text-xs font-mono font-bold text-white focus:outline-none focus:border-catalog-gold focus:ring-1 focus:ring-catalog-gold/30 transition-all shadow-inner"
              />
              <p className="text-[11px] text-catalog-muted font-light">
                Multiplicador por R$ gasto (ex: 0.5 = 1 pt a cada R$ 2,00).
              </p>
            </div>

            {/* Valor do Ponto */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-wider text-catalog-gold font-semibold flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5" />
                <span>Valor do Ponto em Reais (Burn Rate)</span>
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-catalog-gold font-mono font-bold text-xs pointer-events-none">
                  R$
                </div>
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
                  className="w-full h-11 pl-10 pr-4 rounded-xl border border-catalog-gold/30 bg-[#0B132B]/80 text-xs font-mono font-bold text-white focus:outline-none focus:border-catalog-gold focus:ring-1 focus:ring-catalog-gold/30 transition-all shadow-inner"
                />
              </div>
              <p className="text-[11px] text-catalog-muted font-light">
                Valor monetário de cada ponto (ex: 0.05 = R$ 0,05 de desconto por ponto).
              </p>
            </div>

            {/* Saldo Mínimo para Resgate */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-wider text-catalog-gold font-semibold flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5" />
                <span>Resgate Mínimo (Pontos)</span>
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
                className="w-full h-11 px-4 rounded-xl border border-catalog-gold/30 bg-[#0B132B]/80 text-xs font-mono font-bold text-white focus:outline-none focus:border-catalog-gold focus:ring-1 focus:ring-catalog-gold/30 transition-all shadow-inner"
              />
              <p className="text-[11px] text-catalog-muted font-light">
                Quantidade mínima exigida para liberar o desconto no checkout.
              </p>
            </div>

            {/* Teto Máximo de Desconto % */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-wider text-catalog-gold font-semibold flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5" />
                <span>Teto Máximo de Desconto (%)</span>
              </label>
              <div className="relative">
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
                  className="w-full h-11 px-4 pr-10 rounded-xl border border-catalog-gold/30 bg-[#0B132B]/80 text-xs font-mono font-bold text-white focus:outline-none focus:border-catalog-gold focus:ring-1 focus:ring-catalog-gold/30 transition-all shadow-inner"
                />
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-catalog-gold font-mono font-bold text-xs pointer-events-none">
                  %
                </div>
              </div>
              <p className="text-[11px] text-catalog-muted font-light">
                Limite percentual de abatimento máximo no subtotal da compra.
              </p>
            </div>

            {/* Validade dos Pontos */}
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-mono uppercase tracking-wider text-catalog-gold font-semibold flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>Prazo de Validade dos Pontos (Dias)</span>
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
                className="w-full h-11 px-4 rounded-xl border border-catalog-gold/30 bg-[#0B132B]/80 text-xs font-mono font-bold text-white placeholder:text-neutral-500 focus:outline-none focus:border-catalog-gold focus:ring-1 focus:ring-catalog-gold/30 transition-all shadow-inner"
              />
              <p className="text-[11px] text-catalog-muted font-light">
                Período em dias até a expiração contábil dos pontos concedidos.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-catalog-gold/20 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#F0B40E] to-[#DDAF02] text-black font-bold text-xs uppercase font-mono tracking-wider px-8 py-3.5 shadow-[0_0_20px_rgba(240,180,14,0.3)] hover:shadow-[0_0_30px_rgba(240,180,14,0.5)] transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  <span>Salvando Parâmetros...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 text-black" />
                  <span>Salvar Configurações</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ABA 2: Ajuste Manual Auditado */}
      {activeTab === 'adjust' && (
        <form onSubmit={handleManualAdjust} className="bg-catalog-card border border-catalog-gold/30 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl backdrop-blur-xl max-w-2xl">
          <div className="border-b border-catalog-gold/20 pb-4">
            <h3 className="font-bold font-continental-display text-white text-base flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-catalog-gold" />
              <span>Ajuste Contábil Auditado de Saldo</span>
            </h3>
            <p className="text-xs text-catalog-muted font-light mt-1">
              Conceda cortesias, créditos promocionais ou estornos diretamente na carteira de um cliente.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#050B14] border border-catalog-gold/20 flex items-start gap-2.5 text-xs text-catalog-muted">
            <AlertCircle className="w-4 h-4 text-catalog-gold shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Todas as movimentações manuais são registradas de forma indelével no ledger do programa com autor do ajuste e justificativa.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-wider text-catalog-gold font-semibold">
                ID do Cliente (UUID)
              </label>
              <input
                type="text"
                required
                value={adjustForm.userID}
                onChange={(e) => setAdjustForm((prev) => ({ ...prev, userID: e.target.value }))}
                placeholder="Cole o ID do cliente (ex: clu789abc...)"
                className="w-full h-11 px-4 rounded-xl border border-catalog-gold/30 bg-[#0B132B]/80 text-xs font-mono text-white placeholder:text-neutral-500 focus:outline-none focus:border-catalog-gold focus:ring-1 focus:ring-catalog-gold/30 transition-all shadow-inner"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-wider text-catalog-gold font-semibold">
                Quantidade de Pontos (+ para Crédito, - para Débito)
              </label>
              <input
                type="number"
                required
                value={adjustForm.points}
                onChange={(e) => setAdjustForm((prev) => ({ ...prev, points: Number(e.target.value) }))}
                className="w-full h-11 px-4 rounded-xl border border-catalog-gold/30 bg-[#0B132B]/80 text-xs font-mono font-bold text-white focus:outline-none focus:border-catalog-gold focus:ring-1 focus:ring-catalog-gold/30 transition-all shadow-inner"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-wider text-catalog-gold font-semibold">
                Justificativa Contábil (Obrigatória)
              </label>
              <textarea
                required
                rows={3}
                value={adjustForm.description}
                onChange={(e) =>
                  setAdjustForm((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Ex: Cortesia por fidelidade ou bonificação por campanha especial"
                className="w-full p-4 rounded-xl border border-catalog-gold/30 bg-[#0B132B]/80 text-xs font-mono text-white placeholder:text-neutral-500 focus:outline-none focus:border-catalog-gold focus:ring-1 focus:ring-catalog-gold/30 transition-all shadow-inner resize-none"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-catalog-gold/20 flex justify-end">
            <button
              type="submit"
              disabled={adjusting}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#F0B40E] to-[#DDAF02] text-black font-bold text-xs uppercase font-mono tracking-wider px-8 py-3.5 shadow-[0_0_20px_rgba(240,180,14,0.3)] hover:shadow-[0_0_30px_rgba(240,180,14,0.5)] transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
            >
              {adjusting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  <span>Processando Ajuste...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-black" />
                  <span>Efetivar Ajuste no Ledger</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ABA 3: Histórico de Movimentações (Ledger) */}
      {activeTab === 'history' && (
        <div className="bg-catalog-card border border-catalog-gold/30 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl">
          <div className="px-6 py-4 border-b border-catalog-gold/25 bg-[#050B14] flex items-center justify-between">
            <div className="flex items-center gap-2 text-catalog-gold text-xs font-mono uppercase tracking-wider font-semibold">
              <Clock className="w-3.5 h-3.5" />
              <span>Extrato Geral de Movimentações da Loja</span>
            </div>
            <span className="text-xs font-mono text-catalog-muted">
              {report?.recentTransactions?.length || 0} lançamentos recentes
            </span>
          </div>

          {!report?.recentTransactions || report.recentTransactions.length === 0 ? (
            <div className="p-16 text-center space-y-2">
              <Award className="w-8 h-8 text-catalog-gold/60 mx-auto" />
              <p className="text-white font-semibold text-sm">Nenhuma movimentação registrada</p>
              <p className="text-xs text-catalog-muted font-light max-w-sm mx-auto">
                Assim que pedidos forem concluídos ou ajustes forem efetuados, o extrato contábil será preenchido aqui.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#050B14] border-b border-catalog-gold/30">
                    <th className="py-4 px-6 text-[11px] font-mono font-bold uppercase tracking-wider text-catalog-gold">
                      Cliente
                    </th>
                    <th className="py-4 px-6 text-[11px] font-mono font-bold uppercase tracking-wider text-catalog-gold">
                      Motivo / Descrição
                    </th>
                    <th className="py-4 px-6 text-[11px] font-mono font-bold uppercase tracking-wider text-catalog-gold text-center">
                      Tipo
                    </th>
                    <th className="py-4 px-6 text-[11px] font-mono font-bold uppercase tracking-wider text-catalog-gold text-center">
                      Pontos
                    </th>
                    <th className="py-4 px-6 text-[11px] font-mono font-bold uppercase tracking-wider text-catalog-gold text-right">
                      Data / Hora
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-catalog-gold/15 text-xs font-mono">
                  {report.recentTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="py-4 px-6">
                        <p className="font-semibold text-white tracking-tight">{tx.userName}</p>
                        <p className="text-[11px] text-catalog-muted font-mono">{tx.userEmail}</p>
                      </td>
                      <td className="py-4 px-6 text-neutral-300">
                        {tx.description}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-neutral-300 font-semibold">
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center font-mono font-bold">
                        <span
                          className={`px-2.5 py-0.5 rounded-full border text-xs ${
                            tx.points > 0
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                          }`}
                        >
                          {tx.points > 0 ? `+${tx.points}` : tx.points} pts
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right text-catalog-muted whitespace-nowrap text-[11px]">
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
