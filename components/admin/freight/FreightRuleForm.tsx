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
        const errData = await res.json()
        throw new Error(errData.error || 'Erro ao salvar regra de frete.')
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
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-950">
      <div>
        <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
          {editingRule ? 'Editar Regra de Frete' : 'Nova Regra de Frete'}
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Configure o valor do frete para uma cidade específica.
        </p>
      </div>

      {error && (
        <AlertBanner variant="error" title="Erro" message={error} />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="cityName" className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Cidade
          </label>
          <input
            id="cityName"
            type="text"
            value={cityName}
            onChange={(e) => setCityName(e.target.value)}
            placeholder="Ex: São Paulo"
            disabled={isLoading}
            className="flex h-10 w-full rounded-md border border-zinc-200 bg-transparent px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#dbb501] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:ring-offset-zinc-950 dark:placeholder:text-zinc-400"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="value" className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
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
            className="flex h-10 w-full rounded-md border border-zinc-200 bg-transparent px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#dbb501] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:ring-offset-zinc-950 dark:placeholder:text-zinc-400"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button 
          type="submit" 
          disabled={isLoading}
          className="bg-[#dbb501] text-zinc-950 hover:bg-[#c2a001]"
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
          >
            Cancelar
          </Button>
        )}
      </div>
    </form>
  )
}
