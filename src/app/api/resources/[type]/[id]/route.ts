import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, errors, zodFail, requireAuth, requirePerm, logAudit } from '@/lib/api'
import { PERMISSIONS, can } from '@/lib/permissions'
import { getResource, getDelegate, buildInclude, MASTER_USAGE } from '@/lib/resources'

type Params = { params: Promise<{ type: string; id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req)
  if ('response' in auth) return auth.response
  const { session } = auth
  const { type, id } = await params
  const def = getResource(type)
  if (!def) return errors.notFound('Resource')

  if (type === 'criminal' && !can(session.role, PERMISSIONS.CRIMINAL_VIEW)) return errors.forbidden()

  const delegate = getDelegate(def)
  const row = await delegate.findUnique({ where: { id } })
  if (!row) return errors.notFound('Record')

  if (def.staffScoped && session.role === 'USER' && row.staffId !== session.staffId) {
    return errors.forbidden()
  }

  if (def.sensitive) {
    await logAudit({
      user: session, action: 'VIEW', module: def.module, entityType: def.entityType, entityId: id,
      after: { id, staffId: row.staffId }, request: req,
    })
  }

  const include = buildInclude(def, false)
  const full = include ? await delegate.findUnique({ where: { id }, include }) : row
  return ok(full)
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { type, id } = await params
  const def = getResource(type)
  if (!def) return errors.notFound('Resource')
  const auth = await requirePerm(req, def.writePerm)
  if ('response' in auth) return auth.response
  const { session } = auth

  const delegate = getDelegate(def)
  const existing = await delegate.findUnique({ where: { id } })
  if (!existing) return errors.notFound('Record')

  const body = await req.json().catch(() => null)
  const partial = (def.schema as any).partial()
  const parsed = partial.safeParse(body)
  if (!parsed.success) return zodFail(parsed.error)
  const data: any = { ...(parsed.data as any) }
  delete data.staffId // staff link is immutable

  try {
    const row = await delegate.update({ where: { id }, data })

    // ---- Behavioral automation: promotion approval ----
    if (type === 'promotions' && data.status && ['APPROVED', 'EFFECTIVE'].includes(data.status) && existing.status !== data.status) {
      await applyPromotionEffects(row)
    }
    // ---- Transfer approval ----
    if (type === 'transfers' && data.status && ['APPROVED', 'EFFECTIVE'].includes(data.status) && existing.status !== data.status) {
      await applyTransferEffects(row)
    }

    await logAudit({
      user: session, action: 'UPDATE', module: def.module, entityType: def.entityType, entityId: id,
      staffId: def.staffScoped ? ((row as any).staffId ?? (existing as any).staffId ?? null) : null,
      before: existing as Record<string, unknown>, after: row as Record<string, unknown>, request: req,
    })

    const include = buildInclude(def, true)
    const full = include ? await delegate.findUnique({ where: { id }, include }) : row
    return ok(full)
  } catch (err) {
    console.error(`[resources:${type}:update]`, err)
    return errors.conflict('Update failed. Please check the values and try again.')
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { type, id } = await params
  const def = getResource(type)
  if (!def) return errors.notFound('Resource')
  const auth = await requirePerm(req, def.writePerm)
  if ('response' in auth) return auth.response
  const { session } = auth

  const delegate = getDelegate(def)
  const existing = await delegate.findUnique({ where: { id } })
  if (!existing) return errors.notFound('Record')

  // Master data: block delete when referenced by staff records
  const usage = MASTER_USAGE[type]
  if (usage) {
    for (const u of usage) {
      const count = await (db as any)[u.model].count({ where: { [u.relation]: id } })
      if (count > 0) {
        return errors.conflict(`Cannot delete: this record is referenced by ${count} ${u.label}. Reassign or remove them first.`)
      }
    }
  }

  try {
    if (usage) {
      // master table → soft delete
      const row = await delegate.update({ where: { id }, data: { deletedAt: new Date() } })
      await logAudit({
        user: session, action: 'DELETE', module: def.module, entityType: def.entityType, entityId: id,
        staffId: (existing as any).staffId ?? null,
        before: existing as Record<string, unknown>, after: { deletedAt: row.deletedAt?.toISOString?.() }, request: req,
      })
    } else {
      await delegate.delete({ where: { id } })
      await logAudit({
        user: session, action: 'DELETE', module: def.module, entityType: def.entityType, entityId: id,
        staffId: (existing as any).staffId ?? null,
        before: existing as Record<string, unknown>, after: null, request: req,
      })
    }
    return ok({ deleted: true })
  } catch (err) {
    console.error(`[resources:${type}:delete]`, err)
    return errors.conflict('Delete failed. The record may be referenced elsewhere.')
  }
}

async function applyPromotionEffects(row: any) {
  if (!row.staffId) return
  const rank = await db.rank.findUnique({ where: { id: row.toRankId } })
  await db.staffRank.updateMany({ where: { staffId: row.staffId, isCurrent: true }, data: { isCurrent: false, endDate: row.effectiveDate } })
  await db.staffRank.create({
    data: {
      staffId: row.staffId, rankId: row.toRankId, effectiveDate: row.effectiveDate,
      appointedDate: row.appliedDate ?? row.effectiveDate, isCurrent: true, remarks: `Promotion (${row.authority ?? 'HR'})`,
    },
  }).catch(() => null)
  const currentPos = await db.staffPosition.findFirst({ where: { staffId: row.staffId, isCurrent: true } })
  await db.staffServiceHistory.create({
    data: {
      staffId: row.staffId, type: 'PROMOTION',
      title: `Promoted to ${rank?.name ?? 'new rank'}`,
      fromDate: row.effectiveDate, rankId: row.toRankId,
      departmentId: currentPos?.departmentId ?? null, positionId: currentPos?.positionId ?? null,
      remarks: row.remarks ?? null, orderNo: 50,
    },
  }).catch(() => null)
}

async function applyTransferEffects(row: any) {
  if (!row.staffId) return
  const dept = await db.department.findUnique({ where: { id: row.toDepartmentId } })
  await db.staffPosition.updateMany({ where: { staffId: row.staffId, isCurrent: true }, data: { isCurrent: false, endDate: row.transferDate } })
  const positionId = row.toPositionId || (await db.staffPosition.findFirst({ where: { staffId: row.staffId }, orderBy: { startDate: 'desc' } }))?.positionId
  if (positionId) {
    await db.staffPosition.create({
      data: {
        staffId: row.staffId, positionId, departmentId: row.toDepartmentId,
        startDate: row.transferDate, isCurrent: true, remarks: `Transfer (${row.reason ?? ''})`.trim(),
      },
    }).catch(() => null)
  }
  await db.staffServiceHistory.create({
    data: {
      staffId: row.staffId, type: 'TRANSFER',
      title: `Transferred to ${dept?.name ?? 'new department'}`,
      fromDate: row.transferDate, departmentId: row.toDepartmentId, positionId: positionId ?? null,
      remarks: row.reason ?? null, orderNo: 40,
    },
  }).catch(() => null)
}
