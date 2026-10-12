'use client'

import React, { useEffect } from 'react'
import { useUI } from '@/store/ui'
import { apiGet, apiPost } from '@/lib/client-api'
import { LoginView } from '@/components/hr/login'
import { AppShell } from '@/components/hr/shell'
import { useI18n } from '@/i18n'
import { Skeleton } from '@/components/ui/skeleton'

/** Root application: session gate → login or app shell. */
export function App() {
  const { session, sessionLoading, setSession, setSessionLoading } = useUI()
  const { setLocale } = useI18n()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const user = await apiGet<{ user: { userId: string; email: string; name: string; role: string; staffId: string | null; avatarUrl: string | null; preferredLocale: string; theme: string } }>('/api/auth/me')
        if (!cancelled) {
          setSession(user.user)
          if (user.user.preferredLocale === 'mm' || user.user.preferredLocale === 'en') {
            setLocale(user.user.preferredLocale, false)
          }
        }
      } catch {
        if (!cancelled) setSession(null)
      } finally {
        if (!cancelled) setSessionLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [setSession, setSessionLoading, setLocale])

  if (sessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="aurora" />
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#D4AF37] to-[#F1D98B] shadow-lg shadow-[#C9A227]/30">
            <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-[#221A00]">
              <path d="M12 2L14.5 8.5L21 11L14.5 13.5L12 20L9.5 13.5L3 11L9.5 8.5L12 2Z" fill="currentColor" />
            </svg>
          </div>
          <div className="h-2 w-40 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/2 rounded-full bg-primary skeleton-shimmer" />
          </div>
        </div>
      </div>
    )
  }

  return session ? <AppShell /> : <LoginView />
}
