import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { ok, errors, zodFail, requirePerm, requireAuth, parseQuery, logAudit } from '@/lib/api'
import { PERMISSIONS } from '@/lib/permissions'
import { DOC_CATEGORIES, DOC_ACCESS } from '@/lib/constants'

const docSchema = z.object({
  title: z.string().trim().min(1),
  category: z.enum(DOC_CATEGORIES).default('OTHER'),
  fileUrl: z.string().min(1),
  fileName: z.string().min(1),
  fileType: z.string().default('application/octet-stream'),
  fileSize: z.coerce.number().int().min(0).default(0),
  expiryDate: z.union([z.coerce.date(), z.string().transform((v) => new Date(v))]).nullable().optional(),
  entityType: z.string().default('Staff'),
  entityId: z.string().min(1),
  accessLevel: z.enum(DOC_ACCESS).default('INTERNAL'),
})

export async function GET(req: NextRequest) {
  const auth = await requirePerm(req, PERMISSIONS.DOCUMENTS_VIEW)
  if ('response' in auth) return auth.response
  const { page, pageSize, search, sortBy, sortDir, filters } = parseQuery(req)
  const sp = req.nextUrl.searchParams
  const entityId = sp.get('entityId')
  const entityType = sp.get('entityType')

  const where: Record<string, unknown> = {}
  if (search) where.OR = [{ title: { contains: search } }, { fileName: { contains: search } }]
  if (filters.category) where.category = filters.category
  if (filters.accessLevel) where.accessLevel = filters.accessLevel
  if (entityId && entityType) { where.entityId = entityId; where.entityType = entityType }

  const orderBy: Record<string, string> = { [sortBy || 'createdAt']: sortDir || 'desc' }

  const [total, rows] = await Promise.all([
    db.document.count({ where }),
    db.document.findMany({
      where, orderBy,
      skip: (page - 1) * pageSize, take: pageSize,
      include: { uploadedBy: { select: { id: true, name: true, email: true } } },
    }),
  ])
  return ok(rows, { page, pageSize, total })
}

export async function POST(req: NextRequest) {
  const auth = await requirePerm(req, PERMISSIONS.DOCUMENTS_MANAGE)
  if ('response' in auth) return auth.response
  const { session } = auth

  const body = await req.json().catch(() => null)
  const parsed = docSchema.safeParse(body)
  if (!parsed.success) return zodFail(parsed.error)

  const row = await db.document.create({ data: { ...parsed.data, uploadedById: session.userId } })
  await logAudit({
    user: session, action: 'CREATE', module: 'documents', entityType: 'Document', entityId: row.id,
    after: row as unknown as Record<string, unknown>, request: req,
  })
  return ok(row)
}
