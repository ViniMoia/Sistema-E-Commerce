import { Metadata } from "next";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import {
  ShoppingCart,
  Users,
  PackageSearch,
  Truck,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Dashboard",
};

async function getDashboardMetrics(lojaID: string) {
  const [
    orderGroups,
    totalCustomers,
    totalProducts,
    totalFreightRules,
    recentOrders,
  ] = await Promise.all([
    prisma.order.groupBy({
      by: ["status"],
      where: { lojaID },
      _count: { _all: true },
      _sum: { total: true },
    }),
    prisma.user.count({ where: { lojaID, role: "CUSTOMER" } }),
    prisma.product.count({ where: { lojaID } }),
    prisma.freightRule.count({ where: { lojaID } }),
    prisma.order.findMany({
      where: { lojaID },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        user: { select: { name: true, email: true } },
      },
    }),
  ]);

  // Process order metric aggregates locally
  let totalOrders = 0;
  let pendingOrders = 0;
  let paidOrders = 0;
  let cancelledOrders = 0;
  let totalRevenue = 0;

  for (const group of orderGroups) {
    const count = group._count._all;
    totalOrders += count;

    if (group.status === "PENDING") {
      pendingOrders = count;
    } else if (group.status === "PAID") {
      paidOrders = count;
    } else if (group.status === "CANCELLED") {
      cancelledOrders = count;
    }

    if (group.status !== "CANCELLED") {
      totalRevenue += group._sum.total?.toNumber() ?? 0;
    }
  }

  return {
    totalOrders,
    pendingOrders,
    paidOrders,
    cancelledOrders,
    totalCustomers,
    totalProducts,
    totalFreightRules,
    totalRevenue,
    recentOrders,
  };
}

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  PENDING:   { label: "Pendente",   className: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  PAID:      { label: "Pago",       className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  SHIPPED:   { label: "Enviado",    className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  DELIVERED: { label: "Entregue",   className: "bg-[#DDAF02]/10 text-[#DDAF02] border-[#DDAF02]/20" },
  CANCELLED: { label: "Cancelado",  className: "bg-red-500/10 text-red-400 border-red-500/20" },
};

export default async function AdminDashboardPage() {
  const user = await getCurrentUser();
  const lojaID = user!.lojaID;

  const metrics = await getDashboardMetrics(lojaID);

  const kpiCards = [
    {
      label: "Receita Total",
      value: new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(metrics.totalRevenue),
      icon: TrendingUp,
      accent: "text-[#DDAF02]",
      border: "border-[#DDAF02]/20",
      bg: "bg-[#DDAF02]/5",
      href: "/admin/orders",
    },
    {
      label: "Total de Pedidos",
      value: metrics.totalOrders.toString(),
      icon: ShoppingCart,
      accent: "text-blue-400",
      border: "border-blue-500/20",
      bg: "bg-blue-500/5",
      href: "/admin/orders",
      sub: `${metrics.pendingOrders} pendentes`,
    },
    {
      label: "Clientes",
      value: metrics.totalCustomers.toString(),
      icon: Users,
      accent: "text-emerald-400",
      border: "border-emerald-500/20",
      bg: "bg-emerald-500/5",
      href: "/admin/customers",
    },
    {
      label: "Produtos",
      value: metrics.totalProducts.toString(),
      icon: PackageSearch,
      accent: "text-purple-400",
      border: "border-purple-500/20",
      bg: "bg-purple-500/5",
      href: "/admin/products",
    },
    {
      label: "Pedidos Pagos",
      value: metrics.paidOrders.toString(),
      icon: CheckCircle2,
      accent: "text-emerald-400",
      border: "border-emerald-500/20",
      bg: "bg-emerald-500/5",
      href: "/admin/orders",
    },
    {
      label: "Pedidos Cancelados",
      value: metrics.cancelledOrders.toString(),
      icon: XCircle,
      accent: "text-red-400",
      border: "border-red-500/20",
      bg: "bg-red-500/5",
      href: "/admin/orders",
    },
    {
      label: "Pedidos Pendentes",
      value: metrics.pendingOrders.toString(),
      icon: Clock,
      accent: "text-amber-400",
      border: "border-amber-500/20",
      bg: "bg-amber-500/5",
      href: "/admin/orders",
    },
    {
      label: "Regras de Frete",
      value: metrics.totalFreightRules.toString(),
      icon: Truck,
      accent: "text-sky-400",
      border: "border-sky-500/20",
      bg: "bg-sky-500/5",
      href: "/admin/freight",
    },
  ];

  return (
    <div className="p-6 md:p-10 space-y-10 fade-in">
      {/* Page header */}
      <div>
        <p className="text-[10px] text-[#DDAF02] font-mono tracking-[0.25em] uppercase mb-1">
          Visão Geral
        </p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white">
          Dashboard
        </h1>
        <p className="text-zinc-400 mt-1 text-sm">
          Bem-vindo de volta,{" "}
          <span className="text-white font-medium">{user!.name}</span>. Aqui está
          o resumo da sua loja.
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpiCards.map(({ label, value, icon: Icon, accent, border, bg, href, sub }) => (
          <Link
            key={label}
            href={href}
            className={`
              group glass-panel rounded-xl p-5 border ${border}
              hover:scale-[1.02] transition-all duration-300
              hover:shadow-lg hover:shadow-black/20
            `}
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`p-2.5 rounded-lg ${bg} border ${border}`}>
                <Icon className={`w-5 h-5 ${accent}`} />
              </div>
            </div>
            <p className="text-zinc-400 text-xs font-mono tracking-wider uppercase mb-1">
              {label}
            </p>
            <p className={`text-2xl font-bold tracking-tight ${accent}`}>
              {value}
            </p>
            {sub && (
              <p className="text-zinc-500 text-xs mt-1">{sub}</p>
            )}
          </Link>
        ))}
      </div>

      {/* Recent Orders */}
      <div className="glass-panel rounded-xl border border-white/5 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-[#DDAF02] font-mono tracking-[0.2em] uppercase mb-0.5">
              Atividade
            </p>
            <h2 className="text-white font-semibold tracking-tight">
              Pedidos Recentes
            </h2>
          </div>
          <Link
            href="/admin/orders"
            className="text-xs text-zinc-400 hover:text-[#DDAF02] transition-colors font-mono tracking-wider"
          >
            Ver todos →
          </Link>
        </div>

        {metrics.recentOrders.length === 0 ? (
          <div className="px-6 py-12 text-center text-zinc-500 text-sm font-mono">
            Nenhum pedido encontrado.
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {metrics.recentOrders.map((order) => {
              const statusCfg = STATUS_CONFIG[order.status] ?? {
                label: order.status,
                className: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
              };
              return (
                <div
                  key={order.id}
                  className="px-6 py-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors"
                >
                  {/* Order number */}
                  <div className="shrink-0">
                    <p className="text-[#DDAF02] font-mono text-xs tracking-wider">
                      #{order.orderNumber}
                    </p>
                    <p className="text-zinc-500 text-[10px] mt-0.5">
                      {new Date(order.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>

                  {/* Customer */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">
                      {order.user.name}
                    </p>
                    <p className="text-zinc-500 text-xs truncate">
                      {order.user.email}
                    </p>
                  </div>

                  {/* Total */}
                  <div className="shrink-0 text-right hidden sm:block">
                    <p className="text-white text-sm font-semibold">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(order.total.toNumber())}
                    </p>
                  </div>

                  {/* Status badge */}
                  <span
                    className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border ${statusCfg.className}`}
                  >
                    {statusCfg.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
