'use client'

import React, { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useI18n } from '@/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ChevronLeft, ChevronRight, MoreHorizontal, Eye, Pencil, Trash2, Inbox, ArrowUpDown, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { apiUpload } from '@/lib/client-api'

// ============ Layout primitives ============

export function GlassCard({ children, className = '', hover = false }: { children: React.ReactNode; className?: string; hover?: boolean }) {
  return <div className={`glass rounded-2xl ${hover ? 'glass-hover' : ''} ${className}`}>{children}</div>
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function EmptyState({ title, hint, icon: Icon = Inbox }: { title: string; hint?: string; icon?: React.ElementType }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="max-w-xs text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-xl p-3">
          <Skeleton className="h-10 w-10 rounded-full skeleton-shimmer" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3 skeleton-shimmer" />
            <Skeleton className="h-3 w-1/5 skeleton-shimmer" />
          </div>
          <Skeleton className="hidden h-6 w-24 rounded-full skeleton-shimmer sm:block" />
        </div>
      ))}
    </div>
  )
}

export function CardsSkeleton({ count = 4, className = '' }: { count?: number; className?: string }) {
  return (
    <div className={`grid grid-cols-2 gap-3 lg:grid-cols-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={`h-28 rounded-2xl skeleton-shimmer ${i >= 2 ? 'hidden lg:block' : ''}`} />
      ))}
    </div>
  )
}

// ============ Badges & avatars ============

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  APPROVED: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  EFFECTIVE: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  DECIDED: 'bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/30',
  PENDING: 'bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/30',
  UNDER_REVIEW: 'bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/30',
  OPEN: 'bg-orange-500/12 text-orange-700 dark:text-orange-300 border-orange-500/30',
  RETIRED: 'bg-slate-500/12 text-slate-700 dark:text-slate-300 border-slate-500/30',
  RESIGNED: 'bg-slate-500/12 text-slate-700 dark:text-slate-300 border-slate-500/30',
  TRANSFERRED: 'bg-violet-500/12 text-violet-700 dark:text-violet-300 border-violet-500/30',
  CLOSED: 'bg-slate-500/12 text-slate-600 dark:text-slate-300 border-slate-500/30',
  SUSPENDED: 'bg-red-500/12 text-red-700 dark:text-red-300 border-red-500/30',
  DECEASED: 'bg-zinc-500/12 text-zinc-700 dark:text-zinc-300 border-zinc-500/30',
  REJECTED: 'bg-red-500/12 text-red-700 dark:text-red-300 border-red-500/30',
  CANCELLED: 'bg-zinc-500/12 text-zinc-600 dark:text-zinc-300 border-zinc-500/30',
}

export function StatusBadge({ value, className = '' }: { value: string | null | undefined; className?: string }) {
  const { t } = useI18n()
  const v = value || 'UNKNOWN'
  const key = t(`enums.${v}`)
  const color = STATUS_COLORS[v] || 'bg-primary/10 text-primary border-primary/30'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${color} ${className}`}>
      {key}
    </span>
  )
}

export function StaffAvatar({ name, photoUrl, size = 'md', className = '' }: { name?: string | null; photoUrl?: string | null; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const initials = (name || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-base', xl: 'h-24 w-24 text-2xl' }
  return (
    <Avatar className={`${sizes[size]} border-2 border-primary/25 shadow-sm ${className}`}>
      {photoUrl ? <AvatarImage src={photoUrl} alt={name || 'staff'} /> : null}
      <AvatarFallback className="bg-primary/12 font-semibold text-primary">{initials}</AvatarFallback>
    </Avatar>
  )
}

// ============ DataTable ============

export interface Column<T> {
  key: string
  header: string
  render?: (row: T) => React.ReactNode
  sortable?: boolean
  className?: string
  hideOnMobile?: boolean
}

export interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  loading?: boolean
  page?: number
  pageSize?: number
  total?: number
  onPageChange?: (page: number) => void
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  onSort?: (key: string) => void
  rowKey: (row: T, index: number) => string
  mobileCard?: (row: T) => React.ReactNode
  onRowClick?: (row: T) => void
  emptyTitle?: string
  emptyHint?: string
  footer?: React.ReactNode
  paginated?: boolean
}

export function DataTable<T>({
  columns, rows, loading, page = 1, pageSize = 20, total = 0, onPageChange,
  sortBy, sortDir, onSort, rowKey, mobileCard, onRowClick, emptyTitle, emptyHint, footer,
  paginated = true,
}: DataTableProps<T>) {
  const { t, formatNumber } = useI18n()
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  if (loading) return <ListSkeleton rows={Math.min(pageSize, 8)} />
  if (rows.length === 0) return <EmptyState title={emptyTitle || t('common.noData')} hint={emptyHint || t('common.noDataHint')} />

  return (
    <div className="space-y-3">
      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-xl border border-border/50 md:block">
        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((col) => (
                <TableHead key={col.key} className={col.className}>
                  {col.sortable && onSort ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
                      onClick={() => onSort(col.key)}
                    >
                      {col.header}
                      <ArrowUpDown className={`h-3 w-3 ${sortBy === col.key ? 'text-primary' : 'opacity-40'}`} />
                    </button>
                  ) : (
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{col.header}</span>
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow
                key={rowKey(row, i)}
                className={`${onRowClick ? 'cursor-pointer' : ''} transition-colors`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => (
                  <TableCell key={col.key} className={col.className}>
                    {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '—')}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {mobileCard
          ? rows.map((row, i) => <div key={rowKey(row, i)}>{mobileCard(row)}</div>)
          : rows.map((row, i) => (
              <GlassCard key={rowKey(row, i)} className="p-3" hover>
                {columns.filter((c) => !c.hideOnMobile).slice(0, 4).map((col) => (
                  <div key={col.key} className="flex items-center justify-between gap-3 py-1 text-sm">
                    <span className="text-xs text-muted-foreground">{col.header}</span>
                    <span className="text-right">{col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '—')}</span>
                  </div>
                ))}
              </GlassCard>
            ))}
      </div>

      {/* Pagination */}
      {paginated && (
      <div className="flex flex-col items-center justify-between gap-2 pt-1 sm:flex-row">
        <p className="text-xs text-muted-foreground">
          {t('common.showing')} <span className="font-medium text-foreground">{formatNumber(from)}</span>–
          <span className="font-medium text-foreground">{formatNumber(to)}</span> {t('common.of')}{' '}
          <span className="font-medium text-foreground">{formatNumber(total)}</span> {t('common.entries')}
        </p>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => onPageChange?.(page - 1)} aria-label="Previous page">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {Array.from({ length: totalPages }).slice(0, 7).map((_, i) => {
            const p = i + 1
            if (totalPages > 7 && p === 4 && page > 5) return <span key={p} className="px-1 text-xs text-muted-foreground">…</span>
            return (
              <Button
                key={p}
                variant={p === page ? 'default' : 'outline'}
                size="icon"
                className={`h-8 w-8 text-xs ${p === page ? 'bg-primary text-primary-foreground' : ''}`}
                onClick={() => onPageChange?.(p)}
              >
                {p}
              </Button>
            )
          })}
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => onPageChange?.(page + 1)} aria-label="Next page">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      )}
      {footer}
    </div>
  )
}

export function RowActionsMenu({ onEdit, onDelete, extra, canEdit = true, canDelete = true, onView }: {
  onEdit?: () => void; onDelete?: () => void; onView?: () => void; extra?: { label: string; onClick: () => void; icon?: React.ElementType }[]; canEdit?: boolean; canDelete?: boolean
}) {
  const { t } = useI18n()
  const hasActions = onView || (canEdit && onEdit) || (canDelete && onDelete) || (extra && extra.length > 0)
  if (!hasActions) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()} aria-label={t('common.actions')}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="glass w-44">
        {onView && (
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView() }}>
            <Eye className="h-4 w-4" /> {t('common.view')}
          </DropdownMenuItem>
        )}
        {canEdit && onEdit && (
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit() }}>
            <Pencil className="h-4 w-4" /> {t('common.edit')}
          </DropdownMenuItem>
        )}
        {extra?.map((x, i) => (
          <DropdownMenuItem key={i} onClick={(e) => { e.stopPropagation(); x.onClick() }}>
            {x.icon ? <x.icon className="h-4 w-4" /> : null} {x.label}
          </DropdownMenuItem>
        ))}
        {canDelete && onDelete && (
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete() }}>
            <Trash2 className="h-4 w-4" /> {t('common.delete')}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ============ Confirm dialog ============

export function ConfirmDialog({ open, onOpenChange, onConfirm, title, message, destructive = true, loading }: {
  open: boolean; onOpenChange: (b: boolean) => void; onConfirm: () => void; title: string; message: string; destructive?: boolean; loading?: boolean
}) {
  const { t } = useI18n()
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="glass max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-border/60">{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            className={destructive ? 'bg-destructive text-white hover:bg-destructive/90' : 'gold-cta'}
            onClick={(e) => { e.preventDefault(); onConfirm() }}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('common.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ============ Form system ============

export type FormFieldType = 'text' | 'textarea' | 'select' | 'date' | 'number' | 'checkbox' | 'upload'

export interface FieldDef {
  name: string
  label: string
  type: FormFieldType
  options?: { value: string; label: string }[]
  required?: boolean
  placeholder?: string
  full?: boolean
  hint?: string
}

export type FormValues = Record<string, string | boolean | number | null>

export function FormGrid({ fields, values, setValues, disabled }: {
  fields: FieldDef[]; values: FormValues; setValues: (name: string, v: FormValues[string]) => void; disabled?: boolean
}) {
  const { t } = useI18n()
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {fields.map((f) => (
        <div key={f.name} className={`flex flex-col gap-1.5 ${f.full || f.type === 'textarea' ? 'sm:col-span-2' : ''}`}>
          <Label htmlFor={`ff-${f.name}`} className="text-xs font-medium text-muted-foreground">
            {f.label}
            {f.required && <span className="ml-0.5 text-destructive">*</span>}
          </Label>
          {f.type === 'textarea' ? (
            <Textarea
              id={`ff-${f.name}`}
              value={String(values[f.name] ?? '')}
              onChange={(e) => setValues(f.name, e.target.value)}
              placeholder={f.placeholder}
              disabled={disabled}
              rows={3}
              className="bg-background/60"
            />
          ) : f.type === 'select' ? (
            <Select
              value={String(values[f.name] ?? '')}
              onValueChange={(v) => setValues(f.name, v === '__none__' ? null : v)}
              disabled={disabled}
            >
              <SelectTrigger id={`ff-${f.name}`} className="bg-background/60">
                <SelectValue placeholder={f.placeholder || '—'} />
              </SelectTrigger>
              <SelectContent className="glass max-h-72">
                {f.options?.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : f.type === 'checkbox' ? (
            <div className="flex h-9 items-center">
              <Checkbox
                id={`ff-${f.name}`}
                checked={Boolean(values[f.name])}
                onCheckedChange={(v) => setValues(f.name, v === true)}
                disabled={disabled}
              />
            </div>
          ) : f.type === 'upload' ? (
            <div className="flex items-center gap-3">
              {values[f.name] ? (
                <img src={String(values[f.name])} alt="preview" className="h-12 w-12 rounded-lg border-2 border-primary/30 object-cover" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-dashed border-border bg-background/60">
                  <Upload className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <label className="flex min-h-[38px] cursor-pointer items-center gap-2 rounded-lg border border-border/60 bg-background/60 px-3 text-sm transition-colors hover:border-primary/40">
                <Upload className="h-4 w-4" />
                <span>{t('common.upload')}</span>
                <input
                  type="file"
                  className="hidden"
                  accept={f.hint?.includes('doc') ? 'image/png,image/jpeg,image/webp,image/svg+xml,application/pdf' : 'image/png,image/jpeg,image/webp,image/svg+xml'}
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    if (file.size > 2 * 1024 * 1024) { toast.error(t('toast.fileTooLarge')); return }
                    setValues(f.name, '__uploading__')
                    try {
                      const res = await apiUpload(file)
                      setValues(f.name, res.url)
                    } catch (err) {
                      setValues(f.name, '')
                      toast.error(err instanceof Error ? err.message : t('toast.uploadFailed'))
                    }
                  }}
                />
              </label>
              {values[f.name] === '__uploading__' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            </div>
          ) : (
            <Input
              id={`ff-${f.name}`}
              type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'}
              value={f.type === 'date' ? toInputDate(values[f.name]) : String(values[f.name] ?? '')}
              onChange={(e) => setValues(f.name, f.type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)}
              placeholder={f.placeholder}
              disabled={disabled}
              className="bg-background/60"
            />
          )}
          {f.hint && <p className="text-xs text-muted-foreground/70">{f.hint}</p>}
        </div>
      ))}
    </div>
  )
}

export function toInputDate(v: unknown): string {
  if (!v) return ''
  const s = String(v)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return ''
}

export function emptyValues(fields: FieldDef[]): FormValues {
  const v: FormValues = {}
  for (const f of fields) {
    v[f.name] = f.type === 'checkbox' ? false : f.type === 'select' ? (f.required ? (f.options?.[0]?.value ?? '') : '') : ''
  }
  return v
}

export function rowToValues(row: Record<string, unknown>, fields: FieldDef[]): FormValues {
  const v: FormValues = {}
  for (const f of fields) {
    const raw = row[f.name]
    if (f.type === 'checkbox') v[f.name] = Boolean(raw)
    else v[f.name] = raw == null ? '' : String(raw)
  }
  return v
}

/** Serialize values for the API: empty strings → null, date strings passed through. */
export function serializeValues(values: FormValues, fields: FieldDef[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of fields) {
    const v = values[f.name]
    if (f.type === 'checkbox') out[f.name] = Boolean(v)
    else if (f.type === 'number') out[f.name] = v === '' || v == null ? null : Number(v)
    else out[f.name] = v === '' ? null : v
  }
  return out
}

export function FormModal({ open, onOpenChange, title, description, fields, initial, onSubmit, submitLabel, extraContent }: {
  open: boolean
  onOpenChange: (b: boolean) => void
  title: string
  description?: string
  fields: FieldDef[]
  initial?: FormValues
  onSubmit: (values: Record<string, unknown>) => Promise<void>
  submitLabel: string
  extraContent?: React.ReactNode
}) {
  const { t } = useI18n()
  const [values, setValuesState] = useState<FormValues>(initial ?? emptyValues(fields))
  const [submitting, setSubmitting] = useState(false)

  // Sync when opening with new initial data
  const [lastInitial, setLastInitial] = useState<FormValues | undefined>(initial)
  if (open && initial !== lastInitial) {
    setValuesState(initial ?? emptyValues(fields))
    setLastInitial(initial)
  }

  const setValues = (name: string, v: FormValues[string]) => setValuesState((s) => ({ ...s, [name]: v }))

  const handleSubmit = async () => {
    // client-side required check
    for (const f of fields) {
      if (f.required && (values[f.name] === '' || values[f.name] == null)) {
        toast.error(`${f.label}: ${t('validation.required')}`)
        return
      }
    }
    setSubmitting(true)
    try {
      await onSubmit(serializeValues(values, fields))
      onOpenChange(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('common.error')
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!submitting) onOpenChange(o) }}>
      <DialogContent className="glass max-h-[92vh] max-w-2xl overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <FormGrid fields={fields} values={values} setValues={setValues} disabled={submitting} />
        {extraContent}
        <DialogFooter className="mt-2 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting} className="border-border/60">
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} className="gold-cta min-w-24">
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============ Stat card ============

export function StatCard({ label, value, icon: Icon, onClick, accent = 'gold', hint }: {
  label: string; value: string | number; icon: React.ElementType; onClick?: () => void; accent?: 'gold' | 'green' | 'red' | 'violet'; hint?: string
}) {
  const accents: Record<string, string> = {
    gold: 'bg-primary/12 text-primary',
    green: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-300',
    red: 'bg-red-500/12 text-red-600 dark:text-red-300',
    violet: 'bg-violet-500/12 text-violet-600 dark:text-violet-300',
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      whileHover={onClick ? { y: -2 } : undefined}
    >
      <GlassCard hover={!!onClick} className={`flex items-center gap-4 p-4 sm:p-5 ${onClick ? 'cursor-pointer' : ''}`} >
        <button type="button" onClick={onClick} className="flex w-full items-center gap-4 text-left" disabled={!onClick}>
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accents[accent]}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
            <p className="text-xl font-semibold tracking-tight sm:text-2xl">{value}</p>
            {hint && <p className="truncate text-xs text-muted-foreground/70">{hint}</p>}
          </div>
        </button>
      </GlassCard>
    </motion.div>
  )
}

// ============ Timeline ============

export interface TimelineItem {
  id: string
  title: string
  subtitle?: string
  date?: string | Date | null
  badge?: string | null
  content?: React.ReactNode
}

export function Timeline({ items }: { items: TimelineItem[] }) {
  const { formatDate } = useI18n()
  if (items.length === 0) return null
  return (
    <div className="relative space-y-4 pl-6">
      <div className="absolute bottom-2 left-[7px] top-2 w-px bg-gradient-to-b from-primary/40 via-primary/20 to-transparent" />
      {items.map((item) => (
        <div key={item.id} className="relative">
          <div className="absolute -left-[23px] top-1.5 flex h-3.5 w-3.5 items-center justify-center">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-primary bg-background" />
          </div>
          <div className="rounded-xl border border-border/50 bg-background/40 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">{item.title}</p>
              {item.badge && <StatusBadge value={item.badge} />}
            </div>
            {item.date && <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(item.date)}</p>}
            {item.subtitle && <p className="mt-1 text-sm text-muted-foreground">{item.subtitle}</p>}
            {item.content}
          </div>
        </div>
      ))}
    </div>
  )
}

// ============ Info row (label: value) ============

export function InfoRow({ label, value, full }: { label: string; value: React.ReactNode; full?: boolean }) {
  return (
    <div className={`flex flex-col gap-0.5 border-b border-border/30 py-2.5 sm:flex-row sm:items-baseline sm:gap-4 ${full ? 'sm:col-span-2' : ''}`}>
      <span className="w-40 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 text-sm">{value ?? '—'}</span>
    </div>
  )
}

export function useEnumOptions(enumKey: string, values: readonly string[]): { value: string; label: string }[] {
  const { t } = useI18n()
  return useMemo(() => values.map((v) => ({ value: v, label: t(`enums.${v}`) })), [values, t, enumKey])
}

export { useI18n }
