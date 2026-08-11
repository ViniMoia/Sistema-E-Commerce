'use client'

import * as React from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface StatCardProps {
  title: string
  value: string | number
  description?: string
  trend?: 'up' | 'down' | 'neutral'
  icon?: React.ReactNode
  className?: string
}

export function StatCard({
  title,
  value,
  description,
  trend = 'neutral',
  icon,
  className,
}: StatCardProps) {
  const trendColors = {
    up: 'text-emerald-500',
    down: 'text-red-500',
    neutral: 'text-zinc-500',
  }

  return (
    <Card
      className={cn(
        'animate-in relative overflow-hidden group transition-all duration-400 ease-out',
        'bg-white dark:bg-[#050505] border-zinc-200 dark:border-white/5',
        'hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(219,181,1,0.25)] hover:border-[#dbb501]/30',
        className
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          {title}
        </CardTitle>
        {icon && <div className="text-zinc-400 dark:text-zinc-500">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className={cn('text-2xl font-bold tracking-tight', trendColors[trend])}>
          {value}
        </div>
        {description && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
