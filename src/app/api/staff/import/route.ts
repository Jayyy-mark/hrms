import { NextRequest } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { ok, errors, zodFail, requirePerm, logAudit } from '@/lib/api'
import { PERMISSIONS } from '@/lib/permissions'
import { GENDERS, STAFF_STATUS, MARITAL_STATUS } from '@/lib/constants'

/**
 * POST /api/staff/import
 * Bulk staff import (ADMIN+). Accepts pre-mapped rows; validates each row,
 * auto-generates staffNo when omitted, creates Staff + initial assignment
 * (StaffPosition + StaffRank derived from position level) + JOINING service
 * history. Returns per-row results. Import itself is audited.
 */

const IMPORT_ROW = z.object({
  staffNo: z.string().trim().optional().default(''),
  nameEn: z.string().trim().min(2, 'English name is required'),
  nameMm: z.string().trim().optional().default(''),
  gender: z.enum(GENDERS).default('MALE'),
  dateOfBirth: z.string().trim().optional().default(''),
  placeOfBirth: z.string().trim().optional().default(''),
  nrcNo: z.string().trim().optional().default(''),
  nationality: z.string().trim().optional().default(''),
  religion: z.string().trim().optional().default(''),
  bloodGroup: z.string().trim().optional().default(''),
  maritalStatus: z.string().trim().optional().default(''),
  phone: z.string().trim().optional().default(''),
  email: z.string().trim().optional().default(''),
  status: z.enum(STAFF_STATUS).default('ACTIVE'),
  joinDate: z.string().trim().optional().default(''),
  departmentId: z.string().trim().optional().default(''),
  positionId: z.string().trim().optional().default(''),
})

const IMPORT_BODY = z.object({
  rows: z.array(IMPORT_ROW).min(1, 'At least one row is required').max(200, 'Maximum 200 rows per import'),
})

const toDate = (v: string): Date | null => {
  if (!v) return null
  const t = new Date(v)
  return isNaN(t.getTime()) ? null : t
}

const LEVEL_TO_RANK: Record<number, string> = { 5: 'R1', 6: 'R2', 7: 'R3', 8: 'R4', 9: 'R5', 10: 'R6' }

export async function POST(req: NextRequest) {
  const auth = await requirePerm(req, PERMISSIONS.STAFF_CREATE)
  if ('response' in auth) return auth.response
  const { session } = auth

  const body = await req.json().catch(() => null)
  const parsed = IMPORT_BODY.safeParse(body)
  if (!parsed.success) return zodFail(parsed.error)
  const rows = parsed.data.rows

  // Pre-load ranks by code for position-level derivation
  const ranks = await db.rank.findMany({ where: { deletedAt: null }, select: { id: true, code: true, level: true } })
  const rankByCode: Record<string, string> = {}
  for (const r of ranks) if (r.code) rankByCode[r.code] = r.id

  // Next staffNo seed: max numeric suffix + 1
  const lastStaff = await db.staff.findFirst({ orderBy: { staffNo: 'desc' }, select: { staffNo: true } })
  let nextNo = 1
  if (lastStaff?.staffNo) {
    const m = lastStaff.staffNo.match(/(\d+)$/)
    if (m) nextNo = parseInt(m[1], 10) + 1
  }

  const results: { index: number; staffNo?: string; nameEn: string; ok: boolean; error?: string }[] = []
  let created = 0

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    try {
      // Duplicate checks against DB (and against this batch)
      const dupFilters: Prisma.StaffWhereInput[] = []
      if (r.staffNo) dupFilters.push({ staffNo: r.staffNo })
      if (r.nrcNo) dupFilters.push({ nrcNo: r.nrcNo })
      if (dupFilters.length) {
        const dup = await db.staff.findFirst({ where: { OR: dupFilters, deletedAt: null }, select: { staffNo: true } })
        if (dup) {
          results.push({ index: i, nameEn: r.nameEn, ok: false, error: `Duplicate staffNo/NRC (existing ${dup.staffNo})` })
          continue
        }
      }
      const batchDup = rows.slice(0, i).some((p) => (r.staffNo && p.staffNo === r.staffNo) || (r.nrcNo && p.nrcNo && p.nrcNo === r.nrcNo))
      if (batchDup) {
        results.push({ index: i, nameEn: r.nameEn, ok: false, error: 'Duplicate staffNo/NRC within this import' })
        continue
      }

      // Validate optional dates
      const dob = r.dateOfBirth ? toDate(r.dateOfBirth) : null
      if (r.dateOfBirth && !dob) {
        results.push({ index: i, nameEn: r.nameEn, ok: false, error: 'Invalid dateOfBirth (use YYYY-MM-DD)' })
        continue
      }
      const join = r.joinDate ? toDate(r.joinDate) : null
      if (r.joinDate && !join) {
        results.push({ index: i, nameEn: r.nameEn, ok: false, error: 'Invalid joinDate (use YYYY-MM-DD)' })
        continue
      }
      if (r.maritalStatus && !(MARITAL_STATUS as readonly string[]).includes(r.maritalStatus)) {
        results.push({ index: i, nameEn: r.nameEn, ok: false, error: `Invalid maritalStatus (${MARITAL_STATUS.join('/')})` })
        continue
      }

      // Resolve position + derive rank from position level
      let positionId: string | null = r.positionId || null
      let rankId: string | null = null
      if (positionId) {
        const pos = await db.position.findUnique({ where: { id: positionId }, select: { id: true, level: true, departmentId: true } })
        if (!pos) {
          results.push({ index: i, nameEn: r.nameEn, ok: false, error: 'Unknown positionId' })
          continue
        }
        const code = pos.level ? LEVEL_TO_RANK[pos.level] : undefined
        rankId = code ? rankByCode[code] ?? null : null
      }

      const staffNo = r.staffNo || `MOGE-${String(nextNo).padStart(4, '0')}`
      if (!r.staffNo) nextNo++

      const staff = await db.staff.create({
        data: {
          staffNo,
          nameEn: r.nameEn,
          nameMm: r.nameMm || null,
          gender: r.gender,
          dateOfBirth: dob,
          placeOfBirth: r.placeOfBirth || null,
          nrcNo: r.nrcNo || null,
          nationality: r.nationality || null,
          religion: r.religion || null,
          bloodGroup: r.bloodGroup || null,
          maritalStatus: (r.maritalStatus || null) as string | null,
          phone: r.phone || null,
          email: r.email || null,
          status: r.status,
          joinDate: join,
        },
      })

      // Initial assignment + service history (positionId required for StaffPosition;
      // department falls back to the position's own department)
      const effective = join ?? new Date()
      if (positionId) {
        const pos = await db.position.findUnique({ where: { id: positionId }, select: { departmentId: true } })
        await db.staffPosition.create({
          data: { staffId: staff.id, positionId, departmentId: r.departmentId || pos?.departmentId || null, startDate: effective, isCurrent: true },
        }).catch(() => null)
      }
      if (rankId) {
        await db.staffRank.create({
          data: { staffId: staff.id, rankId, effectiveDate: effective, isCurrent: true },
        }).catch(() => null)
      }
      await db.staffServiceHistory.create({
        data: {
          staffId: staff.id, type: 'JOINING', title: 'Joined service (bulk import)', fromDate: effective,
          positionId: positionId || null, departmentId: r.departmentId || null, rankId: rankId || null, orderNo: 1,
        },
      }).catch(() => null)

      created++
      results.push({ index: i, staffNo, nameEn: r.nameEn, ok: true })
    } catch (err) {
      console.error('[staff:import]', err)
      results.push({ index: i, nameEn: r.nameEn, ok: false, error: 'Creation failed' })
    }
  }

  await logAudit({
    user: session, action: 'CREATE', module: 'staff', entityType: 'Staff',
    after: { bulkImport: true, attempted: rows.length, created },
    request: req,
  })

  return ok({ attempted: rows.length, created, failed: rows.length - created, results })
}
