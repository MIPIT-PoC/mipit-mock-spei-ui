'use client'

/**
 * @file theme-provider.tsx
 * @description Thin client-side wrapper around next-themes ThemeProvider so the SPEI mock UI can force the dark theme and avoid hydration mismatches.
 * @author Nicolás Calderón
 * @project MIPIT-PoC — Cross-border Instant Payments Middleware
 */
import * as React from 'react'
import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from 'next-themes'

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
