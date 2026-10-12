'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useI18n } from '@/i18n'
import { apiGet, qs } from '@/lib/client-api'
import { useUI } from '@/store/ui'
import { GlassCard, StatCard, PageHeader, StatusBadge, StaffAvatar, ListSkeleton, EmptyState } from './shared'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, CartesianGrid,
} from 'recharts'
import { Users, UserCheck, UserPlus, Clock, Activity as ActivityIcon } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface DashboardData {
  totals: { total: number; active: number; newHiresThisYear: number; upcomingRetirements: number; male: number; female: number }
  byStatus: Record<string, number>
  genderDistribution: { gender: string; count: number }[]
  departmentDistribution: { name: string; count: number }[]
  rankDistribution: { name: string; count: number }[]
  ageDistribution: { range: string; count: number }[]
  recentActivity: { id: string; userName: string | null; action: string; module: string; entityType: string; createdAt: string }[]
  recentStaff: { id: string; staffNo: string; nameEn: string; nameMm: string | null; photoUrl: string | null; status: string; position: string | null; department: string | null; rank: string | null; joinDate: string | null }[]
}

const GOLD = '#C9A227'
const GOLD_SOFT = '#E6C55C'
const GOLD_DEEP = '#B8860B'
const GOLD_PALE = '#F1D98B'

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name?: string; value?: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass rounded-lg px-3 py-2 text-xs">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-muted-foreground">{p.name}: <span className="font-semibold text-foreground">{p.value}</span></p>
      ))}
    </div>
  )
}

export function DashboardView() {
  const { t, formatNumber, formatDate, locale } = useI18n()
  const { navigate } = useUI()
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiGet<DashboardData>('/api/dashboard'),
  })

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('dashboard.title')} subtitle={t('dashboard.subtitle')} />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass h-24 rounded-2xl skeleton-shimmer" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="glass h-72 rounded-2xl skeleton-shimmer" />
          <div className="glass h-72 rounded-2xl skeleton-shimmer" />
        </div>
      </div>
    )
  }

  const { totals } = data
  const genderData = data.genderDistribution.map((g) => ({
    name: t(`enums.${g.gender}`), value: g.count,
  }))
  const statusEntries = Object.entries(data.byStatus).filter(([k]) => k === 'ACTIVE' || k === 'RETIRED' || k === 'RESIGNED' || k === 'TRANSFERRED' || k === 'SUSPENDED')

  return (
    <div className="space-y-6">
      <PageHeader title={t('dashboard.title')} subtitle={t('dashboard.subtitle')} />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label={t('dashboard.totalStaff')} value={formatNumber(totals.total)} icon={Users} onClick={() => navigate('staff')} accent="gold" />
        <StatCard label={t('dashboard.activeStaff')} value={formatNumber(totals.active)} icon={UserCheck} onClick={() => navigate('staff', { status: 'ACTIVE' })} accent="green" />
        <StatCard label={t('dashboard.newHires')} value={formatNumber(totals.newHiresThisYear)} icon={UserPlus} accent="violet" />
        <StatCard label={t('dashboard.upcomingRetirements')} value={formatNumber(totals.upcomingRetirements)} icon={Clock} accent="red" />
      </div>

      {/* Gender + status row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <GlassCard className="p-4 sm:p-5 lg:col-span-1">
          <h3 className="text-sm font-semibold">{t('dashboard.genderDistribution')}</h3>
          <div className="mt-2 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={genderData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3} strokeWidth={0}>
                  <Cell fill={GOLD} />
                  <Cell fill={GOLD_PALE} />
                  <Cell fill={GOLD_DEEP} />
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-4 pb-1 text-xs">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: GOLD }} />{t('dashboard.male')} {totals.male}</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: GOLD_PALE }} />{t('dashboard.female')} {totals.female}</span>
          </div>
        </GlassCard>

        <GlassCard className="p-4 sm:p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold">{t('dashboard.byDepartment')}</h3>
          <p className="text-xs text-muted-foreground">{t('dashboard.chartHintDepartment')}</p>
          <div className="mt-3 h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.departmentDistribution} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,162,39,0.15)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6B7280' }} interval={0} angle={-30} textAnchor="end" height={54} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(201,162,39,0.08)' }} />
                <Bar dataKey="count" name={t('dashboard.totalStaff')} fill={GOLD} radius={[6, 6, 0, 0]} maxBarSize={42} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>

      {/* Rank + age */}
      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard className="p-4 sm:p-5">
          <h3 className="text-sm font-semibold">{t('dashboard.byRank')}</h3>
          <p className="text-xs text-muted-foreground">{t('dashboard.chartHintRank')}</p>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.rankDistribution} layout="vertical" margin={{ top: 4, right: 12, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,162,39,0.15)" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} width={100} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(201,162,39,0.08)' }} />
                <Bar dataKey="count" name={t('dashboard.totalStaff')} fill={GOLD_SOFT} radius={[0, 6, 6, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="p-4 sm:p-5">
          <h3 className="text-sm font-semibold">{t('dashboard.ageDistribution')}</h3>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.ageDistribution} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,162,39,0.15)" vertical={false} />
                <XAxis dataKey="range" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(201,162,39,0.08)' }} />
                <Bar dataKey="count" name={t('dashboard.totalStaff')} fill={GOLD} radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>

      {/* Status breakdown */}
      <GlassCard className="p-4 sm:p-5">
        <h3 className="mb-3 text-sm font-semibold">{t('dashboard.statusBreakdown')}</h3>
        <div className="flex flex-wrap gap-2">
          {statusEntries.map(([status, count]) => (
            <button
              key={status}
              type="button"
              onClick={() => navigate('staff', { status })}
              className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/50 px-3 py-2 transition-all hover:border-primary/40 hover:shadow-sm"
            >
              <StatusBadge value={status} />
              <span className="text-sm font-semibold">{formatNumber(count)}</span>
            </button>
          ))}
        </div>
      </GlassCard>

      {/* Recent staff + activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        <GlassCard className="p-4 sm:p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">{t('dashboard.recentStaff')}</h3>
            <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => navigate('staff')}>
              {t('dashboard.viewAll')} →
            </button>
          </div>
          {data.recentStaff.length === 0 ? (
            <EmptyState title={t('common.noData')} />
          ) : (
            <div className="max-h-96 space-y-1 overflow-y-auto pr-1">
              {data.recentStaff.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => navigate('staff-detail', { id: s.id })}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-accent"
                >
                  <StaffAvatar name={s.nameEn} photoUrl={s.photoUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.nameEn}{s.nameMm ? ` · ${s.nameMm}` : ''}</p>
                    <p className="truncate text-xs text-muted-foreground">{s.position || s.department || s.staffNo}</p>
                  </div>
                  <StatusBadge value={s.status} />
                </button>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-4 sm:p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <ActivityIcon className="h-4 w-4 text-primary" /> {t('dashboard.recentActivity')}
          </h3>
          {data.recentActivity.length === 0 ? (
            <EmptyState title={t('common.noData')} />
          ) : (
            <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
              {data.recentActivity.map((a) => (
                <div key={a.id} className="flex gap-2.5 text-xs">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary/60" />
                  <div className="min-w-0">
                    <p className="truncate">
                      <span className="font-medium">{t(`enums.${a.action}`)}</span>
                      <span className="text-muted-foreground"> {a.module}</span>
                    </p>
                    <p className="truncate text-muted-foreground">
                      {t('dashboard.activityBy')} {a.userName || '—'} · {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  )
}
