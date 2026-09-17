"use client";

import { useState } from "react";
import { Package, Calendar, ExternalLink, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { UserOrder } from "../types";
import { getTrackingInfo } from "@/lib/freight/tracking-url";

interface OrderHistoryListProps {
  orders: UserOrder[];
}

export function OrderHistoryList({ orders }: OrderHistoryListProps) {
  const [orderList, setOrderList] = useState<UserOrder[]>(orders);
  const [confirmModalOrder, setConfirmModalOrder] = useState<UserOrder | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  if (orderList.length === 0) {
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
    SHIPPED: { label: "Em Trânsito (Enviado)", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
    DELIVERED: { label: "Concluído (Entregue)", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
    CANCELLED: { label: "Cancelado", color: "bg-red-500/10 text-red-400 border-red-500/20" },
  };

  const handleConfirmDelivery = async (orderId: string) => {
    setIsSubmitting(true);
    setModalError(null);

    try {
      const res = await fetch(`/api/orders/${orderId}/confirm-delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Não foi possível confirmar o recebimento.");
      }

      // Atualiza a lista de pedidos localmente
      setOrderList((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, status: "DELIVERED", deliveredConfirmedAt: new Date() }
            : o
        )
      );

      setConfirmModalOrder(null);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold mb-6">Histórico de Pedidos</h2>

      <div className="space-y-4">
        {orderList.map((order, index) => {
          const currentStatus = statusMap[order.status] || {
            label: order.status,
            color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
          };

          const tracking = getTrackingInfo(order.trackingCode, order.shippingServiceName);
          const canConfirmDelivery =
            order.status === "SHIPPED" ||
            (order.status === "PAID" &&
              (order.deliveryType === "PICKUP" || order.deliveryType === "NONE"));

          return (
            <div
              key={order.id}
              className="p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-colors flex flex-col gap-6 animate-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Top Row: Order info and Status */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-bold text-xl text-white">
                      Pedido #{order.orderNumber}
                    </span>
                    <span
                      className={`px-3 py-1 text-xs font-semibold border rounded-full ${currentStatus.color}`}
                    >
                      {currentStatus.label}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-400 pt-1">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-zinc-500" />
                      <span>{new Date(order.createdAt).toLocaleDateString("pt-BR")}</span>
                    </div>

                    {tracking && (
                      <>
                        <span className="text-zinc-600">•</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-zinc-300">
                            {tracking.carrier}: {tracking.trackingCode}
                          </span>
                          {tracking.trackingUrl && (
                            <a
                              href={tracking.trackingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-[#DDAF02] hover:text-[#c49b02] font-semibold hover:underline"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Rastrear
                            </a>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:items-end gap-2 self-start sm:self-center">
                  <p className="text-xs text-zinc-400 uppercase tracking-widest font-medium">Total</p>
                  <p className="font-bold text-2xl text-white">
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(order.total)}
                  </p>
                </div>
              </div>

              {/* Middle Row: Action for delivery confirmation */}
              {canConfirmDelivery && (
                <div className="bg-[#DDAF02]/10 border border-[#DDAF02]/30 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                      <Package className="w-4 h-4 text-[#DDAF02]" />
                      {order.deliveryType === "PICKUP"
                        ? "Seu produto já está pronto para retirada!"
                        : "Seu produto está a caminho!"}
                    </p>
                    <p className="text-xs text-zinc-400">
                      Já recebeu ou retirou sua encomenda? Confirme para concluir o pedido sem precisar contatar o atendimento.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setModalError(null);
                      setConfirmModalOrder(order);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#DDAF02] text-black font-semibold text-xs hover:bg-[#c49b02] transition-colors whitespace-nowrap shadow-md cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Confirmar Recebimento
                  </button>
                </div>
              )}

              {/* Bottom Row: Items List */}
              <div className="space-y-3">
                <h4 className="text-xs uppercase tracking-widest text-zinc-500 font-bold">
                  Itens ({order.items.length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {order.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center bg-black/40 p-3 rounded-lg border border-white/5"
                    >
                      <div className="flex flex-col">
                        <span
                          className="font-medium text-zinc-200 truncate max-w-[180px] sm:max-w-[200px]"
                          title={item.name}
                        >
                          {item.quantity}x {item.name}
                        </span>
                        {(item.color || item.size) && (
                          <span className="text-xs text-zinc-500 mt-1">
                            {item.color} {item.color && item.size && "|"} {item.size}
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-zinc-400 whitespace-nowrap">
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(item.price)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de Confirmação de Recebimento */}
      {confirmModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#111111] border border-white/10 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3 text-[#DDAF02]">
              <div className="p-2.5 rounded-xl bg-[#DDAF02]/10 border border-[#DDAF02]/20">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Confirmar Recebimento</h3>
                <p className="text-xs text-zinc-400">Pedido #{confirmModalOrder.orderNumber}</p>
              </div>
            </div>

            <p className="text-sm text-zinc-300 leading-relaxed">
              Você confirma que recebeu todos os produtos deste pedido em perfeitas condições?
              Esta ação atualizará o status do pedido para <strong className="text-white">Concluído</strong> de forma imediata e definitiva.
            </p>

            {modalError && (
              <div className="flex items-center gap-2 p-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModalOrder(null)}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDelivery(confirmModalOrder.id)}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-black bg-[#DDAF02] hover:bg-[#c49b02] rounded-lg transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Confirmando...
                  </>
                ) : (
                  "Sim, Confirmar Recebimento"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
