'use client'

import { Badge as ShadcnBadge } from '@/components/ui/badge'
import { OrderStatus } from '@prisma/client'
import { cn } from '@/lib/utils'

export type BadgeSize = 'sm' | 'md'

export interface BadgeProps {
  status: OrderStatus
  size?: BadgeSize
  className?: string
}

const statusConfig: Record<OrderStatus, { label: string; className: string }> = {
  PENDING: { 
    label: 'Pendente', 
    className: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
  },
  PAID: { 
    label: 'Pago', 
    className: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
  },
  SHIPPED: { 
    label: 'Enviado', 
    className: 'bg-[#DDAF02]/10 text-[#DDAF02] border border-[#DDAF02]/20' 
  },
  DELIVERED: { 
    label: 'Entregue', 
    className: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
  },
  CANCELLED: { 
    label: 'Cancelado', 
    className: 'bg-red-500/10 text-red-400 border border-red-500/20' 
  },
}

export function Badge({ status, size = 'sm', className }: BadgeProps) {
  const normalizedStatus = status?.toUpperCase() as OrderStatus
  const config = statusConfig[normalizedStatus] || { 
    label: status || 'Desconhecido', 
    className: 'bg-zinc-800/60 text-zinc-300 border border-white/10' 
  }
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
  
  return (
    <ShadcnBadge 
      className={cn(
        'animate-in font-semibold transition-all duration-200',
        config.className,
        sizeClasses,
        className
      )}
    >
      {config.label}
    </ShadcnBadge>
  )
}
