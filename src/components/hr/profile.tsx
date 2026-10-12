'use client'

import React, { useMemo, useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { useI18n } from '@/i18n'
import { apiGet, apiPut, apiQuery, qs } from '@/lib/client-api'
import { useUI } from '@/store/ui'
import { GlassCard, PageHeader, StaffAvatar, StatusBadge, FormModal, type FormValues, rowToValues, toInputDate, type Column, DataTable } from './shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Camera, KeyRound, BookOpen, LogIn, Languages, Save, Sun, Moon, Monitor } from 'lucide-react'
import { toast } from 'sonner'

interface ProfileData {
  id: string
  email: string
  name: string
  role: string
  avatarUrl: string | null
  preferredLocale: string
  theme: string
  lastLoginAt: string | null
  createdAt: string
  staff: { id: string; staffNo: string; nameEn: string; nameMm: string | null; photoUrl: string | null; status: string } | null
  loginHistory: { id: string; action: string; ipAddress: string | null; createdAt: string }[]
}

export function ProfileView() {
  const { t, formatDate, locale, setLocale } = useI18n()
  const { theme, setTheme } = useTheme()
  const queryClient = useQueryClient()
  const { setSession, session, navigate, viewParams } = useUI()

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => apiGet<ProfileData>('/api/profile'),
  })

  const [name, setName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    if (profile) {
      setName(profile.name)
      setAvatarUrl(profile.avatarUrl || '')
    }
  }, [profile])

  const saveProfile = async () => {
    if (!name.trim()) { toast.error(t('validation.required')); return }
    setSavingProfile(true)
    try {
      await apiPut('/api/profile', { name: name.trim(), avatarUrl: avatarUrl || null, preferredLocale: locale, theme: theme || 'system' })
      toast.success(t('profileModule.profileSaved'))
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      setSession({ ...session!, name: name.trim(), avatarUrl: avatarUrl || null, preferredLocale: locale, theme: theme || 'system' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toast.error'))
    } finally {
      setSavingProfile(false)
    }
  }

  const changePassword = async () => {
    if (!currentPassword || !newPassword) { toast.error(t('validation.required')); return }
    if (newPassword.length < 8) { toast.error(t('validation.minLength', { n: 8 })); return }
    if (newPassword !== confirmPassword) { toast.error(t('validation.passwordMismatch')); return }
    setSavingPassword(true)
    try {
      await apiPut('/api/profile/password', { currentPassword, newPassword })
      toast.success(t('profileModule.passwordChanged'))
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
    } catch (err) {
      const msg = err instanceof Error && err.message.includes('permission') ? t('profileModule.currentPasswordWrong') : err instanceof Error ? err.message : t('toast.error')
      toast.error(msg)
    } finally {
      setSavingPassword(false)
    }
  }

  const uploadAvatar = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) { toast.error(t('toast.fileTooLarge')); return }
    try {
      const { apiUpload } = await import('@/lib/client-api')
      const res = await apiUpload(file)
      setAvatarUrl(res.url)
      toast.success(t('toast.saved'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toast.uploadFailed'))
    }
  }

  const defaultTab = viewParams.tab === 'password' ? 'password' : 'profile'

  if (isLoading || !profile) {
    return (
      <div className="space-y-4">
        <div className="glass h-8 w-40 rounded-xl skeleton-shimmer" />
        <div className="glass h-96 rounded-2xl skeleton-shimmer" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t('profileModule.title')} subtitle={t('profileModule.subtitle')} />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* Left card */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <GlassCard className="p-5 text-center">
            <div className="relative mx-auto w-fit">
              <StaffAvatar name={profile.name || profile.email} photoUrl={avatarUrl || undefined} size="xl" className="mx-auto" />
              <label className="absolute -bottom-1 -right-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105" aria-label={t('profileModule.avatar')}>
                <Camera className="h-4 w-4" />
                <input
                  type="file"
                  className="hidden"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f) }}
                />
              </label>
            </div>
            <h2 className="mt-4 text-lg font-semibold">{profile.name}</h2>
            <p className="text-sm text-muted-foreground">{profile.email}</p>
            <div className="mt-2"><StatusBadge value={profile.role} /></div>
            <div className="mt-4 space-y-2 text-left text-sm">
              <div className="flex justify-between gap-2 border-b border-border/30 py-2">
                <span className="text-xs text-muted-foreground">{t('fields.lastLoginAt')}</span>
                <span className="text-sm">{formatDate(profile.lastLoginAt, { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="flex justify-between gap-2 border-b border-border/30 py-2">
                <span className="text-xs text-muted-foreground">{t('common.createdAt')}</span>
                <span className="text-sm">{formatDate(profile.createdAt)}</span>
              </div>
            </div>
            {profile.staff && (
              <Button
                variant="outline"
                className="mt-4 w-full border-border/60"
                onClick={() => navigate('my-record-detail', { id: profile.staff!.id })}
              >
                <BookOpen className="mr-2 h-4 w-4" /> {t('profileModule.openMyRecord')}
              </Button>
            )}
          </GlassCard>
        </div>

        {/* Right tabs */}
        <GlassCard className="p-4 sm:p-6">
          <Tabs defaultValue={defaultTab}>
            <TabsList className="mb-4 h-auto w-full flex-wrap justify-start bg-muted/60">
              <TabsTrigger value="profile" className="gap-1.5 data-[state=active]:bg-background"><Languages className="h-3.5 w-3.5" />{t('profileModule.title')}</TabsTrigger>
              <TabsTrigger value="password" className="gap-1.5 data-[state=active]:bg-background"><KeyRound className="h-3.5 w-3.5" />{t('common.changePassword')}</TabsTrigger>
              <TabsTrigger value="logins" className="gap-1.5 data-[state=active]:bg-background"><LogIn className="h-3.5 w-3.5" />{t('profileModule.loginHistory')}</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-6">
              <div className="space-y-1.5">
                <Label htmlFor="displayName">{t('profileModule.displayName')}</Label>
                <Input id="displayName" value={name} onChange={(e) => setName(e.target.value)} className="h-10 bg-background/60" />
              </div>

              <div className="space-y-1.5">
                <Label>{t('profileModule.preferredLocale')}</Label>
                <Select value={locale} onValueChange={(v) => setLocale(v as 'en' | 'mm')}>
                  <SelectTrigger className="h-10 bg-background/60"><SelectValue /></SelectTrigger>
                  <SelectContent className="glass">
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="mm">မြန်မာ</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>{t('profileModule.themePreference')}</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'light', label: t('common.light'), icon: Sun },
                    { value: 'dark', label: t('common.dark'), icon: Moon },
                    { value: 'system', label: t('common.system'), icon: Monitor },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setTheme(opt.value)}
                      className={`flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-xl border px-3 py-2 text-xs font-medium transition-all ${
                        theme === opt.value ? 'border-primary/50 bg-primary/12 text-primary' : 'border-border/50 bg-background/50 text-muted-foreground hover:border-primary/30'
                      }`}
                    >
                      <opt.icon className="h-4 w-4" />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <Button className="gold-cta" onClick={saveProfile} disabled={savingProfile}>
                <Save className="mr-2 h-4 w-4" /> {savingProfile ? t('common.saving') : t('common.save')}
              </Button>
            </TabsContent>

            <TabsContent value="password" className="space-y-4">
              <p className="text-sm text-muted-foreground">{t('profileModule.passwordHint')}</p>
              <div className="max-w-md space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="currentPassword">{t('common.currentPassword')}</Label>
                  <Input id="currentPassword" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="h-10 bg-background/60" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="newPassword">{t('common.newPassword')}</Label>
                  <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-10 bg-background/60" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">{t('common.confirmNewPassword')}</Label>
                  <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-10 bg-background/60" />
                </div>
                <Button className="gold-cta" onClick={changePassword} disabled={savingPassword}>
                  <KeyRound className="mr-2 h-4 w-4" /> {savingPassword ? t('common.saving') : t('common.changePassword')}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="logins">
              <div className="space-y-1">
                {profile.loginHistory.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">{t('common.noData')}</p>
                ) : (
                  profile.loginHistory.map((h) => (
                    <div key={h.id} className="flex items-center justify-between gap-3 border-b border-border/30 py-2.5 text-sm">
                      <StatusBadge value={h.action} />
                      <span className="text-xs text-muted-foreground">{h.ipAddress || '—'}</span>
                      <span className="text-xs">{formatDate(h.createdAt, { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </GlassCard>
      </div>
    </div>
  )
}
