import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { getSession, type SessionUser } from './auth'
import { can, type PermissionKey } from './permissions'
import { logAudit } from './audit'

export interface ApiMeta {
  page?: number
  pageSize?: number
  total?: number
  [key: string]: unknown
}

export function ok<T>(data: T, meta?: ApiMeta) {
  return NextResponse.json({ success: true, data, ...(meta ? { meta } : {}) })
}

export function fail(code: string, message: string, status = 400, issues?: unknown) {
  return NextResponse.json({ success: false, error: { code, message, ...(issues ? { issues } : {}) } }, { status })
}

export const errors = {
  unauthorized: () => fail('UNAUTHORIZED', 'Authentication required', 401),
  forbidden: () => fail('FORBIDDEN', 'You do not have permission to perform this action', 403),
  notFound: (what = 'Record') => fail('NOT_FOUND', `${what} not found`, 404),
  validation: (issues: unknown) => fail('VALIDATION_ERROR', 'Validation failed', 400, issues),
  conflict: (msg: string) => fail('CONFLICT', msg, 409),
}

export function zodFail(err: ZodError) {
  return errors.validation(err.issues)
}

/** Auth guard for API handlers: returns session or a 401 response. */
export async function requireAuth(req: NextRequest): Promise<{ session: SessionUser } | { response: NextResponse }> {
  const session = await getSession(req)
  if (!session) return { response: errors.unauthorized() }
  return { session }
}

/** Permission guard: returns session or 401/403 response. */
export async function requirePerm(
  req: NextRequest,
  permission: PermissionKey
): Promise<{ session: SessionUser } | { response: NextResponse }> {
  const auth = await requireAuth(req)
  if ('response' in auth) return auth
  if (!can(auth.session.role, permission)) return { response: errors.forbidden() }
  return auth
}

/** Parse pagination + sorting + search from query params. */
export function parseQuery(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') || '20', 10) || 20))
  const search = (sp.get('search') || '').trim()
  const sortBy = sp.get('sortBy') || undefined
  const sortDir = sp.get('sortDir') === 'asc' ? 'asc' : sp.get('sortDir') === 'desc' ? 'desc' : undefined
  const filters: Record<string, string> = {}
  for (const [key, value] of sp.entries()) {
    if (['page', 'pageSize', 'search', 'sortBy', 'sortDir'].includes(key)) continue
    if (value && value !== 'ALL') filters[key] = value
  }
  return { page, pageSize, search, sortBy, sortDir, filters }
}

export { logAudit }
