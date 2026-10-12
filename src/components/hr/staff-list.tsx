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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Download, Plus, Upload, Loader2, CheckCircle2, XCircle, FileUp } from 'lucide-react'
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
  const [departmentId, setDepartmentId] = useState(viewParams.departmentId || 'ALL')
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
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
              <Button variant="outline" className="border-border/60" onClick={() => setImportOpen(true)}>
                <Upload className="mr-2 h-4 w-4" /> {t('import.title')}
              </Button>
            )}
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

      {isAdmin && (
        <StaffImportModal
          open={importOpen}
          onOpenChange={setImportOpen}
          onImported={() => {
            queryClient.invalidateQueries({ queryKey: ['staff-list'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard'] })
          }}
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

/* ============ Bulk CSV import ============ */

const IMPORT_COLUMNS = [
  'nameEn', 'nameMm', 'gender', 'dateOfBirth', 'nrcNo', 'phone', 'email',
  'maritalStatus', 'nationality', 'religion', 'bloodGroup', 'placeOfBirth',
  'joinDate', 'department', 'position', 'status',
] as const

interface ParsedRow {
  index: number
  data: Record<string, string>
  errors: string[]
}

/** Minimal RFC-4180-ish CSV parser (handles quoted fields, CRLF, escaped quotes). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  const src = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += c
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field); field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some((f) => f.trim() !== '')) rows.push(row)
      row = []
    } else field += c
  }
  row.push(field)
  if (row.some((f) => f.trim() !== '')) rows.push(row)
  return rows
}

interface ImportResult {
  attempted: number
  created: number
  failed: number
  results: { index: number; staffNo?: string; nameEn: string; ok: boolean; error?: string }[]
}

export function StaffImportModal({ open, onOpenChange, onImported }: {
  open: boolean
  onOpenChange: (b: boolean) => void
  onImported?: () => void
}) {
  const { t } = useI18n()
  const masters = useMasters()
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)

  const mutation = useMutation({
    mutationFn: () => {
      const payload = rows.filter((r) => r.errors.length === 0).map((r) => {
        const d = r.data
        const dept = masters.departments.find((x) => x.name.toLowerCase() === (d.department || '').toLowerCase() || x.code?.toLowerCase() === (d.department || '').toLowerCase())
        const pos = masters.positions.find((x) => x.name.toLowerCase() === (d.position || '').toLowerCase() || x.code?.toLowerCase() === (d.position || '').toLowerCase())
        return {
          nameEn: d.nameEn, nameMm: d.nameMm, gender: d.gender || 'MALE',
          dateOfBirth: d.dateOfBirth, nrcNo: d.nrcNo, phone: d.phone, email: d.email,
          maritalStatus: d.maritalStatus, nationality: d.nationality, religion: d.religion,
          bloodGroup: d.bloodGroup, placeOfBirth: d.placeOfBirth, joinDate: d.joinDate,
          status: d.status || 'ACTIVE',
          departmentId: dept?.id || '', positionId: pos?.id || '',
        }
      })
      return apiPost<ImportResult>('/api/staff/import', { rows: payload })
    },
    onSuccess: (data) => {
      if (!data) return
      setResult(data)
      setStep('result')
      onImported?.()
      if (data.created > 0) toast.success(t('import.success', { n: data.created }))
      if (data.failed > 0) toast.warning(t('import.partial', { n: data.failed }))
    },
    onError: () => toast.error(t('import.error')),
  })

  const loadCsv = (text: string, name: string) => {
    const table = parseCsv(text)
    if (table.length < 2) {
      toast.error(t('import.emptyFile'))
      return
    }
    const header = table[0].map((h) => h.trim().replace(/^\uFEFF/, ''))
    const hasHeader = header.some((h) => IMPORT_COLUMNS.includes(h as (typeof IMPORT_COLUMNS)[number]))
    const cols = hasHeader ? header : [...IMPORT_COLUMNS]
    const dataRows = hasHeader ? table.slice(1) : table

    const parsed: ParsedRow[] = dataRows.map((cells, i) => {
      const data: Record<string, string> = {}
      cols.forEach((c, ci) => { data[c] = (cells[ci] ?? '').trim() })
      const errors: string[] = []
      if (!data.nameEn || data.nameEn.length < 2) errors.push(t('import.errName'))
      if (data.gender && !['MALE', 'FEMALE', 'OTHER'].includes(data.gender.toUpperCase())) errors.push(t('import.errGender'))
      else if (data.gender) data.gender = data.gender.toUpperCase()
      const dateOk = (v: string) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v) || !isNaN(new Date(v).getTime())
      if (!dateOk(data.dateOfBirth)) errors.push(t('import.errDob'))
      if (!dateOk(data.joinDate)) errors.push(t('import.errJoin'))
      if (data.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) errors.push(t('import.errEmail'))
      if (data.status && !['ACTIVE', 'RETIRED', 'RESIGNED', 'TRANSFERRED', 'SUSPENDED', 'DECEASED', 'OTHER'].includes(data.status.toUpperCase())) errors.push(t('import.errStatus'))
      else if (data.status) data.status = data.status.toUpperCase()
      if (data.maritalStatus) {
        const m = { single: 'SINGLE', married: 'MARRIED', divorced: 'DIVORCED', widowed: 'WIDOWED' }[data.maritalStatus.toLowerCase()]
        if (m) data.maritalStatus = m
        else if (!['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED'].includes(data.maritalStatus.toUpperCase())) errors.push(t('import.errMarital'))
        else data.maritalStatus = data.maritalStatus.toUpperCase()
      }
      if (data.department && !masters.departments.some((x) => x.name.toLowerCase() === data.department.toLowerCase() || x.code?.toLowerCase() === data.department.toLowerCase())) errors.push(t('import.errDepartment'))
      if (data.position && !masters.positions.some((x) => x.name.toLowerCase() === data.position.toLowerCase() || x.code?.toLowerCase() === data.position.toLowerCase())) errors.push(t('import.errPosition'))
      return { index: i, data, errors }
    })

    setRows(parsed)
    setFileName(name)
    setStep('preview')
    setResult(null)
  }

  const onFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => loadCsv(String(reader.result || ''), file.name)
    reader.readAsText(file)
  }

  const downloadTemplate = () => {
    const example = ['Aung Aung', 'အောင်အောင်', 'MALE', '1990-05-15', '12/x(PaNa)123456', '09-777-8888', 'aung.aung@moge.gov.mm', 'SINGLE', 'Myanmar', 'Buddhist', 'O+', 'Yangon', new Date().toISOString().slice(0, 10), 'Human Resources', 'Admin Assistant', 'ACTIVE']
    const csv = [IMPORT_COLUMNS.join(','), example.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'moge-staff-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const validCount = rows.filter((r) => r.errors.length === 0).length
  const invalidCount = rows.length - validCount

  const reset = () => {
    setStep('upload')
    setRows([])
    setFileName('')
    setResult(null)
    mutation.reset()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent className="glass max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" /> {t('import.title')}
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && t('import.subtitle')}
            {step === 'preview' && fileName && `${fileName} — ${rows.length} ${t('import.rowsFound')}`}
            {step === 'result' && t('import.resultTitle')}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => document.getElementById('import-csv-input')?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 px-6 py-10 text-center transition-all hover:border-primary/50 hover:bg-primary/10"
            >
              <FileUp className="h-8 w-8 text-primary" />
              <p className="text-sm font-medium">{t('import.dropHint')}</p>
              <p className="text-xs text-muted-foreground">{t('import.dropHintSub')}</p>
            </button>
            <input
              id="import-csv-input"
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }}
            />
            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">{t('import.templateHint')}</p>
              <Button variant="outline" size="sm" className="border-border/60" onClick={downloadTemplate}>
                <Download className="mr-1.5 h-3.5 w-3.5" /> {t('import.downloadTemplate')}
              </Button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-600 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" /> {validCount} {t('import.valid')}
              </span>
              {invalidCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 font-medium text-red-600 dark:text-red-300">
                  <XCircle className="h-3.5 w-3.5" /> {invalidCount} {t('import.invalid')}
                </span>
              )}
            </div>
            <div className="max-h-72 overflow-y-auto rounded-xl border border-border/50">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>{t('staff.nameEn')}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t('staff.nrcNo')}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t('import.deptPosition')}</TableHead>
                    <TableHead>{t('import.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.index} className={r.errors.length ? 'bg-red-500/5' : ''}>
                      <TableCell className="text-xs text-muted-foreground">{r.index + 1}</TableCell>
                      <TableCell className="max-w-40 truncate text-sm font-medium">{r.data.nameEn || '—'}</TableCell>
                      <TableCell className="hidden max-w-36 truncate text-xs sm:table-cell">{r.data.nrcNo || '—'}</TableCell>
                      <TableCell className="hidden max-w-44 truncate text-xs sm:table-cell">{[r.data.department, r.data.position].filter(Boolean).join(' · ') || '—'}</TableCell>
                      <TableCell>
                        {r.errors.length === 0
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          : <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-300" title={r.errors.join('; ')}><XCircle className="h-4 w-4 shrink-0" /><span className="max-w-32 truncate">{r.errors[0]}</span></span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {invalidCount > 0 && <p className="text-xs text-muted-foreground">{t('import.skipHint')}</p>}
            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={reset}>{t('import.chooseAnother')}</Button>
              <Button className="gold-cta" disabled={validCount === 0 || mutation.isPending} onClick={() => mutation.mutate()}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('import.submit', { n: validCount })}
              </Button>
            </div>
          </div>
        )}

        {step === 'result' && result && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border border-border/60 bg-muted/40 p-3">
                <p className="text-lg font-semibold">{result.attempted}</p>
                <p className="text-xs text-muted-foreground">{t('import.attempted')}</p>
              </div>
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-300">{result.created}</p>
                <p className="text-xs text-muted-foreground">{t('import.created')}</p>
              </div>
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3">
                <p className="text-lg font-semibold text-red-600 dark:text-red-300">{result.failed}</p>
                <p className="text-xs text-muted-foreground">{t('import.failed')}</p>
              </div>
            </div>
            {result.results.filter((r) => !r.ok).length > 0 && (
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-red-500/30 bg-red-500/5 p-2">
                {result.results.filter((r) => !r.ok).map((r) => (
                  <p key={r.index} className="text-xs text-red-600 dark:text-red-300">#{r.index + 1} {r.nameEn}: {r.error}</p>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset}>{t('import.importMore')}</Button>
              <Button className="gold-cta" onClick={() => { onOpenChange(false); reset() }}>{t('common.done')}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
