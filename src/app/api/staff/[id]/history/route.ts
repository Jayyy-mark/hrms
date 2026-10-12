import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, errors, requireAuth, parseQuery } from '@/lib/api'

type Params = { params: Promise<{ id: string }> }

/** Audit trail for a single staff record (History tab). */
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req)
  if ('response' in auth) return auth.response
  const { session } = auth
  const { id } = await params

  if (session.role === 'USER' && session.staffId !== id) return errors.forbidden()

  const staff = await db.staff.findUnique({ where: { id }, select: { id: true, deletedAt: true } })
  if (!staff) return errors.notFound('Staff')

  const { page, pageSize } = parseQuery(req)
  const where = {
    OR: [
      { staffId: id },
      { entityType: 'Staff', entityId: id },
    ],
  }
  const [total, logs] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])
  return ok(logs, { page, pageSize, total })
}
