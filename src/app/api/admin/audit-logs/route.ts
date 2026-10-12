import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ok, errors, requirePerm, parseQuery, logAudit } from '@/lib/api'
import { PERMISSIONS } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  const auth = await requirePerm(req, PERMISSIONS.AUDIT_VIEW)
  if ('response' in auth) return auth.response
  const { session } = auth
  const { page, pageSize, search, sortBy, sortDir, filters } = parseQuery(req)
  const exportCsv = req.nextUrl.searchParams.get('export') === 'csv'
  const entityId = req.nextUrl.searchParams.get('entityId')

  const where: Record<string, unknown> = {}
  if (search) {
    where.OR = [{ userName: { contains: search } }, { module: { contains: search } }, { entityType: { contains: search } }, { entityId: { contains: search } }]
  }
  if (filters.action) where.action = filters.action
  if (filters.module) where.module = filters.module
  if (filters.userId) where.userId = filters.userId
  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: new Date(filters.from) } : {}),
      ...(filters.to ? { lte: new Date(`${filters.to}T23:59:59`) } : {}),
    }
  }
  if (entityId) where.OR = [{ entityId }, { entityId: entityId, entityType: filters.entityType || undefined }].filter(Boolean)

  const orderBy: Record<string, string> = { [sortBy || 'createdAt']: sortDir || 'desc' }

  if (exportCsv) {
    const logs = await db.auditLog.findMany({ where, orderBy, take: 5000 })
    const header = ['Timestamp', 'User', 'Action', 'Module', 'Entity Type', 'Entity ID', 'IP Address', 'Changed Fields']
    const lines = [header.join(',')]
    for (const l of logs) {
      const fields = (() => { try { return JSON.parse(l.changedFields || '[]').join(' | ') } catch { return '' } })()
      lines.push([
        l.createdAt.toISOString(), l.userName ?? '', l.action, l.module, l.entityType, l.entityId ?? '',
        l.ipAddress ?? '', `"${fields.replace(/"/g, '""')}"`,
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    }
    await logAudit({
      user: session, action: 'EXPORT', module: 'admin.audit-logs', entityType: 'AuditLog',
      after: { rows: logs.length }, request: req,
    })
    return new NextResponse(lines.join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  }

  const [total, logs] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
  ])
  return ok(logs, { page, pageSize, total })
}
