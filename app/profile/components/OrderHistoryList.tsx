"use client";

import { useState } from "react";
import {
  Package,
  Calendar,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Truck,
  PackageSearch,
  Check
} from "lucide-react";
import { UserOrder } from "../types";
import { getTrackingInfo } from "@/lib/freight/tracking-url";
import { Badge } from "@/components/ui/primitives/Badge";
import { OrderStatus } from "@prisma/client";
import { getOptimizedImageUrl } from "@/lib/utils";

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
      <div className="text-center py-16 flex flex-col items-center justify-center space-y-3">
        <div className="w-16 h-16 rounded-full bg-white/5 border border-catalog-gold/30 flex items-center justify-center text-catalog-gold shadow-[0_0_20px_rgba(240,180,14,0.15)]">
          <PackageSearch className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold font-continental-display text-white">
          Nenhum Pedido Encontrado
        </h3>
        <p className="text-xs text-catalog-muted max-w-sm font-light leading-relaxed">
          Você ainda não realizou compras em nossa loja. Explore nosso catálogo para descobrir a linha completa de estética automotiva.
        </p>
      </div>
    );
  }

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
      <div className="flex items-center justify-between border-b border-catalog-gold/20 pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-continental-display text-white tracking-tight">
            Histórico de Pedidos
          </h2>
          <p className="text-xs text-catalog-muted font-light mt-0.5">
            Acompanhe o status de pagamento, faturamento e rastreamento das suas compras.
          </p>
        </div>
        <span className="text-xs font-mono text-catalog-muted">
          {orderList.length} {orderList.length === 1 ? "pedido" : "pedidos"}
        </span>
      </div>

      <div className="space-y-5">
        {orderList.map((order, index) => {
          const tracking = getTrackingInfo(order.trackingCode, order.shippingServiceName);
          const canConfirmDelivery =
            order.status === "SHIPPED" ||
            (order.status === "PAID" &&
              (order.deliveryType === "PICKUP" || order.deliveryType === "NONE"));

          return (
            <div
              key={order.id}
              className="p-6 rounded-2xl border border-catalog-gold/25 bg-[#050B14] hover:border-catalog-gold/45 transition-all shadow-xl flex flex-col gap-5 animate-in fade-in duration-300"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              {/* Linha de Topo: Número, Status, Data e Total */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-catalog-gold/15 pb-4">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono font-bold text-lg sm:text-xl text-catalog-gold">
                      Pedido #{order.orderNumber}
                    </span>
                    <Badge status={order.status as OrderStatus} />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-catalog-muted">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-catalog-gold/70" />
                      <span>{new Date(order.createdAt).toLocaleDateString("pt-BR")}</span>
                    </div>

                    {tracking && (
                      <>
                        <span className="text-catalog-gold/40">•</span>
                        <div className="flex items-center gap-2">
                          <Truck className="w-3.5 h-3.5 text-catalog-gold/70" />
                          <span className="text-neutral-300">
                            {tracking.carrier}: {tracking.trackingCode}
                          </span>
                          {tracking.trackingUrl && (
                            <a
                              href={tracking.trackingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-catalog-gold hover:underline font-bold"
                            >
                              <span>Rastrear</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:items-end gap-0.5 self-start sm:self-center">
                  <span className="text-[10px] text-catalog-muted uppercase font-mono tracking-widest">
                    Total do Pedido
                  </span>
                  <span className="font-mono font-bold text-2xl text-white">
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(order.total)}
                  </span>
                </div>
              </div>

              {/* Linha Intermediária: Alerta & Ação para Confirmação de Entrega */}
              {canConfirmDelivery && (
                <div className="bg-catalog-gold/10 border border-catalog-gold/30 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold font-mono text-white flex items-center gap-2">
                      <Package className="w-4 h-4 text-catalog-gold" />
                      <span>
                        {order.deliveryType === "PICKUP"
                          ? "Seu pedido está disponível para retirada no balcão!"
                          : "Sua encomenda já foi despachada pela transportadora!"}
                      </span>
                    </p>
                    <p className="text-[11px] text-catalog-muted font-light leading-relaxed">
                      Já recebeu seus produtos em mãos? Confirme o recebimento para concluir o pedido no sistema.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setModalError(null);
                      setConfirmModalOrder(order);
                    }}
                    className="btn-shimmer inline-flex items-center gap-2 px-5 py-2 rounded-full bg-gradient-to-r from-[#F0B40E] to-[#DDAF02] text-black font-bold text-xs uppercase font-mono tracking-wider shadow-md hover:shadow-lg transition-all cursor-pointer shrink-0"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-black" />
                    <span>Confirmar Recebimento</span>
                  </button>
                </div>
              )}

              {/* Linha Inferior: Produtos do Pedido */}
              <div className="space-y-2.5">
                <span className="text-[10px] uppercase tracking-wider text-catalog-gold font-mono font-semibold">
                  Itens Inclusos ({order.items.length})
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {order.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-xl bg-[#0B132B]/50 border border-catalog-gold/20 gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {item.imageUrl ? (
                          <div className="w-12 h-12 rounded-lg bg-white p-1 flex items-center justify-center shrink-0 border border-white/10">
                            <img
                              src={getOptimizedImageUrl(item.imageUrl, 100)}
                              alt={item.name}
                              className="w-full h-full object-contain"
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-catalog-gold/10 border border-catalog-gold/30 flex items-center justify-center text-catalog-gold shrink-0">
                            <Package className="w-5 h-5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-xs text-white truncate" title={item.name}>
                            {item.quantity}x {item.name}
                          </p>
                          {(item.color || item.size) && (
                            <p className="text-[10px] font-mono text-catalog-muted mt-0.5">
                              {item.color} {item.color && item.size && "•"} {item.size}
                            </p>
                          )}
                        </div>
                      </div>

                      <span className="font-mono font-bold text-xs text-catalog-gold whitespace-nowrap shrink-0">
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

      {/* Modal Canônico de Confirmação de Recebimento */}
      {confirmModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#070D18] border border-catalog-gold/30 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-catalog-gold/15 border border-catalog-gold/30 flex items-center justify-center text-catalog-gold shadow-[0_0_15px_rgba(240,180,14,0.2)]">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold font-continental-display text-white tracking-tight">
                  Confirmar Entrega
                </h3>
                <p className="text-xs font-mono text-catalog-muted">
                  Pedido #{confirmModalOrder.orderNumber}
                </p>
              </div>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed font-light">
              Você confirma que recebeu todos os produtos deste pedido em perfeitas condições?
              Esta ação atualizará o status do pedido para <strong className="text-emerald-400 font-semibold">Concluído</strong> de forma imediata e definitiva no sistema.
            </p>

            {modalError && (
              <div className="flex items-center gap-2 p-3 text-xs font-mono text-red-400 bg-red-950/40 border border-red-500/30 rounded-xl">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-catalog-gold/20">
              <button
                type="button"
                onClick={() => setConfirmModalOrder(null)}
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-mono font-medium text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-all cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDelivery(confirmModalOrder.id)}
                disabled={isSubmitting}
                className="btn-shimmer inline-flex items-center gap-2 px-6 py-2 text-xs font-mono font-bold text-black bg-gradient-to-r from-[#F0B40E] to-[#DDAF02] rounded-full transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                    <span>Confirmando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5 text-black" />
                    <span>Sim, Confirmar Recebimento</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
