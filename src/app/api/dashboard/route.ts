import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, requirePerm } from '@/lib/api'
import { PERMISSIONS } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  const auth = await requirePerm(req, PERMISSIONS.DASHBOARD_FULL)
  if ('response' in auth) return auth.response

  const now = new Date()
  const yearStart = new Date(now.getFullYear(), 0, 1)
  const retirementCutoff = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())

  const staff = await db.staff.findMany({
    where: { deletedAt: null },
    select: {
      id: true, staffNo: true, nameEn: true, nameMm: true, photoUrl: true, status: true,
      gender: true, dateOfBirth: true, joinDate: true,
      positions: { where: { isCurrent: true }, take: 1, include: { position: { include: { department: true } }, department: true } },
      ranks: { where: { isCurrent: true }, take: 1, include: { rank: true } },
    },
  })

  const byStatus: Record<string, number> = {}
  const byGender: Record<string, number> = {}
  const byDepartment: Record<string, number> = {}
  const byRank: Record<string, number> = {}
  const ageBuckets = { '20-29': 0, '30-39': 0, '40-49': 0, '50-59': 0, '60+': 0 }

  for (const s of staff) {
    byStatus[s.status] = (byStatus[s.status] || 0) + 1
    byGender[s.gender] = (byGender[s.gender] || 0) + 1
    const dept = s.positions[0]?.department?.name || s.positions[0]?.position?.department?.name || 'Unassigned'
    byDepartment[dept] = (byDepartment[dept] || 0) + 1
    const rank = s.ranks[0]?.rank?.name
    if (rank) byRank[rank] = (byRank[rank] || 0) + 1
    if (s.dateOfBirth) {
      const age = Math.floor((now.getTime() - new Date(s.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))
      const bucket = age < 30 ? '20-29' : age < 40 ? '30-39' : age < 50 ? '40-49' : age < 60 ? '50-59' : '60+'
      if (bucket in ageBuckets) ageBuckets[bucket as keyof typeof ageBuckets]++
    }
  }

  const newHiresThisYear = staff.filter((s) => s.joinDate && new Date(s.joinDate) >= yearStart).length
  const activeStaff = staff.filter((s) => s.status === 'ACTIVE').length

  // Upcoming retirements: staff turning 60 within a year
  const upcomingRetirements = staff
    .filter((s) => {
      if (!s.dateOfBirth || s.status !== 'ACTIVE') return false
      const dob = new Date(s.dateOfBirth)
      const turns60At = new Date(dob.getFullYear() + 60, dob.getMonth(), dob.getDate())
      return turns60At >= now && turns60At <= retirementCutoff
    })
    .length

  // Upcoming birthdays: employed staff with birthday in the next 30 days
  const upcomingBirthdays = staff
    .filter((s) => s.dateOfBirth && (s.status === 'ACTIVE' || s.status === 'SUSPENDED'))
    .map((s) => {
      if (!s.dateOfBirth) return null
      const dob = new Date(s.dateOfBirth)
      let next = new Date(now.getFullYear(), dob.getMonth(), dob.getDate())
      if (next.getTime() < now.getTime() - 86400000) next = new Date(now.getFullYear() + 1, dob.getMonth(), dob.getDate())
      const daysUntil = Math.ceil((next.getTime() - now.getTime()) / 86400000)
      return {
        id: s.id, staffNo: s.staffNo, nameEn: s.nameEn, nameMm: s.nameMm, photoUrl: s.photoUrl,
        department: s.positions[0]?.department?.name || s.positions[0]?.position?.department?.name || null,
        birthday: next.toISOString(), daysUntil,
      }
    })
    .filter((s): s is NonNullable<typeof s> => s !== null && s.daysUntil >= 0 && s.daysUntil <= 30)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 6)

  // Recent activity feed (audit-based)
  const recentActivity = await db.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 12,
    select: { id: true, userName: true, action: true, module: true, entityType: true, entityId: true, createdAt: true },
  })

  // Recent staff
  const recentStaff = await db.staff.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 6,
    include: {
      positions: { where: { isCurrent: true }, take: 1, include: { position: { include: { department: true } }, department: true } },
      ranks: { where: { isCurrent: true }, take: 1, include: { rank: true } },
    },
  })
  const recentStaffData = recentStaff.map((s) => ({
    id: s.id, staffNo: s.staffNo, nameEn: s.nameEn, nameMm: s.nameMm, photoUrl: s.photoUrl, status: s.status,
    position: s.positions[0]?.position?.name ?? null,
    department: s.positions[0]?.department?.name ?? s.positions[0]?.position?.department?.name ?? null,
    rank: s.ranks[0]?.rank?.name ?? null,
    joinDate: s.joinDate,
  }))

  return ok({
    totals: {
      total: staff.length,
      active: activeStaff,
      newHiresThisYear,
      upcomingRetirements,
      male: byGender['MALE'] || 0,
      female: byGender['FEMALE'] || 0,
    },
    byStatus,
    byGender,
    byDepartment,
    byRank,
    ageDistribution: Object.entries(ageBuckets).map(([range, count]) => ({ range, count })),
    genderDistribution: Object.entries(byGender).map(([gender, count]) => ({ gender, count })),
    departmentDistribution: Object.entries(byDepartment).map(([name, count]) => ({ name, count })),
    rankDistribution: Object.entries(byRank).map(([name, count]) => ({ name, count })),
    recentActivity,
    recentStaff: recentStaffData,
    upcomingBirthdays,
  })
}
