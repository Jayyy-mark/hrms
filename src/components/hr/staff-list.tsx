'use client'

import React, { useMemo, useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useI18n } from '@/i18n'
import { apiGet, apiPost, apiPut, apiQuery, qs, downloadCsv } from '@/lib/client-api'
import { useUI } from '@/store/ui'
import { PERMISSIONS } from '@/lib/permissions'
import {
  GlassCard, PageHeader, DataTable, StaffAvatar, StatusBadge, RowActionsMenu, ConfirmDialog,
  FormModal, type Column, type FormValues, rowToValues, toInputDate, useEnumOptions,
} from './shared'
import { useStaffFields, useMasters } from './module-configs'
import { STAFF_STATUS, GENDERS } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Download, Plus, Upload, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export interface StaffRow {
  id: string
  staffNo: string
  nameEn: string
  nameMm: string | null
  photoUrl: string | null
  gender: string
  status: string
  joinDate: string | null
  email: string | null
  phone: string | null
  currentRank: { id: string; name: string } | null
  currentPosition: { id: string; name: string } | null
  currentDepartment: { id: string; name: string } | null
}

export function StaffFormModal({ open, onOpenChange, staff, onSaved }: {
  open: boolean
  onOpenChange: (b: boolean) => void
  staff?: StaffRow | null
  onSaved?: () => void
}) {
  const { t } = useI18n()
  const fields = useStaffFields()
  const queryClient = useQueryClient()

  const isEdit = !!staff
  const initial = useMemo<FormValues>(() => {
    if (!staff) {
      const v: FormValues = {}
      for (const f of fields) v[f.name] = f.name === 'gender' ? 'MALE' : f.name === 'status' ? 'ACTIVE' : ''
      return v
    }
    const row = staff as unknown as Record<string, unknown>
    const v = rowToValues(row, fields)
    v.dateOfBirth = toInputDate(row.dateOfBirth)
    v.joinDate = toInputDate(row.joinDate)
    v.photoUrl = (row.photoUrl as string) || ''
    return v
  }, [staff, fields])

  const submit = async (values: Record<string, unknown>) => {
    if (isEdit) {
      await apiPut(`/api/staff/${staff!.id}`, values)
      toast.success(t('toast.updated'))
    } else {
      await apiPost('/api/staff', values)
      toast.success(t('toast.created'))
    }
    queryClient.invalidateQueries({ queryKey: ['staff-list'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    onSaved?.()
  }

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? t('staff.editStaff') : t('staff.newStaff')}
      description={isEdit ? staff?.nameEn : undefined}
      fields={fields}
      initial={initial}
      onSubmit={submit}
      submitLabel={isEdit ? t('common.save') : t('common.create')}
    />
  )
}

export function StaffListView() {
  const { t, formatNumber, formatDate } = useI18n()
  const { session, navigate, viewParams } = useUI()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(viewParams.status || 'ALL')
  const [gender, setGender] = useState('ALL')
  const [departmentId, setDepartmentId] = useState('ALL')
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<StaffRow | null>(null)
  const [deleting, setDeleting] = useState<StaffRow | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const masters = useMasters()
  const statusOptions = useEnumOptions('status', STAFF_STATUS)
  const genderOptions = useEnumOptions('gender', GENDERS)
  const isAdmin = session?.role === 'ADMIN' || session?.role === 'SUPERADMIN'
  const isSuperadmin = session?.role === 'SUPERADMIN'

  const { data: result, isLoading } = useQuery({
    queryKey: ['staff-list', { search, status, gender, departmentId, page, sortBy, sortDir }],
    queryFn: () => apiQuery<StaffRow[]>('/api/staff' + qs({ search, status, gender, departmentId, page, pageSize: 20, sortBy, sortDir })),
    placeholderData: (prev) => prev,
  })

  const rows = result?.data ?? []
  const total = result?.meta?.total ?? 0

  const handleSort = (key: string) => {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortBy(key); setSortDir('asc') }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setDeleteLoading(true)
    try {
      const { apiDelete } = await import('@/lib/client-api')
      await apiDelete(`/api/staff/${deleting.id}`)
      toast.success(t('toast.deleted'))
      queryClient.invalidateQueries({ queryKey: ['staff-list'] })
      setDeleting(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toast.error'))
    } finally {
      setDeleteLoading(false)
    }
  }

  const exportCsv = () => {
    downloadCsv('staff-list.csv', [
      { key: 'staffNo', header: t('staff.staffNo') },
      { key: 'nameEn', header: t('staff.nameEn') },
      { key: 'nameMm', header: t('staff.nameMm') },
      { key: 'gender', header: t('staff.gender') },
      { key: 'department', header: t('staff.currentDepartment') },
      { key: 'position', header: t('staff.currentPosition') },
      { key: 'rank', header: t('staff.currentRank') },
      { key: 'status', header: t('staff.status') },
      { key: 'joinDate', header: t('staff.joinDate') },
    ], rows.map((r) => ({ ...r, department: r.currentDepartment?.name, position: r.currentPosition?.name, rank: r.currentRank?.name })))
    toast.success(t('toast.exported'))
  }

  const columns: Column<StaffRow>[] = [
    {
      key: 'name',
      header: t('common.name'),
      sortable: true,
      className: 'min-w-52',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <StaffAvatar name={row.nameEn} photoUrl={row.photoUrl} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{row.nameEn}</p>
            <p className="truncate text-xs text-muted-foreground">{row.staffNo}{row.email ? ` · ${row.email}` : ''}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'position', header: t('staff.currentPosition'),
      render: (row) => <span className="text-sm">{row.currentPosition?.name || '—'}</span>,
    },
    {
      key: 'department', header: t('staff.currentDepartment'), hideOnMobile: true,
      render: (row) => <span className="text-sm">{row.currentDepartment?.name || '—'}</span>,
    },
    {
      key: 'rank', header: t('staff.currentRank'), hideOnMobile: true,
      render: (row) => <span className="text-sm">{row.currentRank?.name || '—'}</span>,
    },
    {
      key: 'joinDate', header: t('staff.joinDate'), sortable: true, hideOnMobile: true,
      render: (row) => <span className="text-sm">{formatDate(row.joinDate)}</span>,
    },
    {
      key: 'status', header: t('staff.status'),
      render: (row) => <StatusBadge value={row.status} />,
    },
    {
      key: 'actions', header: t('common.actions'),
      render: (row) => (
        <RowActionsMenu
          onView={() => navigate('staff-detail', { id: row.id })}
          onEdit={isAdmin ? () => { setEditing(row); setFormOpen(true) } : undefined}
          onDelete={isAdmin ? () => setDeleting(row) : undefined}
        />
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('staff.listTitle')}
        subtitle={t('staff.listSubtitle')}
        actions={
          <>
            <Button variant="outline" className="border-border/60" onClick={exportCsv}>
              <Download className="mr-2 h-4 w-4" /> {t('common.exportCsv')}
            </Button>
            {isAdmin && (
              <Button className="gold-cta" onClick={() => { setEditing(null); setFormOpen(true) }}>
                <Plus className="mr-2 h-4 w-4" /> {t('staff.addNew')}
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
              placeholder={t('staff.searchPlaceholder')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="h-10 pl-9 bg-background/60"
            />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
            <SelectTrigger className="h-10 bg-background/60"><SelectValue /></SelectTrigger>
            <SelectContent className="glass">
              <SelectItem value="ALL">{t('staff.filterStatus')}</SelectItem>
              {statusOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={departmentId} onValueChange={(v) => { setDepartmentId(v); setPage(1) }}>
            <SelectTrigger className="h-10 bg-background/60"><SelectValue /></SelectTrigger>
            <SelectContent className="glass max-h-72">
              <SelectItem value="ALL">{t('staff.filterDepartment')}</SelectItem>
              {masters.departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={gender} onValueChange={(v) => { setGender(v); setPage(1) }}>
            <SelectTrigger className="h-10 bg-background/60"><SelectValue /></SelectTrigger>
            <SelectContent className="glass">
              <SelectItem value="ALL">{t('staff.filterGender')}</SelectItem>
              {genderOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </GlassCard>

      {/* Table */}
      <GlassCard className="p-3 sm:p-4">
        <DataTable
          columns={columns}
          rows={rows}
          loading={isLoading}
          page={page}
          pageSize={20}
          total={total}
          onPageChange={setPage}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate('staff-detail', { id: r.id })}
          mobileCard={(r) => (
            <button type="button" className="w-full text-left" onClick={() => navigate('staff-detail', { id: r.id })}>
              <GlassCard hover className="p-3">
                <div className="flex items-center gap-3">
                  <StaffAvatar name={r.nameEn} photoUrl={r.photoUrl} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.nameEn}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.currentPosition?.name || r.currentDepartment?.name || r.staffNo}</p>
                  </div>
                  <StatusBadge value={r.status} />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{r.currentRank?.name || '—'}</span>
                  <span>{formatDate(r.joinDate)}</span>
                </div>
              </GlassCard>
            </button>
          )}
        />
        {result && (
          <p className="pt-2 text-xs text-muted-foreground">{t('common.total')}: {formatNumber(total)}</p>
        )}
      </GlassCard>

      {isAdmin && (
        <StaffFormModal
          open={formOpen}
          onOpenChange={setFormOpen}
          staff={editing}
          onSaved={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => { if (!o) setDeleting(null) }}
        onConfirm={confirmDelete}
        title={t('common.confirmDeleteTitle')}
        message={deleting ? `${deleting.nameEn} (${deleting.staffNo}) — ${t('common.confirmDeleteMessage')}` : ''}
        loading={deleteLoading}
      />
    </div>
  )
}
