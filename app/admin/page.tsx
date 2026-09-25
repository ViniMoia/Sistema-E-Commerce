import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { getAggregatedDashboardMetrics } from '@/services/dashboard.service';
import {
  DashboardActionInbox,
  FinancialKpiCard,
  LogisticsKpiCard,
  LoyaltyQuickManagementWidget,
  RecentOrdersEnhancedTable,
} from '@/components/admin/dashboard';
import Link from 'next/link';
import {
  PackageSearch,
  Users,
  ShoppingCart,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowUpRight,
  Store,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Dashboard | Painel Administrativo',
  description: 'Visão executiva e operacional da loja Continental Produtos Estéticos Automotivos',
};

export default async function AdminDashboardPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== 'ADMIN') {
    redirect('/login');
  }

  const lojaID = user.lojaID;
  if (!lojaID) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-400 font-mono">Erro: Loja não associada ao usuário administrador.</p>
      </div>
    );
  }

  // Consulta canônica com cache particionado por tenant
  const data = await getAggregatedDashboardMetrics(lojaID);

  return (
    <div className="p-6 md:p-10 space-y-8 fade-in text-white">
      {/* ─── Top Header & Navegação Rápida de Catálogo ─────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-catalog-gold/20 pb-6">
        <div>
          <p className="text-[10px] text-catalog-gold font-mono tracking-[0.25em] uppercase mb-1 font-bold">
            Visão Geral & Operação
          </p>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white uppercase">
            Dashboard
          </h1>
          <p className="text-catalog-muted mt-1 text-sm">
            Bem-vindo de volta,{' '}
            <span className="text-white font-medium">{user.name}</span>. Resumo da loja{' '}
            <span className="text-catalog-gold font-semibold">{data.lojaName}</span>.
          </p>
        </div>

        {/* Contadores Informativos de Produtos e Usuários */}
        <div className="flex items-center gap-3">
          <Link
            href="/admin/products"
            className="bg-catalog-card px-4 py-2.5 rounded-2xl border border-catalog-gold/30 hover:border-catalog-gold/60 transition-all flex items-center gap-3 group shadow-sm"
          >
            <div className="p-2 rounded-xl bg-catalog-gold/10 border border-catalog-gold/25 text-catalog-gold">
              <PackageSearch className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-catalog-muted font-mono uppercase tracking-wider">Produtos Ativos</p>
              <p className="text-sm font-bold text-white font-mono group-hover:text-catalog-gold transition-colors">
                {data.catalog.totalProducts} itens
              </p>
            </div>
          </Link>

          <Link
            href="/admin/customers"
            className="bg-catalog-card px-4 py-2.5 rounded-2xl border border-catalog-gold/30 hover:border-catalog-gold/60 transition-all flex items-center gap-3 group shadow-sm"
          >
            <div className="p-2 rounded-xl bg-catalog-gold/10 border border-catalog-gold/25 text-catalog-gold">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-catalog-muted font-mono uppercase tracking-wider">Clientes</p>
              <p className="text-sm font-bold text-white font-mono group-hover:text-catalog-gold transition-colors">
                {data.catalog.totalCustomers} clientes
              </p>
            </div>
          </Link>
        </div>
      </div>

      {/* ─── 1. Inbox Operacional de Ações Imediatas ───────────────────────── */}
      <DashboardActionInbox
        inbox={data.inbox}
        whatsappNumber={data.financial.pixConfig.whatsappNumber}
      />

      {/* ─── 2. Grid de KPIs Executivos (3 Colunas) ─────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Financeiro & Gateway PIX */}
        <FinancialKpiCard financial={data.financial} />

        {/* Card 2: Expedição & Frete Multi-Provedor */}
        <LogisticsKpiCard logistics={data.logistics} />

        {/* Card 3: Funil de Pedidos & Conversão */}
        <div className="bg-catalog-card rounded-2xl p-6 border border-catalog-gold/30 hover:border-catalog-gold/60 transition-all duration-300 flex flex-col justify-between group shadow-sm">
          <div>
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-catalog-gold/10 border border-catalog-gold/25 text-catalog-gold">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <Link
                href="/admin/orders"
                className="text-xs text-catalog-muted hover:text-catalog-gold font-mono flex items-center gap-1 transition-colors"
              >
                <span>Histórico</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <p className="text-[10px] font-mono tracking-[0.2em] text-catalog-gold uppercase font-bold">
              Volume Total de Pedidos
            </p>
            <p className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-white mt-1">
              {data.financial.totalOrdersCount}
            </p>

            {/* Subtotais do Funil de Pedidos */}
            <div className="mt-4 pt-3 border-t border-catalog-gold/15 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-catalog-muted flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Pedidos Pagos
                </span>
                <span className="text-emerald-400 font-medium">
                  {data.financial.paidOrdersCount}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-catalog-muted flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-catalog-gold" />
                  Pedidos Pendentes
                </span>
                <span className="text-catalog-gold font-medium">
                  {data.financial.pendingOrdersCount}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-catalog-muted flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5 text-red-400" />
                  Pedidos Cancelados
                </span>
                <span className="text-red-400 font-medium">
                  {data.financial.cancelledOrdersCount}
                </span>
              </div>
            </div>
          </div>

          {/* Taxa de Conversão */}
          <div className="mt-4 pt-3 border-t border-catalog-gold/15 flex items-center justify-between text-xs font-mono">
            <span className="text-catalog-muted">Taxa de Conversão</span>
            <span className="text-catalog-gold font-bold">
              {data.financial.paymentConversionRatePct}% liquidado
            </span>
          </div>
        </div>
      </div>

      {/* ─── 3. Grid Central: Gestor de Fidelidade & Painel Operacional ─────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gestor Completo de Fidelidade & Pontos (Ocupa 2 Colunas) */}
        <div className="lg:col-span-2">
          <LoyaltyQuickManagementWidget loyalty={data.loyalty} />
        </div>

        {/* Card Operacional de Logística e Despacho */}
        <div className="bg-catalog-card rounded-2xl p-6 border border-catalog-gold/30 flex flex-col justify-between space-y-4 shadow-sm">
          <div>
            <div className="flex items-center justify-between border-b border-catalog-gold/20 pb-3">
              <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2 uppercase font-mono">
                <Store className="w-4 h-4 text-catalog-gold" />
                <span>Configuração de Expedição</span>
              </h3>
              <Link
                href="/admin/settings"
                className="text-[11px] text-catalog-gold hover:underline font-mono uppercase tracking-wider"
              >
                Ajustar
              </Link>
            </div>

            <div className="space-y-3 mt-4 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-catalog-muted">CEP de Origem (Saída)</span>
                <span className="text-white font-semibold">
                  {data.logistics.providerStatus.originCep || '01001-000 (Padrão)'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-catalog-muted">Entrega Correios</span>
                <span
                  className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full ${
                    data.logistics.providerStatus.enableCorreios
                      ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/50'
                      : 'bg-[#050B14] text-catalog-muted border border-white/5'
                  }`}
                >
                  {data.logistics.providerStatus.enableCorreios ? 'Ativo (SEDEX/PAC)' : 'Desativado'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-catalog-muted">J&T Express Matriz</span>
                <span
                  className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full ${
                    data.logistics.providerStatus.hasJtExpressMatrix
                      ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/50'
                      : 'bg-[#050B14] text-catalog-muted border border-white/5'
                  }`}
                >
                  {data.logistics.providerStatus.hasJtExpressMatrix ? '5.181 Tarifas' : 'Sem Matriz'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-catalog-muted">Retirada na Loja Física</span>
                <span
                  className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full ${
                    data.logistics.providerStatus.enablePickup
                      ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/50'
                      : 'bg-[#050B14] text-catalog-muted border border-white/5'
                  }`}
                >
                  {data.logistics.providerStatus.enablePickup ? 'Disponível (Grátis)' : 'Bloqueado'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-catalog-muted">Tabela de Frete Local</span>
                <span className="text-white font-semibold">
                  {data.logistics.providerStatus.localTableRulesCount} regras cadastradas
                </span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-catalog-gold/15 flex items-center justify-between text-[11px] font-mono text-catalog-muted">
            <span>Sincronização com armazém</span>
            <span className="text-emerald-400 font-semibold">Em tempo real</span>
          </div>
        </div>
      </div>

      {/* ─── 4. Tabela Enriquecida de Pedidos Recentes & Expedição ──────────── */}
      <RecentOrdersEnhancedTable orders={data.recentOrders} />
    </div>
  );
}
