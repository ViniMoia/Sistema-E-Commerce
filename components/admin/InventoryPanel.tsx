'use client';

import { useEffect, useRef, useState } from 'react';
import { prepareInventoryAttempt, type InventoryAttempt } from '@/lib/commerce/inventory-draft';

type Row = { id: string; stock: number; unavailableStock: number; inventoryVersion: number; retiredAt: string | null; size?: string; color?: string };
type Snapshot = Row & { productVariants: Row[] };
type Mode = 'ABSOLUTE' | 'DELTA' | 'REACTIVATE';

/** Inventory and catalog keep independent drafts. Preserve command identity after response loss. */
export function InventoryPanel({ productId }: { productId: string }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [targetId, setTargetId] = useState(''); const [mode, setMode] = useState<Mode>('ABSOLUTE');
  const [quantity, setQuantity] = useState(''); const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const pending = useRef<InventoryAttempt | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    fetch(`/api/products/${productId}`, { cache: 'no-store', signal: abort.signal })
      .then(async response => { if (!response.ok) throw new Error('Não foi possível consultar estoque.'); return response.json(); })
      .then(data => { if (!abort.signal.aborted) setSnapshot(data); })
      .catch(error => { if (!abort.signal.aborted) setMessage(error.message); });
    return () => abort.abort();
  }, [productId]);
  const target = targetId ? snapshot?.productVariants.find(row => row.id === targetId) : snapshot;
  async function refresh() {
    const response = await fetch(`/api/products/${productId}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Não foi possível consultar estoque.');
    setSnapshot(await response.json());
  }
  async function submit() {
    if (!target || busy) return;
    const value = Number(quantity);
    if (!quantity.trim() || !Number.isInteger(value) || reason.trim().length < 3) { setMessage('Informe quantidade inteira e motivo da contagem física/reposição.'); return; }
    // Refreshing a snapshot after a lost response must not turn a retry into a new delta.
    pending.current = prepareInventoryAttempt(pending.current, { productId, ...(targetId ? { variantId: targetId } : {}), mode, quantity: value, reason }, target.inventoryVersion, () => crypto.randomUUID());
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/products/${productId}/inventory`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pending.current.body) });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409) { pending.current = null; setMessage(`${result.error} Rascunho preservado; confira o estoque atual antes de tentar novamente.`); }
        else setMessage(result.error || 'Ajuste recusado.');
        return;
      }
      pending.current = null; setQuantity(''); setReason('');
      setMessage('Ajuste registrado. O limite geral do produto e o estoque da variante são ajustados separadamente.');
      try { await refresh(); }
      catch { setMessage('Ajuste registrado. Não foi possível atualizar a consulta; confira o estoque atual.'); }
    } catch { setMessage('Resposta não confirmada. Tente novamente sem alterar o rascunho para consultar o mesmo ajuste.'); }
    finally { setBusy(false); }
  }
  return <section className="mb-8 space-y-3 rounded-xl border border-catalog-gold/30 p-5" aria-label="Ajuste de estoque">
    <h3 className="font-bold">Ajuste de estoque</h3>
    <p className="text-sm">Salvar o catálogo preserva as quantidades atuais. Novas variantes começam sem estoque; reposição e contagem física são registradas aqui.</p>
    <label className="block">Item
      <select className="block w-full bg-catalog-bg p-2" value={targetId} disabled={busy} onChange={event => { setTargetId(event.target.value); setMode('ABSOLUTE'); pending.current = null; }}>
        <option value="">Limite geral do produto</option>
        {snapshot?.productVariants.map(row => <option key={row.id} value={row.id}>{row.size} / {row.color}{row.retiredAt ? ' (retirada)' : ''}</option>)}
      </select>
    </label>
    {target && <p>Disponível: {target.stock}. Indisponível: {target.unavailableStock}.{target.retiredAt ? ' Item retirado: reativação exige conferência física.' : ''}</p>}
    <label className="block">Operação
      <select className="block w-full bg-catalog-bg p-2" value={mode} disabled={busy} onChange={event => setMode(event.target.value as Mode)}>
        <option value="ABSOLUTE">Definir contagem disponível</option><option value="DELTA">Reposição (+) ou baixa (-)</option>
        {target?.retiredAt && <option value="REACTIVATE">Reativar após conferência física</option>}
      </select>
    </label>
    <label className="block">Quantidade<input className="block bg-catalog-bg p-2" type="number" step="1" value={quantity} disabled={busy} onChange={event => setQuantity(event.target.value)} /></label>
    <label className="block">Motivo<input className="block w-full bg-catalog-bg p-2" value={reason} maxLength={500} disabled={busy} onChange={event => setReason(event.target.value)} /></label>
    <div className="flex gap-4"><button type="button" disabled={busy || !target} onClick={submit}>Registrar ajuste</button>
      <button type="button" disabled={busy} onClick={() => refresh().catch(error => setMessage(error.message))}>Conferir estoque atual</button></div>
    {message && <p role="status">{message}</p>}
  </section>;
}
