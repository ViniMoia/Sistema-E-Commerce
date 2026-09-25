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
    <div className="bg-catalog-card rounded-2xl p-6 border border-catalog-gold/30 hover:border-catalog-gold/60 transition-all duration-300 flex flex-col justify-between group shadow-sm">
      <div>
        {/* Top Header & Indicador de Tempo Real */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-catalog-gold/10 border border-catalog-gold/25 text-catalog-gold shadow-inner">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono tracking-[0.2em] text-catalog-gold uppercase font-bold flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Recebimentos Reais
              </span>
              <p className="text-xs text-catalog-muted">Caixa efetivamente liquidado</p>
            </div>
          </div>
          <Link
            href="/admin/orders"
            className="text-xs text-catalog-muted hover:text-catalog-gold font-mono flex items-center gap-1 transition-colors"
          >
            <span>Ver Pedidos</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* ─── HERO SECTION: VALOR RECEBIDO NO DIA ─── */}
        <div className="mt-4 p-4 rounded-xl bg-[#0B132B]/70 border border-catalog-gold/40 relative overflow-hidden shadow-inner">
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-catalog-gold/20 border border-catalog-gold/40 text-catalog-gold px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold">
            <Sparkles className="w-3 h-3" />
            <span>Hoje</span>
          </div>

          <p className="text-catalog-gold text-[10px] font-mono uppercase tracking-[0.2em] font-semibold">
            Valor Recebido no Dia
          </p>

          <p className="text-3xl lg:text-4xl font-extrabold tracking-tight text-white mt-1 font-mono drop-shadow-[0_2px_8px_rgba(240,180,14,0.25)]">
            {formatBRL(financial.settledTodayRevenue)}
          </p>

          <div className="flex items-center gap-2 mt-2 text-xs text-slate-300">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>
              <strong className="text-white font-mono">{financial.settledTodayOrdersCount}</strong>{' '}
              {financial.settledTodayOrdersCount === 1 ? 'pedido liquidado' : 'pedidos liquidados'} hoje
            </span>
          </div>

          {/* Composição Integrada de Hoje (Produtos Líquidos vs Frete) */}
          <div className="mt-3 pt-2.5 border-t border-catalog-gold/20">
            <div className="flex items-center justify-between text-[11px] font-mono mb-1.5">
              <span className="text-slate-300 flex items-center gap-1">
                <Package className="w-3 h-3 text-catalog-gold" />
                Produtos: <strong className="text-white">{formatBRL(financial.settledTodayNetRevenue)}</strong>
                {hasTodayRevenue && <span className="text-catalog-muted">({todayProductsPct}%)</span>}
              </span>
              <span className="text-slate-300 flex items-center gap-1">
                <Truck className="w-3 h-3 text-slate-400" />
                Frete: <strong className="text-white">{formatBRL(financial.settledTodayShipping)}</strong>
                {hasTodayRevenue && <span className="text-catalog-muted">({todayShippingPct}%)</span>}
              </span>
            </div>

            {/* Barra de Proporção Visual */}
            <div className="w-full h-1.5 bg-[#050B14] rounded-full overflow-hidden flex border border-catalog-gold/20">
              {hasTodayRevenue ? (
                <>
                  <div
                    className="bg-gradient-to-r from-[#F0B40E] to-[#E5A805] h-full transition-all duration-500 rounded-l-full"
                    style={{ width: `${todayProductsPct}%` }}
                    title={`Produtos: ${formatBRL(financial.settledTodayNetRevenue)} (${todayProductsPct}%)`}
                  />
                  <div
                    className="bg-slate-500 h-full transition-all duration-500 rounded-r-full"
                    style={{ width: `${todayShippingPct}%` }}
                    title={`Frete: ${formatBRL(financial.settledTodayShipping)} (${todayShippingPct}%)`}
                  />
                </>
              ) : (
                <div className="bg-[#050B14] w-full h-full" />
              )}
            </div>
          </div>
        </div>

        {/* ─── SUB-INDICADORES: MÊS & TOTAL HISTÓRICO ─── */}
        <div className="grid grid-cols-2 gap-2.5 mt-3">
          {/* Recebido no Mês */}
          <div className="p-3 rounded-xl bg-[#050B14]/80 border border-catalog-gold/20 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-catalog-gold text-[10px] font-mono uppercase tracking-wider">
                <Calendar className="w-3 h-3 text-catalog-gold" />
                <span>Recebido no Mês</span>
              </div>
              <p className="text-base lg:text-lg font-bold text-white font-mono mt-1">
                {formatBRL(financial.settledMonthRevenue)}
              </p>
              <span className="text-[10px] text-catalog-muted font-mono mt-0.5 block">
                {financial.settledMonthOrdersCount} {financial.settledMonthOrdersCount === 1 ? 'pedido' : 'pedidos'}
              </span>
            </div>

            {/* Discriminação Mês */}
            <div className="mt-2 pt-1.5 border-t border-catalog-gold/15 text-[10px] font-mono space-y-0.5">
              <div className="flex items-center justify-between text-catalog-muted">
                <span>Produtos:</span>
                <span className="text-white font-medium">{formatBRL(financial.settledMonthNetRevenue)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1">
                  <Truck className="w-2.5 h-2.5 text-catalog-gold/70" /> Frete:
                </span>
                <span className="font-medium text-white">{formatBRL(financial.settledMonthShipping)}</span>
              </div>
            </div>
          </div>

          {/* Recebido Total */}
          <div className="p-3 rounded-xl bg-[#050B14]/80 border border-catalog-gold/20 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-catalog-gold text-[10px] font-mono uppercase tracking-wider">
                <Layers className="w-3 h-3 text-catalog-gold" />
                <span>Recebido Total</span>
              </div>
              <p className="text-base lg:text-lg font-bold text-white font-mono mt-1">
                {formatBRL(financial.settledTotalRevenue)}
              </p>
              <span className="text-[10px] text-catalog-muted font-mono mt-0.5 block">
                {financial.settledTotalOrdersCount} {financial.settledTotalOrdersCount === 1 ? 'pedido' : 'pedidos'}
              </span>
            </div>

            {/* Discriminação Total */}
            <div className="mt-2 pt-1.5 border-t border-catalog-gold/15 text-[10px] font-mono space-y-0.5">
              <div className="flex items-center justify-between text-catalog-muted">
                <span>Produtos:</span>
                <span className="text-white font-medium">{formatBRL(financial.settledTotalNetRevenue)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1">
                  <Truck className="w-2.5 h-2.5 text-catalog-gold/70" /> Frete:
                </span>
                <span className="font-medium text-white">{formatBRL(financial.settledTotalShipping)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Subtotais e Métricas de Apoio */}
        <div className="mt-4 pt-3 border-t border-catalog-gold/15 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-catalog-muted flex items-center gap-1.5 font-mono">
              <Clock className="w-3.5 h-3.5 text-catalog-gold" />
              Pendente em Aprovação ({financial.pendingOrdersCount})
            </span>
            <span className="font-mono text-catalog-gold font-medium">
              {formatBRL(financial.pendingRevenue)}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-catalog-muted font-mono">Ticket Médio (Pagos)</span>
            <span className="font-mono text-white font-medium">
              {formatBRL(financial.averageTicket)}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-catalog-muted font-mono">Conversão de Vendas</span>
            <span className="font-mono text-emerald-400 font-medium">
              {financial.paymentConversionRatePct}% ({financial.paidOrdersCount} de {financial.totalOrdersCount})
            </span>
          </div>
        </div>
      </div>

      {/* PIX Gateway Status Badge */}
      <div className="mt-4 pt-3 border-t border-catalog-gold/15">
        {financial.pixConfig.hasPixKey ? (
          <div className="flex items-center justify-between bg-emerald-950/40 border border-emerald-500/40 px-3 py-1.5 rounded-xl text-[11px] text-emerald-400 font-mono">
            <div className="flex items-center gap-1.5 truncate">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">PIX Ativo ({financial.pixConfig.pixKeyType}): {financial.pixConfig.pixKeyMasked}</span>
            </div>
            <Link
              href="/admin/settings"
              className="hover:underline ml-1 shrink-0 text-emerald-300 font-semibold"
            >
              Alterar
            </Link>
          </div>
        ) : (
          <div className="flex items-center justify-between bg-catalog-gold/15 border border-catalog-gold/40 px-3 py-1.5 rounded-xl text-[11px] text-catalog-gold font-mono">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Chave PIX não cadastrada</span>
            </div>
            <Link
              href="/admin/settings"
              className="underline font-semibold hover:text-white"
            >
              Configurar
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};
