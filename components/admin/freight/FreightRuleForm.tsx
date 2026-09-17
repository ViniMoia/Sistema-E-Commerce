'use client'

import * as React from 'react'
import { Button, AlertBanner, Spinner } from '@/components/ui'

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
      setError('Valor de frete inválido.')
      return
    }

    if (!cityName.trim()) {
      setError('Nome da cidade é obrigatório.')
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
        throw new Error(errData?.error || 'Erro ao salvar regra de frete.')
      }

      setCityName('')
      setValue('')
      onSuccess()
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Ocorreu um erro desconhecido.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-white/5 bg-zinc-950/60 backdrop-blur-md p-6 shadow-sm">
      <div>
        <h3 className="text-lg font-medium text-zinc-100">
          {editingRule ? 'Editar Regra de Frete' : 'Nova Regra de Frete'}
        </h3>
        <p className="text-sm text-zinc-400">
          Configure o valor do frete para uma cidade específica.
        </p>
      </div>

      {error && (
        <AlertBanner variant="error" title="Erro" message={error} />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="cityName" className="text-sm font-medium text-zinc-300">
            Cidade
          </label>
          <input
            id="cityName"
            type="text"
            value={cityName}
            onChange={(e) => setCityName(e.target.value)}
            placeholder="Ex: São Paulo"
            disabled={isLoading}
            className="flex h-10 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:border-[#DDAF02] focus-visible:ring-1 focus-visible:ring-[#DDAF02]/30 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="value" className="text-sm font-medium text-zinc-300">
            Valor (R$)
          </label>
          <input
            id="value"
            type="number"
            step="0.01"
            min="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0.00"
            disabled={isLoading}
            className="flex h-10 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:border-[#DDAF02] focus-visible:ring-1 focus-visible:ring-[#DDAF02]/30 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button 
          type="submit" 
          disabled={isLoading}
          className="bg-[#DDAF02] text-zinc-950 hover:bg-[#c2a001] font-semibold"
        >
          {isLoading ? <Spinner className="w-4 h-4 mr-2" /> : null}
          {editingRule ? 'Salvar Alterações' : 'Adicionar Regra'}
        </Button>
        {editingRule && onCancelEdit && (
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancelEdit}
            disabled={isLoading}
            className="border-white/10 text-zinc-300 hover:text-white"
          >
            Cancelar
          </Button>
        )}
      </div>
    </form>
  )
}
