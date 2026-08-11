'use client'

import * as React from 'react'
import { FreightRuleForm } from '@/components/admin/freight/FreightRuleForm'
import { DataTable, ColumnDef, Button, EmptyState, AlertBanner, Spinner } from '@/components/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Trash2, Edit2 } from 'lucide-react'

interface FreightRule {
  id: string
  cityName: string
  value: number
}

export default function FreightPage() {
  const [rules, setRules] = React.useState<FreightRule[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  
  const [editingRule, setEditingRule] = React.useState<FreightRule | null>(null)
  const [ruleToDelete, setRuleToDelete] = React.useState<FreightRule | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)

  const fetchRules = React.useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const res = await fetch('/api/admin/freight')
      if (!res.ok) {
        throw new Error('Falha ao carregar regras de frete.')
      }
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setRules(json.data)
      } else {
        throw new Error('Formato de resposta inválido.')
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Erro desconhecido.')
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchRules()
  }, [fetchRules])

  const handleDelete = async () => {
    if (!ruleToDelete) return
    try {
      setIsDeleting(true)
      const res = await fetch(`/api/admin/freight/${ruleToDelete.id}`, {
        method: 'DELETE'
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Falha ao excluir regra.')
      }
      setRuleToDelete(null)
      fetchRules()
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Erro desconhecido ao excluir.')
      }
    } finally {
      setIsDeleting(false)
    }
  }

  const columns: ColumnDef<FreightRule>[] = [
    {
      key: 'cityName',
      header: 'Cidade',
      render: (val) => <span className="font-medium text-zinc-900 dark:text-zinc-100">{String(val)}</span>
    },
    {
      key: 'value',
      header: 'Valor',
      render: (val) => {
        const num = typeof val === 'number' ? val : parseFloat(String(val) || '0')
        return (
          <span className="text-zinc-900 dark:text-zinc-100">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num)}
          </span>
        )
      }
    },
    {
      key: 'id',
      header: 'Ações',
      align: 'right',
      render: (val, row) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingRule(row)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            className="h-8 w-8 p-0 text-zinc-500 hover:text-[#dbb501] dark:text-zinc-400 dark:hover:text-[#dbb501]"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRuleToDelete(row)}
            className="h-8 w-8 p-0 text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-500"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )
    }
  ]

  return (
    <div className="flex-1 space-y-8 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Configuração de Frete
          </h2>
          <p className="text-muted-foreground mt-2 text-zinc-500">
            Gerencie as regras de frete e valores por cidade.
          </p>
        </div>
      </div>

      {error && (
        <AlertBanner variant="error" title="Erro" message={error} />
      )}

      <FreightRuleForm 
        onSuccess={() => {
          setEditingRule(null)
          fetchRules()
        }}
        editingRule={editingRule}
        onCancelEdit={() => setEditingRule(null)}
      />

      <div className="pt-4">
        <DataTable
          columns={columns}
          data={rules}
          keyExtractor={(row) => row.id}
          isLoading={isLoading}
          emptyState={
            <EmptyState 
              title="Nenhuma regra configurada" 
              description="Você ainda não adicionou nenhuma regra de frete. Preencha o formulário acima para começar." 
            />
          }
        />
      </div>

      {/* Confirmação de Exclusão */}
      <Dialog open={!!ruleToDelete} onOpenChange={(open) => !open && !isDeleting && setRuleToDelete(null)}>
        <DialogContent className="sm:max-w-md bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Confirmar exclusão
            </DialogTitle>
            <DialogDescription className="text-zinc-500 dark:text-zinc-400">
              Tem certeza que deseja excluir a regra de frete para <strong>{ruleToDelete?.cityName}</strong>? 
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="border-t border-zinc-200 dark:border-zinc-800 pt-4 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRuleToDelete(null)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-900 dark:hover:bg-red-800 dark:text-red-100"
            >
              {isDeleting ? <Spinner className="mr-2 h-4 w-4" /> : null}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
