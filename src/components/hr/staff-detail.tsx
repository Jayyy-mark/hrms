'use client'

import React, { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useI18n } from '@/i18n'
import { apiGet, apiPost, apiPut, apiDelete, apiQuery, qs } from '@/lib/client-api'
import { useUI } from '@/store/ui'
import { PERMISSIONS } from '@/lib/permissions'
import {
  GlassCard, DataTable, StaffAvatar, StatusBadge, RowActionsMenu, ConfirmDialog,
  FormModal, Timeline, InfoRow, type Column, type FormValues, rowToValues, toInputDate,
} from './shared'
import { MODULE_CONFIGS, useModuleColumns, useModuleFields, useMasters } from './module-configs'
import { StaffFormModal, type StaffRow } from './staff-list'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DOC_CATEGORIES, DOC_ACCESS } from '@/lib/constants'
import { Plus, Pencil, Printer, ChevronLeft, Lock, Home, History, Briefcase } from 'lucide-react'
import { toast } from 'sonner'

// ============ Generic sub-resource section (CRUD within a tab) ============

export function SubResourceSection({ slug, staffId, rows, readOnly, compact }: {
  slug: string
  staffId: string
  rows: Record<string, unknown>[]
  readOnly?: boolean
  compact?: boolean
}) {
  const { t } = useI18n()
  const config = MODULE_CONFIGS[slug]
  const masters = useMasters()
  const columns = useModuleColumns(config, { showStaff: false })
  const fields = useModuleFields(config, masters)
  const queryClient = useQueryClient()
  const session = useUI((s) => s.session)
  const isAdmin = session?.role === 'ADMIN' || session?.role === 'SUPERADMIN'

  const canWrite = !readOnly && isAdmin && (slug !== 'criminal' || session?.role === 'SUPERADMIN')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null)
  const [deleting, setDeleting] = useState<Record<string, unknown> | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const nsKey = slugKey(slug)

  const columnsWithActions: Column<Record<string, unknown>>[] = useMemo(() => {
    const cols = [...columns]
    if (canWrite) {
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
  }, [columns, canWrite, t])

  const initial = useMemo<FormValues | undefined>(() => {
    if (!editing) return undefined
    const v = rowToValues(editing, fields)
    for (const f of fields) {
      if (f.type === 'date') v[f.name] = toInputDate(editing[f.name])
      if (f.type === 'select' && f.options?.some((o) => o.value === '__none__')) {
        if (editing[f.name] == null) v[f.name] = '__none__'
      }
    }
    return v
  }, [editing, fields])

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['staff-detail'] })
    queryClient.invalidateQueries({ queryKey: ['module-list'] })
    queryClient.invalidateQueries({ queryKey: ['masters'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const submit = async (values: Record<string, unknown>) => {
    const payload = { ...values }
    if (config.staffScoped) payload.staffId = staffId
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

  if (!config) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold">{t(config.titleKey)}</h4>
          <Badge variant="secondary" className="rounded-full bg-primary/10 text-primary">{rows.length}</Badge>
        </div>
        {canWrite && (
          <Button size="sm" className="gold-cta h-8" onClick={() => { setEditing(null); setFormOpen(true) }}>
            <Plus className="mr-1 h-3.5 w-3.5" /> {t('common.addNew')}
          </Button>
        )}
      </div>

      {slug === 'criminal' && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/8 p-3 text-xs text-amber-700 dark:text-amber-300">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>{t('criminalModule.accessNote')}</p>
        </div>
      )}

      <DataTable
        columns={columnsWithActions}
        rows={rows}
        rowKey={(r) => String(r.id)}
        emptyTitle={t('common.noData')}
        paginated={false}
      />

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

// helper: slug → i18n namespace key for module strings
function slugKey(slug: string): string {
  const map: Record<string, string> = {
    addresses: 'addresses', family: 'family', education: 'education', languages: 'languages', skills: 'skills',
    'close-contacts': 'contactsModule', references: 'referencesModule', 'service-history': 'serviceHistoryModule',
    'staff-positions': 'serviceHistoryModule', 'staff-ranks': 'serviceHistoryModule', promotions: 'promotionsModule',
    transfers: 'transfersModule', separations: 'separationsModule', trainings: 'trainingsModule', awards: 'awardsModule',
    military: 'militaryModule', activities: 'activitiesModule', hobbies: 'hobbiesModule', political: 'politicalModule',
    conflicts: 'conflictsModule', disciplinary: 'disciplinaryModule', criminal: 'criminalModule', 'foreign-travels': 'foreignTravelsModule',
  }
  return map[slug] || 'common'
}

// ============ Staff Detail View ============

interface StaffDetail {
  id: string
  staffNo: string
  nameEn: string
  nameMm: string | null
  gender: string
  dateOfBirth: string | null
  placeOfBirth: string | null
  nrcNo: string | null
  nationality: string | null
  religion: string | null
  bloodGroup: string | null
  maritalStatus: string | null
  phone: string | null
  email: string | null
  photoUrl: string | null
  status: string
  joinDate: string | null
  createdAt: string
  updatedAt: string
  user: { id: string; email: string; name: string } | null
  addresses: Record<string, unknown>[]
  familyMembers: Record<string, unknown>[]
  educations: Record<string, unknown>[]
  languages: Record<string, unknown>[]
  skills: Record<string, unknown>[]
  closeContacts: Record<string, unknown>[]
  references: Record<string, unknown>[]
  positions: { id: string; startDate: string; endDate: string | null; isCurrent: boolean; remarks: string | null; position: { id: string; name: string } | null; department: { id: string; name: string } | null }[]
  ranks: { id: string; effectiveDate: string; appointedDate: string | null; endDate: string | null; isCurrent: boolean; remarks: string | null; rank: { id: string; name: string } | null }[]
  serviceHistory: { id: string; type: string; title: string; fromDate: string; toDate: string | null; remarks: string | null; department: { name: string } | null; position: { name: string } | null; rank: { name: string } | null; location: string | null }[]
  promotions: Record<string, unknown>[]
  transfers: Record<string, unknown>[]
  separations: Record<string, unknown>[]
  awards: Record<string, unknown>[]
  trainings: Record<string, unknown>[]
  militaryServices: Record<string, unknown>[]
  activities: Record<string, unknown>[]
  hobbies: Record<string, unknown>[]
  politicalMemberships: Record<string, unknown>[]
  conflictAssignments: Record<string, unknown>[]
  disciplinaryCases: Record<string, unknown>[]
  foreignTravels: Record<string, unknown>[]
  criminalRecords: Record<string, unknown>[]
}

const TAB_DEFS = [
  { key: 'overview', labelKey: 'staff.tabOverview' },
  { key: 'personal', labelKey: 'staff.tabPersonal' },
  { key: 'addresses', labelKey: 'staff.tabAddresses' },
  { key: 'family', labelKey: 'staff.tabFamily' },
  { key: 'education', labelKey: 'staff.tabEducation' },
  { key: 'languages', labelKey: 'staff.tabLanguages' },
  { key: 'career', labelKey: 'staff.tabCareer' },
  { key: 'movements', labelKey: 'staff.tabMovements' },
  { key: 'trainings', labelKey: 'staff.tabTrainings' },
  { key: 'awards', labelKey: 'staff.tabAwards' },
  { key: 'military', labelKey: 'staff.tabMilitary' },
  { key: 'foreign', labelKey: 'staff.tabForeignTravel' },
  { key: 'background', labelKey: 'staff.tabBackground' },
  { key: 'contacts', labelKey: 'staff.tabContacts' },
  { key: 'legal', labelKey: 'staff.tabLegal' },
  { key: 'documents', labelKey: 'staff.tabDocuments' },
  { key: 'history', labelKey: 'staff.tabHistory' },
]

export function StaffDetailView({ id, readOnly = false }: { id: string; readOnly?: boolean }) {
  const { t, formatDate } = useI18n()
  const { session, navigate } = useUI()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('overview')
  const [editOpen, setEditOpen] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)

  const isAdmin = session?.role === 'ADMIN' || session?.role === 'SUPERADMIN'
  const canViewCriminal = isAdmin

  const { data: staff, isLoading } = useQuery({
    queryKey: ['staff-detail', id],
    queryFn: () => apiGet<StaffDetail>(`/api/staff/${id}`),
  })

  if (isLoading || !staff) {
    return (
      <div className="space-y-4">
        <div className="glass h-8 w-40 rounded-xl skeleton-shimmer" />
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <div className="glass h-96 rounded-2xl skeleton-shimmer" />
          <div className="glass h-96 rounded-2xl skeleton-shimmer" />
        </div>
      </div>
    )
  }

  const currentPos = staff.positions.find((p) => p.isCurrent) || staff.positions[0]
  const currentRank = staff.ranks.find((r) => r.isCurrent) || staff.ranks[0]
  const currentDept = currentPos?.department
  const age = staff.dateOfBirth ? Math.floor((Date.now() - new Date(staff.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000)) : null
  const yearsOfService = staff.joinDate ? Math.floor((Date.now() - new Date(staff.joinDate).getTime()) / (365.25 * 24 * 3600 * 1000)) : null

  const tabVisible = (key: string) => {
    if (key === 'legal' && !isAdmin && session?.staffId !== id) return false
    return true
  }
  const visibleTabs = TAB_DEFS.filter((x) => tabVisible(x.key))

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => navigate(readOnly ? 'dashboard' : 'staff')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> {readOnly ? t('nav.dashboard') : t('staff.title')}
      </button>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr] xl:grid-cols-[300px_1fr]">
        {/* Left profile card */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <GlassCard className="p-5 text-center">
            <div className="relative mx-auto w-fit">
              <StaffAvatar name={staff.nameEn} photoUrl={staff.photoUrl} size="xl" className="mx-auto" />
              <span className="absolute bottom-1 right-1"><StatusBadge value={staff.status} /></span>
            </div>
            <h2 className="mt-4 text-lg font-semibold leading-tight">{staff.nameEn}</h2>
            {staff.nameMm && <p className="text-sm text-muted-foreground">{staff.nameMm}</p>}
            <p className="mt-1 text-xs text-muted-foreground">{staff.staffNo}</p>

            <div className="mt-4 space-y-2 text-left">
              <InfoRow label={t('staff.currentPosition')} value={currentPos?.position?.name ?? '—'} />
              <InfoRow label={t('staff.currentDepartment')} value={currentDept?.name ?? '—'} />
              <InfoRow label={t('staff.currentRank')} value={currentRank?.rank?.name ?? '—'} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl bg-primary/8 p-2.5">
                <p className="text-lg font-semibold text-primary">{age ?? '—'}</p>
                <p className="text-[10px] text-muted-foreground">{t('staff.age')}</p>
              </div>
              <div className="rounded-xl bg-primary/8 p-2.5">
                <p className="text-lg font-semibold text-primary">{yearsOfService ?? '—'}</p>
                <p className="text-[10px] text-muted-foreground">{t('staff.yearsOfService')}</p>
              </div>
            </div>

            {!readOnly && isAdmin && (
              <Button className="gold-cta mt-4 w-full" onClick={() => setEditOpen(true)}>
                <Pencil className="mr-2 h-4 w-4" /> {t('common.edit')}
              </Button>
            )}
            <Button variant="outline" className="mt-2 w-full border-border/60" onClick={() => setPrintOpen(true)}>
              <Printer className="mr-2 h-4 w-4" /> {t('staff.printSheet')}
            </Button>
          </GlassCard>

          {/* Quick counts */}
          <GlassCard className="p-4">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('staff.quickInfo')}</h4>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs">
              <span className="text-muted-foreground">{t('addresses.title')}</span><span className="text-right font-medium">{staff.addresses.length}</span>
              <span className="text-muted-foreground">{t('family.title')}</span><span className="text-right font-medium">{staff.familyMembers.length}</span>
              <span className="text-muted-foreground">{t('education.title')}</span><span className="text-right font-medium">{staff.educations.length}</span>
              <span className="text-muted-foreground">{t('trainingsModule.title')}</span><span className="text-right font-medium">{staff.trainings.length}</span>
              <span className="text-muted-foreground">{t('awardsModule.title')}</span><span className="text-right font-medium">{staff.awards.length}</span>
              <span className="text-muted-foreground">{t('nav.serviceHistory')}</span><span className="text-right font-medium">{staff.serviceHistory.length}</span>
            </div>
            {staff.user && (
              <p className="mt-3 border-t border-border/40 pt-2 text-xs text-muted-foreground">
                {t('staff.linkedUser')}: <span className="font-medium text-foreground">{staff.user.email}</span>
              </p>
            )}
          </GlassCard>
        </div>

        {/* Right content with tabs */}
        <div className="min-w-0 space-y-4">
          {/* Tab bar */}
          <div className="glass rounded-2xl p-1.5">
            <div className="flex gap-1 overflow-x-auto pb-1 [scrollbar-width:thin]">
              {visibleTabs.map((x) => (
                <button
                  key={x.key}
                  type="button"
                  onClick={() => setTab(x.key)}
                  className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium transition-all min-h-[36px] ${
                    tab === x.key ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  {t(x.labelKey)}
                </button>
              ))}
            </div>
          </div>

          <GlassCard className="p-4 sm:p-5">
            {tab === 'overview' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">{t('staff.overview')}</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <GlassCard className="p-4">
                    <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Home className="h-3.5 w-3.5" />{t('staff.contactInformation')}</h4>
                    <InfoRow label={t('staff.phone')} value={staff.phone || '—'} />
                    <InfoRow label={t('staff.email')} value={staff.email || '—'} />
                    <InfoRow label={t('staff.nrcNo')} value={staff.nrcNo || '—'} />
                  </GlassCard>
                  <GlassCard className="p-4">
                    <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Briefcase className="h-3.5 w-3.5" />{t('staff.basicInformation')}</h4>
                    <InfoRow label={t('staff.joinDate')} value={formatDate(staff.joinDate)} />
                    <InfoRow label={t('staff.gender')} value={<StatusBadge value={staff.gender} />} />
                    <InfoRow label={t('staff.maritalStatus')} value={staff.maritalStatus ? t(`enums.${staff.maritalStatus}`) : '—'} />
                  </GlassCard>
                </div>
                <div>
                  <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><History className="h-3.5 w-3.5" />{t('serviceHistoryModule.timeline')}</h4>
                  <Timeline
                    items={staff.serviceHistory.slice(0, 5).map((h) => ({
                      id: h.id,
                      title: h.title,
                      date: h.fromDate,
                      badge: h.type,
                      subtitle: [h.rank?.name, h.department?.name, h.position?.name].filter(Boolean).join(' · ') || undefined,
                    }))}
                  />
                </div>
              </div>
            )}

            {tab === 'personal' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">{t('staff.personalInfo')}</h3>
                <div className="grid sm:grid-cols-2">
                  <InfoRow label={t('staff.staffNo')} value={staff.staffNo} />
                  <InfoRow label={t('staff.nameEn')} value={staff.nameEn} />
                  <InfoRow label={t('staff.nameMm')} value={staff.nameMm || '—'} />
                  <InfoRow label={t('staff.gender')} value={<StatusBadge value={staff.gender} />} />
                  <InfoRow label={t('staff.dateOfBirth')} value={formatDate(staff.dateOfBirth)} />
                  <InfoRow label={t('staff.placeOfBirth')} value={staff.placeOfBirth || '—'} />
                  <InfoRow label={t('staff.nrcNo')} value={staff.nrcNo || '—'} />
                  <InfoRow label={t('staff.nationality')} value={staff.nationality || '—'} />
                  <InfoRow label={t('staff.religion')} value={staff.religion || '—'} />
                  <InfoRow label={t('staff.bloodGroup')} value={staff.bloodGroup || '—'} />
                  <InfoRow label={t('staff.maritalStatus')} value={staff.maritalStatus ? t(`enums.${staff.maritalStatus}`) : '—'} />
                  <InfoRow label={t('staff.phone')} value={staff.phone || '—'} />
                  <InfoRow label={t('staff.email')} value={staff.email || '—'} />
                  <InfoRow label={t('staff.joinDate')} value={formatDate(staff.joinDate)} />
                  <InfoRow label={t('common.updatedAt')} value={formatDate(staff.updatedAt)} />
                </div>
              </div>
            )}

            {tab === 'addresses' && <SubResourceSection slug="addresses" staffId={staff.id} rows={staff.addresses} readOnly={readOnly} />}
            {tab === 'family' && <SubResourceSection slug="family" staffId={staff.id} rows={staff.familyMembers} readOnly={readOnly} />}
            {tab === 'education' && <SubResourceSection slug="education" staffId={staff.id} rows={staff.educations} readOnly={readOnly} />}
            {tab === 'languages' && (
              <div className="space-y-6">
                <SubResourceSection slug="languages" staffId={staff.id} rows={staff.languages} readOnly={readOnly} />
                <SubResourceSection slug="skills" staffId={staff.id} rows={staff.skills} readOnly={readOnly} />
              </div>
            )}

            {tab === 'career' && (
              <div className="space-y-6">
                <SubResourceSection slug="staff-positions" staffId={staff.id} rows={staff.positions as unknown as Record<string, unknown>[]} readOnly={readOnly} />
                <SubResourceSection slug="staff-ranks" staffId={staff.id} rows={staff.ranks as unknown as Record<string, unknown>[]} readOnly={readOnly} />
                <div>
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold"><History className="h-4 w-4 text-primary" />{t('serviceHistoryModule.timeline')}</h4>
                  <div className="mb-4">
                    <SubResourceSection slug="service-history" staffId={staff.id} rows={staff.serviceHistory as unknown as Record<string, unknown>[]} readOnly={readOnly} compact />
                  </div>
                  <Timeline
                    items={[...staff.serviceHistory].reverse().map((h) => ({
                      id: h.id,
                      title: h.title,
                      date: h.fromDate,
                      badge: h.type,
                      subtitle: [h.rank?.name, h.department?.name, h.position?.name, h.location].filter(Boolean).join(' · ') || undefined,
                    }))}
                  />
                </div>
              </div>
            )}

            {tab === 'movements' && (
              <div className="space-y-6">
                <SubResourceSection slug="promotions" staffId={staff.id} rows={staff.promotions} readOnly={readOnly} />
                <SubResourceSection slug="transfers" staffId={staff.id} rows={staff.transfers} readOnly={readOnly} />
                <SubResourceSection slug="separations" staffId={staff.id} rows={staff.separations} readOnly={readOnly} />
              </div>
            )}

            {tab === 'trainings' && <SubResourceSection slug="trainings" staffId={staff.id} rows={staff.trainings} readOnly={readOnly} />}
            {tab === 'awards' && <SubResourceSection slug="awards" staffId={staff.id} rows={staff.awards} readOnly={readOnly} />}
            {tab === 'military' && <SubResourceSection slug="military" staffId={staff.id} rows={staff.militaryServices} readOnly={readOnly} />}
            {tab === 'foreign' && <SubResourceSection slug="foreign-travels" staffId={staff.id} rows={staff.foreignTravels} readOnly={readOnly} />}

            {tab === 'background' && (
              <div className="space-y-6">
                <SubResourceSection slug="activities" staffId={staff.id} rows={staff.activities} readOnly={readOnly} />
                <SubResourceSection slug="hobbies" staffId={staff.id} rows={staff.hobbies} readOnly={readOnly} />
                <SubResourceSection slug="political" staffId={staff.id} rows={staff.politicalMemberships} readOnly={readOnly} />
                <SubResourceSection slug="conflicts" staffId={staff.id} rows={staff.conflictAssignments} readOnly={readOnly} />
              </div>
            )}

            {tab === 'contacts' && (
              <div className="space-y-6">
                <SubResourceSection slug="close-contacts" staffId={staff.id} rows={staff.closeContacts} readOnly={readOnly} />
                <SubResourceSection slug="references" staffId={staff.id} rows={staff.references} readOnly={readOnly} />
              </div>
            )}

            {tab === 'legal' && (
              <div className="space-y-6">
                <SubResourceSection slug="disciplinary" staffId={staff.id} rows={staff.disciplinaryCases} readOnly={readOnly} />
                {canViewCriminal && (
                  <SubResourceSection slug="criminal" staffId={staff.id} rows={staff.criminalRecords} readOnly={readOnly || session?.role !== 'SUPERADMIN'} />
                )}
              </div>
            )}

            {tab === 'documents' && <StaffDocumentsTab staffId={staff.id} readOnly={readOnly} />}
            {tab === 'history' && <StaffHistoryTab staffId={staff.id} />}
          </GlassCard>
        </div>
      </div>

      {isAdmin && !readOnly && (
        <StaffFormModal open={editOpen} onOpenChange={setEditOpen} staff={staff as unknown as StaffRow} />
      )}
      {printOpen && <PrintSheet staff={staff} onClose={() => setPrintOpen(false)} />}
    </div>
  )
}

// ============ Documents tab ============

function StaffDocumentsTab({ staffId, readOnly }: { staffId: string; readOnly?: boolean }) {
  const { t, formatDate } = useI18n()
  const queryClient = useQueryClient()
  const session = useUI((s) => s.session)
  const isAdmin = session?.role === 'ADMIN' || session?.role === 'SUPERADMIN'
  const [deleting, setDeleting] = useState<Record<string, unknown> | null>(null)

  const { data: docs, isLoading } = useQuery({
    queryKey: ['staff-docs', staffId],
    queryFn: () => apiQuery<Record<string, unknown>[]>(`/api/documents${qs({ entityType: 'Staff', entityId: staffId, pageSize: 100 })}`),
  })
  const rows = docs?.data ?? []

  const confirmDelete = async () => {
    if (!deleting) return
    try {
      await apiDelete(`/api/documents/${deleting.id}`)
      toast.success(t('toast.deleted'))
      queryClient.invalidateQueries({ queryKey: ['staff-docs', staffId] })
      setDeleting(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toast.error'))
    }
  }

  const attachDoc = async (values: Record<string, unknown>) => {
    await apiPost('/api/documents', { ...values, entityType: 'Staff', entityId: staffId })
    toast.success(t('toast.created'))
    queryClient.invalidateQueries({ queryKey: ['staff-docs', staffId] })
  }

  const docFields = useMemo(() => [
    { name: 'title', label: t('common.title'), type: 'text' as const, required: true },
    { name: 'category', label: t('documentsModule.category'), type: 'select' as const, required: true, options: DOC_CAT_OPTIONS.map((c) => ({ value: c, label: t(`enums.${c}`) })) },
    { name: 'accessLevel', label: t('fields.accessLevel'), type: 'select' as const, options: DOC_ACCESS_OPTIONS.map((c) => ({ value: c, label: t(`enums.${c}`) })) },
    { name: 'fileUrl', label: t('documentsModule.uploadFile'), type: 'upload' as const, required: true, full: true, hint: 'doc' },
    { name: 'expiryDate', label: t('fields.expiryDate'), type: 'date' as const },
  ], [t])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold">{t('documentsModule.title')}</h4>
          <Badge variant="secondary" className="rounded-full bg-primary/10 text-primary">{rows.length}</Badge>
        </div>
        {!readOnly && isAdmin && (
          <FormModalButton
            title={t('documentsModule.addNew')}
            fields={docFields}
            onSubmit={attachDoc}
            submitLabel={t('common.create')}
          />
        )}
      </div>
      <DataTable
        columns={[
          { key: 'title', header: t('common.title'), render: (r) => <span className="font-medium">{String(r.title)}</span> },
          { key: 'category', header: t('documentsModule.category'), render: (r) => <StatusBadge value={String(r.category)} /> },
          { key: 'fileName', header: t('fields.fileName'), hideOnMobile: true },
          { key: 'uploadedBy', header: t('fields.uploadedBy'), hideOnMobile: true, render: (r) => (r.uploadedBy as { name?: string } | null)?.name || '—' },
          { key: 'createdAt', header: t('common.createdAt'), render: (r) => formatDate(String(r.createdAt)) },
          { key: 'actions', header: t('common.actions'), render: (r) => (
            <div className="flex items-center gap-1">
              {isAdmin && (
                <RowActionsMenu onDelete={() => setDeleting(r as Record<string, unknown>)} />
              )}
            </div>
          ) },
        ]}
        rows={rows}
        loading={isLoading}
        rowKey={(r) => String(r.id)}
        paginated={false}
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


const DOC_CAT_OPTIONS = DOC_CATEGORIES
const DOC_ACCESS_OPTIONS = DOC_ACCESS
function FormModalButton({ title, fields, onSubmit, submitLabel }: {
  title: string
  fields: { name: string; label: string; type: 'text' | 'select' | 'date' | 'upload'; options?: { value: string; label: string }[]; required?: boolean; full?: boolean; hint?: string }[]
  onSubmit: (values: Record<string, unknown>) => Promise<void>
  submitLabel: string
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size="sm" className="gold-cta h-8" onClick={() => setOpen(true)}>
        <Plus className="mr-1 h-3.5 w-3.5" /> {title}
      </Button>
      <FormModal
        open={open}
        onOpenChange={setOpen}
        title={title}
        fields={fields}
        onSubmit={onSubmit}
        submitLabel={submitLabel}
      />
    </>
  )
}

// ============ History tab ============

function StaffHistoryTab({ staffId }: { staffId: string }) {
  const { t, formatDate } = useI18n()
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['staff-history', staffId, page],
    queryFn: () => apiQuery<Record<string, unknown>[]>(`/api/staff/${staffId}/history${qs({ page, pageSize: 20 })}`),
  })
  const rows = data?.data ?? []
  const total = data?.meta?.total ?? 0

  const parseChanged = (v: unknown): string[] => {
    try { return JSON.parse(String(v || '[]')) } catch { return [] }
  }

  return (
    <div className="space-y-3">
      <h4 className="flex items-center gap-2 text-sm font-semibold"><History className="h-4 w-4 text-primary" />{t('staff.tabHistory')}</h4>
      <DataTable
        columns={[
          { key: 'createdAt', header: t('fields.timestamp'), render: (r) => formatDate(String(r.createdAt), { hour: '2-digit', minute: '2-digit' }) },
          { key: 'action', header: t('fields.action'), render: (r) => <StatusBadge value={String(r.action)} /> },
          { key: 'module', header: t('fields.module') },
          { key: 'userName', header: t('fields.userName'), hideOnMobile: true },
          { key: 'changedFields', header: t('fields.changedFields'), hideOnMobile: true, render: (r) => parseChanged(r.changedFields).join(', ') || '—' },
        ]}
        rows={rows}
        loading={isLoading}
        page={page}
        pageSize={20}
        total={total}
        onPageChange={setPage}
        rowKey={(r) => String(r.id)}
      />
    </div>
  )
}

// ============ Print sheet ============

function PrintSheet({ staff, onClose }: { staff: StaffDetail; onClose: () => void }) {
  const { t, formatDate } = useI18n()
  const currentPos = staff.positions.find((p) => p.isCurrent)
  const currentRank = staff.ranks.find((r) => r.isCurrent)

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4 print:bg-white print:p-0" role="dialog" aria-modal>
      <div className="print-sheet mx-auto max-w-3xl rounded-2xl bg-white p-8 text-black shadow-2xl print:shadow-none">
        <div className="flex items-center justify-between border-b-2 border-[#C9A227] pb-4">
          <div>
            <h1 className="text-xl font-bold">{t('staff.personnelSheetTitle')}</h1>
            <p className="text-xs text-gray-500">{t('staff.personnelSheetGenerated')} {formatDate(new Date())}</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">{staff.nameEn}</p>
            <p className="text-gray-500">{staff.staffNo}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          {[
            [t('staff.nameEn'), staff.nameEn], [t('staff.nameMm'), staff.nameMm || '—'],
            [t('staff.staffNo'), staff.staffNo], [t('staff.nrcNo'), staff.nrcNo || '—'],
            [t('staff.gender'), t(`enums.${staff.gender}`)], [t('staff.dateOfBirth'), formatDate(staff.dateOfBirth)],
            [t('staff.placeOfBirth'), staff.placeOfBirth || '—'], [t('staff.nationality'), staff.nationality || '—'],
            [t('staff.religion'), staff.religion || '—'], [t('staff.maritalStatus'), staff.maritalStatus ? t(`enums.${staff.maritalStatus}`) : '—'],
            [t('staff.phone'), staff.phone || '—'], [t('staff.email'), staff.email || '—'],
            [t('staff.joinDate'), formatDate(staff.joinDate)], [t('staff.status'), t(`enums.${staff.status}`)],
            [t('staff.currentPosition'), currentPos?.position?.name || '—'], [t('staff.currentRank'), currentRank?.rank?.name || '—'],
            [t('staff.currentDepartment'), currentPos?.department?.name || '—'],
          ].map(([label, value], i) => (
            <div key={i} className="border-b border-gray-200 py-1.5">
              <span className="text-xs text-gray-500">{label}: </span>
              <span className="font-medium">{String(value ?? '—')}</span>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <h2 className="mb-2 border-b border-gray-300 pb-1 text-sm font-bold">{t('serviceHistoryModule.title')}</h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-300 text-left text-gray-500">
                <th className="py-1.5">{t('fields.fromDate')}</th>
                <th className="py-1.5">{t('common.title')}</th>
                <th className="py-1.5">{t('common.type')}</th>
                <th className="py-1.5">{t('fields.department')}</th>
                <th className="py-1.5">{t('fields.rank')}</th>
              </tr>
            </thead>
            <tbody>
              {staff.serviceHistory.map((h) => (
                <tr key={h.id} className="border-b border-gray-100">
                  <td className="py-1.5">{formatDate(h.fromDate)}</td>
                  <td className="py-1.5">{h.title}</td>
                  <td className="py-1.5">{t(`enums.${h.type}`)}</td>
                  <td className="py-1.5">{h.department?.name || '—'}</td>
                  <td className="py-1.5">{h.rank?.name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex justify-end gap-2 no-print">
          <Button variant="outline" onClick={onClose} className="border-gray-300">{t('common.close')}</Button>
          <Button className="gold-cta" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />{t('common.print')}</Button>
        </div>
      </div>
    </div>
  )
}
