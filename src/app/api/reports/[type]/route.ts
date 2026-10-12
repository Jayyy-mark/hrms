import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, errors, requirePerm, logAudit } from '@/lib/api'
import { PERMISSIONS } from '@/lib/permissions'

type Params = { params: Promise<{ type: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requirePerm(req, PERMISSIONS.REPORTS_VIEW)
  if ('response' in auth) return auth.response
  const { session } = auth
  const { type } = await params

  const now = new Date()
  let rows: Record<string, unknown>[] = []
  let columns: { key: string; header: string }[] = []

  switch (type) {
    case 'staff-list': {
      const staff = await db.staff.findMany({
        where: { deletedAt: null },
        orderBy: { nameEn: 'asc' },
        include: {
          positions: { where: { isCurrent: true }, take: 1, include: { position: { include: { department: true } }, department: true } },
          ranks: { where: { isCurrent: true }, take: 1, include: { rank: true } },
        },
      })
      rows = staff.map((s) => ({
        staffNo: s.staffNo, name: s.nameEn, gender: s.gender, status: s.status,
        department: s.positions[0]?.department?.name ?? s.positions[0]?.position?.department?.name ?? '—',
        position: s.positions[0]?.position?.name ?? '—',
        rank: s.ranks[0]?.rank?.name ?? '—', joinDate: s.joinDate,
      }))
      columns = [
        { key: 'staffNo', header: 'Staff No' }, { key: 'name', header: 'Name' }, { key: 'gender', header: 'Gender' },
        { key: 'department', header: 'Department' }, { key: 'position', header: 'Position' }, { key: 'rank', header: 'Rank' },
        { key: 'status', header: 'Status' }, { key: 'joinDate', header: 'Join Date' },
      ]
      break
    }
    case 'by-department': {
      const staff = await db.staff.findMany({
        where: { deletedAt: null },
        include: { positions: { where: { isCurrent: true }, take: 1, include: { position: { include: { department: true } }, department: true } } },
      })
      const map = new Map<string, number>()
      for (const s of staff) {
        const d = s.positions[0]?.department?.name ?? s.positions[0]?.position?.department?.name ?? 'Unassigned'
        map.set(d, (map.get(d) || 0) + 1)
      }
      rows = [...map.entries()].map(([department, count]) => ({ department, count })).sort((a, b) => b.count - a.count)
      columns = [{ key: 'department', header: 'Department' }, { key: 'count', header: 'Headcount' }]
      break
    }
    case 'by-rank': {
      const staff = await db.staff.findMany({
        where: { deletedAt: null },
        include: { ranks: { where: { isCurrent: true }, take: 1, include: { rank: true } } },
      })
      const map = new Map<string, number>()
      for (const s of staff) {
        const r = s.ranks[0]?.rank?.name ?? 'Unranked'
        map.set(r, (map.get(r) || 0) + 1)
      }
      rows = [...map.entries()].map(([rank, count]) => ({ rank, count })).sort((a, b) => b.count - a.count)
      columns = [{ key: 'rank', header: 'Rank' }, { key: 'count', header: 'Headcount' }]
      break
    }
    case 'by-age': {
      const staff = await db.staff.findMany({ where: { deletedAt: null }, select: { dateOfBirth: true } })
      const buckets: Record<string, number> = { '20-29': 0, '30-39': 0, '40-49': 0, '50-59': 0, '60+': 0, unknown: 0 }
      for (const s of staff) {
        if (!s.dateOfBirth) { buckets.unknown++; continue }
        const age = Math.floor((now.getTime() - new Date(s.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))
        const b = age < 30 ? '20-29' : age < 40 ? '30-39' : age < 50 ? '40-49' : age < 60 ? '50-59' : '60+'
        buckets[b]++
      }
      rows = Object.entries(buckets).map(([range, count]) => ({ range, count }))
      columns = [{ key: 'range', header: 'Age Range' }, { key: 'count', header: 'Count' }]
      break
    }
    case 'retirement-due': {
      const staff = await db.staff.findMany({
        where: { deletedAt: null, status: 'ACTIVE' },
        include: { ranks: { where: { isCurrent: true }, take: 1, include: { rank: true } } },
      })
      const retireDue: Record<string, unknown>[] = []
      for (const s of staff) {
        if (!s.dateOfBirth) continue
        const dob = new Date(s.dateOfBirth)
        const retireAt = new Date(dob.getFullYear() + 60, dob.getMonth(), dob.getDate())
        if (retireAt >= now && retireAt.getTime() <= now.getTime() + 5 * 365.25 * 24 * 3600 * 1000) {
          retireDue.push({ staffNo: s.staffNo, name: s.nameEn, dateOfBirth: s.dateOfBirth, retirementDate: retireAt, rank: s.ranks[0]?.rank?.name ?? '—' })
        }
      }
      retireDue.sort((a, b) => (a.retirementDate as Date).getTime() - (b.retirementDate as Date).getTime())
      rows = retireDue
      columns = [
        { key: 'staffNo', header: 'Staff No' }, { key: 'name', header: 'Name' },
        { key: 'dateOfBirth', header: 'Date of Birth' }, { key: 'retirementDate', header: 'Retirement Date' }, { key: 'rank', header: 'Rank' },
      ]
      break
    }
    case 'promotions': {
      const data = await db.promotion.findMany({
        include: { staff: { select: { staffNo: true, nameEn: true } }, fromRank: true, toRank: true },
        orderBy: { effectiveDate: 'desc' },
      })
      rows = data.map((p) => ({
        staffNo: p.staff.staffNo, name: p.staff.nameEn, from: p.fromRank?.name ?? '—', to: p.toRank.name,
        effectiveDate: p.effectiveDate, status: p.status, authority: p.authority ?? '—',
      }))
      columns = [
        { key: 'staffNo', header: 'Staff No' }, { key: 'name', header: 'Name' }, { key: 'from', header: 'From Rank' },
        { key: 'to', header: 'To Rank' }, { key: 'effectiveDate', header: 'Effective Date' }, { key: 'status', header: 'Status' }, { key: 'authority', header: 'Authority' },
      ]
      break
    }
    case 'transfers': {
      const data = await db.transfer.findMany({
        include: { staff: { select: { staffNo: true, nameEn: true } }, fromDepartment: true, toDepartment: true },
        orderBy: { transferDate: 'desc' },
      })
      rows = data.map((t) => ({
        staffNo: t.staff.staffNo, name: t.staff.nameEn,
        from: t.fromDepartment?.name ?? '—', to: t.toDepartment.name,
        transferDate: t.transferDate, status: t.status, reason: t.reason ?? '—',
      }))
      columns = [
        { key: 'staffNo', header: 'Staff No' }, { key: 'name', header: 'Name' }, { key: 'from', header: 'From Department' },
        { key: 'to', header: 'To Department' }, { key: 'transferDate', header: 'Transfer Date' }, { key: 'status', header: 'Status' }, { key: 'reason', header: 'Reason' },
      ]
      break
    }
    case 'trainings': {
      const data = await db.staffTraining.findMany({
        include: { staff: { select: { staffNo: true, nameEn: true } } },
        orderBy: { startDate: 'desc' },
      })
      rows = data.map((t) => ({
        staffNo: t.staff.staffNo, name: t.staff.nameEn, course: t.courseName, institution: t.institution ?? '—',
        country: t.country ?? '—', startDate: t.startDate, endDate: t.endDate, result: t.result ?? '—', isForeign: t.isForeign ? 'Yes' : 'No',
      }))
      columns = [
        { key: 'staffNo', header: 'Staff No' }, { key: 'name', header: 'Name' }, { key: 'course', header: 'Course' },
        { key: 'institution', header: 'Institution' }, { key: 'country', header: 'Country' },
        { key: 'startDate', header: 'Start' }, { key: 'endDate', header: 'End' }, { key: 'result', header: 'Result' }, { key: 'isForeign', header: 'Foreign' },
      ]
      break
    }
    case 'awards': {
      const data = await db.staffAward.findMany({
        include: { staff: { select: { staffNo: true, nameEn: true } } },
        orderBy: { awardedDate: 'desc' },
      })
      rows = data.map((a) => ({
        staffNo: a.staff.staffNo, name: a.staff.nameEn, title: a.title, authority: a.authority ?? '—',
        awardedDate: a.awardedDate, reason: a.reason ?? '—',
      }))
      columns = [
        { key: 'staffNo', header: 'Staff No' }, { key: 'name', header: 'Name' }, { key: 'title', header: 'Award' },
        { key: 'authority', header: 'Authority' }, { key: 'awardedDate', header: 'Awarded Date' }, { key: 'reason', header: 'Reason' },
      ]
      break
    }
    case 'foreign-travel': {
      const data = await db.foreignTravel.findMany({
        include: { staff: { select: { staffNo: true, nameEn: true } } },
        orderBy: { startDate: 'desc' },
      })
      rows = data.map((t) => ({
        staffNo: t.staff.staffNo, name: t.staff.nameEn, destination: t.destinationCountry, purpose: t.purpose,
        organization: t.organization ?? '—', sponsor: t.sponsor ?? '—', startDate: t.startDate, endDate: t.endDate,
      }))
      columns = [
        { key: 'staffNo', header: 'Staff No' }, { key: 'name', header: 'Name' }, { key: 'destination', header: 'Destination' },
        { key: 'purpose', header: 'Purpose' }, { key: 'organization', header: 'Organization' }, { key: 'sponsor', header: 'Sponsor' },
        { key: 'startDate', header: 'Start' }, { key: 'endDate', header: 'End' },
      ]
      break
    }
    case 'military-service': {
      const data = await db.militaryService.findMany({
        include: { staff: { select: { staffNo: true, nameEn: true } } },
        orderBy: { startDate: 'asc' },
      })
      rows = data.map((m) => ({
        staffNo: m.staff.staffNo, name: m.staff.nameEn, serviceNumber: m.serviceNumber ?? '—', unit: m.unit ?? '—',
        rank: m.rank ?? '—', position: m.position ?? '—', startDate: m.startDate, endDate: m.endDate, status: m.status ?? '—',
      }))
      columns = [
        { key: 'staffNo', header: 'Staff No' }, { key: 'name', header: 'Name' }, { key: 'serviceNumber', header: 'Service No' },
        { key: 'unit', header: 'Unit' }, { key: 'rank', header: 'Rank' }, { key: 'position', header: 'Position' },
        { key: 'startDate', header: 'Start' }, { key: 'endDate', header: 'End' }, { key: 'status', header: 'Status' },
      ]
      break
    }
    case 'by-education': {
      const data = await db.staffEducation.findMany({ include: { staff: { select: { staffNo: true, nameEn: true } } } })
      const map = new Map<string, number>()
      for (const e of data) {
        const d = e.degree || 'Other'
        map.set(d, (map.get(d) || 0) + 1)
      }
      rows = [...map.entries()].map(([degree, count]) => ({ degree, count })).sort((a, b) => b.count - a.count)
      columns = [{ key: 'degree', header: 'Degree' }, { key: 'count', header: 'Count' }]
      break
    }
    default:
      return errors.notFound('Report')
  }

  await logAudit({
    user: session, action: 'VIEW', module: `reports.${type}`, entityType: 'Report', entityId: type,
    after: { type, rows: rows.length }, request: req,
  })

  return ok({ type, columns, rows })
}
