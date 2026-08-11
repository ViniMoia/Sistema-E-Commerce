'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface SpinnerProps extends React.SVGProps<SVGSVGElement> {
  size?: 'sm' | 'md' | 'lg'
}

const sizeMap = {
  sm: 16,
  md: 24,
  lg: 32,
}

export function Spinner({ size = 'md', className, ...props }: SpinnerProps) {
  const sizePx = sizeMap[size]

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={sizePx}
      height={sizePx}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('animate-[spin_1.5s_linear_infinite]', className)}
      {...props}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}
