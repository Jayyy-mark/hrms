import { NextRequest } from 'next/server'
import { getSession, SESSION_COOKIE_NAME } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { ok } from '@/lib/api'

export async function POST(req: NextRequest) {
  const session = await getSession(req)
  if (session) {
    await logAudit({ user: session, action: 'LOGOUT', module: 'auth', entityType: 'User', entityId: session.userId, request: req })
  }
  const res = ok({ loggedOut: true })
  res.cookies.set({ name: SESSION_COOKIE_NAME, value: '', path: '/', maxAge: 0 })
  return res
}
