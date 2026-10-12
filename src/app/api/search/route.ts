import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, requireAuth } from '@/lib/api'
import { can, PERMISSIONS } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('response' in auth) return auth.response
  const { session } = auth
  const q = (req.nextUrl.searchParams.get('q') || '').trim()
  if (!q || q.length < 1) return ok({ groups: [] })

  const canStaff = can(session.role, PERMISSIONS.STAFF_VIEW)
  const results: { group: string; items: { id: string; title: string; subtitle?: string; view: string }[] }[] = []

  if (canStaff) {
    const staff = await db.staff.findMany({
      where: {
        deletedAt: null,
        OR: [
          { nameEn: { contains: q } }, { nameMm: { contains: q } },
          { staffNo: { contains: q } }, { nrcNo: { contains: q } }, { phone: { contains: q } },
        ],
      },
      take: 8,
      include: { ranks: { where: { isCurrent: true }, take: 1, include: { rank: true } } },
    })
    if (staff.length) {
      results.push({
        group: 'staff',
        items: staff.map((s) => ({
          id: s.id,
          title: s.nameEn + (s.nameMm ? ` · ${s.nameMm}` : ''),
          subtitle: `${s.staffNo}${s.ranks[0]?.rank?.name ? ' · ' + s.ranks[0].rank.name : ''}`,
          view: 'staff-detail',
        })),
      })
    }

    const departments = await db.department.findMany({
      where: { deletedAt: null, OR: [{ name: { contains: q } }, { code: { contains: q } }] },
      take: 5,
    })
    if (departments.length) {
      results.push({
        group: 'departments',
        items: departments.map((d) => ({ id: d.id, title: d.name, subtitle: d.code ?? undefined, view: 'departments' })),
      })
    }

    const trainings = await db.staffTraining.findMany({
      where: { OR: [{ courseName: { contains: q } }, { institution: { contains: q } }] },
      take: 5,
      include: { staff: { select: { nameEn: true } } },
    })
    if (trainings.length) {
      results.push({
        group: 'trainings',
        items: trainings.map((t) => ({ id: t.id, title: t.courseName, subtitle: t.staff?.nameEn, view: 'trainings' })),
      })
    }

    const awards = await db.staffAward.findMany({
      where: { OR: [{ title: { contains: q } }, { authority: { contains: q } }] },
      take: 5,
      include: { staff: { select: { nameEn: true } } },
    })
    if (awards.length) {
      results.push({
        group: 'awards',
        items: awards.map((a) => ({ id: a.id, title: a.title, subtitle: a.staff?.nameEn, view: 'awards' })),
      })
    }

    const positions = await db.position.findMany({
      where: { deletedAt: null, OR: [{ name: { contains: q } }, { code: { contains: q } }] },
      take: 5,
    })
    if (positions.length) {
      results.push({
        group: 'positions',
        items: positions.map((p) => ({ id: p.id, title: p.name, subtitle: p.code ?? undefined, view: 'positions' })),
      })
    }

    const ranks = await db.rank.findMany({
      where: { deletedAt: null, OR: [{ name: { contains: q } }, { code: { contains: q } }] },
      take: 5,
    })
    if (ranks.length) {
      results.push({
        group: 'ranks',
        items: ranks.map((r) => ({ id: r.id, title: r.name, subtitle: r.code ?? undefined, view: 'ranks' })),
      })
    }
  }

  return ok({ groups: results })
}
