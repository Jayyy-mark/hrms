import { NextRequest } from 'next/server'
import { requireAuth, ok } from '@/lib/api'
import { ROLE_PERMISSIONS } from '@/lib/permissions'
import type { RoleName } from '@/lib/constants'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('response' in auth) return auth.response
  const { session } = auth
  return ok({
    user: session,
    permissions: ROLE_PERMISSIONS[session.role as RoleName] ?? [],
  })
}
