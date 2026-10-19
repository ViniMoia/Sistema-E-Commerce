'use client'

import * as React from 'react'
import { physicalReturnViewSchema, type PhysicalReturnView } from '@/lib/commerce/physical-return'

export function PhysicalReturnPanel({ orderId, onCompleted }: { orderId: string; onCompleted: () => void }) {
  const [view, setView] = React.useState<PhysicalReturnView | null>(null)
  const [error, setError] = React.useState('')
  const [reference, setReference] = React.useState('')
  const [received, setReceived] = React.useState(false)
  const [quantities, setQuantities] = React.useState<Record<string, string>>({})
  const [busy, setBusy] = React.useState(false)
  const [attempted, setAttempted] = React.useState(false)
  const active = React.useRef(false)
  const submitting = React.useRef(false)
  const endpoint = `/api/admin/orders/${orderId}/physical-return`
  const read = React.useCallback(async () => {
    try {
      const response = await fetch(endpoint, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000) })
      const body = await response.json()
      const parsed = physicalReturnViewSchema.safeParse(body.data)
      if (!response.ok || body.success !== true || !parsed.success || parsed.data.orderId !== orderId) throw new Error('Não foi possível consultar o retorno físico.')
      if (active.current) { setView(parsed.data); setError('') }
    } catch (e) { if (active.current) setError(e instanceof Error ? e.message : 'Falha ao consultar retorno.') }
  }, [endpoint, orderId])
  React.useEffect(() => { active.current = true; void read(); return () => { active.current = false } }, [read])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!view || !received || attempted || submitting.current) return
    submitting.current = true
    setBusy(true); setAttempted(true); setError('')
    try {
      const response = await fetch(endpoint, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          commandId: crypto.randomUUID(), expectedVersion: view.version, inspectionReference: reference,
          receivedAllItems: true, items: view.items.map(item => ({ orderItemId: item.id, receivedQuantity: item.quantity,
            restockQuantity: Number(quantities[item.id] ?? '0') })),
        }) })
      const body = await response.json()
      if (!response.ok || body.success !== true || body.data?.orderId !== orderId) throw new Error(body.error || 'Resultado não confirmado. Consulte o registro.')
      if (active.current) { await read(); onCompleted() }
    } catch (e) {
      if (active.current) setError(e instanceof Error ? e.message : 'Resultado não confirmado. Consulte o registro.')
    } finally { submitting.current = false; if (active.current) setBusy(false) }
  }

  if (view && !view.eligible && !view.completed && !error) return null
  return <section className="border border-gray-700 rounded-lg p-4 space-y-3" aria-label="Retorno físico">
    <h3 className="font-semibold">Retorno físico após estorno</h3>
    {error && <p role="alert" className="text-red-400">{error}</p>}
    {!view && !error && <p>Consultando retorno…</p>}
    {view?.completed && view.receipt && <div role="status">
      <p>Retorno físico registrado em {new Date(view.receipt.at).toLocaleString('pt-BR')}.</p>
      <ul>{view.receipt.result.movements.map(m => <li key={m.orderItemId}>
        {view.items.find(i => i.id === m.orderItemId)?.name}: {m.received} recebida(s), {m.available} disponível(is) para venda, {m.unavailable} indisponível(is).
      </li>)}</ul>
      <p>O histórico da entrega foi preservado.</p>
    </div>}
    {view?.eligible && !attempted && <form onSubmit={submit} className="space-y-3">
      <p>Confira todos os itens recebidos. Informe quantas unidades podem voltar à venda; as demais ficarão indisponíveis. Produtos e variantes retirados do catálogo permanecem indisponíveis.</p>
      <p>Use este registro somente se estas unidades ainda não foram repostas por outro ajuste de estoque.</p>
      {view.items.map(item => <label key={item.id} className="block">
        {item.name} · {item.size} · {item.color} — {item.quantity} unidade(s). Aptas para venda:
        <input name={`restock-${item.id}`} aria-label={`Unidades aptas para venda: ${item.name}`} type="number" min="0" max={item.quantity} step="1" required
          className="block w-24 bg-gray-900 border border-gray-600 rounded p-2"
          value={quantities[item.id] ?? '0'} onChange={e => setQuantities(q => ({ ...q, [item.id]: e.target.value }))} />
      </label>)}
      <label className="block">Referência da conferência (sem dados pessoais)
        <input name="physicalReturnReference" required minLength={3} maxLength={200} value={reference} onChange={e => setReference(e.target.value)}
          className="block w-full bg-gray-900 border border-gray-600 rounded p-2" />
      </label>
      <label className="flex gap-2"><input name="physicalReturnReceived" type="checkbox" required checked={received} onChange={e => setReceived(e.target.checked)} />
        Recebi e conferi todas as unidades deste pedido, ainda sem reposição no estoque.</label>
      <button type="submit" disabled={!received || busy} className="rounded bg-amber-500 text-black px-4 py-2 disabled:opacity-50">Registrar retorno físico</button>
    </form>}
    {attempted && !view?.completed && <p role="status">{busy ? 'Registrando conferência…' : 'Consulte o registro antes de qualquer nova tentativa. Se continuar pendente, confira com o responsável pelo estoque.'}</p>}
    {(error || attempted) && !busy && <button type="button" onClick={() => void read()} className="underline">Consultar registro do retorno</button>}
  </section>
}
