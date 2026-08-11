'use client'

import * as React from 'react'
import { Avatar, AlertBanner, SkeletonRow } from '@/components/ui'
import { CustomerMetricsPanel } from './CustomerMetricsPanel'
import { CustomerOrderHistory } from './CustomerOrderHistory'

interface CustomerProfile {
  id: string
  name: string
  email: string
  phone: string | null
  createdAt: string
  addresses: Array<{
    state: string
    city: string
    neighborhood: string
    street: string
    number: string
    complement: string | null
  }>
}

interface CustomerMetrics {
  totalOrders: number
  totalSpent: number
  averageOrderValue: number
  firstOrderAt: string | null
  lastOrderAt: string | null
  mostBoughtProduct: string | null
  preferredDeliveryType: 'DELIVERY' | 'PICKUP' | null
  cancelledOrders: number
}

interface CustomerProfilePageProps {
  customerId: string
  onClose: () => void
}

export function CustomerProfilePage({ customerId, onClose }: CustomerProfilePageProps) {
  const [profile, setProfile] = React.useState<CustomerProfile | null>(null)
  const [metrics, setMetrics] = React.useState<CustomerMetrics | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true)
        setError(null)

        const [profileRes, metricsRes] = await Promise.all([
          fetch(`/api/admin/customers/${customerId}`),
          fetch(`/api/admin/customers/${customerId}/metrics`)
        ])

        if (!profileRes.ok) {
          const errData = await profileRes.json()
          throw new Error(errData.error || 'Erro ao carregar dados do cliente')
        }

        if (!metricsRes.ok) {
          const errData = await metricsRes.json()
          throw new Error(errData.error || 'Erro ao carregar métricas do cliente')
        }

        const profileJson = await profileRes.json()
        const metricsJson = await metricsRes.json()

        if (profileJson.success && profileJson.data) {
          setProfile(profileJson.data)
        }

        if (metricsJson.success && metricsJson.data) {
          setMetrics(metricsJson.data)
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

    fetchData()
  }, [customerId])

  function getInitials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map(n => n[0])
      .join('')
      .toUpperCase()
  }

  function formatMemberDate(isoString: string): string {
    return new Intl.DateTimeFormat('pt-BR', {
      year: 'numeric',
      month: 'long'
    }).format(new Date(isoString))
  }

  function formatAddress(address: CustomerProfile['addresses'][0]): string {
    const parts = [
      address.street,
      address.number,
      address.complement ? `, ${address.complement}` : '',
      address.neighborhood,
      address.city,
      address.state
    ].filter(Boolean)
    return parts.join(' - ')
  }

  if (isLoading) {
    return (
      <div className="h-full flex flex-col bg-zinc-950">
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center gap-4">
            <SkeletonRow columns={1} />
            <div className="space-y-2">
              <SkeletonRow columns={1} />
              <SkeletonRow columns={1} />
            </div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <SkeletonRow columns={1} />
          <SkeletonRow columns={1} />
          <SkeletonRow columns={1} />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex flex-col bg-zinc-950 p-6">
        <div className="flex items-center mb-6">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            <span>Voltar</span>
          </button>
        </div>
        <AlertBanner variant="error" title="Erro" message={error} />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="h-full flex flex-col bg-zinc-950 p-6">
        <div className="flex items-center mb-6">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            <span>Voltar</span>
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-zinc-400">Cliente não encontrado.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-zinc-950 overflow-y-auto">
      <div className="p-6 border-b border-zinc-800">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            <span>Voltar</span>
          </button>
        </div>
        <div className="flex items-start gap-4">
          <Avatar name={profile.name} className="w-16 h-16 bg-zinc-800 text-zinc-100 text-xl font-medium" />
          <div>
            <h2 className="text-2xl font-bold text-zinc-100">{profile.name}</h2>
            <p className="text-zinc-400">{profile.email}</p>
            {profile.phone && (
              <p className="text-zinc-400">{profile.phone}</p>
            )}
            <p className="mt-2 text-sm text-zinc-500">
              Membro desde {formatMemberDate(profile.createdAt)}
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {metrics && <CustomerMetricsPanel metrics={metrics} isLoading={isLoading} />}

        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 border-b border-zinc-800 pb-2">
            Endereços
          </h3>
          {profile.addresses.length === 0 ? (
            <p className="text-zinc-400">Nenhum endereço registrado.</p>
          ) : (
            <div className="space-y-2">
              {profile.addresses.map((address, index) => (
                <div
                  key={index}
                  className="bg-zinc-900 rounded-lg p-4 border border-zinc-800"
                >
                  <p className="text-zinc-300 text-sm leading-relaxed">
                    {formatAddress(address)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 border-b border-zinc-800 pb-2">
            Histórico de Pedidos
          </h3>
          <CustomerOrderHistory customerId={customerId} />
        </section>
      </div>
    </div>
  )
}