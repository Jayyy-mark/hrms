import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, errors, zodFail, requirePerm, requireAuth, logAudit } from '@/lib/api'
import { PERMISSIONS, can } from '@/lib/permissions'
import { STAFF_SCHEMA } from '@/lib/resources'

type Params = { params: Promise<{ id: string }> }

const DETAIL_INCLUDE = {
  addresses: { orderBy: { createdAt: 'asc' as const } },
  familyMembers: { orderBy: { createdAt: 'asc' as const } },
  educations: { orderBy: { graduationYear: 'desc' as const } },
  languages: true,
  skills: true,
  closeContacts: true,
  references: true,
  positions: { orderBy: { startDate: 'desc' as const }, include: { position: { include: { department: true } }, department: true } },
  ranks: { orderBy: { effectiveDate: 'desc' as const }, include: { rank: true } },
  serviceHistory: { orderBy: { fromDate: 'asc' as const }, include: { department: true, position: true, rank: true } },
  promotions: { orderBy: { effectiveDate: 'desc' as const }, include: { fromRank: true, toRank: true } },
  transfers: { orderBy: { transferDate: 'desc' as const }, include: { fromDepartment: true, toDepartment: true, fromPosition: true, toPosition: true } },
  separations: { orderBy: { effectiveDate: 'desc' as const }, include: { finalRank: true, finalPosition: true } },
  awards: { orderBy: { awardedDate: 'desc' as const }, include: { award: true } },
  trainings: { orderBy: { startDate: 'desc' as const }, include: { training: true } },
  militaryServices: true,
  activities: { orderBy: { date: 'desc' as const } },
  hobbies: true,
  politicalMemberships: { include: { party: true } },
  conflictAssignments: { orderBy: { deploymentDate: 'desc' as const }, include: { conflictArea: true } },
  disciplinaryCases: { orderBy: { dateOpened: 'desc' as const }, include: { actions: { orderBy: { actionDate: 'asc' as const } } } },
  foreignTravels: { orderBy: { startDate: 'desc' as const } },
  user: { select: { id: true, email: true, name: true } },
}

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req)
  if ('response' in auth) return auth.response
  const { session } = auth
  const { id } = await params

  if (session.role === 'USER' && session.staffId !== id) {
    return errors.forbidden()
  }

  const staff = await db.staff.findUnique({ where: { id }, include: DETAIL_INCLUDE })
  if (!staff || staff.deletedAt) return errors.notFound('Staff')

  // Criminal records: permission-gated, and VIEW is itself audited
  let criminalRecords: unknown[] = []
  if (can(session.role, PERMISSIONS.CRIMINAL_VIEW)) {
    criminalRecords = await db.criminalRecord.findMany({ where: { staffId: id }, orderBy: { createdAt: 'desc' } })
    if (criminalRecords.length > 0) {
      await logAudit({
        user: session, action: 'VIEW', module: 'background.criminal', entityType: 'CriminalRecord',
        entityId: id, after: { count: criminalRecords.length, staffId: id }, request: req,
      })
    }
  }

  return ok({ ...staff, criminalRecords })
}

export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requirePerm(req, PERMISSIONS.STAFF_UPDATE)
  if ('response' in auth) return auth.response
  const { session } = auth
  const { id } = await params

  const existing = await db.staff.findUnique({ where: { id } })
  if (!existing || existing.deletedAt) return errors.notFound('Staff')

  const body = await req.json().catch(() => null)
  const parsed = STAFF_SCHEMA.partial().safeParse(body)
  if (!parsed.success) return zodFail(parsed.error)

  try {
    const updated = await db.staff.update({ where: { id }, data: parsed.data })
    await logAudit({
      user: session, action: 'UPDATE', module: 'staff', entityType: 'Staff', entityId: id,
      before: existing as unknown as Record<string, unknown>,
      after: updated as unknown as Record<string, unknown>, request: req,
    })
    return ok(updated)
  } catch (err) {
    console.error('[staff:update]', err)
    return errors.conflict('Update failed. Staff number or NRC may already be in use.')
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req)
  if ('response' in auth) return auth.response
  const { session } = auth
  const { id } = await params
  const hard = req.nextUrl.searchParams.get('hard') === 'true'

  const existing = await db.staff.findUnique({ where: { id } })
  if (!existing || (existing.deletedAt && !hard)) return errors.notFound('Staff')

  if (hard) {
    if (!can(session.role, PERMISSIONS.STAFF_DELETE_HARD)) return errors.forbidden()
    await db.staff.delete({ where: { id } })
    await logAudit({
      user: session, action: 'DELETE', module: 'staff', entityType: 'Staff', entityId: id,
      before: existing as unknown as Record<string, unknown>, after: null, request: req,
    })
    return ok({ deleted: true, hard: true })
  } else {
    if (!can(session.role, PERMISSIONS.STAFF_DELETE_SOFT)) return errors.forbidden()
    const updated = await db.staff.update({ where: { id }, data: { deletedAt: new Date() } })
    await logAudit({
      user: session, action: 'DELETE', module: 'staff', entityType: 'Staff', entityId: id,
      before: existing as unknown as Record<string, unknown>,
      after: { deletedAt: updated.deletedAt?.toISOString() }, request: req,
    })
    return ok({ deleted: true, hard: false })
  }
}
