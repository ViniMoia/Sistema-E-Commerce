'use client'

import * as React from 'react'
import { boletoRefundViewSchema, type BoletoRefundView } from '@/lib/commerce/boleto-refund'

export function BoletoRefundPanel({ orderId }: { orderId: string }) {
  const [view, setView] = React.useState<BoletoRefundView | null>(null)
  const [error, setError] = React.useState('')
  const [confirmed, setConfirmed] = React.useState(false)
  const [attempted, setAttempted] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const active = React.useRef(false)
  const submitting = React.useRef(false)
  const endpoint = `/api/admin/orders/${orderId}/payment-operation`
  const read = React.useCallback(async () => {
    try {
      const response = await fetch(endpoint, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000) })
      const body = await response.json()
      const parsed = boletoRefundViewSchema.safeParse(body.data)
      if (!response.ok || !parsed.success || parsed.data.orderId !== orderId) throw new Error()
      if (active.current) { setView(parsed.data); setError(''); setCopied(false) }
    } catch { if (active.current) setError('Não foi possível consultar a devolução. Atualize a consulta antes de qualquer ação.') }
  }, [endpoint, orderId])
  React.useEffect(() => { active.current = true; void read(); return () => { active.current = false } }, [read])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!view?.eligible || !confirmed || attempted || submitting.current) return
    submitting.current = true; setBusy(true); setAttempted(true); setError('')
    try {
      const response = await fetch(endpoint, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'REFUND', commandId: crypto.randomUUID(), expectedVersion: view.version }) })
      if (response.status !== 202) throw new Error()
      await read()
    } catch {
      if (active.current) setError('Resultado da solicitação não confirmado. Consulte o registro; não solicite novamente para tentar obter o link.')
    } finally { submitting.current = false; if (active.current) setBusy(false) }
  }
  async function copyLink() {
    if (!view?.requestUrl) return
    try { await navigator.clipboard.writeText(view.requestUrl); if (active.current) setCopied(true) }
    catch { if (active.current) setError('Não foi possível copiar. Use o link de atendimento abaixo.') }
  }

  if (view && !view.applicable && !error) return null
  const messages = {
    UNAVAILABLE: 'Este boleto não está elegível para solicitar devolução. Confira o pagamento e eventuais pendências com o atendimento.',
    AVAILABLE: 'A solicitação é integral. O pagador deverá preencher os dados e documentos solicitados diretamente no Asaas.',
    QUEUED: 'Solicitação registrada. Aguarde o processamento e consulte novamente para obter o link do pagador.',
    AWAITING_CUSTOMER: 'Solicitação iniciada. Encaminhe o link somente ao pagador pelo canal privado de atendimento. O dinheiro ainda não foi devolvido.',
    REVIEW: 'A devolução requer conferência do atendimento. Consulte o provedor antes de qualquer nova solicitação; um link ausente não autoriza repetir o estorno.',
    COMPLETED: 'Devolução integral confirmada. Eventual retorno de mercadoria deve ser conferido separadamente.',
  }
  return <section aria-label="Devolução de boleto" className="border border-gray-700 rounded-lg p-4 space-y-3 min-w-0">
    <h3 className="font-semibold">Devolução de boleto pago</h3>
    {error && <p role="alert" className="text-red-400">{error}</p>}
    {!view && !error && <p>Consultando devolução…</p>}
    {view && <><p>Valor integral: {Number(view.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
      <p role="status">{messages[view.state]}</p></>}
    {view?.eligible && !attempted && <form onSubmit={submit} className="space-y-3">
      <label className="flex gap-2 items-start"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
        Conferi o pedido e autorizo solicitar a devolução integral deste boleto.</label>
      <button type="submit" disabled={!confirmed || busy} className="rounded bg-amber-500 text-black px-4 py-2 disabled:opacity-50">Solicitar devolução do boleto</button>
    </form>}
    {attempted && view?.eligible && <p>Solicitação já tentada nesta tela. Confira o registro com o atendimento antes de tentar novamente.</p>}
    {view?.requestUrl && <div className="flex flex-col items-start gap-3">
      <button type="button" onClick={() => void copyLink()} className="underline">Copiar link para o pagador</button>
      <a href={view.requestUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="underline">Abrir formulário do Asaas</a>
      {copied && <p role="status">Link copiado. Compartilhe somente com o pagador.</p>}
    </div>}
    <button type="button" disabled={busy} onClick={() => void read()} className="underline disabled:opacity-50">Atualizar consulta da devolução</button>
  </section>
}
