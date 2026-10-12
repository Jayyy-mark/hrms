'use client'

import React, { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useI18n } from '@/i18n'
import { apiPost, apiPut, apiDelete, apiQuery, qs, downloadCsv } from '@/lib/client-api'
import { useUI } from '@/store/ui'
import {
  GlassCard, PageHeader, DataTable, RowActionsMenu, ConfirmDialog, FormModal,
  type FormValues, rowToValues, toInputDate, useEnumOptions, type Column,
} from './shared'
import { MODULE_CONFIGS, useModuleColumns, useModuleFields, useMasters } from './module-configs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Download, Plus } from 'lucide-react'
import { toast } from 'sonner'

/** Generic standalone module list page (promotions, trainings, etc.) */
export function ModuleListPage({ slug }: { slug: string }) {
  const { t, formatNumber } = useI18n()
  const config = MODULE_CONFIGS[slug]
  const masters = useMasters()
  const columns = useModuleColumns(config, { showStaff: true })
  const fields = useModuleFields(config, masters)
  const queryClient = useQueryClient()
  const session = useUI((s) => s.session)
  const navigate = useUI((s) => s.navigate)
  const isAdmin = session?.role === 'ADMIN' || session?.role === 'SUPERADMIN'

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState<string | undefined>(undefined)
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | undefined>(undefined)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null)
  const [deleting, setDeleting] = useState<Record<string, unknown> | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const { data: result, isLoading } = useQuery({
    queryKey: ['module-list', slug, { search, filters, page, sortBy, sortDir }],
    queryFn: () => apiQuery<Record<string, unknown>[]>(`/api/resources/${slug}` + qs({ search, page, pageSize: 20, sortBy, sortDir, ...filters })),
    placeholderData: (prev) => prev,
  })

  const rows = result?.data ?? []
  const total = result?.meta?.total ?? 0

  // We need staff options for the create form — load a staff list lazily when form opens
  const [staffOptions, setStaffOptions] = useState<{ value: string; label: string }[]>([])
  const loadStaffOptions = async () => {
    if (!config?.staffScoped || staffOptions.length) return
    try {
      const res = await apiQuery<{ id: string; nameEn: string; staffNo: string; nameMm: string | null }[]>(`/api/staff${qs({ pageSize: 100, sortBy: 'name', sortDir: 'asc' })}`)
      setStaffOptions(res.data.map((s) => ({ value: s.id, label: `${s.nameEn} (${s.staffNo})` })))
    } catch { /* ignore */ }
  }

  const formFields = useMemo(() => {
    if (!config?.staffScoped) return fields
    return [
      { name: 'staffId', label: t('common.staffMember'), type: 'select' as const, required: true, options: staffOptions, full: false },
      ...fields,
    ]
  }, [config, fields, t, staffOptions])

  const initial = useMemo<FormValues>(() => {
    if (!editing) {
      const v: FormValues = {}
      for (const f of formFields) v[f.name] = f.type === 'checkbox' ? false : ''
      return v
    }
    const v = rowToValues(editing, formFields)
    for (const f of formFields) {
      if (f.type === 'date') v[f.name] = toInputDate(editing[f.name])
      if (f.type === 'select' && f.options?.some((o) => o.value === '__none__') && editing[f.name] == null) v[f.name] = '__none__'
    }
    return v
  }, [editing, formFields])

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['module-list', slug] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['staff-detail'] })
  }

  const submit = async (values: Record<string, unknown>) => {
    if (editing) {
      const { staffId, ...rest } = values
      await apiPut(`/api/resources/${slug}/${editing.id}`, rest)
      toast.success(t('toast.updated'))
    } else {
      await apiPost(`/api/resources/${slug}`, values)
      toast.success(t('toast.created'))
    }
    refresh()
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setDeleteLoading(true)
    try {
      await apiDelete(`/api/resources/${slug}/${deleting.id}`)
      toast.success(t('toast.deleted'))
      refresh()
      setDeleting(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toast.error'))
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleSort = (key: string) => {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortBy(key); setSortDir('asc') }
  }

  const columnsWithActions: Column<Record<string, unknown>>[] = useMemo(() => {
    const cols = [...columns]
    if (slug === 'promotions' || slug === 'transfers' || slug === 'disciplinary') {
      // Add staff-click navigation on the staff column is handled by DataTable row click
    }
    if (isAdmin) {
      cols.push({
        key: '__actions',
        header: t('common.actions'),
        render: (row) => (
          <RowActionsMenu
            onEdit={() => { setEditing(row); setFormOpen(true) }}
            onDelete={() => setDeleting(row)}
            onView={() => {
              const staff = row.staff as { id?: string } | null | undefined
              if (staff?.id) navigate('staff-detail', { id: staff.id })
            }}
          />
        ),
      })
    }
    return cols
  }, [columns, isAdmin, t, navigate, slug])

  const exportCsv = () => {
    const exportCols = columns.map((c) => ({ key: c.key, header: c.header }))
    downloadCsv(`${slug}.csv`, exportCols, rows)
    toast.success(t('toast.exported'))
  }

  if (!config) return null

  const title = t(config.titleKey)
  const subtitle = config.subtitleKey ? t(config.subtitleKey) : undefined

  return (
    <div className="space-y-4">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <>
            <Button variant="outline" className="border-border/60" onClick={exportCsv}>
              <Download className="mr-2 h-4 w-4" /> {t('common.exportCsv')}
            </Button>
            {isAdmin && (
              <Button className="gold-cta" onClick={() => { setEditing(null); setFormOpen(true); loadStaffOptions() }}>
                <Plus className="mr-2 h-4 w-4" /> {t('common.addNew')}
              </Button>
            )}
          </>
        }
      />

      {/* Filter bar */}
      <GlassCard className="p-3 sm:p-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('common.searchPrompt')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="h-10 pl-9 bg-background/60"
            />
          </div>
          {config.filters?.map((f) => (
            <Select key={f.name} value={filters[f.name] || 'ALL'} onValueChange={(v) => { setFilters((s) => ({ ...s, [f.name]: v })); setPage(1) }}>
              <SelectTrigger className="h-10 bg-background/60"><SelectValue placeholder={t(f.labelKey)} /></SelectTrigger>
              <SelectContent className="glass">
                <SelectItem value="ALL">{t(f.labelKey)} — {t('common.all')}</SelectItem>
                {f.enumValues?.map((v) => <SelectItem key={v} value={v}>{t(`enums.${v}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          ))}
        </div>
      </GlassCard>

      {/* Table */}
      <GlassCard className="p-3 sm:p-4">
        <DataTable
          columns={columnsWithActions}
          rows={rows}
          loading={isLoading}
          page={page}
          pageSize={20}
          total={total}
          onPageChange={setPage}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
          rowKey={(r) => String(r.id)}
          onRowClick={(r) => {
            const staff = r.staff as { id?: string } | null | undefined
            if (staff?.id) navigate('staff-detail', { id: staff.id })
          }}
        />
        <p className="pt-2 text-xs text-muted-foreground">{t('common.total')}: {formatNumber(total)}</p>
      </GlassCard>

      <FormModal
        open={formOpen}
        onOpenChange={(o) => { setFormOpen(o); if (o) loadStaffOptions() }}
        title={editing ? t('common.edit') : `${t('common.addNew')} — ${title}`}
        fields={formFields}
        initial={initial}
        onSubmit={submit}
        submitLabel={editing ? t('common.save') : t('common.create')}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => { if (!o) setDeleting(null) }}
        onConfirm={confirmDelete}
        title={t('common.confirmDeleteTitle')}
        message={t('common.confirmDeleteMessage')}
        loading={deleteLoading}
      />
    </div>
  )
}
