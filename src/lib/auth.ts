import 'server-only'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { db } from './db'

const SESSION_COOKIE = 'moge_session'
const SESSION_SECRET = process.env.SESSION_SECRET || 'moge-hr-dev-secret-change-in-production'
const secretKey = new TextEncoder().encode(SESSION_SECRET)

export interface SessionUser {
  userId: string
  email: string
  name: string
  role: string
  staffId: string | null
  avatarUrl?: string | null
  preferredLocale?: string
  theme?: string
}

export async function hashPassword(password: string): Promise<string> {
  const bcrypt = (await import('bcryptjs')).default
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const bcrypt = (await import('bcryptjs')).default
  return bcrypt.compare(password, hash)
}

export async function createSessionToken(payload: { userId: string; email: string }): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secretKey)
}

export function sessionCookieOptions() {
  return {
    name: SESSION_COOKIE,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: false,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  }
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE

/** Read + verify session from a NextRequest (API routes) and load fresh user from DB. */
export async function getSession(req: NextRequest): Promise<SessionUser | null> {
  try {
    const token = req.cookies.get(SESSION_COOKIE)?.value
    if (!token) return null
    const { payload } = await jwtVerify(token, secretKey)
    const userId = payload.userId as string
    if (!userId) return null
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { role: true, staff: { select: { id: true, status: true, deletedAt: true } } },
    })
    if (!user || !user.isActive) return null
    if (user.staffId && user.staff?.status === 'OTHER' && user.staff?.deletedAt) return null
    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role?.name ?? 'USER',
      staffId: user.staffId,
      avatarUrl: user.avatarUrl,
      preferredLocale: user.preferredLocale,
      theme: user.theme,
    }
  } catch {
    return null
  }
}

/** Read session from server components (cookies()) */
export async function getSessionFromCookies(): Promise<SessionUser | null> {
  try {
    const store = await cookies()
    const token = store.get(SESSION_COOKIE)?.value
    if (!token) return null
    const { payload } = await jwtVerify(token, secretKey)
    const userId = payload.userId as string
    if (!userId) return null
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { role: true, staff: { select: { id: true, status: true, deletedAt: true } } },
    })
    if (!user || !user.isActive) return null
    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role?.name ?? 'USER',
      staffId: user.staffId,
      avatarUrl: user.avatarUrl,
      preferredLocale: user.preferredLocale,
      theme: user.theme,
    }
  } catch {
    return null
  }
}

// ---- Simple in-memory rate limiter (per IP) ----
const attempts = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(ip: string, max = 5, windowMs = 60_000): boolean {
  const now = Date.now()
  const entry = attempts.get(ip)
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (entry.count >= max) return false
  entry.count += 1
  return true
}

export function clearRateLimit(ip: string) {
  attempts.delete(ip)
}
