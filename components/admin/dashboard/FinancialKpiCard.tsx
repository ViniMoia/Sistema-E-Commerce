'use client';

import React from 'react';
import Link from 'next/link';
import { TrendingUp, Clock, CheckCircle2, AlertCircle, ArrowUpRight, QrCode } from 'lucide-react';
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
  return (
    <div className="glass-panel rounded-xl p-5 border border-[#DDAF02]/20 hover:border-[#DDAF02]/40 transition-all duration-300 flex flex-col justify-between group">
      {/* Top Header */}
      <div>
        <div className="flex items-start justify-between mb-3">
          <div className="p-2.5 rounded-lg bg-[#DDAF02]/10 border border-[#DDAF02]/20 text-[#DDAF02]">
            <TrendingUp className="w-5 h-5" />
          </div>
          <Link
            href="/admin/orders"
            className="text-xs text-zinc-400 hover:text-[#DDAF02] font-mono flex items-center gap-1 transition-colors"
          >
            <span>Ver Pedidos</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <p className="text-zinc-400 text-xs font-mono tracking-wider uppercase">
          Receita Confirmada (PIX Liquidado)
        </p>
        <p className="text-3xl font-bold tracking-tight text-[#DDAF02] mt-1">
          {formatBRL(financial.settledRevenue)}
        </p>

        {/* Subtotais Financeiros */}
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
