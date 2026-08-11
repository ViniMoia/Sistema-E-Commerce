'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/primitives/Spinner'
import { cn } from '@/lib/utils'

export interface PaginationProps {
  hasNextPage: boolean
  hasPreviousPage: boolean
  onNext: () => void
  onPrevious: () => void
  isLoading?: boolean
  className?: string
}

export function Pagination({
  hasNextPage,
  hasPreviousPage,
  onNext,
  onPrevious,
  isLoading = false,
  className,
}: PaginationProps) {
  return (
    <div className={cn('flex w-full items-center justify-between', className)}>
      <Button
        variant="ghost"
        onClick={onPrevious}
        disabled={!hasPreviousPage || isLoading}
        className="group relative flex items-center justify-center gap-2 overflow-hidden transition-all duration-300 ease-out text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        {isLoading ? (
          <Spinner size="sm" />
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 transition-transform duration-300 ease-out group-hover:-translate-x-1"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        )}
        <span>Anterior</span>
      </Button>

      <Button
        variant="ghost"
        onClick={onNext}
        disabled={!hasNextPage || isLoading}
        className="group relative flex items-center justify-center gap-2 overflow-hidden transition-all duration-300 ease-out text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <span>Próxima</span>
        {isLoading ? (
          <Spinner size="sm" />
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 transition-transform duration-300 ease-out group-hover:translate-x-1"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        )}
      </Button>
    </div>
  )
}
