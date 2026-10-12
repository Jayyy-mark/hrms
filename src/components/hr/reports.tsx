'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useI18n } from '@/i18n'
import { apiGet, downloadCsv } from '@/lib/client-api'
import { GlassCard, PageHeader, DataTable, StatusBadge, type Column } from './shared'
import { Button } from '@/components/ui/button'
import { Download, Printer, BarChart3, FileSpreadsheet } from 'lucide-react'
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

// Values that look like status enums get badge treatment
const BADGE_VALUES = new Set([
  'ACTIVE', 'RETIRED', 'RESIGNED', 'TRANSFERRED', 'SUSPENDED', 'PENDING', 'APPROVED',
  'REJECTED', 'CLOSED', 'OPEN', 'UNDER_REVIEW', 'DECIDED', 'EFFECTIVE', 'MALE', 'FEMALE',
])

interface ReportData {
  type: string
  columns: { key: string; header: string }[]
  rows: Record<string, unknown>[]
}

export function ReportsView() {
  const { t, formatNumber, formatDate } = useI18n()
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
      if (BADGE_VALUES.has(s)) return <StatusBadge value={s} />
      return s
    },
  }))

  const exportCsv = () => {
    if (!data) return
    downloadCsv(`${type}.csv`, data.columns, data.rows)
    toast.success(t('toast.exported'))
  }

  const reportTitle = t(REPORT_TYPES.find((r) => r.key === type)?.labelKey || 'reportsModule.preview')

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('reportsModule.title')}
        subtitle={t('reportsModule.subtitle')}
        actions={
          <>
            <Button variant="outline" className="border-border/60 no-print" onClick={exportCsv} disabled={!data}>
              <Download className="mr-2 h-4 w-4" /> {t('common.exportCsv')}
            </Button>
            <Button variant="outline" className="border-border/60 no-print" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" /> {t('common.print')}
            </Button>
          </>
        }
      />

      {/* Print header — visible only when printing */}
      <div className="hidden print:block print:mb-4">
        <div className="flex items-center justify-between border-b-2 border-primary pb-2">
          <div>
            <p className="text-lg font-bold tracking-tight">MOGE HR</p>
            <p className="text-sm">{reportTitle}</p>
          </div>
          <p className="text-xs text-gray-600">
            {formatDate(new Date())} · {formatNumber(data?.rows.length ?? 0)} {t('reportsModule.rows')}
          </p>
        </div>
      </div>

      {/* Report selector */}
      <GlassCard className="no-print p-3 sm:p-4">
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
              {type === r.key ? <FileSpreadsheet className="h-4 w-4 shrink-0" /> : <BarChart3 className="h-4 w-4 shrink-0" />}
              <span className="leading-tight">{t(r.labelKey)}</span>
            </button>
          ))}
        </div>
      </GlassCard>

      {/* Preview table */}
      <GlassCard className="p-3 sm:p-4 print:border-0 print:bg-white print:shadow-none">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold print:text-base">{reportTitle}</h3>
          {data && <p className="text-xs text-muted-foreground">{formatNumber(data.rows.length)} {t('reportsModule.rows')}</p>}
        </div>
        <div className="max-h-[70vh] overflow-auto print:max-h-none print:overflow-visible">
          <DataTable
            columns={columns}
            rows={data?.rows ?? []}
            loading={isLoading}
            rowKey={(_, i) => `row-${i}`}
            emptyTitle={t('common.noData')}
            paginated={false}
          />
        </div>
        {/* Print footer */}
        <div className="hidden print:flex print:justify-between print:pt-4 print:text-[10px] print:text-gray-500">
          <span>MOGE HR — {t('reportsModule.title')}</span>
          <span>{formatDate(new Date())}</span>
        </div>
      </GlassCard>
    </div>
  )
}
