'use client'

import React, { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useI18n } from '@/i18n'
import { apiPost, apiDelete, apiQuery, apiUpload, qs, downloadCsv } from '@/lib/client-api'
import { useUI } from '@/store/ui'
import {
  GlassCard, PageHeader, DataTable, RowActionsMenu, ConfirmDialog, FormModal, StatusBadge,
  type FormValues, type Column,
} from './shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Download, Plus, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { DOC_CATEGORIES, DOC_ACCESS } from '@/lib/constants'

interface DocRow {
  id: string
  title: string
  category: string
  fileUrl: string
  fileName: string
  fileType: string
  fileSize: number
  accessLevel: string
  createdAt: string
  expiryDate: string | null
  uploadedBy: { id: string; name: string; email: string } | null
}

export function DocumentsView() {
  const { t, formatDate, formatNumber } = useI18n()
  const queryClient = useQueryClient()
  const session = useUI((s) => s.session)
  const isAdmin = session?.role === 'ADMIN' || session?.role === 'SUPERADMIN'

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('ALL')
  const [accessLevel, setAccessLevel] = useState('ALL')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [deleting, setDeleting] = useState<DocRow | null>(null)

  const { data: result, isLoading } = useQuery({
    queryKey: ['documents', { search, category, accessLevel, page }],
    queryFn: () => apiQuery<DocRow[]>('/api/documents' + qs({ search, category, accessLevel, page, pageSize: 20 })),
  })

  const rows = result?.data ?? []
  const total = result?.meta?.total ?? 0

  const fields = useMemo(() => [
    { name: 'title', label: t('common.title'), type: 'text' as const, required: true },
    { name: 'category', label: t('documentsModule.category'), type: 'select' as const, required: true, options: DOC_CATEGORIES.map((c) => ({ value: c, label: t(`enums.${c}`) })) },
    { name: 'accessLevel', label: t('fields.accessLevel'), type: 'select' as const, options: DOC_ACCESS.map((c) => ({ value: c, label: t(`enums.${c}`) })) },
    { name: 'entityType', label: 'Entity Type', type: 'select' as const, required: true, options: [{ value: 'Staff', label: t('nav.staff') }] },
    { name: 'entityId', label: 'Entity ID', type: 'text' as const, required: true, hint: 'Staff ID (from staff detail URL)' },
    { name: 'fileUrl', label: t('documentsModule.uploadFile'), type: 'upload' as const, required: true, full: true, hint: 'doc' },
    { name: 'expiryDate', label: t('fields.expiryDate'), type: 'date' as const },
  ], [t])

  const submit = async (values: Record<string, unknown>) => {
    await apiPost('/api/documents', values)
    toast.success(t('toast.created'))
    queryClient.invalidateQueries({ queryKey: ['documents'] })
  }

  const confirmDelete = async () => {
    if (!deleting) return
    try {
      await apiDelete(`/api/documents/${deleting.id}`)
      toast.success(t('toast.deleted'))
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      setDeleting(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toast.error'))
    }
  }

  const columns: Column<DocRow>[] = [
    {
      key: 'title', header: t('common.title'),
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{r.title}</p>
            <p className="truncate text-xs text-muted-foreground">{r.fileName}</p>
          </div>
        </div>
      ),
    },
    { key: 'category', header: t('documentsModule.category'), render: (r) => <StatusBadge value={r.category} /> },
    { key: 'accessLevel', header: t('fields.accessLevel'), render: (r) => <StatusBadge value={r.accessLevel} /> },
    { key: 'fileSize', header: t('fields.fileSize'), hideOnMobile: true, render: (r) => <span className="text-xs">{formatNumber(Math.round(r.fileSize / 1024))} KB</span> },
    { key: 'uploadedBy', header: t('fields.uploadedBy'), hideOnMobile: true, render: (r) => r.uploadedBy?.name || '—' },
    { key: 'createdAt', header: t('common.createdAt'), render: (r) => formatDate(r.createdAt) },
    {
      key: 'actions', header: t('common.actions'),
      render: (r) => (
        <RowActionsMenu
          extra={[
            { label: t('common.download'), onClick: () => { window.open(r.fileUrl, '_blank') }, icon: Download },
          ]}
          onDelete={isAdmin ? () => setDeleting(r) : undefined}
        />
      ),
    },
  ]

  const exportCsv = () => {
    downloadCsv('documents.csv', [
      { key: 'title', header: t('common.title') },
      { key: 'category', header: t('documentsModule.category') },
      { key: 'accessLevel', header: t('fields.accessLevel') },
      { key: 'fileName', header: t('fields.fileName') },
      { key: 'createdAt', header: t('common.createdAt') },
    ], rows as unknown as Record<string, unknown>[])
    toast.success(t('toast.exported'))
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('documentsModule.title')}
        subtitle={t('documentsModule.subtitle')}
        actions={
          <>
            <Button variant="outline" className="border-border/60" onClick={exportCsv}>
              <Download className="mr-2 h-4 w-4" /> {t('common.exportCsv')}
            </Button>
            {isAdmin && (
              <Button className="gold-cta" onClick={() => setFormOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> {t('documentsModule.addNew')}
              </Button>
            )}
          </>
        }
      />

      <GlassCard className="p-3 sm:p-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder={t('common.searchPrompt')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} className="h-10 pl-9 bg-background/60" />
          </div>
          <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1) }}>
            <SelectTrigger className="h-10 bg-background/60"><SelectValue /></SelectTrigger>
            <SelectContent className="glass max-h-72">
              <SelectItem value="ALL">{t('documentsModule.category')} — {t('common.all')}</SelectItem>
              {DOC_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{t(`enums.${c}`)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={accessLevel} onValueChange={(v) => { setAccessLevel(v); setPage(1) }}>
            <SelectTrigger className="h-10 bg-background/60"><SelectValue /></SelectTrigger>
            <SelectContent className="glass">
              <SelectItem value="ALL">{t('fields.accessLevel')} — {t('common.all')}</SelectItem>
              {DOC_ACCESS.map((c) => <SelectItem key={c} value={c}>{t(`enums.${c}`)}</SelectItem>)}
            </SelectContent>
          </Select>
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
        />
      </GlassCard>

      <FormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        title={t('documentsModule.addNew')}
        description={t('documentsModule.viewPermissionNote')}
        fields={fields}
        onSubmit={submit}
        submitLabel={t('common.create')}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => { if (!o) setDeleting(null) }}
        onConfirm={confirmDelete}
        title={t('common.confirmDeleteTitle')}
        message={t('common.confirmDeleteMessage')}
      />
    </div>
  )
}
