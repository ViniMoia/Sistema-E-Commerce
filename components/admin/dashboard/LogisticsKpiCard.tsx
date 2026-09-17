'use client';

import React from 'react';
import Link from 'next/link';
import { Truck, ArrowUpRight, CheckCircle2, XCircle, Store, MessageCircle, Box } from 'lucide-react';
import type { DashboardLogisticsDTO } from '@/types/dashboard';

interface LogisticsKpiCardProps {
  logistics: DashboardLogisticsDTO;
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export const LogisticsKpiCard: React.FC<LogisticsKpiCardProps> = ({ logistics }) => {
  const totalShipments =
    logistics.deliveryOrdersCount +
    logistics.pickupOrdersCount +
    logistics.customFreightOrdersCount;

  return (
    <div className="glass-panel rounded-xl p-5 border border-sky-500/20 hover:border-sky-500/40 transition-all duration-300 flex flex-col justify-between group">
      <div>
        <div className="flex items-start justify-between mb-3">
          <div className="p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
            <Truck className="w-5 h-5" />
          </div>
          <Link
            href="/admin/freight"
            className="text-xs text-zinc-400 hover:text-sky-400 font-mono flex items-center gap-1 transition-colors"
          >
            <span>Gerenciar Frete</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <p className="text-zinc-400 text-xs font-mono tracking-wider uppercase">
          Expedição & Frete Multi-Provedor
        </p>
        <p className="text-3xl font-bold tracking-tight text-sky-400 mt-1">
          {formatBRL(logistics.totalShippingRevenue)}
        </p>

        {/* Subtotais de Logística */}
        <div className="mt-4 pt-3 border-t border-white/5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <Box className="w-3.5 h-3.5 text-sky-400" />
              Entregas em Domicílio
            </span>
            <span className="font-mono text-white font-medium">
              {logistics.deliveryOrdersCount} envios
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-emerald-400" />
              Retiradas no Balcão (Grátis)
            </span>
            <span className="font-mono text-emerald-400 font-medium">
              {logistics.pickupOrdersCount} pedidos
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5 text-purple-400" />
              A Combinar via WhatsApp
            </span>
            <span className="font-mono text-purple-400 font-medium">
              {logistics.customFreightOrdersCount} pedidos
            </span>
          </div>
        </div>
      </div>

      {/* Provedores Ativos */}
      <div className="mt-4 pt-3 border-t border-white/5">
        <p className="text-[10px] text-zinc-500 font-mono tracking-wider uppercase mb-1.5">
          Integrações Logísticas
        </p>
        <div className="grid grid-cols-3 gap-1.5 text-[11px] font-mono">
          {/* Correios */}
          <div className="flex items-center gap-1 bg-white/[0.03] px-2 py-1 rounded border border-white/5 truncate">
            {logistics.providerStatus.enableCorreios ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="w-3 h-3 text-zinc-500 shrink-0" />
            )}
            <span className="truncate text-zinc-300">Correios</span>
          </div>

          {/* J&T Express */}
          <div className="flex items-center gap-1 bg-white/[0.03] px-2 py-1 rounded border border-white/5 truncate">
            {logistics.providerStatus.hasJtExpressMatrix ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="w-3 h-3 text-zinc-500 shrink-0" />
            )}
            <span className="truncate text-zinc-300">J&T Express</span>
          </div>

          {/* Balcão */}
          <div className="flex items-center gap-1 bg-white/[0.03] px-2 py-1 rounded border border-white/5 truncate">
            {logistics.providerStatus.enablePickup ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="w-3 h-3 text-zinc-500 shrink-0" />
            )}
            <span className="truncate text-zinc-300">Balcão</span>
          </div>
        </div>
      </div>
    </div>
  );
};
