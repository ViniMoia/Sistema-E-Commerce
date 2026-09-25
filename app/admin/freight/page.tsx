'use client'

import * as React from 'react'
import { FreightRuleForm } from '@/components/admin/freight/FreightRuleForm'
import { DataTable, ColumnDef, AlertBanner, Spinner } from '@/components/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import {
  Truck,
  Trash2,
  Edit2,
  MapPin,
  DollarSign,
  AlertTriangle,
  PackageCheck,
  ShieldAlert,
  Loader2
} from 'lucide-react'

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
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Falha ao excluir regra.')
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

  const freeShippingRulesCount = React.useMemo(() => rules.filter((r) => r.value === 0).length, [rules])

  const columns: ColumnDef<FreightRule>[] = [
    {
      key: 'cityName',
      header: 'Município / Região de Atendimento',
      render: (val) => (
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-catalog-gold/15 border border-catalog-gold/30 flex items-center justify-center text-catalog-gold shrink-0">
            <MapPin className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold text-white tracking-tight">
            {String(val)}
          </span>
        </div>
      )
    },
    {
      key: 'value',
      header: 'Tarifa Aplicada',
      render: (val) => {
        const num = typeof val === 'number' ? val : parseFloat(String(val) || '0')
        return (
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-catalog-gold text-sm">
              {num === 0
                ? 'Grátis (R$ 0,00)'
                : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num)}
            </span>
            {num === 0 && (
              <span className="font-mono text-[10px] px-2 py-0.2 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Sem custo
              </span>
            )}
          </div>
        )
      }
    },
    {
      key: 'id',
      header: 'Ações de Gestão',
      align: 'right',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => {
              setEditingRule(row)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-mono font-semibold bg-white/5 border border-catalog-gold/30 text-white hover:text-catalog-gold hover:border-catalog-gold hover:bg-catalog-gold/10 transition-all cursor-pointer shadow-sm"
          >
            <Edit2 className="w-3.5 h-3.5 text-catalog-gold" />
            <span>Editar</span>
          </button>
          <button
            onClick={() => setRuleToDelete(row)}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-mono font-semibold bg-red-950/20 border border-red-500/30 text-red-300 hover:text-white hover:bg-red-600 hover:border-red-600 transition-all cursor-pointer shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
            <span>Excluir</span>
          </button>
        </div>
      )
    }
  ]

  return (
    <div className="flex-1 space-y-8 p-6 md:p-10 max-w-7xl mx-auto">
      {/* Cabeçalho Canônico Continental */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-catalog-gold/20 pb-6">
        <div>
          <div className="flex items-center gap-2 text-catalog-gold text-xs font-mono uppercase tracking-widest mb-1.5">
            <Truck className="w-3.5 h-3.5" />
            <span>Logística & Tarifação Regional</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold font-continental-display tracking-tight text-white">
            Regras de Frete Fixo
          </h1>
          <p className="text-catalog-muted mt-1 text-xs sm:text-sm font-light">
            Defina taxas de frete personalizadas por município para entregas diretas e motoboy.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-catalog-muted self-start sm:self-auto">
          <span>Regras ativas:</span>
          <span className="font-bold text-catalog-gold px-2.5 py-0.5 rounded-full bg-catalog-gold/15 border border-catalog-gold/40">
            {rules.length} {rules.length === 1 ? 'regra' : 'regras'}
          </span>
        </div>
      </div>

      {error && (
        <AlertBanner variant="error" title="Atenção" message={error} />
      )}

      {/* 3 StatCards Rápidos de Logística */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-catalog-card border border-catalog-gold/25 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-catalog-muted">
              Cidades Cadastradas
            </span>
            <div className="text-2xl font-bold font-mono text-white mt-1">
              {rules.length}
            </div>
            <p className="text-[10px] text-catalog-muted font-mono mt-0.5">Destinos com tabela fixa</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-catalog-gold/10 border border-catalog-gold/30 flex items-center justify-center text-catalog-gold">
            <MapPin className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-catalog-card border border-catalog-gold/30 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-catalog-gold font-semibold">
              Regras com Frete Grátis
            </span>
            <div className="text-2xl font-bold font-mono text-catalog-gold mt-1">
              {freeShippingRulesCount}
            </div>
            <p className="text-[10px] text-catalog-muted font-mono mt-0.5">Custo zero para o comprador</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-catalog-gold/20 border border-catalog-gold/40 flex items-center justify-center text-catalog-gold">
            <PackageCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-catalog-card border border-catalog-gold/20 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-catalog-muted">
              Integração Ativa
            </span>
            <div className="text-sm font-bold font-mono text-emerald-400 mt-2 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Checkout Sincronizado
            </div>
            <p className="text-[10px] text-catalog-muted font-mono mt-0.5">Prioridade sobre Correios</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-neutral-400">
            <Truck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Formulário de Criação/Edição */}
      <FreightRuleForm 
        onSuccess={() => {
          setEditingRule(null)
          fetchRules()
        }}
        editingRule={editingRule}
        onCancelEdit={() => setEditingRule(null)}
      />

      {/* Tabela de Regras Canônica Continental */}
      <div className="bg-catalog-card border border-catalog-gold/30 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl">
        <DataTable
          columns={columns}
          data={rules}
          keyExtractor={(row) => row.id}
          isLoading={isLoading}
          emptyState={
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-white/5 border border-catalog-gold/30 flex items-center justify-center mx-auto text-catalog-gold">
                <Truck className="w-5 h-5" />
              </div>
              <p className="text-white font-semibold text-sm">Nenhuma regra de frete cadastrada</p>
              <p className="text-xs text-catalog-muted max-w-sm mx-auto font-light">
                Utilize o formulário acima para adicionar cidades e valores personalizados de entrega.
              </p>
            </div>
          }
        />
      </div>

      {/* Modal Canônico de Confirmação de Exclusão */}
      <Dialog open={!!ruleToDelete} onOpenChange={(open) => !open && !isDeleting && setRuleToDelete(null)}>
        <DialogContent className="sm:max-w-md bg-[#070D18] border border-catalog-gold/30 text-white rounded-2xl shadow-2xl p-6">
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-2.5 text-red-400">
              <div className="w-8 h-8 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-red-400" />
              </div>
              <DialogTitle className="text-lg font-bold font-continental-display text-white tracking-tight">
                Confirmar Exclusão de Regra
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-catalog-muted font-mono leading-relaxed pt-2">
              Você tem certeza de que deseja remover a regra de frete para o município de{' '}
              <strong className="text-catalog-gold">{ruleToDelete?.cityName}</strong>? Clientes deste local passarão a calcular o frete padrão (Correios ou a combinar).
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="border-t border-catalog-gold/20 pt-4 flex sm:justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setRuleToDelete(null)}
              disabled={isDeleting}
              className="rounded-full px-5 py-2 text-xs font-mono font-medium border border-white/10 text-neutral-300 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="inline-flex items-center gap-2 rounded-full px-6 py-2 text-xs font-mono font-bold bg-red-600 hover:bg-red-500 text-white transition-all shadow-md cursor-pointer disabled:opacity-50"
            >
              {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              <span>Excluir Regra</span>
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
