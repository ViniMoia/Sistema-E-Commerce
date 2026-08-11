'use client'

import * as React from 'react'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

export interface AlertBannerProps {
  title?: string
  message: string
  variant: 'success' | 'error' | 'warning' | 'info'
  onDismiss?: () => void
  className?: string
}

const variantStyles = {
  success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  error: 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400',
  warning: 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  info: 'border-[#dbb501]/20 bg-[#dbb501]/10 text-[#dbb501]',
}

const VariantIcons = {
  success: (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>
    </svg>
  ),
  error: (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>
    </svg>
  ),
  warning: (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>
    </svg>
  ),
  info: (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
    </svg>
  ),
}

export function AlertBanner({
  title,
  message,
  variant,
  onDismiss,
  className,
}: AlertBannerProps) {
  const [isExiting, setIsExiting] = React.useState(false)

  const handleDismiss = () => {
    setIsExiting(true)
    setTimeout(() => {
      onDismiss?.()
    }, 300)
  }

  return (
    <Alert
      className={cn(
        'relative flex items-center justify-between gap-4 py-3 px-4 shadow-sm backdrop-blur-sm',
        isExiting 
          ? 'animate-out fade-out slide-out-to-top-4 duration-300' 
          : 'animate-in fade-in slide-in-from-top-4 duration-500',
        variantStyles[variant],
        className
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5">{VariantIcons[variant]}</span>
        <div className="flex flex-col gap-0.5">
          {title && (
            <AlertTitle className="text-sm font-semibold leading-snug m-0">
              {title}
            </AlertTitle>
          )}
          <AlertDescription className="text-sm font-medium leading-relaxed m-0">
            {message}
          </AlertDescription>
        </div>
      </div>
      
      {onDismiss ? (
        <button
          onClick={handleDismiss}
          className="rounded-md p-1 opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5 transition-all focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10"
          aria-label="Dismiss"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
          </svg>
        </button>
      ) : null}
    </Alert>
  )
}
