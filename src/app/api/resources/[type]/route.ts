import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, errors, zodFail, requireAuth, requirePerm, parseQuery, logAudit } from '@/lib/api'
import { PERMISSIONS, can } from '@/lib/permissions'
import { getResource, getDelegate, buildInclude, type ResourceDef } from '@/lib/resources'

type Params = { params: Promise<{ type: string }> }

function safeFilterValue(def: ResourceDef, key: string, value: string): unknown {
  const shape = (def.schema as any).shape as Record<string, any>
  const field = shape[key]
  if (!field) return undefined
  // boolean coercion
  if (value === 'true' || value === 'false') {
    const isBoolish = field?._def?.typeName === 'ZodBoolean' || field?._def?.innerType?.typeName === 'ZodBoolean'
    if (isBoolish) return value === 'true'
  }
  return value
}

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req)
  if ('response' in auth) return auth.response
  const { session } = auth
  const { type } = await params
  const def = getResource(type)
  if (!def) return errors.notFound('Resource')

  // Criminal records: strict permission
  if (type === 'criminal' && !can(session.role, PERMISSIONS.CRIMINAL_VIEW)) return errors.forbidden()

  const { page, pageSize, search, sortBy, sortDir, filters } = parseQuery(req)
  const sp = req.nextUrl.searchParams
  const staffId = sp.get('staffId')
  const caseId = sp.get('caseId')

  const where: any = {}

  if (def.staffScoped) {
    if (session.role === 'USER') {
      if (!session.staffId) return ok([], { page, pageSize, total: 0 })
      where.staffId = session.staffId
    } else if (staffId) {
      where.staffId = staffId
    }
  } else if (session.role === 'USER') {
    // USER cannot browse master data lists
    return errors.forbidden()
  }
  if (def.caseScoped && caseId) where.caseId = caseId
  if (!def.staffScoped && !def.caseScoped) where.deletedAt = null

  if (search) {
    const or: any[] = (def.searchFields || []).map((f) => ({ [f]: { contains: search } }))
    if (def.staffScoped) {
      or.push({ staff: { OR: [{ nameEn: { contains: search } }, { nameMm: { contains: search } }, { staffNo: { contains: search } }] } })
    }
    if (or.length) where.OR = or
  }
  for (const [key, value] of Object.entries(filters)) {
    const v = safeFilterValue(def, key, value)
    if (v !== undefined) where[key] = v
  }

  const delegate = getDelegate(def)
  const sortField: string = (sortBy && ((def.schema as any).shape?.[sortBy] || ['staffId', 'caseId'].includes(sortBy)) ? sortBy : def.defaultSort?.field) || 'createdAt'
  const dir = sortDir || def.defaultSort?.dir || 'desc'
  const orderBy: any = { [sortField]: dir }

  const include = buildInclude(def, true)

  const [total, rows] = await Promise.all([
    delegate.count({ where }),
    delegate.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize, ...(include ? { include } : {}) }),
  ])

  // Sensitive modules: VIEW is audited
  if (def.sensitive && rows.length > 0) {
    await logAudit({
      user: session, action: 'VIEW', module: def.module, entityType: def.entityType,
      entityId: staffId || null, staffId: staffId || null, after: { count: rows.length, staffId }, request: req,
    })
  }

  return ok(rows, { page, pageSize, total })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { type } = await params
  const def = getResource(type)
  if (!def) return errors.notFound('Resource')
  const auth = await requirePerm(req, def.writePerm)
  if ('response' in auth) return auth.response
  const { session } = auth

  const body = await req.json().catch(() => null)
  const parsed = def.schema.safeParse(body)
  if (!parsed.success) return zodFail(parsed.error)
  const data: any = { ...(parsed.data as any) }
  if (def.staffScoped) {
    const staffId = body?.staffId
    if (!staffId) return errors.validation([{ path: ['staffId'], message: 'staffId is required' }])
    const staff = await db.staff.findFirst({ where: { id: staffId, deletedAt: null } })
    if (!staff) return errors.notFound('Staff')
    data.staffId = staffId
  }

  try {
    const delegate = getDelegate(def)
    const row = await delegate.create({ data })

    // ---- Behavioral automation ----
    if (type === 'separations' && row.staffId) {
      await applySeparationEffects(row)
    }

    await logAudit({
      user: session, action: 'CREATE', module: def.module, entityType: def.entityType, entityId: row.id,
      staffId: def.staffScoped ? (row.staffId ?? null) : null,
      after: row as Record<string, unknown>, request: req,
    })
    const include = buildInclude(def, true)
    const full = include ? await delegate.findUnique({ where: { id: row.id }, include }) : row
    return ok(full)
  } catch (err) {
    console.error(`[resources:${type}:create]`, err)
    return errors.conflict('Failed to create record. Please check the values and try again.')
  }
}

// ---- Movement side effects ----

const SEPARATION_STATUS_MAP: Record<string, string> = {
  RETIREMENT: 'RETIRED', RESIGNATION: 'RESIGNED', TERMINATION: 'OTHER',
  TRANSFER_OUT: 'TRANSFERRED', DEATH: 'DECEASED', OTHER: 'OTHER',
}

export async function applySeparationEffects(row: any) {
  const newStatus = SEPARATION_STATUS_MAP[row.type] || 'OTHER'
  await db.staff.update({ where: { id: row.staffId }, data: { status: newStatus } })
  // close current position & rank
  await db.staffPosition.updateMany({ where: { staffId: row.staffId, isCurrent: true }, data: { isCurrent: false, endDate: row.effectiveDate } })
  await db.staffRank.updateMany({ where: { staffId: row.staffId, isCurrent: true }, data: { isCurrent: false, endDate: row.effectiveDate } })
  await db.staffServiceHistory.create({
    data: {
      staffId: row.staffId, type: row.type === 'RETIREMENT' ? 'RETIREMENT' : row.type === 'RESIGNATION' ? 'RESIGNATION' : 'OTHER',
      title: `Separation: ${row.type}`, fromDate: row.effectiveDate,
      rankId: row.finalRankId ?? null, positionId: row.finalPositionId ?? null,
      remarks: row.reason ?? null, orderNo: 99,
    },
  }).catch(() => null)
}
