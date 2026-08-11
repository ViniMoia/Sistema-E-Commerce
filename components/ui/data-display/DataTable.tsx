'use client'

import * as React from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SkeletonRow } from '../feedback/SkeletonRow'
import { cn } from '@/lib/utils'

export interface ColumnDef<T> {
  key: keyof T
  header: string
  render?: (value: T[keyof T], row: T) => React.ReactNode
  align?: 'left' | 'center' | 'right'
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[]
  data: T[]
  keyExtractor: (row: T) => string
  isLoading?: boolean
  emptyState?: React.ReactNode
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  emptyState,
}: DataTableProps<T>) {
  return (
    <div className="w-full overflow-x-auto rounded-md border border-zinc-200 dark:border-white/10">
      <Table className="w-full text-sm">
        <TableHeader className="bg-zinc-50 dark:bg-white/[0.02]">
          <TableRow className="border-b border-zinc-200 dark:border-white/10 hover:bg-transparent">
            {columns.map((col) => (
              <TableHead
                key={String(col.key)}
                className={cn(
                  'h-12 px-4 align-middle font-medium text-zinc-500 dark:text-zinc-400',
                  col.align === 'center' && 'text-center',
                  col.align === 'right' && 'text-right'
                )}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <SkeletonRow key={`skeleton-${index}`} columns={columns.length} />
            ))
          ) : data.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={columns.length}
                className="h-32 p-0 align-middle"
              >
                {emptyState}
              </TableCell>
            </TableRow>
          ) : (
            data.map((row, index) => (
              <TableRow
                key={keyExtractor(row)}
                className={cn(
                  'group transition-colors duration-200 ease-in-out border-b border-zinc-200 dark:border-white/10',
                  'hover:bg-zinc-100 dark:hover:bg-white/5',
                  index % 2 === 0 ? 'bg-transparent' : 'bg-zinc-50/50 dark:bg-white/[0.01]'
                )}
              >
                {columns.map((col) => (
                  <TableCell
                    key={String(col.key)}
                    className={cn(
                      'p-4 align-middle text-zinc-900 dark:text-zinc-100',
                      col.align === 'center' && 'text-center',
                      col.align === 'right' && 'text-right'
                    )}
                  >
                    {col.render
                      ? col.render(row[col.key], row)
                      : String(row[col.key])}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
