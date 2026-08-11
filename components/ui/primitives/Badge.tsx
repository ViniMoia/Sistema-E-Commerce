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
    className: 'bg-amber-100 text-amber-900 hover:bg-amber-100/80 border-transparent' 
  },
  PAID: { 
    label: 'Pago', 
    className: 'bg-blue-100 text-blue-900 hover:bg-blue-100/80 border-transparent' 
  },
  SHIPPED: { 
    label: 'Enviado', 
    className: 'bg-[#dbb501] text-white hover:bg-[#dbb501]/80 border-transparent' 
  },
  DELIVERED: { 
    label: 'Entregue', 
    className: 'bg-green-100 text-green-900 hover:bg-green-100/80 border-transparent' 
  },
  CANCELLED: { 
    label: 'Cancelado', 
    className: 'bg-red-100 text-red-900 hover:bg-red-100/80 border-transparent' 
  },
}

export function Badge({ status, size = 'sm', className }: BadgeProps) {
  const normalizedStatus = status?.toUpperCase() as OrderStatus
  const config = statusConfig[normalizedStatus] || { 
    label: status || 'Desconhecido', 
    className: 'bg-zinc-100 text-zinc-900 border-zinc-200' 
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
