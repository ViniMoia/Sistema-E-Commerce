'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Loader2 } from 'lucide-react'

export function PaymentCopyButton({ value, label, successMessage, isAllowed }: {
  value: string
  label: string
  successMessage: string
  isAllowed: () => boolean
}) {
  const [status, setStatus] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle')
  const operation = useRef({ revision: 0, busy: false, timer: undefined as ReturnType<typeof setTimeout> | undefined })

  useEffect(() => {
    const state = operation.current
    state.revision++
    state.busy = false
    setStatus('idle')
    return () => { state.revision++; clearTimeout(state.timer) }
  }, [value])

  const copy = async () => {
    const state = operation.current
    if (state.busy || !isAllowed()) return
    const request = ++state.revision
    state.busy = true
    clearTimeout(state.timer)
    setStatus('copying')
    try {
      await navigator.clipboard.writeText(value)
      if (state.revision !== request) return
      setStatus(isAllowed() ? 'copied' : 'idle')
      state.timer = setTimeout(() => setStatus('idle'), 2500)
    } catch {
      if (state.revision === request) setStatus(isAllowed() ? 'error' : 'idle')
    } finally {
      if (state.revision === request) state.busy = false
    }
  }

  return <div className="shrink-0 max-w-48">
    <button type="button" onClick={copy} aria-label={label} disabled={status === 'copying'}
      className="btn-shimmer px-4 py-2.5 rounded-full bg-gradient-to-r from-[#F0B40E] to-[#E5A805] text-[#010E31] font-bold text-xs uppercase tracking-wider border border-[#F5BD1E]/40 flex items-center gap-1.5 disabled:opacity-60">
      {status === 'copying' ? <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin" />
        : status === 'copied' ? <Check aria-hidden="true" className="w-4 h-4" /> : <Copy aria-hidden="true" className="w-4 h-4" />}
      <span>{status === 'copied' ? 'Copiado!' : status === 'copying' ? 'Copiando...' : 'Copiar'}</span>
    </button>
    <p role="status" aria-live="polite" className="mt-1 text-xs text-catalog-muted">{status === 'copied' ? successMessage : ''}</p>
    {status === 'error' && <p role="alert" className="mt-1 text-xs text-catalog-text">Não foi possível copiar. Selecione o código e copie manualmente.</p>}
  </div>
}
