import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, errors, requirePerm, logAudit } from '@/lib/api'
import { PERMISSIONS } from '@/lib/permissions'

type Params = { params: Promise<{ id: string }> }

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requirePerm(req, PERMISSIONS.DOCUMENTS_MANAGE)
  if ('response' in auth) return auth.response
  const { session } = auth
  const { id } = await params

  const existing = await db.document.findUnique({ where: { id } })
  if (!existing) return errors.notFound('Document')

  await db.document.delete({ where: { id } })
  await logAudit({
    user: session, action: 'DELETE', module: 'documents', entityType: 'Document', entityId: id,
    before: existing as unknown as Record<string, unknown>, after: null, request: req,
  })
  return ok({ deleted: true })
}
