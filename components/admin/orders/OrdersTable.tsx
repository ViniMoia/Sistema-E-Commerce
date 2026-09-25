'use client'

import * as React from 'react'
import { OrderStatus } from '@prisma/client'
import { Eye, Truck, Store, Clock, CheckCircle2, XCircle, Package } from 'lucide-react'

export interface OrderRow {
  id: string
  orderNumber: number
  createdAt: string
  customerName: string
  customerEmail: string
  status: OrderStatus
  deliveryType: 'DELIVERY' | 'PICKUP'
  total: number
  freightValue: number | null
}

export interface OrdersTableProps {
  data: OrderRow[]
  isLoading: boolean
  onSelectOrder: (orderId: string) => void
}

export function OrdersTable({ data, isLoading, onSelectOrder }: OrdersTableProps) {
  return (
    <div className="bg-catalog-card border border-catalog-gold/30 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#050B14] border-b border-catalog-gold/30">
              <th className="py-4 px-6 text-[11px] font-mono font-bold uppercase tracking-wider text-catalog-gold">
                Pedido / Data
              </th>
              <th className="py-4 px-6 text-[11px] font-mono font-bold uppercase tracking-wider text-catalog-gold">
                Cliente & Contato
              </th>
              <th className="py-4 px-6 text-[11px] font-mono font-bold uppercase tracking-wider text-catalog-gold">
                Envio
              </th>
              <th className="py-4 px-6 text-[11px] font-mono font-bold uppercase tracking-wider text-catalog-gold">
                Status
              </th>
              <th className="py-4 px-6 text-[11px] font-mono font-bold uppercase tracking-wider text-catalog-gold">
                Total
              </th>
              <th className="py-4 px-6 text-[11px] font-mono font-bold uppercase tracking-wider text-catalog-gold text-right">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-catalog-gold/15 text-xs font-mono">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-catalog-muted">
                  <span className="uppercase tracking-wider text-[11px]">
                    Carregando listagem de pedidos...
                  </span>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <Package className="w-10 h-10 text-catalog-muted mx-auto mb-3 opacity-40" />
                  <p className="text-white font-bold uppercase tracking-wide">Nenhum pedido localizado</p>
                  <p className="text-catalog-muted text-xs mt-1">
                    Não há transações que correspondam aos filtros ativos.
                  </p>
                </td>
              </tr>
            ) : (
              data.map((order) => {
                const date = new Date(order.createdAt)
                const formattedDate = new Intl.DateTimeFormat('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(date)

                return (
                  <tr
                    key={order.id}
                    className="hover:bg-white/[0.02] transition-colors group cursor-pointer"
                    onClick={() => onSelectOrder(order.id)}
                  >
                    {/* Número do Pedido e Data */}
                    <td className="py-3.5 px-6">
                      <span className="font-bold text-sm text-white font-mono group-hover:text-catalog-gold transition-colors block">
                        #{order.orderNumber}
                      </span>
                      <span className="text-[11px] text-catalog-muted font-mono mt-0.5 block">
                        {formattedDate}
                      </span>
                    </td>

                    {/* Cliente e E-mail */}
                    <td className="py-3.5 px-6">
                      <span className="font-semibold text-white block max-w-xs truncate">
                        {order.customerName}
                      </span>
                      <span className="text-[11px] text-catalog-muted truncate block max-w-xs mt-0.5">
                        {order.customerEmail || 'Sem e-mail'}
                      </span>
                    </td>

                    {/* Modalidade de Envio */}
                    <td className="py-3.5 px-6">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold bg-[#0B132B] border border-catalog-gold/30 text-slate-300">
                        {order.deliveryType === 'DELIVERY' ? (
                          <>
                            <Truck className="w-3 h-3 text-catalog-gold" />
                            <span>Entrega</span>
                          </>
                        ) : (
                          <>
                            <Store className="w-3 h-3 text-catalog-gold" />
                            <span>Balcão</span>
                          </>
                        )}
                      </span>
                    </td>

                    {/* Badges de Status Canônicas */}
                    <td className="py-3.5 px-6">
                      {order.status === 'PAID' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-500/50 text-emerald-400 font-mono text-[10px] uppercase font-bold inline-block">
                          Pago
                        </span>
                      )}
                      {order.status === 'PENDING' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-catalog-gold/15 border border-catalog-gold/50 text-catalog-gold font-mono text-[10px] uppercase font-bold inline-block">
                          Pendente
                        </span>
                      )}
                      {order.status === 'SHIPPED' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-sky-950/60 border border-sky-500/50 text-sky-400 font-mono text-[10px] uppercase font-bold inline-block">
                          Enviado
                        </span>
                      )}
                      {order.status === 'DELIVERED' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-500/50 text-emerald-400 font-mono text-[10px] uppercase font-bold inline-block">
                          Entregue
                        </span>
                      )}
                      {order.status === 'CANCELLED' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-red-950/60 border border-red-500/50 text-red-400 font-mono text-[10px] uppercase font-bold inline-block">
                          Cancelado
                        </span>
                      )}
                    </td>

                    {/* Total em Destaque Ouro */}
                    <td className="py-3.5 px-6">
                      <span className="text-sm font-bold text-catalog-gold tracking-tight">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }).format(order.total)}
                      </span>
                    </td>

                    {/* Botão Ver Detalhes */}
                    <td className="py-3.5 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => onSelectOrder(order.id)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-catalog-gold/30 bg-[#0B132B]/80 hover:bg-catalog-gold/15 text-slate-300 hover:text-catalog-gold transition-colors text-xs font-mono uppercase tracking-wider cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Detalhes</span>
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
