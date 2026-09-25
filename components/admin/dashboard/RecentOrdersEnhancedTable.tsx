'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Truck,
  Store,
  MessageCircle,
  AlertTriangle,
  Check,
  Copy,
  ChevronRight,
  Award,
} from 'lucide-react';
import { toast } from 'sonner';
import { OrderDetailDrawer } from '@/components/admin/orders/OrderDetailDrawer';
import type { RecentOrderDashboardDTO } from '@/types/dashboard';

interface RecentOrdersEnhancedTableProps {
  orders: RecentOrderDashboardDTO[];
}

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  PENDING: {
    label: 'Pendente',
    className: 'bg-catalog-gold/15 border-catalog-gold/50 text-catalog-gold',
  },
  PAID: {
    label: 'Pago',
    className: 'bg-emerald-950/60 border-emerald-500/50 text-emerald-400',
  },
  CONFIRMED: {
    label: 'Confirmado',
    className: 'bg-emerald-950/60 border-emerald-500/50 text-emerald-400',
  },
  SHIPPED: {
    label: 'Enviado',
    className: 'bg-sky-950/60 border-sky-500/50 text-sky-400',
  },
  DELIVERED: {
    label: 'Entregue',
    className: 'bg-emerald-950/60 border-emerald-500/50 text-emerald-400',
  },
  CANCELLED: {
    label: 'Cancelado',
    className: 'bg-red-950/60 border-red-500/50 text-red-400',
  },
};

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export const RecentOrdersEnhancedTable: React.FC<RecentOrdersEnhancedTableProps> = ({
  orders,
}) => {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [copiedTracking, setCopiedTracking] = useState<string | null>(null);

  const copyToClipboard = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedTracking(code);
    toast.success(`Código de rastreio ${code} copiado!`);
    setTimeout(() => setCopiedTracking(null), 2000);
  };

  const openWhatsApp = (phone: string, orderNumber: number, customerName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const cleanPhone = phone.replace(/\D/g, '');
    const text = encodeURIComponent(
      `Olá ${customerName}! Aqui é da Continental Estética Automotiva sobre seu pedido #${orderNumber}.`
    );
    window.open(`https://wa.me/55${cleanPhone}?text=${text}`, '_blank');
  };

  return (
    <>
      <div className="bg-catalog-card rounded-2xl border border-catalog-gold/30 overflow-hidden shadow-sm">
        {/* Header da Tabela */}
        <div className="px-6 py-4 border-b border-catalog-gold/20 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-catalog-gold font-mono tracking-[0.2em] uppercase mb-0.5 font-bold">
              Atividade & Expedição
            </p>
            <h2 className="text-white font-semibold tracking-tight text-base uppercase">
              Pedidos Recentes
            </h2>
          </div>
          <Link
            href="/admin/orders"
            className="text-xs text-catalog-muted hover:text-catalog-gold transition-colors font-mono tracking-wider flex items-center gap-1"
          >
            <span>Ver todos</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Listagem de Pedidos */}
        {orders.length === 0 ? (
          <div className="px-6 py-12 text-center text-catalog-muted text-sm font-mono">
            Nenhum pedido encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#050B14] border-b border-catalog-gold/30 text-[11px] font-mono font-bold uppercase tracking-wider text-catalog-gold">
                  <th className="py-3.5 px-4">Pedido / Data</th>
                  <th className="py-3.5 px-4">Cliente & Contato</th>
                  <th className="py-3.5 px-4">Modalidade de Envio</th>
                  <th className="py-3.5 px-4">Rastreio / Expedição</th>
                  <th className="py-3.5 px-4">Fidelidade</th>
                  <th className="py-3.5 px-4 text-right">Total</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-catalog-gold/15">
                {orders.map((order) => {
                  const statusCfg = STATUS_CONFIG[order.status] ?? {
                    label: order.status,
                    className: 'bg-zinc-900 border-zinc-700 text-zinc-400',
                  };

                  return (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedOrderId(order.id)}
                      className="hover:bg-white/[0.02] cursor-pointer transition-colors group"
                    >
                      {/* 1. Pedido & Data */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="text-catalog-gold font-mono font-bold text-sm group-hover:underline">
                          #{order.orderNumber}
                        </span>
                        <p className="text-[10px] text-catalog-muted font-mono mt-0.5">
                          {new Date(order.createdAt).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </td>

                      {/* 2. Cliente & Contato */}
                      <td className="py-3.5 px-4 max-w-[200px]">
                        <p className="text-white font-medium truncate text-sm">
                          {order.customer.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-catalog-muted text-[11px] truncate">
                            {order.customer.email}
                          </span>
                          {order.customer.phone && (
                            <button
                              type="button"
                              onClick={(e) =>
                                openWhatsApp(
                                  order.customer.phone!,
                                  order.orderNumber,
                                  order.customer.name,
                                  e
                                )
                              }
                              title="Contatar no WhatsApp"
                              className="text-[#25D366] hover:text-emerald-300 p-0.5 rounded hover:bg-emerald-500/10 transition-colors"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* 3. Modalidade de Frete */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {order.deliveryType === 'PICKUP' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-catalog-gold/15 text-catalog-gold border border-catalog-gold/40">
                            <Store className="w-3 h-3" />
                            <span>Retirada Balcão</span>
                          </span>
                        ) : order.deliveryType === 'NONE' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-[#0B132B] text-slate-300 border border-catalog-gold/25">
                            <MessageCircle className="w-3 h-3 text-[#25D366]" />
                            <span>A Combinar</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-[#0B132B] text-slate-300 border border-catalog-gold/25">
                            <Truck className="w-3 h-3 text-catalog-gold" />
                            <span>
                              {order.shippingServiceName ||
                                order.shippingProvider ||
                                'Entrega'}
                            </span>
                          </span>
                        )}
                      </td>

                      {/* 4. Rastreio & Expedição */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {order.isAwaitingDispatch ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-catalog-gold/20 text-catalog-gold border border-catalog-gold/50 animate-pulse">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Sem Rastreio</span>
                          </span>
                        ) : order.trackingCode ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-emerald-400 font-medium text-[11px] bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded-md">
                              {order.trackingCode}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => copyToClipboard(order.trackingCode!, e)}
                              title="Copiar Código"
                              className="text-catalog-muted hover:text-catalog-gold transition-colors"
                            >
                              {copiedTracking === order.trackingCode ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        ) : order.deliveryType === 'PICKUP' ? (
                          <span className="text-catalog-muted font-mono text-[11px]">
                            Balcão da Loja
                          </span>
                        ) : (
                          <span className="text-zinc-600 font-mono text-[11px]">
                            —
                          </span>
                        )}
                      </td>

                      {/* 5. Fidelidade */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {order.pointsRedeemed > 0 ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-400">
                            <Award className="w-3 h-3" />
                            <span>-{order.pointsRedeemed} pts</span>
                            <span className="text-catalog-muted text-[10px]">
                              ({formatBRL(order.pointsDiscountValue)})
                            </span>
                          </span>
                        ) : order.pointsEarned > 0 ? (
                          <span className="font-mono text-[11px] text-catalog-gold font-medium">
                            +{order.pointsEarned} pts
                          </span>
                        ) : (
                          <span className="text-zinc-600 font-mono text-[11px]">—</span>
                        )}
                      </td>

                      {/* 6. Total do Pedido */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <p className="text-white font-bold font-mono text-sm">
                          {formatBRL(order.total)}
                        </p>
                        {order.shippingCost > 0 && (
                          <p className="text-[10px] text-catalog-muted font-mono">
                            Frete: {formatBRL(order.shippingCost)}
                          </p>
                        )}
                      </td>

                      {/* 7. Status Badge */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border ${statusCfg.className}`}
                        >
                          {statusCfg.label}
                        </span>
                      </td>

                      {/* 8. Botão de Ação */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedOrderId(order.id)}
                          className="px-3 py-1 rounded-full border border-catalog-gold/45 bg-transparent hover:bg-catalog-gold/20 text-catalog-gold font-mono text-[11px] uppercase tracking-wider transition-all"
                        >
                          Detalhes
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drawer de Detalhes do Pedido Integrado */}
      {selectedOrderId && (
        <OrderDetailDrawer
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
          onStatusUpdate={() => {}}
        />
      )}
    </>
  );
};
