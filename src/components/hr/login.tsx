'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { useI18n } from '@/i18n'
import { apiGet, apiPost, ApiError } from '@/lib/client-api'
import { useUI, type SessionUser } from '@/store/ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { GlassCard } from './shared'
import { Loader2, Eye, EyeOff, ShieldCheck, Users, UserCog, Sparkles, Languages } from 'lucide-react'
import { toast } from 'sonner'

interface PublicSettings {
  siteNameEn: string; siteNameMm: string; taglineEn: string | null; taglineMm: string | null
  logoFullUrl: string | null; logoMobileUrl: string | null; loginBackgroundUrl: string | null
  footerTextEn: string | null; footerTextMm: string | null
}

function GoldLogo({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'h-8 w-8', md: 'h-11 w-11', lg: 'h-14 w-14' }
  return (
    <div className={`relative flex ${sizes[size]} items-center justify-center rounded-2xl bg-gradient-to-br from-[#D4AF37] to-[#F1D98B] shadow-lg shadow-[#C9A227]/30`}>
      <svg viewBox="0 0 24 24" fill="none" className="h-1/2 w-1/2 text-[#221A00]">
        <path d="M12 2L14.5 8.5L21 11L14.5 13.5L12 20L9.5 13.5L3 11L9.5 8.5L12 2Z" fill="currentColor" />
        <circle cx="19" cy="5" r="1.6" fill="currentColor" opacity="0.7" />
      </svg>
      <span className="sr-only">{name}</span>
    </div>
  )
}

export function LoginView() {
  const { t, locale, setLocale } = useI18n()
  const { setSession, setSessionLoading } = useUI()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const { data: settings } = useQuery({
    queryKey: ['public-settings'],
    queryFn: () => apiGet<PublicSettings>('/api/public/settings'),
  })

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('moge-remember-email') : null
    if (saved) setEmail(saved)
  }, [])

  const siteName = locale === 'mm' ? settings?.siteNameMm ?? settings?.siteNameEn : settings?.siteNameEn
  const tagline = locale === 'mm' ? settings?.taglineMm ?? settings?.taglineEn : settings?.taglineEn
  const footer = locale === 'mm' ? settings?.footerTextMm ?? settings?.footerTextEn : settings?.footerTextEn

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!email || !password || submitting) return
    setSubmitting(true)
    try {
      const data = await apiPost<{ user: SessionUser }>('/api/auth/login', { email, password })
      if (remember) localStorage.setItem('moge-remember-email', email)
      else localStorage.removeItem('moge-remember-email')
      if (data.user.preferredLocale === 'mm' || data.user.preferredLocale === 'en') setLocale(data.user.preferredLocale)
      setSession(data.user)
      setSessionLoading(false)
      toast.success(t('toast.loginSuccess'))
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t('common.error')
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const fillDemo = (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail)
    setPassword(demoPassword)
  }

  return (
    <div className="relative flex min-h-screen flex-col lg:flex-row">
      <div className="aurora" />
      {/* Left branding panel */}
      <div className="relative hidden overflow-hidden lg:flex lg:w-1/2 xl:w-[55%]">
        {settings?.loginBackgroundUrl ? (
          <img src={settings.loginBackgroundUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#FBF9F4] via-[#F5EFDD] to-[#EDE4C8] dark:from-[#0B0E14] dark:via-[#10141C] dark:to-[#16130A]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
        <div className="relative z-10 flex h-full flex-col justify-between p-10 xl:p-16">
          <div className="flex items-center gap-3">
            {settings?.logoFullUrl ? (
              <img src={settings.logoFullUrl} alt={siteName ?? 'logo'} className="h-11 w-auto" />
            ) : (
              <GoldLogo name={siteName ?? 'MOGE HR'} />
            )}
            <div>
              <p className="text-lg font-semibold text-white drop-shadow">{siteName}</p>
              <p className="text-xs text-white/70">{tagline}</p>
            </div>
          </div>
          <div className="max-w-md">
            <motion.h2
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="text-3xl font-semibold leading-tight text-white drop-shadow-md xl:text-4xl"
            >
              {t('auth.welcomeBack')}
            </motion.h2>
            <p className="mt-3 text-sm leading-relaxed text-white/80 drop-shadow">
              {tagline || t('auth.signInSubtitle')}
            </p>
          </div>
          <p className="hidden text-xs text-white/60 lg:block">{footer || `© ${new Date().getFullYear()} ${siteName}`}</p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-10 lg:w-1/2 xl:w-[45%]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="w-full max-w-md"
        >
          <GlassCard className="p-6 sm:p-8">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3 lg:hidden">
                {settings?.logoMobileUrl ? (
                  <img src={settings.logoMobileUrl} alt={siteName ?? 'logo'} className="h-9 w-auto" />
                ) : (
                  <GoldLogo name={siteName ?? 'MOGE HR'} size="sm" />
                )}
                <div>
                  <p className="text-base font-semibold leading-tight">{siteName}</p>
                  <p className="text-[11px] text-muted-foreground">{tagline}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto gap-1.5 text-muted-foreground"
                onClick={() => setLocale(locale === 'en' ? 'mm' : 'en')}
              >
                <Languages className="h-4 w-4" />
                {locale === 'en' ? 'မြန်မာ' : 'English'}
              </Button>
            </div>

            <h1 className="text-2xl font-semibold tracking-tight">{t('auth.signInTitle')}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t('auth.signInSubtitle')}</p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">{t('auth.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder={t('auth.emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 bg-background/60"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">{t('auth.password')}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder={t('auth.passwordPlaceholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 bg-background/60 pr-10"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="remember" checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
                <Label htmlFor="remember" className="cursor-pointer text-sm font-normal text-muted-foreground">{t('auth.rememberMe')}</Label>
              </div>
              <Button type="submit" className="gold-cta h-11 w-full text-base font-medium" disabled={submitting}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('auth.signingIn')}</> : t('auth.signIn')}
              </Button>
            </form>

            {/* Demo accounts */}
            <div className="mt-6 rounded-xl border border-border/60 bg-muted/40 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> {t('auth.demoAccounts')} · {t('auth.demoAccountsHint')}
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => fillDemo('superadmin@moge.hr', 'Super@123')}
                  className="flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-lg border border-border/50 bg-background/60 px-1 py-1.5 text-center transition-all hover:border-primary/50 hover:shadow-sm"
                >
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <span className="text-[10px] font-medium">superadmin</span>
                  <span className="text-[9px] text-muted-foreground">Super@123</span>
                </button>
                <button
                  type="button"
                  onClick={() => fillDemo('admin@moge.hr', 'Admin@123')}
                  className="flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-lg border border-border/50 bg-background/60 px-1 py-1.5 text-center transition-all hover:border-primary/50 hover:shadow-sm"
                >
                  <UserCog className="h-4 w-4 text-primary" />
                  <span className="text-[10px] font-medium">admin</span>
                  <span className="text-[9px] text-muted-foreground">Admin@123</span>
                </button>
                <button
                  type="button"
                  onClick={() => fillDemo('user@moge.hr', 'User@123')}
                  className="flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-lg border border-border/50 bg-background/60 px-1 py-1.5 text-center transition-all hover:border-primary/50 hover:shadow-sm"
                >
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-[10px] font-medium">user</span>
                  <span className="text-[9px] text-muted-foreground">User@123</span>
                </button>
              </div>
            </div>
          </GlassCard>
          <p className="mt-4 text-center text-xs text-muted-foreground lg:hidden">
            {footer || `© ${new Date().getFullYear()} ${siteName} · ${t('auth.footerRights')}`}
          </p>
        </motion.div>
      </div>
    </div>
  )
}
