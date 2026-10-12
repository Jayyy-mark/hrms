'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useI18n } from '@/i18n'
import { apiGet, downloadCsv } from '@/lib/client-api'
import { GlassCard, PageHeader, DataTable, type Column } from './shared'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Download, Printer, BarChart3 } from 'lucide-react'
import { toast } from 'sonner'

const REPORT_TYPES = [
  { key: 'staff-list', labelKey: 'reportsModule.staffList' },
  { key: 'by-department', labelKey: 'reportsModule.byDepartment' },
  { key: 'by-rank', labelKey: 'reportsModule.byRank' },
  { key: 'by-age', labelKey: 'reportsModule.byAge' },
  { key: 'by-education', labelKey: 'reportsModule.byEducation' },
  { key: 'retirement-due', labelKey: 'reportsModule.retirementDue' },
  { key: 'promotions', labelKey: 'reportsModule.promotions' },
  { key: 'transfers', labelKey: 'reportsModule.transfers' },
  { key: 'trainings', labelKey: 'reportsModule.trainings' },
  { key: 'awards', labelKey: 'reportsModule.awards' },
  { key: 'foreign-travel', labelKey: 'reportsModule.foreignTravel' },
  { key: 'military-service', labelKey: 'reportsModule.military' },
]

interface ReportData {
  type: string
  columns: { key: string; header: string }[]
  rows: Record<string, unknown>[]
}

export function ReportsView() {
  const { t, formatNumber } = useI18n()
  const [type, setType] = useState('staff-list')

  const { data, isLoading } = useQuery({
    queryKey: ['report', type],
    queryFn: () => apiGet<ReportData>(`/api/reports/${type}`),
  })

  const columns: Column<Record<string, unknown>>[] = (data?.columns ?? []).map((c) => ({
    key: c.key,
    header: c.header,
    render: (row) => {
      const v = row[c.key]
      if (v == null) return '—'
      const s = String(v)
      if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10)
      return s
    },
  }))

  const exportCsv = () => {
    if (!data) return
    downloadCsv(`${type}.csv`, data.columns, data.rows)
    toast.success(t('toast.exported'))
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('reportsModule.title')}
        subtitle={t('reportsModule.subtitle')}
        actions={
          <>
            <Button variant="outline" className="border-border/60" onClick={exportCsv} disabled={!data}>
              <Download className="mr-2 h-4 w-4" /> {t('common.exportCsv')}
            </Button>
            <Button variant="outline" className="border-border/60" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" /> {t('common.print')}
            </Button>
          </>
        }
      />

      {/* Report selector */}
      <GlassCard className="p-3 sm:p-4 no-print">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {REPORT_TYPES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setType(r.key)}
              className={`flex min-h-[56px] items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-medium transition-all ${
                type === r.key
                  ? 'border-primary/50 bg-primary/12 text-primary shadow-sm'
                  : 'border-border/50 bg-background/50 text-muted-foreground hover:border-primary/30 hover:text-foreground'
              }`}
            >
              <BarChart3 className="h-4 w-4 shrink-0" />
              <span className="leading-tight">{t(r.labelKey)}</span>
            </button>
          ))}
        </div>
      </GlassCard>

      {/* Preview table */}
      <GlassCard className="p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            {t(REPORT_TYPES.find((r) => r.key === type)?.labelKey || 'reportsModule.preview')}
          </h3>
          {data && <p className="text-xs text-muted-foreground">{formatNumber(data.rows.length)} {t('reportsModule.rows')}</p>}
        </div>
        <div className="max-h-[70vh] overflow-auto">
          <DataTable
            columns={columns}
            rows={data?.rows ?? []}
            loading={isLoading}
            rowKey={(_, i) => `row-${i}`}
            emptyTitle={t('common.noData')}
          />
        </div>
      </GlassCard>
    </div>
  )
}
