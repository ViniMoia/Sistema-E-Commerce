'use client'

import * as React from 'react'
import { CustomersTable } from '@/components/admin/customers/CustomersTable'
import { AlertBanner } from '@/components/ui'
import { CustomerProfilePage } from '@/components/admin/customers/CustomerProfilePage'
import { Users, Search, Loader2 } from 'lucide-react'

interface CustomerRow {
  id: string
  name: string
  email: string
  phone: string | null
  totalOrders: number
  totalSpent: number
  lastOrderAt: string | null
  createdAt: string
}

export default function CustomersPage() {
  const [customers, setCustomers] = React.useState<CustomerRow[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [selectedCustomerId, setSelectedCustomerId] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState('')
  const [debouncedSearch, setDebouncedSearch] = React.useState('')
  const [nextCursor, setNextCursor] = React.useState<string | null>(null)
  const [hasMore, setHasMore] = React.useState(false)

  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>(null)

  React.useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search)
    }, 350)
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [search])

  async function fetchCustomers(searchTerm: string, cursorValue: string | null, append: boolean) {
    try {
      setIsLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (searchTerm) params.set('search', searchTerm)
      if (cursorValue) params.set('cursor', cursorValue)

      const res = await fetch(`/api/admin/customers?${params.toString()}`)
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Erro ao carregar clientes')
      }

      const json = await res.json()
      if (json.success && json.data) {
        if (append) {
          setCustomers(prev => [...prev, ...json.data.data])
        } else {
          setCustomers(json.data.data)
        }
        setNextCursor(json.data.nextCursor)
        setHasMore(!!json.data.nextCursor)
      } else {
        throw new Error('Formato de resposta inválido')
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Ocorreu um erro desconhecido')
      }
    } finally {
      setIsLoading(false)
    }
  }

  React.useEffect(() => {
    setCustomers([])
    setNextCursor(null)
    setHasMore(false)
    fetchCustomers(debouncedSearch, null, false)
  }, [debouncedSearch])

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value)
  }

  function handleLoadMore() {
    if (nextCursor) {
      fetchCustomers(debouncedSearch, nextCursor, true)
    }
  }

  return (
    <div className="flex-1 space-y-8 p-6 md:p-10 max-w-7xl mx-auto">
      {/* Cabeçalho Canônico Continental */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-catalog-gold/20 pb-6">
        <div>
          <div className="flex items-center gap-2 text-catalog-gold text-xs font-mono uppercase tracking-widest mb-1.5">
            <Users className="w-3.5 h-3.5" />
            <span>Gestão de Relacionamento (CRM)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold font-continental-display tracking-tight text-white">
            Clientes Continental
          </h1>
          <p className="text-catalog-muted mt-1 text-xs sm:text-sm font-light">
            Base completa de clientes, métricas de consumo e histórico transacional individual.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-catalog-muted self-start sm:self-auto">
          <span>Registros carregados:</span>
          <span className="font-bold text-catalog-gold px-2.5 py-0.5 rounded-full bg-catalog-gold/15 border border-catalog-gold/40">
            {customers.length} {customers.length === 1 ? 'cliente' : 'clientes'}
          </span>
        </div>
      </div>

      {error && (
        <AlertBanner
          variant="error"
          title="Erro"
          message={error}
        />
      )}

      {/* Barra de Busca com Design System Continental */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 text-catalog-gold absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por nome, e-mail ou documento..."
            value={search}
            onChange={handleSearchChange}
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-catalog-gold/30 bg-[#0B132B]/80 text-xs font-mono text-white placeholder:text-neutral-500 focus:outline-none focus:border-catalog-gold focus:ring-1 focus:ring-catalog-gold/30 transition-all shadow-inner"
          />
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-xs font-mono text-catalog-gold animate-pulse self-start sm:self-auto">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Consultando base...</span>
          </div>
        )}
      </div>

      {/* Tabela Canônica de Clientes */}
      <CustomersTable
        data={customers}
        isLoading={isLoading && customers.length === 0}
        onSelectCustomer={setSelectedCustomerId}
      />

      {/* Paginação / Carregar Mais */}
      {hasMore && (
        <div className="flex justify-center pt-4">
          <button
            onClick={handleLoadMore}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-full px-8 py-2.5 border border-catalog-gold/40 text-catalog-gold hover:bg-catalog-gold hover:text-black font-semibold text-xs font-mono transition-all shadow-[0_0_15px_rgba(240,180,14,0.15)] hover:shadow-[0_0_25px_rgba(240,180,14,0.35)] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Carregando...</span>
              </>
            ) : (
              <span>Carregar mais clientes</span>
            )}
          </button>
        </div>
      )}

      {/* Drawer Lateral do Perfil do Cliente com Backdrop Blur */}
      {selectedCustomerId && (
        <>
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm z-40 transition-opacity duration-300"
            onClick={() => setSelectedCustomerId(null)}
          />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl border-l border-catalog-gold/30 bg-[#070D18] shadow-2xl overflow-hidden animate-in slide-in-from-right duration-300">
            <CustomerProfilePage
              customerId={selectedCustomerId}
              onClose={() => setSelectedCustomerId(null)}
            />
          </div>
        </>
      )}
    </div>
  )
}