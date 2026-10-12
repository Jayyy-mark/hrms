'use client'

import React, { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useI18n } from '@/i18n'
import { apiGet, apiPost, apiPut, apiDelete, apiQuery, qs, downloadCsv } from '@/lib/client-api'
import { useUI } from '@/store/ui'
import {
  GlassCard, PageHeader, DataTable, StatusBadge, RowActionsMenu, ConfirmDialog, FormModal,
  StaffAvatar, FormGrid, useModuleLabel, type FormValues, rowToValues, type Column,
} from './shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Search, Download, Plus, ShieldCheck, KeyRound, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ROLES } from '@/lib/constants'
import { useMasters } from './module-configs'

// ============ Users management ============

interface UserRow {
  id: string
  email: string
  name: string
  role: string
  isActive: boolean
  staffId: string | null
  staff: { id: string; staffNo: string; nameEn: string } | null
  avatarUrl: string | null
  lastLoginAt: string | null
  createdAt: string
}

export function UsersView() {
  const { t, formatDate, formatNumber } = useI18n()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('ALL')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<UserRow | null>(null)
  const [deleting, setDeleting] = useState<UserRow | null>(null)
  const [pwReset, setPwReset] = useState<UserRow | null>(null)
  const [pwValue, setPwValue] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)

  const { data: result, isLoading } = useQuery({
    queryKey: ['admin-users', { search, role, page }],
    queryFn: () => apiQuery<UserRow[]>('/api/admin/users' + qs({ search, role, page, pageSize: 20 })),
  })
  const rows = result?.data ?? []
  const total = result?.meta?.total ?? 0

  // staff options for linking
  const [staffOptions, setStaffOptions] = useState<{ value: string; label: string }[]>([])
  React.useEffect(() => {
    apiQuery<{ id: string; nameEn: string; staffNo: string }[]>(`/api/staff${qs({ pageSize: 100, sortBy: 'name', sortDir: 'asc' })}`)
      .then((r) => setStaffOptions(r.data.map((s) => ({ value: s.id, label: `${s.nameEn} (${s.staffNo})` }))))
      .catch(() => {})
  }, [])

  const fields = useMemo(() => [
    { name: 'name', label: t('admin.userNameRequired'), type: 'text' as const, required: true },
    { name: 'email', label: t('staff.email'), type: 'text' as const, required: true },
    ...(editing ? [] : [{ name: 'password', label: t('admin.password'), type: 'text' as const, required: true, hint: t('admin.passwordHint') }]),
    { name: 'role', label: t('admin.role'), type: 'select' as const, required: true, options: ROLES.map((r) => ({ value: r, label: t(`enums.${r}`) })) },
    { name: 'staffId', label: t('admin.linkedStaff'), type: 'select' as const, options: [{ value: '__none__', label: '—' }, ...staffOptions], hint: t('admin.linkStaffHint') },
    { name: 'isActive', label: t('fields.isActive'), type: 'checkbox' as const },
  ], [t, editing, staffOptions])

  const initial = useMemo<FormValues>(() => {
    if (!editing) {
      const v: FormValues = {}
      for (const f of fields) v[f.name] = f.type === 'checkbox' ? true : f.name === 'role' ? 'USER' : ''
      v.staffId = '__none__'
      return v
    }
    const v = rowToValues(editing as unknown as Record<string, unknown>, fields)
    v.staffId = editing.staffId || '__none__'
    v.role = editing.role
    v.password = ''
    return v
  }, [editing, fields])

  const submit = async (values: Record<string, unknown>) => {
    const payload = { ...values }
    if (payload.staffId === '__none__') payload.staffId = null
    if (editing) {
      if (!payload.password) delete payload.password
      await apiPut(`/api/admin/users/${editing.id}`, payload)
      toast.success(t('toast.updated'))
    } else {
      await apiPost('/api/admin/users', payload)
      toast.success(t('toast.created'))
    }
    queryClient.invalidateQueries({ queryKey: ['admin-users'] })
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setDeleteLoading(true)
    try {
      await apiDelete(`/api/admin/users/${deleting.id}`)
      toast.success(t('toast.deleted'))
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setDeleting(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toast.error'))
    } finally {
      setDeleteLoading(false)
    }
  }

  const doPasswordReset = async () => {
    if (!pwReset || !pwValue || pwValue.length < 8) return
    try {
      await apiPut(`/api/admin/users/${pwReset.id}`, { password: pwValue })
      toast.success(t('toast.saved'))
      setPwReset(null)
      setPwValue('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toast.error'))
    }
  }

  const columns: Column<UserRow>[] = [
    {
      key: 'name', header: t('common.name'),
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <StaffAvatar name={r.name} photoUrl={r.avatarUrl} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{r.name}</p>
            <p className="truncate text-xs text-muted-foreground">{r.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'role', header: t('admin.role'), render: (r) => <StatusBadge value={r.role} /> },
    { key: 'staff', header: t('admin.linkedStaff'), hideOnMobile: true, render: (r) => r.staff ? `${r.staff.nameEn} (${r.staff.staffNo})` : '—' },
    { key: 'isActive', header: t('fields.isActive'), render: (r) => <StatusBadge value={r.isActive ? 'ACTIVE' : 'CLOSED'} /> },
    { key: 'lastLoginAt', header: t('fields.lastLoginAt'), hideOnMobile: true, render: (r) => formatDate(r.lastLoginAt) },
    {
      key: 'actions', header: t('common.actions'),
      render: (r) => (
        <RowActionsMenu
          onEdit={() => { setEditing(r); setFormOpen(true) }}
          onDelete={() => setDeleting(r)}
          extra={[{ label: t('common.changePassword'), onClick: () => setPwReset(r), icon: KeyRound }]}
        />
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('admin.usersTitle')}
        subtitle={t('admin.usersSubtitle')}
        actions={
          <Button className="gold-cta" onClick={() => { setEditing(null); setFormOpen(true) }}>
            <Plus className="mr-2 h-4 w-4" /> {t('admin.addUser')}
          </Button>
        }
      />

      <GlassCard className="p-3 sm:p-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder={t('common.searchPrompt')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} className="h-10 pl-9 bg-background/60" />
          </div>
          <Select value={role} onValueChange={(v) => { setRole(v); setPage(1) }}>
            <SelectTrigger className="h-10 bg-background/60"><SelectValue /></SelectTrigger>
            <SelectContent className="glass">
              <SelectItem value="ALL">{t('admin.role')} — {t('common.all')}</SelectItem>
              {ROLES.map((r) => <SelectItem key={r} value={r}>{t(`enums.${r}`)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </GlassCard>

      <GlassCard className="p-3 sm:p-4">
        <DataTable columns={columns} rows={rows} loading={isLoading} page={page} pageSize={20} total={total} onPageChange={setPage} rowKey={(r) => r.id} />
        <p className="pt-2 text-xs text-muted-foreground">{t('common.total')}: {formatNumber(total)}</p>
      </GlassCard>

      <FormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? t('admin.editUser') : t('admin.addUser')}
        fields={fields}
        initial={initial}
        onSubmit={submit}
        submitLabel={editing ? t('common.save') : t('common.create')}
      />

      {/* Password reset sheet */}
      <Sheet open={!!pwReset} onOpenChange={(o) => { if (!o) { setPwReset(null); setPwValue('') } }}>
        <SheetContent className="glass w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t('common.changePassword')} — {pwReset?.name}</SheetTitle>
            <SheetDescription>{t('admin.passwordHint')}</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <Input type="text" placeholder={t('admin.password')} value={pwValue} onChange={(e) => setPwValue(e.target.value)} className="bg-background/60" />
            <Button className="gold-cta w-full" onClick={doPasswordReset} disabled={!pwValue || pwValue.length < 8}>
              <KeyRound className="mr-2 h-4 w-4" /> {t('common.save')}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => { if (!o) setDeleting(null) }}
        onConfirm={confirmDelete}
        title={t('common.confirmDeleteTitle')}
        message={deleting ? `${deleting.name} (${deleting.email}) — ${t('common.confirmDeleteMessage')}` : ''}
        loading={deleteLoading}
      />
    </div>
  )
}

// ============ Audit logs ============

interface AuditRow {
  id: string
  userId: string | null
  userName: string | null
  action: string
  module: string
  entityType: string
  entityId: string | null
  before: string | null
  after: string | null
  changedFields: string | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
}

export function AuditLogsView() {
  const { t, formatDate, formatNumber } = useI18n()
  const moduleLabel = useModuleLabel()
  const [search, setSearch] = useState('')
  const [action, setAction] = useState('ALL')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<AuditRow | null>(null)

  const { data: result, isLoading } = useQuery({
    queryKey: ['audit-logs', { search, action, from, to, page }],
    queryFn: () => apiQuery<AuditRow[]>('/api/admin/audit-logs' + qs({ search, action, from, to, page, pageSize: 20 })),
  })
  const rows = result?.data ?? []
  const total = result?.meta?.total ?? 0

  const exportCsv = () => {
    window.location.href = '/api/admin/audit-logs?export=csv'
  }

  const parseJson = (v: string | null): Record<string, unknown> | null => {
    if (!v) return null
    try { return JSON.parse(v) } catch { return null }
  }
  const parseFields = (v: string | null): string[] => {
    if (!v) return []
    try { return JSON.parse(v) } catch { return [] }
  }

  const columns: Column<AuditRow>[] = [
    { key: 'createdAt', header: t('fields.timestamp'), render: (r) => formatDate(r.createdAt, { hour: '2-digit', minute: '2-digit' }) },
    { key: 'userName', header: t('fields.userName'), render: (r) => <span className="text-sm font-medium">{r.userName || '—'}</span> },
    { key: 'action', header: t('fields.action'), render: (r) => <StatusBadge value={r.action} /> },
    { key: 'module', header: t('fields.module'), hideOnMobile: true, render: (r) => <span className="text-xs font-medium text-muted-foreground">{moduleLabel(r.module)}</span> },
    { key: 'entityType', header: t('fields.entityType'), hideOnMobile: true },
    { key: 'changedFields', header: t('fields.changedFields'), hideOnMobile: true, render: (r) => parseFields(r.changedFields).join(', ') || '—' },
    { key: 'ipAddress', header: t('fields.ipAddress'), hideOnMobile: true, render: (r) => <span className="text-xs">{r.ipAddress || '—'}</span> },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('admin.auditTitle')}
        subtitle={t('admin.auditSubtitle')}
        actions={
          <Button variant="outline" className="border-border/60" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" /> {t('admin.exportCsv')}
          </Button>
        }
      />

      <GlassCard className="p-3 sm:p-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder={t('common.searchPrompt')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} className="h-10 pl-9 bg-background/60" />
          </div>
          <Select value={action} onValueChange={(v) => { setAction(v); setPage(1) }}>
            <SelectTrigger className="h-10 bg-background/60"><SelectValue /></SelectTrigger>
            <SelectContent className="glass">
              <SelectItem value="ALL">{t('admin.filterAction')}</SelectItem>
              {['CREATE', 'UPDATE', 'DELETE', 'VIEW', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'EXPORT', 'DOWNLOAD'].map((a) => (
                <SelectItem key={a} value={a}>{t(`enums.${a}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} className="h-10 bg-background/60" aria-label={t('admin.from')} />
          <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} className="h-10 bg-background/60" aria-label={t('admin.to')} />
        </div>
      </GlassCard>

      <GlassCard className="p-3 sm:p-4">
        <DataTable
          columns={columns}
          rows={rows}
          loading={isLoading}
          page={page}
          pageSize={20}
          total={total}
          onPageChange={setPage}
          rowKey={(r) => r.id}
          onRowClick={(r) => setDetail(r)}
          emptyTitle={t('common.noData')}
        />
        <p className="pt-2 text-xs text-muted-foreground">{t('common.total')}: {formatNumber(total)}</p>
      </GlassCard>

      {/* Detail drawer */}
      <Sheet open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null) }}>
        <SheetContent className="glass w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {detail && <StatusBadge value={detail.action} />} {detail && <span className="text-sm text-muted-foreground">{moduleLabel(detail.module)}</span>}
            </SheetTitle>
            <SheetDescription>
              {detail?.entityType} {detail?.entityId ? `· ${detail.entityId.slice(0, 12)}…` : ''} · {detail && formatDate(detail.createdAt, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </SheetDescription>
          </SheetHeader>
          {detail && (
            <div className="mt-4 space-y-4 text-sm">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('fields.userName')}</p>
                <p>{detail.userName || '—'} {detail.ipAddress ? `(${detail.ipAddress})` : ''}</p>
              </div>
              {parseFields(detail.changedFields).length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('fields.changedFields')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {parseFields(detail.changedFields).map((f) => (
                      <span key={f} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{f}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('admin.fieldDiff')}</p>
                <DiffView before={parseJson(detail.before)} after={parseJson(detail.after)} changed={parseFields(detail.changedFields)} />
              </div>
              {detail.userAgent && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('fields.userAgent')}</p>
                  <p className="break-all text-xs text-muted-foreground">{detail.userAgent}</p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function DiffView({ before, after, changed }: { before: Record<string, unknown> | null; after: Record<string, unknown> | null; changed: string[] }) {
  const { t } = useI18n()
  if (!before && !after) return <p className="text-xs text-muted-foreground">{t('common.notAvailable')}</p>
  const keys = changed.length ? changed : [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])]
  return (
    <div className="overflow-hidden rounded-xl border border-border/50">
      <div className="grid grid-cols-3 gap-2 border-b border-border/50 bg-muted/50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span>Field</span><span>{t('admin.before')}</span><span>{t('admin.after')}</span>
      </div>
      <div className="max-h-72 overflow-y-auto">
        {keys.map((k) => {
          const b = before?.[k]
          const a = after?.[k]
          const isChanged = JSON.stringify(b) !== JSON.stringify(a)
          return (
            <div key={k} className={`grid grid-cols-3 gap-2 border-b border-border/30 px-3 py-2 text-xs ${isChanged ? 'bg-primary/5' : ''}`}>
              <span className="font-medium">{k}</span>
              <span className="break-all text-muted-foreground line-through decoration-border">{b == null ? '—' : String(typeof b === 'object' ? JSON.stringify(b).slice(0, 60) : b)}</span>
              <span className="break-all font-medium text-foreground">{a == null ? '—' : String(typeof a === 'object' ? JSON.stringify(a).slice(0, 60) : a)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============ Site settings ============

interface SettingsForm {
  siteNameEn: string
  siteNameMm: string
  taglineEn: string
  taglineMm: string
  logoFullUrl: string
  logoSmallUrl: string
  logoMobileUrl: string
  faviconUrl: string
  loginBackgroundUrl: string
  footerTextEn: string
  footerTextMm: string
}

export function SettingsView() {
  const { t, locale } = useI18n()
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => apiGet<SettingsForm>('/api/admin/settings'),
  })

  const [form, setForm] = useState<SettingsForm | null>(null)
  const [saving, setSaving] = useState(false)
  React.useEffect(() => { if (data && !form) setForm(data) }, [data, form])

  const set = (name: keyof SettingsForm, v: string) => setForm((f) => (f ? { ...f, [name]: v } : f))

  const uploadFields: { name: keyof SettingsForm; labelKey: string }[] = [
    { name: 'logoFullUrl', labelKey: 'admin.logoFull' },
    { name: 'logoSmallUrl', labelKey: 'admin.logoSmall' },
    { name: 'logoMobileUrl', labelKey: 'admin.logoMobile' },
    { name: 'faviconUrl', labelKey: 'admin.favicon' },
    { name: 'loginBackgroundUrl', labelKey: 'admin.loginBackground' },
  ]

  const save = async () => {
    if (!form) return
    setSaving(true)
    try {
      await apiPut('/api/admin/settings', form)
      toast.success(t('admin.savedSuccess'))
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
      queryClient.invalidateQueries({ queryKey: ['public-settings'] })
      queryClient.invalidateQueries({ queryKey: ['public-settings-2'] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toast.error'))
    } finally {
      setSaving(false)
    }
  }

  if (isLoading || !form) return <div className="glass h-96 rounded-2xl skeleton-shimmer" />

  const siteName = locale === 'mm' ? form.siteNameMm : form.siteNameEn

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('admin.settingsTitle')}
        subtitle={t('admin.settingsSubtitle')}
        actions={
          <Button className="gold-cta" onClick={save} disabled={saving}>
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard className="space-y-4 p-4 sm:p-5">
          <h3 className="text-sm font-semibold">{t('admin.siteName')} & {t('admin.tagline')}</h3>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Site Name (EN)</label>
                <Input value={form.siteNameEn} onChange={(e) => set('siteNameEn', e.target.value)} className="bg-background/60" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Site Name (MM)</label>
                <Input value={form.siteNameMm} onChange={(e) => set('siteNameMm', e.target.value)} className="bg-background/60" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t('admin.tagline')} (EN)</label>
                <Input value={form.taglineEn} onChange={(e) => set('taglineEn', e.target.value)} className="bg-background/60" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t('admin.tagline')} (MM)</label>
                <Input value={form.taglineMm} onChange={(e) => set('taglineMm', e.target.value)} className="bg-background/60" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t('admin.footerText')} (EN)</label>
                <Input value={form.footerTextEn} onChange={(e) => set('footerTextEn', e.target.value)} className="bg-background/60" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t('admin.footerText')} (MM)</label>
                <Input value={form.footerTextMm} onChange={(e) => set('footerTextMm', e.target.value)} className="bg-background/60" />
              </div>
            </div>
          </div>

          <h3 className="pt-2 text-sm font-semibold">{t('common.upload')}</h3>
          <p className="text-xs text-muted-foreground">{t('common.uploadHint')}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {uploadFields.map((f) => (
              <div key={f.name} className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t(f.labelKey)}</label>
                <div className="flex items-center gap-2">
                  <Input
                    value={String(form[f.name] || '')}
                    onChange={(e) => set(f.name, e.target.value)}
                    placeholder="https://…"
                    className="bg-background/60"
                  />
                  <label className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border/60 bg-background/60 transition-colors hover:border-primary/40" aria-label={t('common.upload')}>
                    <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                    <input
                      type="file"
                      className="hidden"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        if (file.size > 2 * 1024 * 1024) { toast.error(t('toast.fileTooLarge')); return }
                        try {
                          const { apiUpload } = await import('@/lib/client-api')
                          const res = await apiUpload(file)
                          set(f.name, res.url)
                          toast.success(t('toast.saved'))
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : t('toast.uploadFailed'))
                        }
                      }}
                    />
                  </label>
                </div>
                {form[f.name] && <img src={String(form[f.name])} alt={t(f.labelKey)} className="h-10 w-auto rounded border border-border/50 bg-background/40 p-1" />}
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Live preview */}
        <div className="space-y-4">
          <GlassCard className="p-4 sm:p-5">
            <h3 className="mb-3 text-sm font-semibold">{t('admin.livePreview')}</h3>
            {/* Mini sidebar preview */}
            <div className="flex overflow-hidden rounded-xl border border-border/60">
              <div className="flex w-28 flex-col gap-2 bg-sidebar/80 p-3">
                <div className="flex items-center gap-1.5">
                  {form.logoSmallUrl || form.logoFullUrl ? (
                    <img src={form.logoSmallUrl || form.logoFullUrl} alt="logo" className="h-6 w-6 rounded object-contain" />
                  ) : (
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-[#D4AF37] to-[#F1D98B]">
                      <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 text-[#221A00]"><path d="M12 2L14.5 8.5L21 11L14.5 13.5L12 20L9.5 13.5L3 11L9.5 8.5L12 2Z" fill="currentColor" /></svg>
                    </div>
                  )}
                  <span className="truncate text-[10px] font-semibold">{siteName}</span>
                </div>
                <div className="h-4 rounded bg-primary/15" />
                <div className="h-4 rounded bg-background/60" />
                <div className="h-4 rounded bg-background/60" />
              </div>
              <div className="flex flex-1 flex-col bg-background/60">
                <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2">
                  {form.logoMobileUrl ? <img src={form.logoMobileUrl} alt="mobile logo" className="h-4 w-auto" /> : <span className="text-[10px] font-semibold text-primary">{siteName}</span>}
                  <div className="ml-auto h-3 w-8 rounded-full bg-muted" />
                </div>
                <div className="flex flex-1 items-center justify-center p-4">
                  <p className="text-center text-xs text-muted-foreground">
                    <span className="block text-sm font-semibold text-foreground">{form.taglineEn}</span>
                    <span className="block">{form.taglineMm}</span>
                  </p>
                </div>
              </div>
            </div>
          </GlassCard>
          <GlassCard className="p-4 text-center text-xs text-muted-foreground">
            {locale === 'mm' ? form.footerTextMm || '—' : form.footerTextEn || '—'}
          </GlassCard>
        </div>
      </div>
    </div>
  )
}
