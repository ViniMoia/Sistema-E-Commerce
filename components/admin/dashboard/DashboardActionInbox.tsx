'use client';

import React from 'react';
import Link from 'next/link';
import { Package, Store, Clock, AlertTriangle, ArrowRight, MessageCircle } from 'lucide-react';
import type { DashboardActionInboxDTO } from '@/types/dashboard';

interface DashboardActionInboxProps {
  inbox: DashboardActionInboxDTO;
  whatsappNumber?: string | null;
}

export const DashboardActionInbox: React.FC<DashboardActionInboxProps> = ({
  inbox,
  whatsappNumber,
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
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
          </span>
          <p className="text-xs text-amber-400 font-mono tracking-wider uppercase font-semibold">
            Inbox Operacional de Ações Imediatas
          </p>
        </div>
        <span className="text-[11px] font-mono text-zinc-500">
          {totalActionCount} {totalActionCount === 1 ? 'pendência requer' : 'pendências requerem'} atenção
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* 1. Pedidos Pagos que precisam de despacho / rastreio */}
        <Link
          href="/admin/orders?status=PAID"
          className={`
            group relative overflow-hidden rounded-xl p-4 border transition-all duration-300
            ${
              inbox.ordersAwaitingDispatchCount > 0
                ? 'bg-amber-500/10 border-amber-500/30 hover:border-amber-400 hover:shadow-lg hover:shadow-amber-500/10'
                : 'bg-zinc-900/40 border-white/5 opacity-60'
            }
          `}
        >
          <div className="flex items-start justify-between">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
              <Package className="w-5 h-5" />
            </div>
            <span
              className={`
                px-2.5 py-0.5 rounded-full text-xs font-mono font-bold
                ${
                  inbox.ordersAwaitingDispatchCount > 0
                    ? 'bg-amber-500 text-black'
                    : 'bg-zinc-800 text-zinc-400'
                }
              `}
            >
              {inbox.ordersAwaitingDispatchCount}
            </span>
          </div>
          <div className="mt-3">
            <h4 className="text-sm font-semibold text-white group-hover:text-amber-400 transition-colors">
              Aguardando Despacho
            </h4>
            <p className="text-xs text-zinc-400 mt-0.5">
              Pedidos pagos necessitando de envio e código de rastreamento
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[11px] text-amber-400/90 font-mono">
            <span>Visualizar envios</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        {/* 2. Retiradas na Loja Física */}
        <Link
          href="/admin/orders?deliveryType=PICKUP"
          className={`
            group relative overflow-hidden rounded-xl p-4 border transition-all duration-300
            ${
              inbox.ordersAwaitingPickupCount > 0
                ? 'bg-sky-500/10 border-sky-500/30 hover:border-sky-400 hover:shadow-lg hover:shadow-sky-500/10'
                : 'bg-zinc-900/40 border-white/5 opacity-60'
            }
          `}
        >
          <div className="flex items-start justify-between">
            <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400">
              <Store className="w-5 h-5" />
            </div>
            <span
              className={`
                px-2.5 py-0.5 rounded-full text-xs font-mono font-bold
                ${
                  inbox.ordersAwaitingPickupCount > 0
                    ? 'bg-sky-500 text-black'
                    : 'bg-zinc-800 text-zinc-400'
                }
              `}
            >
              {inbox.ordersAwaitingPickupCount}
            </span>
          </div>
          <div className="mt-3">
            <h4 className="text-sm font-semibold text-white group-hover:text-sky-400 transition-colors">
              Retiradas no Balcão
            </h4>
            <p className="text-xs text-zinc-400 mt-0.5">
              Pedidos prontos aguardando retirada presencial do cliente
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[11px] text-sky-400/90 font-mono">
            <span>Ver pedidos de balcão</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        {/* 3. Pedidos Pendentes de Pagamento PIX */}
        <Link
          href="/admin/orders?status=PENDING"
          className={`
            group relative overflow-hidden rounded-xl p-4 border transition-all duration-300
            ${
              inbox.ordersPendingPixCount > 0
                ? 'bg-purple-500/10 border-purple-500/30 hover:border-purple-400 hover:shadow-lg hover:shadow-purple-500/10'
                : 'bg-zinc-900/40 border-white/5 opacity-60'
            }
          `}
        >
          <div className="flex items-start justify-between">
            <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
              <Clock className="w-5 h-5" />
            </div>
            <span
              className={`
                px-2.5 py-0.5 rounded-full text-xs font-mono font-bold
                ${
                  inbox.ordersPendingPixCount > 0
                    ? 'bg-purple-500 text-white'
                    : 'bg-zinc-800 text-zinc-400'
                }
              `}
            >
              {inbox.ordersPendingPixCount}
            </span>
          </div>
          <div className="mt-3">
            <h4 className="text-sm font-semibold text-white group-hover:text-purple-400 transition-colors">
              Aguardando PIX (Follow-up)
            </h4>
            <p className="text-xs text-zinc-400 mt-0.5">
              Pedidos pendentes nas últimas horas para contato e cobrança amigável
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[11px] text-purple-400/90 font-mono">
            <span>Cobrança via WhatsApp</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </div>
    </div>
  );
};
