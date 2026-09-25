'use client';

import React from 'react';
import Link from 'next/link';
import { Package, Store, Clock, ArrowRight, MessageCircle } from 'lucide-react';
import type { DashboardActionInboxDTO } from '@/types/dashboard';

interface DashboardActionInboxProps {
  inbox: DashboardActionInboxDTO;
  whatsappNumber?: string | null;
}

export const DashboardActionInbox: React.FC<DashboardActionInboxProps> = ({
  inbox,
}) => {
  const totalActionCount =
    inbox.ordersAwaitingDispatchCount +
    inbox.ordersAwaitingPickupCount +
    inbox.ordersPendingPixCount;

  if (totalActionCount === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F0B40E] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#F0B40E]"></span>
          </span>
          <p className="text-xs text-catalog-gold font-mono tracking-wider uppercase font-bold">
            Inbox Operacional de Ações Imediatas
          </p>
        </div>
        <span className="text-[11px] font-mono text-catalog-muted">
          {totalActionCount} {totalActionCount === 1 ? 'pendência requer' : 'pendências requerem'} atenção
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* 1. Pedidos Pagos que precisam de despacho / rastreio */}
        <Link
          href="/admin/orders?status=PAID"
          className={`
            group relative overflow-hidden rounded-2xl p-5 border transition-all duration-300
            ${
              inbox.ordersAwaitingDispatchCount > 0
                ? 'bg-catalog-card border-catalog-gold/45 hover:border-catalog-gold/80 hover:shadow-lg hover:shadow-black/50'
                : 'bg-catalog-card/40 border-catalog-gold/15 opacity-60'
            }
          `}
        >
          <div className="flex items-start justify-between">
            <div className="p-2.5 rounded-xl bg-catalog-gold/10 border border-catalog-gold/25 text-catalog-gold">
              <Package className="w-5 h-5" />
            </div>
            <span
              className={`
                px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border
                ${
                  inbox.ordersAwaitingDispatchCount > 0
                    ? 'bg-[#0B111E] border-catalog-gold/50 text-catalog-gold'
                    : 'bg-[#050B14] border-white/5 text-catalog-muted'
                }
              `}
            >
              {inbox.ordersAwaitingDispatchCount}
            </span>
          </div>
          <div className="mt-3">
            <h4 className="text-sm font-semibold text-white group-hover:text-catalog-gold transition-colors uppercase tracking-tight">
              Aguardando Despacho
            </h4>
            <p className="text-xs text-catalog-muted mt-1 leading-relaxed">
              Pedidos pagos necessitando de envio e código de rastreamento
            </p>
          </div>
          <div className="mt-4 pt-2.5 border-t border-catalog-gold/15 flex items-center justify-between text-[11px] text-catalog-gold font-mono uppercase tracking-wider">
            <span>Visualizar envios</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        {/* 2. Retiradas na Loja Física */}
        <Link
          href="/admin/orders?deliveryType=PICKUP"
          className={`
            group relative overflow-hidden rounded-2xl p-5 border transition-all duration-300
            ${
              inbox.ordersAwaitingPickupCount > 0
                ? 'bg-catalog-card border-catalog-gold/45 hover:border-catalog-gold/80 hover:shadow-lg hover:shadow-black/50'
                : 'bg-catalog-card/40 border-catalog-gold/15 opacity-60'
            }
          `}
        >
          <div className="flex items-start justify-between">
            <div className="p-2.5 rounded-xl bg-catalog-gold/10 border border-catalog-gold/25 text-catalog-gold">
              <Store className="w-5 h-5" />
            </div>
            <span
              className={`
                px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border
                ${
                  inbox.ordersAwaitingPickupCount > 0
                    ? 'bg-[#0B111E] border-catalog-gold/50 text-catalog-gold'
                    : 'bg-[#050B14] border-white/5 text-catalog-muted'
                }
              `}
            >
              {inbox.ordersAwaitingPickupCount}
            </span>
          </div>
          <div className="mt-3">
            <h4 className="text-sm font-semibold text-white group-hover:text-catalog-gold transition-colors uppercase tracking-tight">
              Retirada no Balcão
            </h4>
            <p className="text-xs text-catalog-muted mt-1 leading-relaxed">
              Pedidos aguardando separação para retirada pelo cliente
            </p>
          </div>
          <div className="mt-4 pt-2.5 border-t border-catalog-gold/15 flex items-center justify-between text-[11px] text-catalog-gold font-mono uppercase tracking-wider">
            <span>Ver retiradas</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        {/* 3. Pedidos Pendentes PIX */}
        <Link
          href="/admin/orders?status=PENDING"
          className={`
            group relative overflow-hidden rounded-2xl p-5 border transition-all duration-300
            ${
              inbox.ordersPendingPixCount > 0
                ? 'bg-catalog-card border-catalog-gold/45 hover:border-catalog-gold/80 hover:shadow-lg hover:shadow-black/50'
                : 'bg-catalog-card/40 border-catalog-gold/15 opacity-60'
            }
          `}
        >
          <div className="flex items-start justify-between">
            <div className="p-2.5 rounded-xl bg-catalog-gold/10 border border-catalog-gold/25 text-catalog-gold">
              <Clock className="w-5 h-5" />
            </div>
            <span
              className={`
                px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border
                ${
                  inbox.ordersPendingPixCount > 0
                    ? 'bg-[#0B111E] border-catalog-gold/50 text-catalog-gold'
                    : 'bg-[#050B14] border-white/5 text-catalog-muted'
                }
              `}
            >
              {inbox.ordersPendingPixCount}
            </span>
          </div>
          <div className="mt-3">
            <h4 className="text-sm font-semibold text-white group-hover:text-catalog-gold transition-colors uppercase tracking-tight">
              Aguardando Pagamento
            </h4>
            <p className="text-xs text-catalog-muted mt-1 leading-relaxed">
              Pedidos gerados que ainda não foram liquidados via PIX
            </p>
          </div>
          <div className="mt-4 pt-2.5 border-t border-catalog-gold/15 flex items-center justify-between text-[11px] text-catalog-gold font-mono uppercase tracking-wider">
            <span>Acompanhar</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </div>
    </div>
  );
};
