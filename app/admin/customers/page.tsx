'use client'

import * as React from 'react'
import { CustomersTable } from '@/components/admin/customers/CustomersTable'
import { AlertBanner } from '@/components/ui'
import { CustomerProfilePage } from '@/components/admin/customers/CustomerProfilePage'

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
    }, 400)
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
        throw new Error('Formato de resposta inv\u00e1lido')
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
    <div className="flex-1 space-y-8 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-100">
            Clientes
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            Gerencie e visualize os dados dos seus clientes.
          </p>
        </div>
      </div>

      {error && (
        <AlertBanner
          variant="error"
          title="Erro"
          message={error}
        />
      )}

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <input
          type="text"
          placeholder="Buscar por nome ou email..."
          value={search}
          onChange={handleSearchChange}
          className="flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#dbb501] focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-50 sm:max-w-sm"
        />
      </div>

      <CustomersTable
        data={customers}
        isLoading={isLoading}
        onSelectCustomer={setSelectedCustomerId}
      />

      {hasMore && (
        <div className="flex justify-center pt-4">
          <button
            onClick={handleLoadMore}
            disabled={isLoading}
            className="inline-flex items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 px-6 py-2 text-sm font-medium text-zinc-100 transition-colors hover:border-[#dbb501] hover:text-[#dbb501] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#dbb501] disabled:pointer-events-none disabled:opacity-50"
          >
            Carregar mais
          </button>
        </div>
      )}

      {selectedCustomerId && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl border-l border-zinc-800 bg-zinc-950 shadow-xl">
          <CustomerProfilePage
            customerId={selectedCustomerId}
            onClose={() => setSelectedCustomerId(null)}
          />
        </div>
      )}
    </div>
  )
}