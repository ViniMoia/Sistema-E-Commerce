'use client'

import * as React from 'react'
import { Button as ShadcnButton } from '@/components/ui/button'
import { Spinner } from './Spinner'
import { cn } from '@/lib/utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const isPrimary = variant === 'primary'

    const variantClasses = {
      primary: 'bg-[#dbb501] text-white hover:bg-[#dbb501]/90 border-transparent shadow-md',
      secondary: 'bg-zinc-800 text-white hover:bg-zinc-700 border border-zinc-700 shadow-sm',
      danger: 'bg-red-500 text-white hover:bg-red-600 border-transparent shadow-sm',
      ghost: 'bg-transparent text-zinc-300 hover:bg-white/10 hover:text-white',
      outline: 'bg-transparent text-zinc-300 border border-zinc-700 hover:bg-white/10 hover:text-white',
    }

    const sizeClasses = {
      sm: 'h-8 px-3 text-xs rounded-md',
      md: 'h-10 px-4 py-2 rounded-md',
      lg: 'h-12 px-8 text-lg rounded-md',
    }

    return (
      <ShadcnButton
        ref={ref}
        disabled={loading || disabled}
        className={cn(
          'group relative overflow-hidden transition-all duration-300 ease-out',
          variantClasses[variant],
          sizeClasses[size],
          isPrimary && 'hover:shadow-[0_0_20px_rgba(219,181,1,0.4)]',
          className
        )}
        {...props}
      >
        {isPrimary && (
          <span className="absolute inset-0 overflow-hidden rounded-md pointer-events-none">
            <span className="absolute top-0 left-0 h-full w-full -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:animate-[shimmer_1.5s_infinite] group-hover:opacity-100"></span>
          </span>
        )}
        
        <span className="relative z-10 flex items-center justify-center gap-2">
          {loading ? (
            <Spinner size="sm" />
          ) : (
            <>
              {leftIcon && <span className="flex items-center">{leftIcon}</span>}
              {children}
              {rightIcon && <span className="flex items-center">{rightIcon}</span>}
            </>
          )}
        </span>
      </ShadcnButton>
    )
  }
)

Button.displayName = 'Button'
