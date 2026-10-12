'use client'

import React, { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useI18n } from '@/i18n'
import { apiPost, apiPut, apiDelete, apiQuery, qs } from '@/lib/client-api'
import { useUI } from '@/store/ui'
import {
  GlassCard, PageHeader, DataTable, RowActionsMenu, ConfirmDialog, FormModal, EmptyState,
  type FormValues, rowToValues, toInputDate, type Column,
} from './shared'
import { MODULE_CONFIGS, useModuleColumns, useModuleFields, useMasters } from './module-configs'
import { Button } from '@/components/ui/button'
import { ChevronRight, ChevronDown, Plus, Building2, FolderTree } from 'lucide-react'
import { toast } from 'sonner'

/** Master data page — generic CRUD for departments/positions/ranks/catalogs. */
export function MasterDataPage({ slug }: { slug: string }) {
  const { t } = useI18n()
  const config = MODULE_CONFIGS[slug]
  const masters = useMasters()
  const columns = useModuleColumns(config, { showStaff: false })
  const fields = useModuleFields(config, masters)
  const queryClient = useQueryClient()
  const session = useUI((s) => s.session)
  const isAdmin = session?.role === 'ADMIN' || session?.role === 'SUPERADMIN'

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null)
  const [deleting, setDeleting] = useState<Record<string, unknown> | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const { data: result, isLoading } = useQuery({
    queryKey: ['module-list', slug, { search, page }],
    queryFn: () => apiQuery<Record<string, unknown>[]>(`/api/resources/${slug}` + qs({ search, page, pageSize: 50, sortBy: 'name', sortDir: 'asc' })),
  })

  const rows = result?.data ?? []
  const total = result?.meta?.total ?? 0

  const initial = useMemo<FormValues>(() => {
    if (!editing) {
      const v: FormValues = {}
      for (const f of fields) v[f.name] = f.type === 'checkbox' ? false : ''
      return v
    }
    const v = rowToValues(editing, fields)
    for (const f of fields) {
      if (f.type === 'date') v[f.name] = toInputDate(editing[f.name])
      if (f.type === 'select' && f.options?.some((o) => o.value === '__none__') && editing[f.name] == null) v[f.name] = '__none__'
    }
    return v
  }, [editing, fields])

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['module-list', slug] })
    queryClient.invalidateQueries({ queryKey: ['masters'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const submit = async (values: Record<string, unknown>) => {
    const payload = { ...values }
    if (payload.parentId === '__none__') payload.parentId = null
    if (payload.departmentId === '__none__') payload.departmentId = null
    if (editing) {
      await apiPut(`/api/resources/${slug}/${editing.id}`, payload)
      toast.success(t('toast.updated'))
    } else {
      await apiPost(`/api/resources/${slug}`, payload)
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

  const columnsWithActions: Column<Record<string, unknown>>[] = useMemo(() => {
    const cols = [...columns]
    if (isAdmin) {
      cols.push({
        key: '__actions',
        header: t('common.actions'),
        render: (row) => (
          <RowActionsMenu
            onEdit={() => { setEditing(row); setFormOpen(true) }}
            onDelete={() => setDeleting(row)}
          />
        ),
      })
    }
    return cols
  }, [columns, isAdmin, t])

  if (!config) return null

  return (
    <div className="space-y-4">
      <PageHeader
        title={t(config.titleKey)}
        actions={
          isAdmin && (
            <Button className="gold-cta" onClick={() => { setEditing(null); setFormOpen(true) }}>
              <Plus className="mr-2 h-4 w-4" /> {t('common.addNew')}
            </Button>
          )
        }
      />

      {/* Department tree view */}
      {slug === 'departments' && <DepartmentTreeCard rows={rows} loading={isLoading} onEdit={(r) => { setEditing(r); setFormOpen(true) }} isAdmin={isAdmin} />}

      <GlassCard className="p-3 sm:p-4">
        <DataTable
          columns={columnsWithActions}
          rows={rows}
          loading={isLoading}
          page={page}
          pageSize={50}
          total={total}
          onPageChange={setPage}
          rowKey={(r) => String(r.id)}
          emptyTitle={t('common.noData')}
        />
      </GlassCard>

      <FormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? t('common.edit') : `${t('common.addNew')} — ${t(config.titleKey)}`}
        fields={fields}
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

interface DeptRow {
  id: string
  name: string
  code: string | null
  parentId: string | null
  children?: { id: string; name: string }[]
}

/** Hierarchical tree view for departments. */
function DepartmentTreeCard({ rows, loading, onEdit, isAdmin }: {
  rows: Record<string, unknown>[]
  loading: boolean
  onEdit: (r: Record<string, unknown>) => void
  isAdmin: boolean
}) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const deptRows = rows as unknown as DeptRow[]

  const roots = deptRows.filter((r) => !r.parentId)

  const toggle = (id: string) => setExpanded((s) => ({ ...s, [id]: !s[id] }))

  if (loading) return <GlassCard className="h-64 rounded-2xl skeleton-shimmer">{' '}</GlassCard>
  if (roots.length === 0) return null

  const renderNode = (node: DeptRow, depth: number): React.ReactNode => {
    const children = deptRows.filter((r) => r.parentId === node.id)
    const isExpanded = expanded[node.id] ?? depth < 1
    return (
      <div key={node.id}>
        <div
          className="flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-accent"
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
        >
          {children.length > 0 ? (
            <button type="button" onClick={() => toggle(node.id)} className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground" aria-label="toggle">
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : (
            <span className="h-6 w-6" />
          )}
          <Building2 className="h-4 w-4 text-primary/70" />
          <span className="text-sm font-medium">{node.name}</span>
          {node.code && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{node.code}</span>}
          {children.length > 0 && <span className="text-xs text-muted-foreground">({children.length})</span>}
          {isAdmin && (
            <button type="button" className="ml-auto rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" onClick={() => onEdit(node as unknown as Record<string, unknown>)} aria-label={t('common.edit')}>
              <Plus className="hidden h-3.5 w-3.5" />
              <span className="text-xs">{t('common.edit')}</span>
            </button>
          )}
        </div>
        {isExpanded && children.map((c) => renderNode(c, depth + 1))}
      </div>
    )
  }

  return (
    <GlassCard className="p-4 sm:p-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <FolderTree className="h-4 w-4 text-primary" /> {t('nav.departments')} — Tree
      </h3>
      <div className="max-h-96 overflow-y-auto">
        {roots.map((r) => renderNode(r, 0))}
      </div>
    </GlassCard>
  )
}
