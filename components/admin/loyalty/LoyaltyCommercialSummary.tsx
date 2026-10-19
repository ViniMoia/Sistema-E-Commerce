import type { LoyaltyCommercialMetrics } from '@/types/loyalty.types'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const pts = (n: number) => `${n.toLocaleString('pt-BR')} pts`

export function LoyaltyCommercialSummary({ commercial: c, debt, legacyWallets }: {
  commercial: LoyaltyCommercialMetrics; debt: number; legacyWallets: number
}) {
  return <section className="rounded-xl border border-catalog-gold/25 p-4 text-xs text-catalog-muted space-y-3" data-testid="loyalty-commercial-summary">
    <h3 className="text-catalog-gold font-semibold">Movimentação de pontos dos pedidos comerciais</h3>
    <p>Histórico sem pedidos classificados como teste. Valores em reais registrados na operação, antes e depois das devoluções de pontos; não representam pagamento ou estorno em dinheiro.</p>
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div><dt>Pontos concedidos nos pedidos</dt><dd className="text-white">{pts(c.earnedPoints)}</dd></div>
      <div><dt>Pontos retirados por reversão de ganhos</dt><dd className="text-white">{pts(c.reversedEarnedPoints)}</dd></div>
      <div><dt>Resgates registrados</dt><dd className="text-white">{pts(c.redeemedPoints)} · {brl(c.redeemedValue)}</dd></div>
      <div><dt>Resgates devolvidos</dt><dd className="text-white">{pts(c.returnedPoints)} · {brl(c.returnedValue)}</dd></div>
      <div><dt>Resgates menos devoluções</dt><dd className="text-white">{pts(c.netRedeemedPoints)} · {brl(c.netRedeemedValue)}</dd></div>
    </dl>
    {c.coverage === 'PARTIAL' && <p role="status" className="text-amber-300">Apuração parcial: {c.missingMonetaryValues} movimentos sem valor histórico e {c.unlinkedTransactions} sem vínculo com pedido da loja. Os totais em reais somam apenas valores registrados; não estimamos valores ausentes.</p>}
    <p>Carteiras: saldo atual de todos os clientes, incluindo ajustes e histórico de testes. A classificação dos pedidos não altera saldos. Valor de resgate estimado pela cotação atual, sujeito às regras do programa. Dívida de pontos: {pts(debt)}.</p>
    {legacyWallets > 0 && <p role="status" className="text-amber-300">{legacyWallets} carteiras legadas aguardam conciliação; o saldo exibido não comprova disponibilidade para resgate.</p>}
  </section>
}
