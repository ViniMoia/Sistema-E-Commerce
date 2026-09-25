'use client'

import * as React from 'react'
import { AlertBanner } from '@/components/ui'
import { CustomerMetricsPanel } from './CustomerMetricsPanel'
import { CustomerOrderHistory } from './CustomerOrderHistory'
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  MapPin,
  User,
  Shield,
  Loader2,
  X
} from 'lucide-react'

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
      `${address.street}, ${address.number}`,
      address.complement ? `(${address.complement})` : null,
      address.neighborhood,
      `${address.city} - ${address.state}`
    ].filter(Boolean)
    return parts.join(' • ')
  }

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-[#070D18]">
        <Loader2 className="w-8 h-8 animate-spin text-catalog-gold mb-3" />
        <p className="text-xs font-mono uppercase tracking-widest text-catalog-muted">
          Carregando dossiê do cliente...
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex flex-col bg-[#070D18] p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-catalog-gold/20 pb-4">
          <button
            onClick={onClose}
            className="inline-flex items-center text-catalog-muted hover:text-white transition-colors group w-fit cursor-pointer"
          >
            <span className="group-hover:-translate-x-1 transition-transform duration-300">
              <ArrowLeft className="w-4 h-4 text-catalog-gold" />
            </span>
            <span className="ml-2 tracking-widest uppercase text-xs font-bold font-mono whitespace-nowrap">
              Voltar à listagem
            </span>
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <AlertBanner variant="error" title="Erro de Carregamento" message={error} />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="h-full flex flex-col bg-[#070D18] p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-catalog-gold/20 pb-4">
          <button
            onClick={onClose}
            className="inline-flex items-center text-catalog-muted hover:text-white transition-colors group w-fit cursor-pointer"
          >
            <span className="group-hover:-translate-x-1 transition-transform duration-300">
              <ArrowLeft className="w-4 h-4 text-catalog-gold" />
            </span>
            <span className="ml-2 tracking-widest uppercase text-xs font-bold font-mono whitespace-nowrap">
              Voltar à listagem
            </span>
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm font-mono text-catalog-muted">Cliente não encontrado.</p>
        </div>
      </div>
    )
  }

  const initials = getInitials(profile.name)

  return (
    <div className="h-full flex flex-col bg-[#070D18] text-white">
      {/* Top Bar com Navegação e Fechar */}
      <div className="p-6 border-b border-catalog-gold/25 bg-[#050B14]/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onClose}
            className="inline-flex items-center text-catalog-muted hover:text-white transition-colors group w-fit cursor-pointer"
          >
            <span className="group-hover:-translate-x-1 transition-transform duration-300">
              <ArrowLeft className="w-4 h-4 text-catalog-gold" />
            </span>
            <span className="ml-2 tracking-widest uppercase text-xs font-bold font-mono whitespace-nowrap">
              Voltar à listagem
            </span>
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-catalog-muted hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Fechar painel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Header do Perfil */}
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0B132B] via-[#0F172A] to-[#1E293B] border-2 border-catalog-gold/50 flex items-center justify-center text-catalog-gold font-bold text-xl shadow-[0_0_25px_rgba(240,180,14,0.25)] shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold font-continental-display text-white tracking-tight truncate">
                {profile.name}
              </h2>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-catalog-gold/15 text-catalog-gold border border-catalog-gold/30 shrink-0">
                Cliente
              </span>
            </div>
            
            <div className="mt-1 space-y-1 text-xs font-mono">
              <div className="flex items-center gap-2 text-neutral-300">
                <Mail className="w-3.5 h-3.5 text-catalog-gold/70 shrink-0" />
                <span className="truncate">{profile.email}</span>
              </div>
              {profile.phone && (
                <div className="flex items-center gap-2 text-catalog-muted">
                  <Phone className="w-3.5 h-3.5 text-catalog-gold/50 shrink-0" />
                  <span>{profile.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-catalog-muted text-[11px] pt-0.5">
                <Calendar className="w-3.5 h-3.5 text-catalog-gold/50 shrink-0" />
                <span>Membro desde {formatMemberDate(profile.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo rolável */}
      <div className="p-6 space-y-8 overflow-y-auto flex-1">
        {/* Painel de Métricas */}
        {metrics && (
          <section className="space-y-3">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-catalog-gold border-b border-catalog-gold/25 pb-2">
              Desempenho & Métricas de Consumo
            </h3>
            <CustomerMetricsPanel metrics={metrics} isLoading={isLoading} />
          </section>
        )}

        {/* Endereços de Entrega Registrados */}
        <section className="space-y-3">
          <div className="flex items-center justify-between border-b border-catalog-gold/25 pb-2">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-catalog-gold">
              Endereços Cadastrados
            </h3>
            <span className="text-[11px] font-mono text-catalog-muted">
              {profile.addresses.length} {profile.addresses.length === 1 ? 'endereço' : 'endereços'}
            </span>
          </div>

          {profile.addresses.length === 0 ? (
            <div className="p-4 rounded-xl bg-[#050B14] border border-white/5 text-center text-xs font-mono text-catalog-muted">
              Nenhum endereço registrado por este cliente.
            </div>
          ) : (
            <div className="space-y-2">
              {profile.addresses.map((address, index) => (
                <div
                  key={index}
                  className="bg-[#050B14] rounded-xl p-3.5 border border-catalog-gold/20 flex items-start gap-3 hover:border-catalog-gold/40 transition-all"
                >
                  <div className="w-7 h-7 rounded-lg bg-catalog-gold/10 border border-catalog-gold/30 flex items-center justify-center text-catalog-gold shrink-0 mt-0.5">
                    <MapPin className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-white font-medium leading-relaxed">
                      {formatAddress(address)}
                    </p>
                    <p className="text-[10px] font-mono text-catalog-gold mt-0.5">
                      {index === 0 ? 'Endereço Principal' : `Endereço Secundário #${index + 1}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Histórico Transacional */}
        <section className="space-y-3">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-catalog-gold border-b border-catalog-gold/25 pb-2">
            Histórico de Transações
          </h3>
          <CustomerOrderHistory customerId={customerId} />
        </section>
      </div>
    </div>
  )
}