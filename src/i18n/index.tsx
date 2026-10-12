'use client'

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import en from './en.json'
import mm from './mm.json'

export type Locale = 'en' | 'mm'

const dictionaries: Record<Locale, Record<string, unknown>> = { en: en as Record<string, unknown>, mm: mm as Record<string, unknown> }

type Params = Record<string, string | number>

function lookup(dict: Record<string, unknown>, key: string): string | undefined {
  const parts = key.split('.')
  let cur: unknown = dict
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return typeof cur === 'string' ? cur : undefined
}

function interpolate(template: string, params?: Params): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (m, k) => (params[k] != null ? String(params[k]) : m))
}

interface I18nContextValue {
  locale: Locale
  setLocale: (l: Locale, persist?: boolean) => void
  t: (key: string, params?: Params) => string
  formatDate: (d: string | Date | null | undefined, opts?: Intl.DateTimeFormatOptions) => string
  formatNumber: (n: number) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

function initialLocaleFromStorage(fallback: Locale): Locale {
  if (typeof window === 'undefined') return fallback
  const stored = localStorage.getItem('moge-locale')
  return stored === 'en' || stored === 'mm' ? stored : fallback
}

export function I18nProvider({ children, initialLocale = 'en' }: { children: React.ReactNode; initialLocale?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(() => initialLocaleFromStorage(initialLocale))

  const setLocale = useCallback((l: Locale, persist = true) => {
    setLocaleState(l)
    if (persist && typeof window !== 'undefined') localStorage.setItem('moge-locale', l)
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const value = useMemo<I18nContextValue>(() => {
    const t = (key: string, params?: Params) => {
      const v = lookup(dictionaries[locale], key) ?? lookup(dictionaries.en, key)
      if (v == null) {
        if (process.env.NODE_ENV !== 'production') console.warn(`[i18n] missing key: ${key}`)
        return key
      }
      return interpolate(v, params)
    }
    const formatDate = (d: string | Date | null | undefined, opts?: Intl.DateTimeFormatOptions) => {
      if (!d) return '—'
      const date = typeof d === 'string' ? new Date(d) : d
      if (isNaN(date.getTime())) return '—'
      try {
        return new Intl.DateTimeFormat(locale === 'mm' ? 'my-MM' : 'en-GB', {
          year: 'numeric', month: 'short', day: 'numeric', ...opts,
        }).format(date)
      } catch {
        return date.toISOString().slice(0, 10)
      }
    }
    const formatNumber = (n: number) => {
      try {
        return new Intl.NumberFormat(locale === 'mm' ? 'my-MM' : 'en-US').format(n)
      } catch {
        return String(n)
      }
    }
    return { locale, setLocale, t, formatDate, formatNumber }
  }, [locale, setLocale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
