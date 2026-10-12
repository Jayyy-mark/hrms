import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { ok, errors, zodFail, requirePerm, requireAuth, parseQuery, logAudit } from '@/lib/api'
import { PERMISSIONS } from '@/lib/permissions'
import { STAFF_SCHEMA } from '@/lib/resources'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('response' in auth) return auth.response
  const { session } = auth
  const { page, pageSize, search, sortBy, sortDir, filters } = parseQuery(req)

  const where: Prisma.StaffWhereInput = { deletedAt: null }

  // USER role: only own record
  if (session.role === 'USER') {
    where.id = session.staffId ?? '__none__'
  }
  if (search) {
    where.OR = [
      { nameEn: { contains: search } },
      { nameMm: { contains: search } },
      { staffNo: { contains: search } },
      { nrcNo: { contains: search } },
      { phone: { contains: search } },
      { email: { contains: search } },
    ]
  }
  if (filters.status) where.status = filters.status
  if (filters.gender) where.gender = filters.gender
  if (filters.departmentId) {
    where.positions = { some: { isCurrent: true, OR: [{ departmentId: filters.departmentId }, { position: { departmentId: filters.departmentId } }] } }
  }
  if (filters.rankId) where.ranks = { some: { isCurrent: true, rankId: filters.rankId } }

  const orderBy: Prisma.StaffOrderByWithRelationInput = (() => {
    const dir = (sortDir || 'desc') as Prisma.SortOrder
    switch (sortBy) {
      case 'name': return { nameEn: (sortDir || 'asc') as Prisma.SortOrder }
      case 'staffNo': return { staffNo: (sortDir || 'asc') as Prisma.SortOrder }
      case 'joinDate': return { joinDate: dir }
      case 'status': return { status: (sortDir || 'asc') as Prisma.SortOrder }
      default: return { createdAt: dir }
    }
  })()

  const [total, rows] = await Promise.all([
    db.staff.count({ where }),
    db.staff.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        ranks: { where: { isCurrent: true }, take: 1, orderBy: { effectiveDate: 'desc' }, include: { rank: true } },
        positions: { where: { isCurrent: true }, take: 1, orderBy: { startDate: 'desc' }, include: { position: { include: { department: true } }, department: true } },
      },
    }),
  ])

  const data = rows.map((s) => ({
    ...s,
    currentRank: s.ranks[0]?.rank ?? null,
    currentPosition: s.positions[0]?.position ?? null,
    currentDepartment: s.positions[0]?.department ?? s.positions[0]?.position?.department ?? null,
    ranks: undefined,
    positions: undefined,
  }))

  return ok(data, { page, pageSize, total })
}

export async function POST(req: NextRequest) {
  const auth = await requirePerm(req, PERMISSIONS.STAFF_CREATE)
  if ('response' in auth) return auth.response
  const { session } = auth

  const body = await req.json().catch(() => null)
  const parsed = STAFF_SCHEMA.safeParse(body)
  if (!parsed.success) return zodFail(parsed.error)
  const { positionId, departmentId, rankId, ...staffData } = body as Record<string, string>

  const dup = await db.staff.findFirst({
    where: { OR: [{ staffNo: staffData.staffNo }, ...(staffData.nrcNo ? [{ nrcNo: staffData.nrcNo }] : [])], deletedAt: null },
  })
  if (dup) return errors.conflict('A staff record with this staff number or NRC already exists')

  try {
    const staff = await db.staff.create({ data: staffData as unknown as Prisma.StaffUncheckedCreateInput })

    // Optional initial assignment
    if (positionId || departmentId || rankId) {
      const joinDate = staffData.joinDate ? new Date(staffData.joinDate) : new Date()
      if (positionId || departmentId) {
        await db.staffPosition.create({
          data: { staffId: staff.id, positionId: positionId || 'none', departmentId: departmentId || null, startDate: joinDate, isCurrent: true },
        }).catch(() => null)
      }
      if (rankId) {
        await db.staffRank.create({
          data: { staffId: staff.id, rankId, effectiveDate: joinDate, isCurrent: true },
        }).catch(() => null)
      }
      await db.staffServiceHistory.create({
        data: {
          staffId: staff.id, type: 'JOINING', title: 'Joined service', fromDate: joinDate,
          positionId: positionId || null, departmentId: departmentId || null, rankId: rankId || null, orderNo: 1,
        },
      }).catch(() => null)
    }

    await logAudit({
      user: session, action: 'CREATE', module: 'staff', entityType: 'Staff', entityId: staff.id,
      after: staff as unknown as Record<string, unknown>, request: req,
    })
    return ok(staff)
  } catch (err) {
    console.error('[staff:create]', err)
    return errors.conflict('Failed to create staff record. Staff number or NRC may already exist.')
  }
}
