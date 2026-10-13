'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Info, Loader2, Package, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { prepareInventoryAttempt, type InventoryAttempt } from '@/lib/commerce/inventory-draft';

type Row = { id: string; stock: number; unavailableStock: number; inventoryVersion: number; retiredAt: string | null; size?: string; color?: string };
export type InventorySnapshot = Row & { productVariants: Row[] };
type Mode = 'ABSOLUTE' | 'DELTA' | 'REACTIVATE';

/** Inventory and catalog keep independent drafts. Preserve command identity after response loss. */
export function InventoryPanel({ productId, onInventoryRead }: { productId: string; onInventoryRead?: (snapshot: InventorySnapshot) => void }) {
  const [snapshot, setSnapshot] = useState<InventorySnapshot | null>(null);
  const [targetId, setTargetId] = useState(''); const [mode, setMode] = useState<Mode>('ABSOLUTE');
  const [quantity, setQuantity] = useState(''); const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const pending = useRef<InventoryAttempt | null>(null);
  const quantityInput = useRef<HTMLInputElement | null>(null);
  const inputClass = 'block min-h-12 w-full rounded-xl border border-catalog-gold/30 bg-[#0B132B]/70 px-4 py-3 text-sm font-mono text-white placeholder:text-gray-500 transition-colors focus:outline-none focus:border-catalog-gold focus:ring-1 focus:ring-catalog-gold/40 disabled:cursor-not-allowed disabled:opacity-50';
  const labelClass = 'block space-y-2 text-xs font-mono font-bold uppercase tracking-wider text-catalog-gold';
  const buttonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-catalog-gold/40 bg-catalog-gold/10 px-4 py-2 text-xs font-mono font-bold text-catalog-gold transition-colors hover:bg-catalog-gold/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-catalog-gold focus-visible:ring-offset-2 focus-visible:ring-offset-catalog-card disabled:cursor-not-allowed disabled:opacity-50';
  useEffect(() => {
    const abort = new AbortController();
    fetch(`/api/products/${productId}`, { cache: 'no-store', signal: abort.signal })
      .then(async response => { if (!response.ok) throw new Error('Não foi possível consultar estoque.'); return response.json(); })
      .then(data => { if (!abort.signal.aborted) { setSnapshot(data); onInventoryRead?.(data); } })
      .catch(error => { if (!abort.signal.aborted) setMessage(error.message); });
    return () => abort.abort();
  }, [productId, onInventoryRead]);
  const target = targetId ? snapshot?.productVariants.find(row => row.id === targetId) : snapshot;
  function selectTarget(id: string) {
    if (busy) return;
    if (id !== targetId) {
      setTargetId(id); setMode('ABSOLUTE'); setQuantity(''); setReason(''); setMessage(''); pending.current = null;
    }
    quantityInput.current?.focus();
  }
  async function refresh() {
    const response = await fetch(`/api/products/${productId}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Não foi possível consultar estoque.');
    const data: InventorySnapshot = await response.json();
    setSnapshot(data);
    onInventoryRead?.(data);
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
  return <section className="mb-8 min-w-0 space-y-6 rounded-2xl border border-catalog-gold/30 bg-catalog-card p-6 text-catalog-text shadow-xl backdrop-blur-xl sm:p-8" aria-label="Ajuste de estoque">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-catalog-gold/20 pb-4">
      <h3 className="flex items-center gap-2 text-base font-bold uppercase tracking-wider text-white font-mono">
        <Package aria-hidden="true" className="h-4 w-4 shrink-0 text-catalog-gold" />Ajuste de estoque
      </h3>
      <span className="rounded border border-catalog-gold/45 px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-catalog-gold">Inventário</span>
    </div>
    <div className="flex items-start gap-3 rounded-xl border border-catalog-gold/20 bg-[#0B132B]/60 p-4 text-sm leading-relaxed text-catalog-muted">
      <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-catalog-gold" />
      <div className="space-y-2">
        <p>Registre reposições e contagens do produto ou de cada variante. Salvar o cadastro preserva o estoque; novas variantes começam sem estoque.</p>
        <p>O limite geral é independente das variantes e também precisa comportar a quantidade que você deseja vender.</p>
      </div>
    </div>
    {snapshot && snapshot.productVariants.length > 0 && <div role="region" aria-label="Estoque por variante" tabIndex={0} className="overflow-x-auto rounded-xl border border-catalog-gold/20 bg-[#0B132B]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-catalog-gold">
      <table className="w-full text-left text-sm">
        <caption className="border-b border-catalog-gold/20 p-4 text-left text-xs font-mono font-bold uppercase tracking-wider text-catalog-gold">Estoque por variante<span className="mt-2 block text-[11px] font-normal normal-case tracking-normal text-catalog-muted sm:hidden">Deslize a tabela para acessar as ações.</span></caption>
        <thead className="bg-[#050B14] text-[10px] font-mono uppercase tracking-wider text-catalog-gold"><tr>
          <th scope="col" className="px-4 py-3">Variante</th><th scope="col" className="px-4 py-3">Disponível</th>
          <th scope="col" className="px-4 py-3">Indisponível</th><th scope="col" className="px-4 py-3">Ação</th>
        </tr></thead>
        <tbody>{snapshot.productVariants.map(row => <tr key={row.id} data-variant-id={row.id} className={`border-t border-catalog-gold/15 transition-colors ${targetId === row.id ? 'bg-catalog-gold/10' : 'hover:bg-catalog-gold/5'}`}>
          <th scope="row" className="px-4 py-3 font-medium">{row.size} / {row.color}{row.retiredAt && <span className="mt-1 block text-xs text-catalog-muted">Retirada</span>}</th>
          <td className="px-4 py-3 font-mono font-bold tabular-nums text-emerald-400">{row.stock}</td><td className="px-4 py-3 font-mono tabular-nums text-catalog-muted">{row.unavailableStock}</td>
          <td className="px-4 py-3"><button type="button" className={`${buttonClass} whitespace-nowrap`} disabled={busy} onClick={() => selectTarget(row.id)}
            aria-pressed={targetId === row.id} aria-label={`Ajustar estoque: ${row.size} / ${row.color}`}><SlidersHorizontal aria-hidden="true" className="h-3.5 w-3.5" />Ajustar estoque</button></td>
        </tr>)}</tbody>
      </table>
    </div>}
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
    <label className={labelClass}>Item
      <span className="relative block">
      <select className={`${inputClass} appearance-none pr-10 normal-case font-normal tracking-normal`} value={targetId} disabled={busy} onChange={event => selectTarget(event.target.value)}>
        <option value="">Limite geral do produto</option>
        {snapshot?.productVariants.map(row => <option key={row.id} value={row.id}>{row.size} / {row.color}{row.retiredAt ? ' (retirada)' : ''}</option>)}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2" />
      </span>
    </label>
    <label className={labelClass}>Operação
      <span className="relative block">
      <select className={`${inputClass} appearance-none pr-10 normal-case font-normal tracking-normal`} value={mode} disabled={busy} onChange={event => setMode(event.target.value as Mode)}>
        <option value="ABSOLUTE">Definir contagem disponível</option><option value="DELTA">Reposição (+) ou baixa (-)</option>
        {target?.retiredAt && <option value="REACTIVATE">Reativar após conferência física</option>}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2" />
      </span>
    </label>
    </div>
    {target && <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-3 rounded-xl border border-catalog-gold/20 bg-[#050B14] p-4 font-mono">
        <div><dt className="text-[10px] uppercase tracking-wider text-catalog-muted">Disponível</dt><dd className="mt-1 text-2xl font-bold tabular-nums text-emerald-400">{target.stock}</dd></div>
        <div className="border-l border-catalog-gold/20 pl-4"><dt className="text-[10px] uppercase tracking-wider text-catalog-muted">Indisponível</dt><dd className="mt-1 text-2xl font-bold tabular-nums text-catalog-text">{target.unavailableStock}</dd></div>
      </dl>
      {target.retiredAt && <p className="text-sm text-amber-300">Item retirado: reativação exige conferência física.</p>}
    </div>}
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-[1fr_2fr]">
      <label className={labelClass}>Quantidade<input ref={quantityInput} className={`${inputClass} font-normal tracking-normal`} type="number" step="1" min={mode === 'DELTA' ? undefined : 0} placeholder="Ex.: 10" value={quantity} disabled={busy} onChange={event => setQuantity(event.target.value)} /></label>
      <label className={labelClass}>Motivo<input className={`${inputClass} font-normal tracking-normal`} placeholder="Ex.: reposição recebida ou contagem física" value={reason} maxLength={500} disabled={busy} onChange={event => setReason(event.target.value)} /></label>
    </div>
    <div className="flex flex-col gap-3 border-t border-catalog-gold/20 pt-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
      <button type="button" className={buttonClass} disabled={busy} onClick={() => refresh().catch(error => setMessage(error.message))}><RefreshCw aria-hidden="true" className="h-4 w-4" />Conferir estoque atual</button>
      <button type="button" className="btn-shimmer inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#F5BD1E]/40 bg-gradient-to-r from-[#F0B40E] to-[#E5A805] px-6 py-3 text-xs font-bold uppercase tracking-widest text-brand-navy shadow-[0_0_25px_rgba(240,180,14,0.15)] transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-catalog-gold focus-visible:ring-offset-2 focus-visible:ring-offset-catalog-card disabled:cursor-not-allowed disabled:opacity-50" disabled={busy || !target} onClick={submit}>
        {busy ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Check aria-hidden="true" className="h-4 w-4" />}{busy ? 'Registrando ajuste…' : 'Registrar ajuste'}
      </button>
    </div>
    {message && <p role="status" className="flex items-start gap-2 rounded-xl border border-catalog-gold/30 bg-[#0B132B]/70 p-4 text-sm leading-relaxed text-catalog-text"><Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-catalog-gold" /><span>{message}</span></p>}
  </section>;
}
