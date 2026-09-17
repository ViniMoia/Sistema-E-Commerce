'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Award,
  Sparkles,
  Settings2,
  PlusCircle,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import type { DashboardLoyaltyDTO } from '@/types/dashboard';

interface LoyaltyQuickManagementWidgetProps {
  loyalty: DashboardLoyaltyDTO;
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export const LoyaltyQuickManagementWidget: React.FC<LoyaltyQuickManagementWidgetProps> = ({
  loyalty,
}) => {
  const [activeTab, setActiveTab] = useState<'metrics' | 'config' | 'adjust'>('metrics');

  // Estado da Configuração Rápida
  const [configState, setConfigState] = useState({
    loyaltyEnabled: loyalty.loyaltyEnabled,
    loyaltyEarnRate: loyalty.settings.loyaltyEarnRate,
    loyaltyPointValue: loyalty.settings.loyaltyPointValue,
    loyaltyMinPointsRedeem: loyalty.settings.loyaltyMinPointsRedeem,
    loyaltyMaxDiscountPct: loyalty.settings.loyaltyMaxDiscountPct,
  });
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Estado do Ajuste Manual Rápido
  const [adjustState, setAdjustState] = useState({
    userID: '',
    points: 100,
    description: '',
  });
  const [isAdjusting, setIsAdjusting] = useState(false);

  // Salvar Configuração Rápida
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);

    try {
      const res = await fetch('/api/admin/loyalty/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loyaltyEnabled: configState.loyaltyEnabled,
          loyaltyEarnRate: Number(configState.loyaltyEarnRate),
          loyaltyPointValue: Number(configState.loyaltyPointValue),
          loyaltyMinPointsRedeem: Number(configState.loyaltyMinPointsRedeem),
          loyaltyMaxDiscountPct: Number(configState.loyaltyMaxDiscountPct),
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success('Configurações de fidelidade atualizadas com sucesso!');
      } else {
        toast.error(json.error || 'Erro ao salvar configurações.');
      }
    } catch (err: any) {
      toast.error('Erro de conexão ao salvar configurações.');
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Executar Ajuste Manual Rápido
  const handleAdjustPoints = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustState.userID.trim()) {
      toast.error('Informe o ID do cliente.');
      return;
    }
    if (!adjustState.description.trim()) {
      toast.error('Informe a justificativa do ajuste.');
      return;
    }
    if (adjustState.points === 0) {
      toast.error('Os pontos não podem ser zero.');
      return;
    }

    setIsAdjusting(true);

    try {
      const res = await fetch('/api/admin/loyalty/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userID: adjustState.userID.trim(),
          points: Number(adjustState.points),
          description: adjustState.description.trim(),
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(
          `Ajuste de ${adjustState.points > 0 ? '+' : ''}${adjustState.points} pontos realizado!`
        );
        setAdjustState({ userID: '', points: 100, description: '' });
      } else {
        toast.error(json.error || 'Erro ao processar ajuste de pontos.');
      }
    } catch (err: any) {
      toast.error('Erro de conexão ao ajustar pontos.');
    } finally {
      setIsAdjusting(false);
    }
  };

  return (
    <div className="glass-panel rounded-xl border border-[#DDAF02]/20 overflow-hidden flex flex-col justify-between">
      {/* Header do Widget */}
      <div className="px-5 py-4 border-b border-white/5 bg-white/[0.01] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-[#DDAF02]/10 border border-[#DDAF02]/20 text-[#DDAF02]">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white tracking-tight">
                Programa de Fidelidade & Pontos Continental
              </h3>
              <span
                className={`
                  px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border
                  ${
                    configState.loyaltyEnabled
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }
                `}
              >
                {configState.loyaltyEnabled ? 'Ativo' : 'Pausado'}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Acúmulo automático no checkout e resgate como desconto
            </p>
          </div>
        </div>

        {/* Abas de Navegação */}
        <div className="flex items-center p-1 rounded-lg bg-black/40 border border-white/5 text-xs font-mono">
          <button
            type="button"
            onClick={() => setActiveTab('metrics')}
            className={`px-3 py-1 rounded-md transition-all ${
              activeTab === 'metrics'
                ? 'bg-[#DDAF02]/20 text-[#DDAF02] font-semibold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Métricas
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`px-3 py-1 rounded-md transition-all flex items-center gap-1 ${
              activeTab === 'config'
                ? 'bg-[#DDAF02]/20 text-[#DDAF02] font-semibold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Settings2 className="w-3 h-3" />
            Configurar
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('adjust')}
            className={`px-3 py-1 rounded-md transition-all flex items-center gap-1 ${
              activeTab === 'adjust'
                ? 'bg-[#DDAF02]/20 text-[#DDAF02] font-semibold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <PlusCircle className="w-3 h-3" />
            Ajustar
          </button>
        </div>
      </div>

      {/* Conteúdo da Aba */}
      <div className="p-5 flex-1">
        {/* ABA 1: MÉTRICAS */}
        {activeTab === 'metrics' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                <p className="text-[10px] text-zinc-500 font-mono uppercase">Em Circulação</p>
                <p className="text-lg font-bold text-[#DDAF02] font-mono mt-0.5">
                  {loyalty.totalCirculatingPoints.toLocaleString('pt-BR')} pts
                </p>
              </div>

              <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                <p className="text-[10px] text-zinc-500 font-mono uppercase">Passivo Estimado</p>
                <p className="text-lg font-bold text-white font-mono mt-0.5">
                  {formatBRL(loyalty.projectedFinancialLiability)}
                </p>
              </div>

              <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                <p className="text-[10px] text-zinc-500 font-mono uppercase">Economia Gerada</p>
                <p className="text-lg font-bold text-emerald-400 font-mono mt-0.5">
                  {formatBRL(loyalty.totalRedeemedMonetaryDiscount)}
                </p>
              </div>

              <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                <p className="text-[10px] text-zinc-500 font-mono uppercase">Carteiras Ativas</p>
                <p className="text-lg font-bold text-sky-400 font-mono mt-0.5 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {loyalty.activeWalletsCount}
                </p>
              </div>
            </div>

            {/* Regras Vigentes Resumo */}
            <div className="bg-white/[0.02] p-3 rounded-lg border border-white/5 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#DDAF02]" />
                Taxa: Ganha 1 pt a cada R${' '}
                {(1 / (configState.loyaltyEarnRate || 0.5)).toFixed(2)} gastos
              </span>
              <span className="font-mono text-zinc-300">
                1 pt = {formatBRL(configState.loyaltyPointValue)}
              </span>
              <span className="font-mono text-zinc-300">
                Mínimo: {configState.loyaltyMinPointsRedeem} pts
              </span>
            </div>

            {/* Últimas Transações */}
            {loyalty.recentTransactions.length > 0 && (
              <div>
                <p className="text-[10px] text-zinc-500 font-mono uppercase mb-2">
                  Atividade Recente de Pontos
                </p>
                <div className="space-y-1.5">
                  {loyalty.recentTransactions.slice(0, 3).map((tx) => (
                    <div
                      key={tx.id}
                      className="px-3 py-2 rounded bg-black/20 border border-white/5 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            tx.points > 0 ? 'bg-emerald-400' : 'bg-amber-400'
                          }`}
                        />
                        <span className="text-white truncate font-medium">
                          {tx.userName}
                        </span>
                        <span className="text-zinc-500 text-[11px] truncate hidden sm:inline">
                          — {tx.description}
                        </span>
                      </div>
                      <span
                        className={`font-mono font-bold shrink-0 ml-2 ${
                          tx.points > 0 ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {tx.points > 0 ? `+${tx.points}` : tx.points} pts
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ABA 2: CONFIGURAÇÃO RÁPIDA */}
        {activeTab === 'config' && (
          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-black/20 border border-white/5">
              <div>
                <p className="text-xs font-medium text-white">Status do Programa</p>
                <p className="text-[11px] text-zinc-400">
                  {configState.loyaltyEnabled
                    ? 'Clientes acumulam e resgatam pontos normalmente'
                    : 'Programa pausado (resgates e novos acúmulos desativados)'}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setConfigState((prev) => ({
                    ...prev,
                    loyaltyEnabled: !prev.loyaltyEnabled,
                  }))
                }
                className={`
                  relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none
                  ${configState.loyaltyEnabled ? 'bg-[#DDAF02]' : 'bg-zinc-700'}
                `}
              >
                <span
                  className={`
                    pointer-events-none inline-block h-5 w-5 transform rounded-full bg-black shadow ring-0 transition duration-200 ease-in-out
                    ${configState.loyaltyEnabled ? 'translate-x-5' : 'translate-x-0'}
                  `}
                />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-zinc-400 block mb-1">
                  Taxa de Acúmulo (ex: 0.5 = 1 pt a cada R$ 2)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.01"
                  max="10"
                  value={configState.loyaltyEarnRate}
                  onChange={(e) =>
                    setConfigState({
                      ...configState,
                      loyaltyEarnRate: parseFloat(e.target.value) || 0.5,
                    })
                  }
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:border-[#DDAF02] outline-none"
                />
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">
                  Valor de 1 Ponto em R$ (ex: 0.05)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.001"
                  max="1"
                  value={configState.loyaltyPointValue}
                  onChange={(e) =>
                    setConfigState({
                      ...configState,
                      loyaltyPointValue: parseFloat(e.target.value) || 0.05,
                    })
                  }
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:border-[#DDAF02] outline-none"
                />
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">
                  Mínimo de Pontos para Resgate
                </label>
                <input
                  type="number"
                  min="1"
                  value={configState.loyaltyMinPointsRedeem}
                  onChange={(e) =>
                    setConfigState({
                      ...configState,
                      loyaltyMinPointsRedeem: parseInt(e.target.value, 10) || 100,
                    })
                  }
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:border-[#DDAF02] outline-none"
                />
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">
                  Teto Máximo de Desconto (%)
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={configState.loyaltyMaxDiscountPct}
                  onChange={(e) =>
                    setConfigState({
                      ...configState,
                      loyaltyMaxDiscountPct: parseFloat(e.target.value) || 50,
                    })
                  }
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:border-[#DDAF02] outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSavingConfig}
              className="w-full bg-[#DDAF02] hover:bg-[#c99f02] text-black font-semibold text-xs py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {isSavingConfig ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>Salvar Configurações de Fidelidade</span>
            </button>
          </form>
        )}

        {/* ABA 3: AJUSTE MANUAL RÁPIDO */}
        {activeTab === 'adjust' && (
          <form onSubmit={handleAdjustPoints} className="space-y-3 text-xs">
            <p className="text-zinc-400 text-xs">
              Credite ou debite pontos de um cliente manualmente durante o suporte:
            </p>

            <div>
              <label className="text-zinc-400 block mb-1">ID do Usuário (UUID)</label>
              <input
                type="text"
                placeholder="ex: c9a12345-6789-abcd-ef01-234567890abc"
                value={adjustState.userID}
                onChange={(e) =>
                  setAdjustState({ ...adjustState, userID: e.target.value })
                }
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:border-[#DDAF02] outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-zinc-400 block mb-1">
                  Pontos (+ para crédito, - para débito)
                </label>
                <input
                  type="number"
                  step="10"
                  value={adjustState.points}
                  onChange={(e) =>
                    setAdjustState({
                      ...adjustState,
                      points: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:border-[#DDAF02] outline-none"
                />
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">Impacto em R$</label>
                <div className="w-full bg-black/20 border border-white/5 rounded-lg px-3 py-2 text-[#DDAF02] font-mono font-medium">
                  {formatBRL(adjustState.points * configState.loyaltyPointValue)}
                </div>
              </div>
            </div>

            <div>
              <label className="text-zinc-400 block mb-1">
                Motivo / Justificativa (Auditoria)
              </label>
              <input
                type="text"
                placeholder="ex: Bonificação atendimento WhatsApp ou compensação"
                value={adjustState.description}
                onChange={(e) =>
                  setAdjustState({ ...adjustState, description: e.target.value })
                }
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-[#DDAF02]"
              />
            </div>

            <button
              type="submit"
              disabled={isAdjusting}
              className="w-full bg-[#DDAF02] hover:bg-[#c99f02] text-black font-semibold text-xs py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {isAdjusting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <PlusCircle className="w-4 h-4" />
              )}
              <span>Processar Ajuste de Saldo</span>
            </button>
          </form>
        )}
      </div>

      {/* Footer do Widget */}
      <div className="px-5 py-3 border-t border-white/5 bg-white/[0.01] flex items-center justify-between text-xs">
        <span className="text-zinc-500 font-mono text-[11px]">
          Validade padrão: {loyalty.settings.loyaltyPointsExpiryDays ?? 365} dias
        </span>
        <Link
          href="/admin/fidelidade"
          className="text-[#DDAF02] hover:underline flex items-center gap-1 font-mono text-[11px]"
        >
          <span>Painel Detalhado & Extratos</span>
          <ArrowUpRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
};
