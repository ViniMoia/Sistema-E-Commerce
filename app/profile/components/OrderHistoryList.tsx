"use client";

import { Package, Calendar, ChevronRight } from "lucide-react";
import { UserOrder } from "../types";

interface OrderHistoryListProps {
  orders: UserOrder[];
}

export function OrderHistoryList({ orders }: OrderHistoryListProps) {
  if (orders.length === 0) {
    return (
      <div className="text-center py-12 flex flex-col items-center">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/10">
          <Package className="w-8 h-8 text-zinc-500" />
        </div>
        <h3 className="text-xl font-medium mb-2">Nenhum pedido encontrado</h3>
        <p className="text-zinc-400 max-w-sm">
          Você ainda não realizou nenhuma compra. Explore nossa loja para encontrar produtos incríveis.
        </p>
      </div>
    );
  }

  const statusMap: Record<string, { label: string; color: string }> = {
    PENDING: { label: "Pendente", color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
    PAID: { label: "Aprovado", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
    SHIPPED: { label: "Enviado", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
    DELIVERED: { label: "Entregue", color: "bg-green-500/10 text-green-400 border-green-500/20" },
    CANCELLED: { label: "Cancelado", color: "bg-red-500/10 text-red-400 border-red-500/20" },
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold mb-6">Histórico de Pedidos</h2>
      
      <div className="space-y-4">
        {orders.map((order, index) => {
          const currentStatus = statusMap[order.status] || { label: order.status, color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" };
          
          return (
            <div 
              key={order.id} 
              className="flashlight-card p-6 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-colors flex flex-col gap-6 animate-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Top Row: Order info and Status */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-xl text-white">Pedido #{order.orderNumber}</span>
                    <span className={`px-3 py-1 text-xs font-semibold border rounded-full ${currentStatus.color}`}>
                      {currentStatus.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(order.createdAt).toLocaleDateString('pt-BR')}</span>
                    {order.trackingCode && (
                      <>
                        <span className="mx-2">•</span>
                        <span className="text-[var(--primary)] font-mono tracking-wider">
                          Rastreio: {order.trackingCode}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-6 self-start sm:self-center">
                  <div className="text-left sm:text-right">
                    <p className="text-sm text-zinc-400 uppercase tracking-widest font-medium mb-1">Total</p>
                    <p className="font-bold text-2xl text-white">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom Row: Items List */}
              <div className="space-y-3">
                <h4 className="text-xs uppercase tracking-widest text-zinc-500 font-bold">Itens ({order.items.length})</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-black/40 p-3 rounded-lg border border-white/5">
                      <div className="flex flex-col">
                        <span className="font-medium text-zinc-200 truncate max-w-[180px] sm:max-w-[200px]" title={item.name}>
                          {item.quantity}x {item.name}
                        </span>
                        {(item.color || item.size) && (
                          <span className="text-xs text-zinc-500 mt-1">
                            {item.color} {item.color && item.size && '|'} {item.size}
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-zinc-400 whitespace-nowrap">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
