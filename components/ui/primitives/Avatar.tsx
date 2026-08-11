'use client'

import * as React from 'react'
import {
  Avatar as ShadcnAvatar,
  AvatarFallback as ShadcnAvatarFallback,
  AvatarImage as ShadcnAvatarImage,
} from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

export interface AvatarProps {
  name: string
  src?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-14 h-14',
}

const typographyClasses = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-lg',
}

export const Avatar = React.forwardRef<React.ElementRef<typeof ShadcnAvatar>, AvatarProps>(
  ({ name, src, size = 'md', className }, ref) => {
    const initial = (name || '?')
      .trim()
      .substring(0, 1)
      .toUpperCase()

    const hasValidSrc = typeof src === 'string' && src.trim().length > 0

    return (
      <ShadcnAvatar
        ref={ref}
        className={cn(
          sizeClasses[size],
          'shadow-sm border border-black/5 ring-1 ring-white/10 transition-all duration-200',
          className
        )}
      >
        {hasValidSrc && (
          <ShadcnAvatarImage src={src as string} alt={name} className="object-cover" />
        )}
        <ShadcnAvatarFallback
          className={cn(
            'bg-[#dbb501]/10 text-[#dbb501] font-semibold tracking-widest',
            typographyClasses[size]
          )}
        >
          {initial}
        </ShadcnAvatarFallback>
      </ShadcnAvatar>
    )
  }
)

Avatar.displayName = 'Avatar'
