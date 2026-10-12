import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, requireAuth, errors } from '@/lib/api'

/**
 * GET /api/org-chart
 * Department hierarchy with headcounts (ADMIN+ only — same policy as master data lists).
 * Returns a flat node list; the client builds the tree from parentId.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('response' in auth) return auth.response
  const { session } = auth
  if (session.role === 'USER') return errors.forbidden()

  const [departments, positions, currentAssignments] = await Promise.all([
    db.department.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, nameMm: true, code: true, parentId: true, description: true },
      orderBy: { name: 'asc' },
    }),
    db.position.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, departmentId: true, level: true },
      orderBy: { level: 'desc' },
    }),
    db.staffPosition.findMany({
      where: { isCurrent: true, staff: { deletedAt: null, status: { in: ['ACTIVE', 'SUSPENDED'] } } },
      select: { departmentId: true, positionId: true },
    }),
  ])

  // Direct headcount per department
  const headcount: Record<string, number> = {}
  for (const a of currentAssignments) {
    if (a.departmentId) headcount[a.departmentId] = (headcount[a.departmentId] || 0) + 1
  }

  // Position titles per department (for the node detail)
  const positionsByDept: Record<string, { name: string; level: number | null }[]> = {}
  for (const p of positions) {
    if (!p.departmentId) continue
    ;(positionsByDept[p.departmentId] ||= []).push({ name: p.name, level: p.level })
  }

  // Aggregate headcount including all descendant departments
  const childrenOf: Record<string, string[]> = {}
  for (const d of departments) {
    if (d.parentId) (childrenOf[d.parentId] ||= []).push(d.id)
  }
  const subtreeCount = (id: string, seen = new Set<string>()): number => {
    if (seen.has(id)) return 0
    seen.add(id)
    let total = headcount[id] || 0
    for (const c of childrenOf[id] || []) total += subtreeCount(c, seen)
    return total
  }

  const nodes = departments.map((d) => ({
    id: d.id,
    name: d.name,
    nameMm: d.nameMm,
    code: d.code,
    parentId: d.parentId,
    description: d.description,
    headcount: headcount[d.id] || 0,
    totalHeadcount: subtreeCount(d.id),
    positions: (positionsByDept[d.id] || []).slice(0, 6),
  }))

  return ok({ nodes, generatedAt: new Date().toISOString() })
}
