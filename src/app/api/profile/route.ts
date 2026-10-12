import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { ok, errors, zodFail, requireAuth, logAudit } from '@/lib/api'
import { hashPassword } from '@/lib/auth'

const profileSchema = z.object({
  name: z.string().trim().min(1).optional(),
  avatarUrl: z.string().trim().nullable().optional(),
  preferredLocale: z.enum(['en', 'mm']).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
})

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('response' in auth) return auth.response
  const { session } = auth

  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: { role: true, staff: { select: { id: true, staffNo: true, nameEn: true, nameMm: true, photoUrl: true, status: true } } },
  })
  if (!user) return errors.notFound('User')

  const loginHistory = await db.auditLog.findMany({
    where: { userId: user.id, action: { in: ['LOGIN', 'LOGIN_FAILED', 'LOGOUT'] } },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, action: true, ipAddress: true, createdAt: true },
  })

  return ok({
    id: user.id, email: user.email, name: user.name, role: user.role.name,
    avatarUrl: user.avatarUrl, preferredLocale: user.preferredLocale, theme: user.theme,
    lastLoginAt: user.lastLoginAt, createdAt: user.createdAt,
    staff: user.staff, loginHistory,
  })
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('response' in auth) return auth.response
  const { session } = auth

  const body = await req.json().catch(() => null)
  const parsed = profileSchema.safeParse(body)
  if (!parsed.success) return zodFail(parsed.error)
  const data = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined))

  const before = await db.user.findUnique({ where: { id: session.userId } })
  const updated = await db.user.update({ where: { id: session.userId }, data })

  await logAudit({
    user: session, action: 'UPDATE', module: 'profile', entityType: 'User', entityId: session.userId,
    before: { name: before?.name, avatarUrl: before?.avatarUrl, preferredLocale: before?.preferredLocale, theme: before?.theme },
    after: { name: updated.name, avatarUrl: updated.avatarUrl, preferredLocale: updated.preferredLocale, theme: updated.theme },
    request: req,
  })
  return ok({ name: updated.name, avatarUrl: updated.avatarUrl, preferredLocale: updated.preferredLocale, theme: updated.theme })
}
