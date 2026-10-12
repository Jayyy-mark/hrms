import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { ok, errors, zodFail, requirePerm, logAudit } from '@/lib/api'
import { PERMISSIONS } from '@/lib/permissions'
import { hashPassword } from '@/lib/auth'
import { ROLES } from '@/lib/constants'

type Params = { params: Promise<{ id: string }> }

const updateSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().trim().min(1).optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional().or(z.literal('')),
  role: z.enum(ROLES).optional(),
  staffId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requirePerm(req, PERMISSIONS.USERS_MANAGE)
  if ('response' in auth) return auth.response
  const { session } = auth
  const { id } = await params

  const existing = await db.user.findUnique({ where: { id }, include: { role: true } })
  if (!existing) return errors.notFound('User')

  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return zodFail(parsed.error)
  const { email, name, password, role, staffId, isActive } = parsed.data

  const data: Record<string, unknown> = {}
  if (email && email.toLowerCase() !== existing.email) {
    const dup = await db.user.findUnique({ where: { email: email.toLowerCase() } })
    if (dup) return errors.conflict('A user with this email already exists')
    data.email = email.toLowerCase()
  }
  if (name) data.name = name
  if (password) data.passwordHash = await hashPassword(password)
  if (role && role !== existing.role.name) {
    const roleRow = await db.role.findUnique({ where: { name: role } })
    if (!roleRow) return errors.notFound('Role')
    data.roleId = roleRow.id
  }
  if (isActive !== undefined) data.isActive = isActive
  if (staffId !== undefined && staffId !== existing.staffId) {
    if (staffId) {
      const staff = await db.staff.findFirst({ where: { id: staffId, deletedAt: null } })
      if (!staff) return errors.notFound('Staff')
      const linked = await db.user.findFirst({ where: { staffId, NOT: { id } } })
      if (linked) return errors.conflict('This staff record is already linked to another user')
    }
    data.staffId = staffId
  }

  // Safety: cannot deactivate/demote the last superadmin
  if (existing.role.name === 'SUPERADMIN' && ((isActive === false) || (role && role !== 'SUPERADMIN'))) {
    const superadmins = await db.user.count({ where: { role: { name: 'SUPERADMIN' }, isActive: true } })
    if (superadmins <= 1) return errors.conflict('Cannot modify the last active superadmin')
  }

  const updated = await db.user.update({ where: { id }, data, include: { role: true, staff: { select: { id: true, staffNo: true, nameEn: true } } } })
  await logAudit({
    user: session, action: 'UPDATE', module: 'admin.users', entityType: 'User', entityId: id,
    before: { email: existing.email, name: existing.name, role: existing.role.name, isActive: existing.isActive, staffId: existing.staffId },
    after: { email: updated.email, name: updated.name, role: updated.role.name, isActive: updated.isActive, staffId: updated.staffId },
    request: req,
  })
  return ok({ id: updated.id, email: updated.email, name: updated.name, role: updated.role.name, isActive: updated.isActive, staffId: updated.staffId, staff: updated.staff })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requirePerm(req, PERMISSIONS.USERS_MANAGE)
  if ('response' in auth) return auth.response
  const { session } = auth
  const { id } = await params

  const existing = await db.user.findUnique({ where: { id }, include: { role: true } })
  if (!existing) return errors.notFound('User')
  if (existing.id === session.userId) return errors.conflict('You cannot delete your own account')
  if (existing.role.name === 'SUPERADMIN') {
    const superadmins = await db.user.count({ where: { role: { name: 'SUPERADMIN' }, isActive: true } })
    if (superadmins <= 1) return errors.conflict('Cannot delete the last superadmin')
  }

  await db.user.delete({ where: { id } })
  await logAudit({
    user: session, action: 'DELETE', module: 'admin.users', entityType: 'User', entityId: id,
    before: { email: existing.email, name: existing.name, role: existing.role.name }, after: null, request: req,
  })
  return ok({ deleted: true })
}
