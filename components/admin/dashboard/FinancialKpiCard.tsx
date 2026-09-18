'use client';

import React from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  Calendar,
  Layers,
  Sparkles,
  Package,
  Truck,
} from 'lucide-react';
import type { DashboardFinancialDTO } from '@/types/dashboard';

interface FinancialKpiCardProps {
  financial: DashboardFinancialDTO;
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export const FinancialKpiCard: React.FC<FinancialKpiCardProps> = ({ financial }) => {
  const hasTodayRevenue = financial.settledTodayRevenue > 0;
  const todayProductsPct = hasTodayRevenue
    ? Math.round((financial.settledTodayNetRevenue / financial.settledTodayRevenue) * 100)
    : 100;
  const todayShippingPct = hasTodayRevenue ? 100 - todayProductsPct : 0;

  return (
    <div className="glass-panel rounded-xl p-5 border border-[#DDAF02]/30 hover:border-[#DDAF02]/60 transition-all duration-300 flex flex-col justify-between group shadow-lg shadow-black/40">
      <div>
        {/* Top Header & Indicador de Tempo Real */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-lg bg-[#DDAF02]/10 border border-[#DDAF02]/30 text-[#DDAF02] shadow-inner">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono tracking-widest text-[#DDAF02] uppercase font-bold flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Recebimentos Reais
              </span>
              <p className="text-xs text-zinc-400">Caixa efetivamente liquidado</p>
            </div>
          </div>
          <Link
            href="/admin/orders"
            className="text-xs text-zinc-400 hover:text-[#DDAF02] font-mono flex items-center gap-1 transition-colors"
          >
            <span>Ver Pedidos</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* ─── HERO SECTION: VALOR RECEBIDO NO DIA (DESTAQUE VISUAL MÁXIMO) ─── */}
        <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-[#DDAF02]/15 via-black/40 to-black/60 border border-[#DDAF02]/40 relative overflow-hidden">
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-[#DDAF02]/20 border border-[#DDAF02]/30 text-[#DDAF02] px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold">
            <Sparkles className="w-3 h-3" />
            <span>Hoje</span>
          </div>

          <p className="text-zinc-300 text-xs font-mono uppercase tracking-wider font-semibold">
            Valor Recebido no Dia
          </p>

          <p className="text-3xl lg:text-4xl font-extrabold tracking-tight text-[#DDAF02] mt-1 font-mono drop-shadow-[0_2px_8px_rgba(221,175,2,0.25)]">
            {formatBRL(financial.settledTodayRevenue)}
          </p>

          <div className="flex items-center gap-2 mt-2 text-xs text-zinc-400">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>
              <strong className="text-white font-mono">{financial.settledTodayOrdersCount}</strong>{' '}
              {financial.settledTodayOrdersCount === 1 ? 'pedido liquidado' : 'pedidos liquidados'} hoje
            </span>
          </div>

          {/* Composição Integrada de Hoje (Produtos Líquidos vs Frete) */}
          <div className="mt-3 pt-2.5 border-t border-[#DDAF02]/20">
            <div className="flex items-center justify-between text-[11px] font-mono mb-1.5">
              <span className="text-zinc-300 flex items-center gap-1">
                <Package className="w-3 h-3 text-[#DDAF02]" />
                Produtos: <strong className="text-white">{formatBRL(financial.settledTodayNetRevenue)}</strong>
                {hasTodayRevenue && <span className="text-zinc-500">({todayProductsPct}%)</span>}
              </span>
              <span className="text-zinc-300 flex items-center gap-1">
                <Truck className="w-3 h-3 text-cyan-400" />
                Frete: <strong className="text-cyan-300">{formatBRL(financial.settledTodayShipping)}</strong>
                {hasTodayRevenue && <span className="text-zinc-500">({todayShippingPct}%)</span>}
              </span>
            </div>

            {/* Barra de Proporção Visual */}
            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden flex">
              {hasTodayRevenue ? (
                <>
                  <div
                    className="bg-[#DDAF02] h-full transition-all duration-500 rounded-l-full"
                    style={{ width: `${todayProductsPct}%` }}
                    title={`Produtos: ${formatBRL(financial.settledTodayNetRevenue)} (${todayProductsPct}%)`}
                  />
                  <div
                    className="bg-cyan-400 h-full transition-all duration-500 rounded-r-full"
                    style={{ width: `${todayShippingPct}%` }}
                    title={`Frete: ${formatBRL(financial.settledTodayShipping)} (${todayShippingPct}%)`}
                  />
                </>
              ) : (
                <div className="bg-zinc-800 w-full h-full" />
              )}
            </div>
          </div>
        </div>

        {/* ─── SUB-INDICADORES: MÊS & TOTAL HISTÓRICO COM DISCRIMINAÇÃO DE FRETE ─── */}
        <div className="grid grid-cols-2 gap-2.5 mt-3">
          {/* Recebido no Mês */}
          <div className="p-3 rounded-lg bg-zinc-900/60 border border-white/5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] font-mono">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>Recebido no Mês</span>
              </div>
              <p className="text-base lg:text-lg font-bold text-white font-mono mt-1">
                {formatBRL(financial.settledMonthRevenue)}
              </p>
              <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block">
                {financial.settledMonthOrdersCount} {financial.settledMonthOrdersCount === 1 ? 'pedido' : 'pedidos'}
              </span>
            </div>

            {/* Discriminação Mês */}
            <div className="mt-2 pt-1.5 border-t border-white/5 text-[10px] font-mono space-y-0.5">
              <div className="flex items-center justify-between text-zinc-400">
                <span>Produtos:</span>
                <span className="text-white font-medium">{formatBRL(financial.settledMonthNetRevenue)}</span>
              </div>
              <div className="flex items-center justify-between text-cyan-400/90">
                <span className="flex items-center gap-1">
                  <Truck className="w-2.5 h-2.5" /> Frete:
                </span>
                <span className="font-medium">{formatBRL(financial.settledMonthShipping)}</span>
              </div>
            </div>
          </div>

          {/* Recebido Total */}
          <div className="p-3 rounded-lg bg-zinc-900/60 border border-white/5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] font-mono">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                <span>Recebido Total</span>
              </div>
              <p className="text-base lg:text-lg font-bold text-zinc-200 font-mono mt-1">
                {formatBRL(financial.settledTotalRevenue)}
              </p>
              <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block">
                {financial.settledTotalOrdersCount} {financial.settledTotalOrdersCount === 1 ? 'pedido' : 'pedidos'}
              </span>
            </div>

            {/* Discriminação Total */}
            <div className="mt-2 pt-1.5 border-t border-white/5 text-[10px] font-mono space-y-0.5">
              <div className="flex items-center justify-between text-zinc-400">
                <span>Produtos:</span>
                <span className="text-zinc-200 font-medium">{formatBRL(financial.settledTotalNetRevenue)}</span>
              </div>
              <div className="flex items-center justify-between text-cyan-400/90">
                <span className="flex items-center gap-1">
                  <Truck className="w-2.5 h-2.5" /> Frete:
                </span>
                <span className="font-medium">{formatBRL(financial.settledTotalShipping)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Subtotais e Métricas de Apoio */}
        <div className="mt-4 pt-3 border-t border-white/5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              Pendente em Aprovação ({financial.pendingOrdersCount})
            </span>
            <span className="font-mono text-amber-400 font-medium">
              {formatBRL(financial.pendingRevenue)}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">Ticket Médio (Pagos)</span>
            <span className="font-mono text-white font-medium">
              {formatBRL(financial.averageTicket)}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">Conversão de Vendas</span>
            <span className="font-mono text-emerald-400 font-medium">
              {financial.paymentConversionRatePct}% ({financial.paidOrdersCount} de {financial.totalOrdersCount})
            </span>
          </div>
        </div>
      </div>

      {/* PIX Gateway Status Badge */}
      <div className="mt-4 pt-3 border-t border-white/5">
        {financial.pixConfig.hasPixKey ? (
          <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg text-[11px] text-emerald-400 font-mono">
            <div className="flex items-center gap-1.5 truncate">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">PIX Ativo ({financial.pixConfig.pixKeyType}): {financial.pixConfig.pixKeyMasked}</span>
            </div>
            <Link
              href="/admin/settings"
              className="hover:underline ml-1 shrink-0 text-emerald-300"
            >
              Alterar
            </Link>
          </div>
        ) : (
          <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-lg text-[11px] text-amber-400 font-mono">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Chave PIX não cadastrada</span>
            </div>
            <Link
              href="/admin/settings"
              className="underline font-semibold hover:text-amber-300"
            >
              Configurar
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};


