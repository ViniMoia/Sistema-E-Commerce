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
  ExternalLink,
  ChevronRight,
  Package,
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
    className: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  PAID: {
    label: 'Pago',
    className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  SHIPPED: {
    label: 'Enviado',
    className: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
  DELIVERED: {
    label: 'Entregue',
    className: 'bg-[#DDAF02]/10 text-[#DDAF02] border-[#DDAF02]/20',
  },
  CANCELLED: {
    label: 'Cancelado',
    className: 'bg-red-500/10 text-red-400 border-red-500/20',
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
      <div className="glass-panel rounded-xl border border-white/5 overflow-hidden">
        {/* Header da Tabela */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-[#DDAF02] font-mono tracking-[0.2em] uppercase mb-0.5">
              Atividade & Expedição
            </p>
            <h2 className="text-white font-semibold tracking-tight text-base">
              Pedidos Recentes
            </h2>
          </div>
          <Link
            href="/admin/orders"
            className="text-xs text-zinc-400 hover:text-[#DDAF02] transition-colors font-mono tracking-wider flex items-center gap-1"
          >
            <span>Ver todos</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Listagem de Pedidos */}
        {orders.length === 0 ? (
          <div className="px-6 py-12 text-center text-zinc-500 text-sm font-mono">
            Nenhum pedido encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-[11px] font-mono uppercase tracking-wider text-zinc-500 bg-white/[0.01]">
                  <th className="py-3 px-4">Pedido / Data</th>
                  <th className="py-3 px-4">Cliente & Contato</th>
                  <th className="py-3 px-4">Modalidade de Envio</th>
                  <th className="py-3 px-4">Rastreio / Expedição</th>
                  <th className="py-3 px-4">Fidelidade</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {orders.map((order) => {
                  const statusCfg = STATUS_CONFIG[order.status] ?? {
                    label: order.status,
                    className: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
                  };

                  return (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedOrderId(order.id)}
                      className="hover:bg-white/[0.02] cursor-pointer transition-colors group"
                    >
                      {/* 1. Pedido & Data */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="text-[#DDAF02] font-mono font-bold text-sm">
                          #{order.orderNumber}
                        </span>
                        <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
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
                          <span className="text-zinc-500 text-[11px] truncate">
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
                              className="text-emerald-400 hover:text-emerald-300 p-0.5 rounded hover:bg-emerald-500/10 transition-colors"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* 3. Modalidade de Frete */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {order.deliveryType === 'PICKUP' ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20">
                            <Store className="w-3 h-3" />
                            <span>Retirada Balcão</span>
                          </span>
                        ) : order.deliveryType === 'NONE' ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            <MessageCircle className="w-3 h-3" />
                            <span>A Combinar</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-mono bg-zinc-800/80 text-zinc-300 border border-white/5">
                            <Truck className="w-3 h-3 text-sky-400" />
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
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Sem Rastreio</span>
                          </span>
                        ) : order.trackingCode ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-emerald-400 font-medium text-[11px] bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                              {order.trackingCode}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => copyToClipboard(order.trackingCode!, e)}
                              title="Copiar Código"
                              className="text-zinc-500 hover:text-white transition-colors"
                            >
                              {copiedTracking === order.trackingCode ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        ) : order.deliveryType === 'PICKUP' ? (
                          <span className="text-zinc-500 font-mono text-[11px]">
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
                            <span className="text-zinc-500 text-[10px]">
                              ({formatBRL(order.pointsDiscountValue)})
                            </span>
                          </span>
                        ) : order.pointsEarned > 0 ? (
                          <span className="font-mono text-[11px] text-[#DDAF02]">
                            +{order.pointsEarned} pts
                          </span>
                        ) : (
                          <span className="text-zinc-600 font-mono text-[11px]">—</span>
                        )}
                      </td>

                      {/* 6. Total do Pedido */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <p className="text-white font-semibold font-mono text-sm">
                          {formatBRL(order.total)}
                        </p>
                        {order.shippingCost > 0 && (
                          <p className="text-[10px] text-zinc-500 font-mono">
                            Frete: {formatBRL(order.shippingCost)}
                          </p>
                        )}
                      </td>

                      {/* 7. Status Badge */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border ${statusCfg.className}`}
                        >
                          {statusCfg.label}
                        </span>
                      </td>

                      {/* 8. Botão de Ação */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedOrderId(order.id)}
                          className="px-2.5 py-1 rounded-md bg-white/[0.04] hover:bg-[#DDAF02] hover:text-black text-zinc-300 font-mono text-[11px] transition-all"
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
