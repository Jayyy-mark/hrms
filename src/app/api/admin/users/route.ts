import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { ok, errors, zodFail, requirePerm, parseQuery, logAudit } from '@/lib/api'
import { PERMISSIONS } from '@/lib/permissions'
import { hashPassword } from '@/lib/auth'
import { ROLES } from '@/lib/constants'

const userSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(1),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(ROLES),
  staffId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

export async function GET(req: NextRequest) {
  const auth = await requirePerm(req, PERMISSIONS.USERS_MANAGE)
  if ('response' in auth) return auth.response
  const { page, pageSize, search, filters } = parseQuery(req)

  const where: Record<string, unknown> = {}
  if (search) where.OR = [{ email: { contains: search } }, { name: { contains: search } }]
  if (filters.role) where.role = { name: filters.role }
  if (filters.status) where.isActive = filters.status === 'true'

  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        role: true,
        staff: { select: { id: true, staffNo: true, nameEn: true } },
      },
    }),
  ])

  const data = users.map((u) => ({
    id: u.id, email: u.email, name: u.name, role: u.role.name, isActive: u.isActive,
    staffId: u.staffId, staff: u.staff, avatarUrl: u.avatarUrl,
    preferredLocale: u.preferredLocale, lastLoginAt: u.lastLoginAt, createdAt: u.createdAt,
  }))
  return ok(data, { page, pageSize, total })
}

export async function POST(req: NextRequest) {
  const auth = await requirePerm(req, PERMISSIONS.USERS_MANAGE)
  if ('response' in auth) return auth.response
  const { session } = auth

  const body = await req.json().catch(() => null)
  const parsed = userSchema.safeParse(body)
  if (!parsed.success) return zodFail(parsed.error)
  const { email, name, password, role, staffId } = parsed.data

  const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } })
  if (existing) return errors.conflict('A user with this email already exists')

  const roleRow = await db.role.findUnique({ where: { name: role } })
  if (!roleRow) return errors.notFound('Role')

  if (staffId) {
    const staff = await db.staff.findFirst({ where: { id: staffId, deletedAt: null } })
    if (!staff) return errors.notFound('Staff')
    const linked = await db.user.findFirst({ where: { staffId } })
    if (linked) return errors.conflict('This staff record is already linked to another user')
  }

  const user = await db.user.create({
    data: {
      email: email.toLowerCase(), name, passwordHash: await hashPassword(password),
      roleId: roleRow.id, staffId: staffId || null, isActive: true,
    },
    include: { role: true, staff: { select: { id: true, staffNo: true, nameEn: true } } },
  })

  await logAudit({
    user: session, action: 'CREATE', module: 'admin.users', entityType: 'User', entityId: user.id,
    after: { email: user.email, name: user.name, role: user.role.name, staffId: user.staffId }, request: req,
  })
  return ok({ id: user.id, email: user.email, name: user.name, role: user.role.name, isActive: user.isActive, staffId: user.staffId, staff: user.staff })
}
