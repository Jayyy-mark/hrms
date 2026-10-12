import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { verifyPassword, createSessionToken, sessionCookieOptions, checkRateLimit, clearRateLimit } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { ok, fail } from '@/lib/api'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!checkRateLimit(ip)) {
      return fail('RATE_LIMITED', 'Too many attempts. Please try again in a minute.', 429)
    }

    const body = await req.json().catch(() => null)
    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) {
      return fail('INVALID_CREDENTIALS', 'Invalid email or password', 401)
    }

    const { email, password } = parsed.data
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { role: true, staff: { select: { id: true, deletedAt: true } } },
    })

    if (!user || !user.isActive || !user.role) {
      await logAudit({ action: 'LOGIN_FAILED', module: 'auth', entityType: 'User', entityId: user?.id ?? email, after: { email }, request: req })
      return fail('INVALID_CREDENTIALS', 'Invalid email or password', 401)
    }

    const valid = await verifyPassword(password, user.passwordHash)
    if (!valid) {
      await logAudit({ action: 'LOGIN_FAILED', module: 'auth', entityType: 'User', entityId: user.id, after: { email }, request: req })
      return fail('INVALID_CREDENTIALS', 'Invalid email or password', 401)
    }

    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
    const token = await createSessionToken({ userId: user.id, email: user.email })
    const res = ok({
      user: {
        id: user.id, email: user.email, name: user.name, role: user.role.name,
        staffId: user.staffId, avatarUrl: user.avatarUrl, preferredLocale: user.preferredLocale, theme: user.theme,
      },
    })
    res.cookies.set({ ...sessionCookieOptions(), value: token })
    clearRateLimit(ip)
    await logAudit({
      user: { userId: user.id, email: user.email, name: user.name, role: user.role.name, staffId: user.staffId },
      action: 'LOGIN', module: 'auth', entityType: 'User', entityId: user.id,
      after: { email: user.email, lastLoginAt: new Date().toISOString() }, request: req,
    })
    return res as NextResponse
  } catch (err) {
    console.error('[login]', err)
    return fail('INTERNAL', 'Something went wrong. Please try again.', 500)
  }
}
