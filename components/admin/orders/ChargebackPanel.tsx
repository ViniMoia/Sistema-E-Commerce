'use client'

import type { ChargebackSnapshot } from '@/services/payment/chargeback'

export function ChargebackPanel({ charges }: { charges: Array<ChargebackSnapshot & { ordinal: number }> }) {
  if (!charges.length) return null
  const labels: Record<ChargebackSnapshot['outcome'], string> = {
    OPEN: 'Contestação em andamento', AWAITING_FINANCIAL_RESULT: 'Aguardando confirmação do resultado financeiro',
    REVERSED: 'Contestação revertida; pagamento confirmado', REFUNDED: 'Devolução financeira confirmada',
    UNRESOLVED: 'Evidência incompleta; conferência necessária',
  }
  return <section aria-label="Chargeback" className="border border-catalog-gold/25 rounded-xl p-4 space-y-3">
    <h3 className="font-semibold text-catalog-gold">Contestação do pagamento (chargeback)</h3>
    {charges.map(charge => <div key={charge.ordinal} className="text-sm space-y-1">
      <p>Parcela {charge.ordinal}: {labels[charge.outcome]}</p>
      <p className="text-slate-400">Estado informado: {charge.status} · Cobrança: {charge.paymentStatus}</p>
      {charge.reason && <p className="text-slate-400">Motivo informado: {charge.reason}</p>}
      {charge.review && <p className="text-amber-400">Revisar o caso no provedor. Não solicitar outro estorno para resolver esta contestação.</p>}
    </div>)}
    <p className="text-sm text-slate-400">Última evidência conciliada. A contestação e seu resultado financeiro não comprovam devolução da mercadoria. O resultado de uma parcela não encerra as demais.</p>
  </section>
}
