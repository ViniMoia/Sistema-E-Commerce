'use client';

import Link from 'next/link';
import { TrendingUp, ArrowUpRight } from 'lucide-react';
import type { DashboardFinancialDTO } from '@/types/dashboard';

const brl = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const measures = [
  ['recognizedGross', 'Reconhecido bruto'],
  ['settledGross', 'Liquidação bruta'],
  ['confirmedRefunds', 'Estornos confirmados'],
  ['netRecognized', 'Reconhecido menos estornos'],
] as const;

export function FinancialKpiCard({ financial: f }: { financial: DashboardFinancialDTO }) {
  return (
    <section aria-label="Movimentação financeira" className="bg-catalog-card rounded-2xl p-6 border border-catalog-gold/30 space-y-5 min-w-0">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-bold text-catalog-gold flex gap-2 items-center"><TrendingUp className="w-5 h-5" />Movimentação financeira</h2>
        <Link href="/admin/orders" className="text-xs text-catalog-muted flex items-center gap-1">Pedidos<ArrowUpRight className="w-3 h-3" /></Link>
      </div>
      <p className="text-xs text-catalog-muted">Reconhecido inclui pagamentos autorizados ou confirmados. Liquidação exige confirmação própria e não representa saldo bancário disponível.</p>
      {f.coverage === 'PARTIAL' && <p role="status" data-testid="financial-coverage" className="rounded-xl border border-amber-500/50 bg-amber-950/30 p-3 text-sm text-amber-200">
        Base financeira parcial: {f.unverifiedOrders} pedido(s) sem evidência histórica e {f.financialReviewOrders} em revisão. Valores não comprovados não são estimados.
      </p>}
      <div className="space-y-3">
        {([['today', 'Hoje'], ['month', 'Mês atual'], ['allTime', 'Todo o histórico']] as const).map(([period, label]) => (
          <div key={period} className="rounded-xl border border-catalog-gold/20 bg-[#050B14]/60 p-4">
            <h3 className="text-sm font-bold text-catalog-gold mb-3">{label}</h3>
            <dl className="space-y-2 text-xs">
              {measures.map(([key, title]) => <div key={key} className="flex justify-between gap-3">
                <dt className="text-catalog-muted">{title}</dt>
                <dd data-testid={'financial-' + period + '-' + key} className="font-mono font-semibold text-white text-right">{brl(f[period][key])}</dd>
              </div>)}
            </dl>
            <p className="text-[11px] text-catalog-muted mt-3">Pedidos com registro no período: {f[period].recognizedOrderCount} reconhecido(s), {f[period].settledOrderCount} liquidado(s), {f[period].refundedOrderCount} estornado(s).</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-catalog-muted">Períodos pela data de registro de cada confirmação financeira, no horário de Brasília. Estornos entram na data do seu registro, sem apagar o reconhecimento anterior. Um período pode ter saldo negativo de reconhecimentos menos estornos.</p>
      <p className="text-xs text-catalog-muted">Valores brutos incluem encargos cobrados do comprador. Taxas do provedor não foram descontadas; estes valores não representam lucro.</p>
      <div className="border-t border-catalog-gold/20 pt-4">
        <h3 className="text-sm text-catalog-gold mb-2">Composição dos contratos integralmente reconhecidos</h3>
        <p className="text-xs text-catalog-muted mb-3">Todo o histórico, antes dos estornos. Não é uma divisão da liquidação do período.</p>
        <dl className="text-xs space-y-2">
          {([
            ['merchandiseAfterDiscount', 'Produtos após descontos'], ['shipping', 'Frete'], ['financingCharge', 'Encargos do parcelamento'],
            ['unallocatedRecognized', 'Reconhecido sem composição completa'],
          ] as const).map(([key, title]) => <div key={key} className="flex justify-between gap-3"><dt className="text-catalog-muted">{title}</dt>
            <dd data-testid={'financial-composition-' + key} className="text-white font-mono">{brl(f.composition[key])}</dd></div>)}
        </dl>
      </div>
      <dl className="border-t border-catalog-gold/20 pt-4 text-xs space-y-2">
        <div className="flex justify-between gap-3"><dt className="text-catalog-muted">Em aberto na base conferida</dt><dd className="font-mono text-catalog-gold">{brl(f.pendingOrderValue)}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-catalog-muted">Cancelados sem valor reconhecido ({f.cancelledUnpaidOrderCount})</dt><dd className="font-mono text-white">{brl(f.cancelledUnpaidOrderValue)}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-catalog-muted">Ticket reconhecido após estornos</dt><dd className="font-mono text-white">{brl(f.averageNetTicket)}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-catalog-muted">Pedidos com valor reconhecido</dt><dd className="font-mono text-white">{f.paymentConversionRatePct}% ({f.allTime.recognizedOrderCount} de {f.totalOrdersCount})</dd></div>
      </dl>
      <p className="text-[11px] text-catalog-muted">Base consultada em {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'America/Sao_Paulo' }).format(new Date(f.asOf))}. Pedidos classificados como teste não entram nos indicadores.</p>
      <div className="border-t border-catalog-gold/20 pt-3 text-xs text-catalog-muted">
        {f.pixConfig.hasPixKey ? 'Chave PIX cadastrada (' + f.pixConfig.pixKeyType + '): ' + f.pixConfig.pixKeyMasked : 'Chave PIX não cadastrada'}
        <Link href="/admin/settings" className="ml-2 text-catalog-gold underline">Configurar</Link>
      </div>
    </section>
  );
}
