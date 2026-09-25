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
  return (
    <div className="bg-catalog-card rounded-2xl p-6 border border-catalog-gold/30 hover:border-catalog-gold/60 transition-all duration-300 flex flex-col justify-between group shadow-sm">
      <div>
        <div className="flex items-start justify-between mb-3">
          <div className="p-2.5 rounded-xl bg-catalog-gold/10 border border-catalog-gold/25 text-catalog-gold">
            <Truck className="w-5 h-5" />
          </div>
          <Link
            href="/admin/freight"
            className="text-xs text-catalog-muted hover:text-catalog-gold font-mono flex items-center gap-1 transition-colors"
          >
            <span>Gerenciar Frete</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <p className="text-[10px] font-mono tracking-[0.2em] text-catalog-gold uppercase font-bold">
          Expedição & Frete Multi-Provedor
        </p>
        <p className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-white mt-1">
          {formatBRL(logistics.totalShippingRevenue)}
        </p>

        {/* Subtotais de Logística */}
        <div className="mt-4 pt-3 border-t border-catalog-gold/15 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-catalog-muted flex items-center gap-1.5 font-mono">
              <Box className="w-3.5 h-3.5 text-catalog-gold" />
              Entregas em Domicílio
            </span>
            <span className="font-mono text-white font-medium">
              {logistics.deliveryOrdersCount} envios
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-catalog-muted flex items-center gap-1.5 font-mono">
              <Store className="w-3.5 h-3.5 text-emerald-400" />
              Retiradas no Balcão (Grátis)
            </span>
            <span className="font-mono text-emerald-400 font-medium">
              {logistics.pickupOrdersCount} pedidos
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-catalog-muted flex items-center gap-1.5 font-mono">
              <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
              A Combinar via WhatsApp
            </span>
            <span className="font-mono text-white font-medium">
              {logistics.customFreightOrdersCount} pedidos
            </span>
          </div>
        </div>
      </div>

      {/* Provedores Ativos */}
      <div className="mt-4 pt-3 border-t border-catalog-gold/15">
        <p className="text-[10px] text-catalog-gold/70 font-mono tracking-wider uppercase mb-1.5 font-semibold">
          Integrações Logísticas
        </p>
        <div className="grid grid-cols-3 gap-1.5 text-[11px] font-mono">
          {/* Correios */}
          <div className="flex items-center gap-1 bg-[#050B14]/80 px-2 py-1.5 rounded-lg border border-catalog-gold/20 truncate">
            {logistics.providerStatus.enableCorreios ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="w-3 h-3 text-catalog-muted shrink-0" />
            )}
            <span className="truncate text-slate-300">Correios</span>
          </div>

          {/* J&T Express */}
          <div className="flex items-center gap-1 bg-[#050B14]/80 px-2 py-1.5 rounded-lg border border-catalog-gold/20 truncate">
            {logistics.providerStatus.hasJtExpressMatrix ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="w-3 h-3 text-catalog-muted shrink-0" />
            )}
            <span className="truncate text-slate-300">J&T</span>
          </div>

          {/* Balcão */}
          <div className="flex items-center gap-1 bg-[#050B14]/80 px-2 py-1.5 rounded-lg border border-catalog-gold/20 truncate">
            {logistics.providerStatus.enablePickup ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="w-3 h-3 text-catalog-muted shrink-0" />
            )}
            <span className="truncate text-slate-300">Balcão</span>
          </div>
        </div>
      </div>
    </div>
  );
};
