'use client'

import * as React from 'react'
import { AlertBanner, Spinner } from '@/components/ui'
import { PlusCircle, Edit3, MapPin, DollarSign, X } from 'lucide-react'

interface EditingRule {
  id: string
  cityName: string
  value: number
}

export interface FreightRuleFormProps {
  onSuccess: () => void
  editingRule?: EditingRule | null
  onCancelEdit?: () => void
}

export function FreightRuleForm({ onSuccess, editingRule, onCancelEdit }: FreightRuleFormProps) {
  const [cityName, setCityName] = React.useState('')
  const [value, setValue] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (editingRule) {
      setCityName(editingRule.cityName)
      setValue(editingRule.value.toString())
    } else {
      setCityName('')
      setValue('')
    }
  }, [editingRule])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const parsedValue = parseFloat(value)
    if (isNaN(parsedValue) || parsedValue < 0) {
      setError('Informe um valor de frete válido (zero ou superior).')
      return
    }

    if (!cityName.trim()) {
      setError('O nome da cidade de entrega é obrigatório.')
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const url = editingRule 
        ? `/api/admin/freight/${editingRule.id}` 
        : '/api/admin/freight'
        
      const method = editingRule ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cityName: cityName.trim(),
          value: parsedValue
        })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.error || 'Erro ao registrar regra de frete.')
      }

      setCityName('')
      setValue('')
      onSuccess()
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Ocorreu um erro desconhecido ao processar a regra.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-catalog-gold/30 bg-catalog-card backdrop-blur-xl p-6 shadow-2xl space-y-5"
    >
      <div className="flex items-center justify-between border-b border-catalog-gold/20 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-catalog-gold/15 border border-catalog-gold/30 flex items-center justify-center text-catalog-gold">
            {editingRule ? <Edit3 className="w-4 h-4" /> : <PlusCircle className="w-4 h-4" />}
          </div>
          <div>
            <h3 className="text-base font-bold font-continental-display text-white tracking-tight">
              {editingRule ? `Editar Regra: ${editingRule.cityName}` : 'Cadastrar Nova Regra de Frete'}
            </h3>
            <p className="text-xs text-catalog-muted font-light">
              Defina a tarifa fixa de entrega para municípios ou regiões específicas.
            </p>
          </div>
        </div>

        {editingRule && (
          <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-catalog-gold/15 text-catalog-gold border border-catalog-gold/30">
            Modo Edição
          </span>
        )}
      </div>

      {error && (
        <AlertBanner variant="error" title="Atenção" message={error} />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Campo Cidade */}
        <div className="space-y-1.5">
          <label htmlFor="cityName" className="text-xs font-mono uppercase tracking-wider text-catalog-gold font-semibold flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            <span>Município / Região de Atendimento</span>
          </label>
          <div className="relative">
            <input
              id="cityName"
              type="text"
              value={cityName}
              onChange={(e) => setCityName(e.target.value)}
              placeholder="Ex: Ribeirão Preto, Campinas, São Paulo"
              disabled={isLoading}
              className="w-full h-11 px-4 rounded-xl border border-catalog-gold/30 bg-[#0B132B]/80 text-xs font-mono text-white placeholder:text-neutral-500 focus:outline-none focus:border-catalog-gold focus:ring-1 focus:ring-catalog-gold/30 disabled:opacity-50 transition-all shadow-inner"
            />
          </div>
        </div>

        {/* Campo Valor */}
        <div className="space-y-1.5">
          <label htmlFor="value" className="text-xs font-mono uppercase tracking-wider text-catalog-gold font-semibold flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5" />
            <span>Tarifa Fixa (R$)</span>
          </label>
          <div className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-catalog-gold font-mono font-bold text-xs pointer-events-none">
              R$
            </div>
            <input
              id="value"
              type="number"
              step="0.01"
              min="0"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0,00 (0 para frete grátis)"
              disabled={isLoading}
              className="w-full h-11 pl-10 pr-4 rounded-xl border border-catalog-gold/30 bg-[#0B132B]/80 text-xs font-mono font-bold text-white placeholder:text-neutral-500 focus:outline-none focus:border-catalog-gold focus:ring-1 focus:ring-catalog-gold/30 disabled:opacity-50 transition-all shadow-inner"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit" 
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#F0B40E] to-[#DDAF02] text-black font-bold text-xs uppercase font-mono tracking-wider px-6 py-2.5 shadow-[0_0_20px_rgba(240,180,14,0.25)] hover:shadow-[0_0_30px_rgba(240,180,14,0.45)] transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
        >
          {isLoading && <Spinner className="w-4 h-4 text-black" />}
          <span>{editingRule ? 'Salvar Alterações' : 'Cadastrar Regra de Frete'}</span>
        </button>

        {editingRule && onCancelEdit && (
          <button
            type="button" 
            onClick={onCancelEdit}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-xs font-mono font-medium border border-white/10 text-neutral-300 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Cancelar Edição</span>
          </button>
        )}
      </div>
    </form>
  )
}
