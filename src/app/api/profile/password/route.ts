import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { ok, errors, zodFail, requireAuth, logAudit } from '@/lib/api'
import { hashPassword, verifyPassword } from '@/lib/auth'

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
})

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('response' in auth) return auth.response
  const { session } = auth

  const body = await req.json().catch(() => null)
  const parsed = passwordSchema.safeParse(body)
  if (!parsed.success) return zodFail(parsed.error)

  const user = await db.user.findUnique({ where: { id: session.userId } })
  if (!user) return errors.notFound('User')

  const valid = await verifyPassword(parsed.data.currentPassword, user.passwordHash)
  if (!valid) return errors.forbidden()

  await db.user.update({ where: { id: session.userId }, data: { passwordHash: await hashPassword(parsed.data.newPassword) } })
  await logAudit({
    user: session, action: 'UPDATE', module: 'profile', entityType: 'User', entityId: session.userId,
    after: { passwordChanged: true }, request: req,
  })
  return ok({ changed: true })
}
