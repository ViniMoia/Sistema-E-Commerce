'use client'

import * as React from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { TableCell, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export interface SkeletonRowProps {
  columns: number
  rows?: number
}

const staticWidths = [
  'w-[65%]',
  'w-[85%]',
  'w-[60%]',
  'w-[90%]',
  'w-[70%]',
  'w-[75%]',
  'w-[80%]',
]

export function SkeletonRow({ columns, rows = 5 }: SkeletonRowProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <TableRow
          key={`skeleton-row-${rowIndex}`}
          className="border-b border-zinc-200 dark:border-white/10 hover:bg-transparent"
        >
          {Array.from({ length: columns }).map((_, colIndex) => {
            const widthClass = staticWidths[(rowIndex * columns + colIndex) % staticWidths.length]
            return (
              <TableCell
                key={`skeleton-col-${rowIndex}-${colIndex}`}
                className="p-4 align-middle"
              >
                <Skeleton
                  className={cn(
                    'h-4 rounded-sm animate-pulse bg-zinc-200/60 dark:bg-white/5',
                    widthClass
                  )}
                />
              </TableCell>
            )
          })}
        </TableRow>
      ))}
    </>
  )
}
