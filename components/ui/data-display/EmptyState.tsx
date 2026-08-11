'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface EmptyStateProps {
  title: string
  description?: string
  action?: React.ReactNode
  icon?: React.ReactNode
  className?: string
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'animate-in flex flex-col items-center justify-center text-center p-8 md:p-16',
        'border border-dashed border-zinc-200 dark:border-white/10 rounded-xl',
        'bg-zinc-50/50 dark:bg-black/20 transition-all duration-300',
        className
      )}
    >
      {icon ? (
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-zinc-100 dark:bg-white/5 text-zinc-400 dark:text-zinc-500 [&>svg]:w-10 [&>svg]:h-10">
          {icon}
        </div>
      ) : null}
      
      <h3 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">
        {title}
      </h3>
      
      {description ? (
        <p className="mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
          {description}
        </p>
      ) : null}
      
      {action ? <div className="mt-8">{action}</div> : null}
    </div>
  )
}
