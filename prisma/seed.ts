/**
 * MOGE HR — Demo database seed script
 * ====================================
 * Run from the project root:   bun prisma/seed.ts
 *
 * Wipes all existing rows (reverse dependency order) and creates a complete
 * demo dataset:
 *   • 3 roles + 19 permissions, 3 users (superadmin / admin / user)
 *   • Org structure: 8 departments, 10 positions, 6 ranks
 *   • Master data: awards, trainings, political parties, conflict areas
 *   • 25 staff with full sub-records (address / family / education /
 *     language / skill / position / rank / service-history) plus every
 *     movement and background module (promotions, transfers, separations,
 *     trainings, awards, military, activities, hobbies, political,
 *     conflict, criminal, disciplinary, foreign travel, documents).
 *
 * Notes:
 *   • Deterministic — a seeded PRNG (mulberry32) is used instead of
 *     Math.random, so every run produces the same dataset.
 *   • bcryptjs is imported directly here: src/lib/auth.ts pulls in
 *     'server-only', which cannot run in a plain bun script.
 *   • A dedicated PrismaClient instance is created on purpose — the app
 *     singleton in src/lib/db.ts uses a path alias that plain bun
 *     scripts cannot resolve.
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

/* ============================== helpers ============================== */

const d = (s: string): Date => new Date(s)
const clamp = (n: number, lo: number, hi: number): number => Math.min(Math.max(n, lo), hi)

/** Deterministic PRNG (mulberry32) — same data on every run. */
let rngState = 0x4d4f4745 // "MOGE"
function rand(): number {
  rngState |= 0
  rngState = (rngState + 0x6d2b79f5) | 0
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]
function pickN<T>(arr: readonly T[], n: number): T[] {
  const pool = [...arr]
  const out: T[] = []
  while (out.length < n && pool.length > 0) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0])
  return out
}
const reseed = (n: number): void => {
  rngState = (0x9e3779b9 ^ (n * 7919)) | 0
}

const LEVELS = ['POOR', 'FAIR', 'GOOD', 'EXCELLENT'] as const
type Proficiency = (typeof LEVELS)[number]
const shift = (lvl: Proficiency, delta: number): Proficiency => LEVELS[clamp(LEVELS.indexOf(lvl) + delta, 0, 3)]

const phoneFor = (i: number): string => `09-${['4', '7', '8', '9'][i % 4]}${412731 + i * 8471}`
const NRC_PREFIXES = [
  '12/XaKhata(N)', '1/KaMaYa(N)', '14/MaLaKa(N)', '7/SaKaNa(N)', '9/NaGaLa(N)', '3/LaMaTa(N)', '11/PaKaSa(N)',
  '6/TaNaLa(N)', '13/WaBaGa(N)', '2/YaKaNa(N)', '10/KaNaMa(N)', '4/SaPaKa(N)', '8/LaKaNa(N)', '5/GaDaBa(N)',
]
const nrcNo = (i: number): string => `${NRC_PREFIXES[i % 14]}${100000 + i * 3703}`

/* ========================= static reference data ========================= */

const DEPARTMENTS = [
  { key: 'MOE', name: 'Ministry of Energy', nameMm: 'စွမ်းအင်ဝန်ကြီးဌာန', parent: null as string | null, description: 'Root department of the ministry' },
  { key: 'HR', name: 'Human Resources', nameMm: 'လူ့စွမ်းအားရေးရာဌာန', parent: 'MOE', description: 'Personnel and human resources administration' },
  { key: 'FIN', name: 'Finance', nameMm: 'ဘဏ္ဍာရေးဌာန', parent: 'MOE', description: 'Budgeting, accounting and payroll' },
  { key: 'OPS', name: 'Operations', nameMm: 'ဆောင်ရွက်ရေးဌာန', parent: 'MOE', description: 'Field operations coordination' },
  { key: 'ENG', name: 'Engineering', nameMm: 'အင်ဂျင်နီယာဌာန', parent: 'MOE', description: 'Engineering divisions' },
  { key: 'LEG', name: 'Legal & Compliance', nameMm: 'ဥပဒေရေးရာနှင့် စည်းကမ်းထိန်းသိမ်းရေးဌာန', parent: 'MOE', description: 'Legal affairs and regulatory compliance' },
  { key: 'ENG-F', name: 'Field Engineering', nameMm: 'ကွင်းဆင်းအင်ဂျင်နီယာဌာန', parent: 'ENG', description: 'Field engineering and site works' },
  { key: 'ENG-M', name: 'Maintenance', nameMm: 'ထိန်းသိမ်းစောင့်ရှောက်ရေးဌာန', parent: 'ENG', description: 'Equipment and facility maintenance' },
] as const

const POSITIONS = [
  { key: 'DIR', code: 'POS-DIR', name: 'Director', nameMm: 'ညွှန်ကြားရေးမှူး', dept: 'HR', level: 10 },
  { key: 'DEP', code: 'POS-DDIR', name: 'Deputy Director', nameMm: 'ဒုတိယညွှန်ကြားရေးမှူး', dept: 'HR', level: 9 },
  { key: 'HRM', code: 'POS-HRM', name: 'HR Manager', nameMm: 'လူ့စွမ်းအားမန်နေဂျာ', dept: 'HR', level: 8 },
  { key: 'ACC', code: 'POS-ACC', name: 'Accountant', nameMm: 'စာရင်းကိုင်', dept: 'FIN', level: 7 },
  { key: 'FIM', code: 'POS-FM', name: 'Finance Manager', nameMm: 'ဘဏ္ဍာရေးမန်နေဂျာ', dept: 'FIN', level: 8 },
  { key: 'OPS', code: 'POS-OPS', name: 'Operations Officer', nameMm: 'ဆောင်ရွက်ရေးအရာရှိ', dept: 'OPS', level: 6 },
  { key: 'FEN', code: 'POS-FE', name: 'Field Engineer', nameMm: 'ကွင်းဆင်းအင်ဂျင်နီယာ', dept: 'ENG-F', level: 7 },
  { key: 'MNT', code: 'POS-MS', name: 'Maintenance Supervisor', nameMm: 'ထိန်းသိမ်းရေးကြီးကြပ်မှူး', dept: 'ENG-M', level: 6 },
  { key: 'LO', code: 'POS-LO', name: 'Legal Officer', nameMm: 'ဥပဒေရေးရာအရာရှိ', dept: 'LEG', level: 7 },
  { key: 'AA', code: 'POS-AA', name: 'Admin Assistant', nameMm: 'အုပ်ချုပ်ရေးကူထောက်', dept: 'HR', level: 5 },
] as const

const RANKS = [
  { key: 'R1', code: 'R1', name: 'Assistant', nameMm: 'လက်ထောက်', level: 1 },
  { key: 'R2', code: 'R2', name: 'Officer', nameMm: 'အရာရှိ', level: 2 },
  { key: 'R3', code: 'R3', name: 'Supervisor', nameMm: 'ကြီးကြပ်ရေးမှူး', level: 3 },
  { key: 'R4', code: 'R4', name: 'Manager', nameMm: 'စီမံခန့်ခွဲရေးမှူး', level: 4 },
  { key: 'R5', code: 'R5', name: 'Deputy Director', nameMm: 'ဒုတိယညွှန်ကြားရေးမှူး', level: 5 },
  { key: 'R6', code: 'R6', name: 'Director', nameMm: 'ညွှန်ကြားရေးမှူး', level: 6 },
] as const

/** Position level (5-10) → rank code. Current rank always matches current position level. */
const LEVEL_TO_RANK: Record<number, string> = { 5: 'R1', 6: 'R2', 7: 'R3', 8: 'R4', 9: 'R5', 10: 'R6' }

const DEPT_LOCATION: Record<string, string> = {
  MOE: 'Naypyitaw',
  HR: 'Yangon Head Office',
  FIN: 'Yangon Head Office',
  OPS: 'Yangon Head Office',
  ENG: 'Yangon Head Office',
  LEG: 'Yangon Head Office',
  'ENG-F': 'Chauk Field Office, Magway',
  'ENG-M': 'Mandalay Maintenance Depot',
}

const POS_MAP: Record<string, (typeof POSITIONS)[number]> = Object.fromEntries(POSITIONS.map((p) => [p.key, p]))
const DEPT_MAP: Record<string, (typeof DEPARTMENTS)[number]> = Object.fromEntries(DEPARTMENTS.map((p) => [p.key, p]))

/* ============================== staff specs ============================== */

interface Stage {
  pos: string
  dept: string
  start: Date
  end?: Date
  event: 'JOINING' | 'PROMOTION' | 'TRANSFER'
}
interface ExtraEvent {
  type: string
  title: string
  date: Date
}
interface StaffSpec {
  nameEn: string
  nameMm: string
  gender: 'MALE' | 'FEMALE'
  dob: Date
  pob: string
  religion: string
  nationality: string
  blood: string
  marital: string
  join: Date
  status: string
  stages: Stage[]
  extras: ExtraEvent[]
}

const S = (nameEn: string, nameMm: string, gender: 'MALE' | 'FEMALE', dob: string, pob: string, religion: string, nationality: string, blood: string, marital: string, join: string, status: string, stages: Stage[], extras: ExtraEvent[] = []): StaffSpec =>
  ({ nameEn, nameMm, gender, dob: d(dob), pob, religion, nationality, blood, marital, join: d(join), status, stages, extras })

// Careers: every staff has 2-3 StaffPosition rows; rank is derived from
// position level so StaffRank stays consistent with the held position.
const STAFF: StaffSpec[] = [
  // 0 — linked to the demo user account; rich timeline
  S('Aung Myint', 'အောင်မြင့်', 'MALE', '1962-05-14', 'Yangon', 'Buddhist', 'Myanmar', 'O+', 'MARRIED', '1995-03-01', 'ACTIVE', [
    { pos: 'HRM', dept: 'HR', start: d('1995-03-01'), end: d('2012-09-30'), event: 'JOINING' },
    { pos: 'DIR', dept: 'HR', start: d('2012-10-01'), event: 'PROMOTION' },
  ], [{ type: 'APPOINTMENT', title: 'Appointed as Head of HR Administration', date: d('2002-06-01') }]),
  S('Su Su Hlaing', 'စုစုလှိုင်', 'FEMALE', '1975-08-20', 'Mandalay', 'Buddhist', 'Myanmar', 'B+', 'MARRIED', '2001-07-02', 'ACTIVE', [
    { pos: 'HRM', dept: 'HR', start: d('2001-07-02'), end: d('2011-06-30'), event: 'JOINING' },
    { pos: 'DEP', dept: 'HR', start: d('2011-07-01'), event: 'PROMOTION' },
  ]),
  S('Kyaw Min Tun', 'ကျော်မင်းထွန်း', 'MALE', '1979-02-11', 'Taunggyi', 'Buddhist', 'Myanmar', 'A+', 'MARRIED', '2004-01-12', 'ACTIVE', [
    { pos: 'AA', dept: 'HR', start: d('2004-01-12'), end: d('2016-03-31'), event: 'JOINING' },
    { pos: 'HRM', dept: 'HR', start: d('2016-04-01'), event: 'PROMOTION' },
  ]),
  S('Mya Mya Swe', 'မြမြဆွေ', 'FEMALE', '1990-06-25', 'Yangon', 'Buddhist', 'Myanmar', 'AB+', 'SINGLE', '2012-03-05', 'ACTIVE', [
    { pos: 'AA', dept: 'HR', start: d('2012-03-05'), end: d('2019-02-28'), event: 'JOINING' },
    { pos: 'AA', dept: 'FIN', start: d('2019-03-01'), event: 'TRANSFER' },
  ], [{ type: 'APPOINTMENT', title: 'Appointed as personnel records coordinator', date: d('2021-04-01') }]),
  S('Thin Thin Aye', 'သင်းသင်းအေး', 'FEMALE', '1982-09-17', 'Magway', 'Buddhist', 'Myanmar', 'AB+', 'MARRIED', '2006-11-20', 'ACTIVE', [
    { pos: 'ACC', dept: 'FIN', start: d('2006-11-20'), end: d('2018-01-14'), event: 'JOINING' },
    { pos: 'FIM', dept: 'FIN', start: d('2018-01-15'), event: 'PROMOTION' },
  ]),
  S('Zaw Win Oo', 'ဇော်ဝင်းဦး', 'MALE', '1977-12-03', 'Yangon', 'Buddhist', 'Myanmar', 'B+', 'MARRIED', '2002-08-15', 'ACTIVE', [
    { pos: 'AA', dept: 'HR', start: d('2002-08-15'), end: d('2008-09-30'), event: 'JOINING' },
    { pos: 'ACC', dept: 'FIN', start: d('2008-10-01'), event: 'PROMOTION' },
  ]),
  S('Aye Aye Mar', 'အေးအေးမာ', 'FEMALE', '1988-04-07', 'Bago', 'Buddhist', 'Myanmar', 'O+', 'MARRIED', '2011-05-30', 'ACTIVE', [
    { pos: 'AA', dept: 'HR', start: d('2011-05-30'), end: d('2020-04-30'), event: 'JOINING' },
    { pos: 'ACC', dept: 'FIN', start: d('2020-05-01'), event: 'PROMOTION' },
  ]),
  S('Myat Thu', 'မြသူ', 'MALE', '1986-10-28', 'Pyin Oo Lwin', 'Buddhist', 'Myanmar', 'A+', 'SINGLE', '2009-09-14', 'ACTIVE', [
    { pos: 'AA', dept: 'HR', start: d('2009-09-14'), end: d('2014-07-31'), event: 'JOINING' },
    { pos: 'OPS', dept: 'OPS', start: d('2014-08-01'), event: 'PROMOTION' },
  ]),
  S('Khin Sandar Win', 'ခင်စန္ဒာဝင်း', 'FEMALE', '1991-03-19', 'Yangon', 'Buddhist', 'Myanmar', 'B+', 'SINGLE', '2015-02-09', 'ACTIVE', [
    { pos: 'AA', dept: 'HR', start: d('2015-02-09'), end: d('2019-06-30'), event: 'JOINING' },
    { pos: 'AA', dept: 'OPS', start: d('2019-07-01'), end: d('2020-08-31'), event: 'TRANSFER' },
    { pos: 'OPS', dept: 'OPS', start: d('2020-09-01'), event: 'PROMOTION' },
  ]),
  S('Than Tun', 'သန်းထွန်း', 'MALE', '1974-07-08', 'Mawlamyine', 'Buddhist', 'Myanmar', 'O+', 'MARRIED', '1998-06-01', 'ACTIVE', [
    { pos: 'AA', dept: 'HR', start: d('1998-06-01'), end: d('2005-07-31'), event: 'JOINING' },
    { pos: 'OPS', dept: 'OPS', start: d('2005-08-01'), event: 'PROMOTION' },
  ], [{ type: 'APPOINTMENT', title: 'Appointed as field operations coordinator', date: d('2012-04-01') }]),
  S('Tin Maung Oo', 'တင်မောင်ဦး', 'MALE', '1981-01-15', 'Mandalay', 'Buddhist', 'Myanmar', 'A+', 'MARRIED', '2005-04-18', 'ACTIVE', [
    { pos: 'OPS', dept: 'OPS', start: d('2005-04-18'), end: d('2010-05-31'), event: 'JOINING' },
    { pos: 'FEN', dept: 'ENG-F', start: d('2010-06-01'), event: 'PROMOTION' },
  ]),
  S('Nyi Nyi Aung', 'ညီညီအောင်', 'MALE', '1987-11-23', 'Monywa', 'Buddhist', 'Myanmar', 'B+', 'MARRIED', '2010-10-11', 'ACTIVE', [
    { pos: 'OPS', dept: 'OPS', start: d('2010-10-11'), end: d('2018-03-31'), event: 'JOINING' },
    { pos: 'FEN', dept: 'ENG-F', start: d('2018-04-01'), event: 'PROMOTION' },
  ]),
  S('Hla Win', 'လှဝင်း', 'MALE', '1972-02-27', 'Sagaing', 'Buddhist', 'Myanmar', 'O+', 'MARRIED', '1996-09-02', 'ACTIVE', [
    { pos: 'AA', dept: 'HR', start: d('1996-09-02'), end: d('2009-02-28'), event: 'JOINING' },
    { pos: 'MNT', dept: 'ENG-M', start: d('2009-03-01'), event: 'PROMOTION' },
  ]),
  S('Win Naing', 'ဝင်းနိုင်', 'MALE', '1984-08-09', 'Yangon', 'Buddhist', 'Myanmar', 'A+', 'MARRIED', '2008-07-21', 'ACTIVE', [
    { pos: 'OPS', dept: 'OPS', start: d('2008-07-21'), end: d('2015-08-31'), event: 'JOINING' },
    { pos: 'MNT', dept: 'ENG-M', start: d('2015-09-01'), event: 'TRANSFER' },
  ]),
  S('Kyi Kyi Naing', 'ကြီးကြီးနိုင်', 'FEMALE', '1980-05-16', 'Yangon', 'Buddhist', 'Myanmar', 'AB+', 'MARRIED', '2003-03-24', 'ACTIVE', [
    { pos: 'OPS', dept: 'OPS', start: d('2003-03-24'), end: d('2009-06-30'), event: 'JOINING' },
    { pos: 'LO', dept: 'LEG', start: d('2009-07-01'), event: 'PROMOTION' },
  ]),
  S('Cho Cho Lwin', 'ချိုချိုလွင်', 'FEMALE', '1985-12-12', 'Taunggyi', 'Buddhist', 'Myanmar (Shan)', 'B+', 'DIVORCED', '2009-01-05', 'ACTIVE', [
    { pos: 'OPS', dept: 'OPS', start: d('2009-01-05'), end: d('2016-08-31'), event: 'JOINING' },
    { pos: 'LO', dept: 'LEG', start: d('2016-09-01'), event: 'PROMOTION' },
  ]),
  S('Ko Ko Gyi', 'ကိုကိုကြီး', 'MALE', '1976-04-30', 'Yangon', 'Hindu', 'Myanmar', 'O+', 'MARRIED', '2000-02-14', 'ACTIVE', [
    { pos: 'OPS', dept: 'OPS', start: d('2000-02-14'), end: d('2006-03-31'), event: 'JOINING' },
    { pos: 'ACC', dept: 'FIN', start: d('2006-04-01'), event: 'PROMOTION' },
  ]),
  S('Min Thein', 'မင်းသိန်း', 'MALE', '1989-09-05', 'Magway', 'Christian', 'Myanmar', 'A+', 'SINGLE', '2013-06-10', 'ACTIVE', [
    { pos: 'OPS', dept: 'OPS', start: d('2013-06-10'), end: d('2018-09-30'), event: 'JOINING' },
    { pos: 'FEN', dept: 'ENG-F', start: d('2018-10-01'), event: 'PROMOTION' },
  ]),
  S('Ei Ei Zin', 'အီအီဇင်', 'FEMALE', '1993-07-14', 'Yangon', 'Buddhist', 'Myanmar', 'B+', 'SINGLE', '2017-08-07', 'ACTIVE', [
    { pos: 'AA', dept: 'HR', start: d('2017-08-07'), end: d('2021-03-31'), event: 'JOINING' },
    { pos: 'AA', dept: 'FIN', start: d('2021-04-01'), event: 'TRANSFER' },
  ]),
  S('Aung Kyaw', 'အောင်ကျော်', 'MALE', '1995-01-20', 'Bago', 'Buddhist', 'Myanmar', 'O+', 'SINGLE', '2020-05-04', 'ACTIVE', [
    { pos: 'AA', dept: 'HR', start: d('2020-05-04'), end: d('2023-02-28'), event: 'JOINING' },
    { pos: 'OPS', dept: 'OPS', start: d('2023-03-01'), event: 'PROMOTION' },
  ]),
  // 20 — RETIRED
  S('Soe Win', 'စိုးဝင်း', 'MALE', '1963-10-09', 'Myitkyina', 'Buddhist', 'Myanmar (Kachin)', 'A+', 'MARRIED', '1995-03-01', 'RETIRED', [
    { pos: 'AA', dept: 'HR', start: d('1995-03-01'), end: d('2005-07-31'), event: 'JOINING' },
    { pos: 'OPS', dept: 'OPS', start: d('2005-08-01'), end: d('2023-10-08'), event: 'PROMOTION' },
  ]),
  // 21 — RETIRED
  S('Sandar Myint', 'စန္ဒာမြင့်', 'FEMALE', '1965-03-08', 'Mandalay', 'Christian', 'Myanmar', 'AB+', 'WIDOWED', '1995-07-10', 'RETIRED', [
    { pos: 'OPS', dept: 'OPS', start: d('1995-07-10'), end: d('2005-06-30'), event: 'JOINING' },
    { pos: 'ACC', dept: 'FIN', start: d('2005-07-01'), end: d('2025-03-07'), event: 'PROMOTION' },
  ]),
  // 22 — RESIGNED
  S('Thet Naing Oo', 'သက်နိုင်ဦး', 'MALE', '1992-11-27', 'Yangon', 'Buddhist', 'Myanmar', 'B+', 'SINGLE', '2016-04-11', 'RESIGNED', [
    { pos: 'OPS', dept: 'OPS', start: d('2016-04-11'), end: d('2020-10-31'), event: 'JOINING' },
    { pos: 'FEN', dept: 'ENG-F', start: d('2020-11-01'), end: d('2024-06-29'), event: 'PROMOTION' },
  ]),
  // 23 — TRANSFERRED OUT
  S('Yu Yu Nwe', 'ယုယုနွဲ့', 'FEMALE', '1990-02-18', 'Yangon', 'Buddhist', 'Myanmar', 'O+', 'MARRIED', '2014-09-01', 'TRANSFERRED', [
    { pos: 'OPS', dept: 'OPS', start: d('2014-09-01'), end: d('2019-04-30'), event: 'JOINING' },
    { pos: 'ACC', dept: 'FIN', start: d('2019-05-01'), end: d('2024-11-14'), event: 'PROMOTION' },
  ]),
  // 24 — SUSPENDED (criminal record + disciplinary case)
  S('Moe Moe Khaing', 'မိုးမိုးခိုင်', 'FEMALE', '1986-06-11', 'Hpa-an', 'Buddhist', 'Myanmar (Kayin)', 'B+', 'MARRIED', '2010-02-01', 'SUSPENDED', [
    { pos: 'AA', dept: 'HR', start: d('2010-02-01'), end: d('2016-07-31'), event: 'JOINING' },
    { pos: 'OPS', dept: 'OPS', start: d('2016-08-01'), event: 'PROMOTION' },
  ], [{ type: 'OTHER', title: 'Suspended from duty pending disciplinary review', date: d('2025-01-10') }]),
]

/* ========================= movement & module data ========================= */

// 8 promotions: 5 APPROVED (past, reflected in history) + 3 PENDING (future)
const PROMOTIONS: Array<{ si: number; from: string; to: string; applied: string; effective: string; status: string; authority: string; remarks: string }> = [
  { si: 0, from: 'R4', to: 'R6', applied: '2012-08-15', effective: '2012-10-01', status: 'APPROVED', authority: 'Ministry of Energy', remarks: 'Promoted to Director of Human Resources' },
  { si: 2, from: 'R1', to: 'R4', applied: '2016-02-20', effective: '2016-04-01', status: 'APPROVED', authority: 'Ministry of Energy', remarks: 'Promoted to HR Manager' },
  { si: 4, from: 'R3', to: 'R4', applied: '2017-11-05', effective: '2018-01-15', status: 'APPROVED', authority: 'Ministry of Energy', remarks: 'Promoted to Finance Manager' },
  { si: 6, from: 'R1', to: 'R3', applied: '2020-03-12', effective: '2020-05-01', status: 'APPROVED', authority: 'MOGE Management', remarks: 'Promoted to Accountant' },
  { si: 12, from: 'R1', to: 'R2', applied: '2009-01-10', effective: '2009-03-01', status: 'APPROVED', authority: 'MOGE Management', remarks: 'Promoted to Maintenance Supervisor' },
  { si: 3, from: 'R1', to: 'R2', applied: '2025-05-10', effective: '2025-07-01', status: 'PENDING', authority: 'MOGE Management', remarks: 'Proposed promotion to Officer grade' },
  { si: 11, from: 'R3', to: 'R4', applied: '2025-06-02', effective: '2025-08-01', status: 'PENDING', authority: 'Ministry of Energy', remarks: 'Proposed promotion to Manager grade' },
  { si: 8, from: 'R2', to: 'R3', applied: '2025-06-25', effective: '2025-09-01', status: 'PENDING', authority: 'MOGE Management', remarks: 'Proposed promotion to Supervisor grade' },
]

// 5 transfers: 3 APPROVED (past) + 2 PENDING
const TRANSFERS: Array<{ si: number; fromDept: string; toDept: string; fromPos: string; toPos: string; date: string; reason: string; status: string; remarks: string }> = [
  { si: 13, fromDept: 'OPS', toDept: 'ENG-M', fromPos: 'OPS', toPos: 'MNT', date: '2015-09-01', reason: 'Reassigned to maintenance division', status: 'APPROVED', remarks: 'Departmental restructuring' },
  { si: 8, fromDept: 'HR', toDept: 'OPS', fromPos: 'AA', toPos: 'AA', date: '2019-07-01', reason: 'Staffing reallocation', status: 'APPROVED', remarks: 'Administrative support reallocation' },
  { si: 18, fromDept: 'HR', toDept: 'FIN', fromPos: 'AA', toPos: 'AA', date: '2021-04-01', reason: 'Administrative support reallocation', status: 'APPROVED', remarks: 'Finance records support' },
  { si: 17, fromDept: 'ENG-F', toDept: 'OPS', fromPos: 'FEN', toPos: 'OPS', date: '2025-08-15', reason: 'Requested transfer for family reasons', status: 'PENDING', remarks: 'Awaiting department head approval' },
  { si: 6, fromDept: 'FIN', toDept: 'HR', fromPos: 'ACC', toPos: 'ACC', date: '2025-10-01', reason: 'Finance administrative realignment', status: 'PENDING', remarks: 'Proposed under restructuring plan' },
]

// 4 separations (2 RETIREMENT / 1 RESIGNATION / 1 TRANSFER_OUT)
const SEPARATIONS: Array<{ si: number; type: string; reason: string; effective: string; finalRank: string; finalPos: string; remarks: string }> = [
  { si: 20, type: 'RETIREMENT', reason: 'Reached mandatory retirement age (60)', effective: '2023-10-09', finalRank: 'R2', finalPos: 'OPS', remarks: '28 years of dedicated service' },
  { si: 21, type: 'RETIREMENT', reason: 'Reached mandatory retirement age (60)', effective: '2025-03-08', finalRank: 'R3', finalPos: 'ACC', remarks: '29 years of dedicated service' },
  { si: 22, type: 'RESIGNATION', reason: 'Personal reasons — pursuing private sector career', effective: '2024-06-30', finalRank: 'R3', finalPos: 'FEN', remarks: 'Resignation accepted by management' },
  { si: 23, type: 'TRANSFER_OUT', reason: 'Transferred to Ministry of Planning and Finance by ministerial order', effective: '2024-11-15', finalRank: 'R3', finalPos: 'ACC', remarks: 'Ministerial transfer order no. 94/2024' },
]

// 15 staff trainings (4 foreign: Singapore / Japan / Malaysia / Thailand)
const STAFF_TRAININGS: Array<{ si: number; master?: string; course: string; inst: string; loc: string; country: string; start: string; end: string; result: string; foreign: boolean }> = [
  { si: 0, course: 'Senior Leadership Program', inst: 'NUS Executive Education', loc: 'Singapore', country: 'Singapore', start: '2017-09-04', end: '2017-09-22', result: 'Completed', foreign: true },
  { si: 10, course: 'Petroleum Engineering Workshop', inst: 'JICA Training Centre, Tokyo', loc: 'Tokyo', country: 'Japan', start: '2018-05-14', end: '2018-06-01', result: 'Completed', foreign: true },
  { si: 5, course: 'Oil & Gas Accounting Standards', inst: 'PETRONAS Training Centre', loc: 'Kuala Lumpur', country: 'Malaysia', start: '2020-02-10', end: '2020-02-28', result: 'Passed', foreign: true },
  { si: 17, course: 'Basic Offshore Safety (BOSIET)', inst: 'Chonburi Safety Institute', loc: 'Chonburi', country: 'Thailand', start: '2019-11-04', end: '2019-11-15', result: 'Passed', foreign: true },
  { si: 1, master: 'Leadership Development', course: 'Leadership Development', inst: 'Myanmar Management Institute', loc: 'Yangon', country: 'Myanmar', start: '2015-03-02', end: '2015-03-13', result: 'Passed', foreign: false },
  { si: 2, master: 'Leadership Development', course: 'Leadership Development', inst: 'Myanmar Management Institute', loc: 'Yangon', country: 'Myanmar', start: '2019-08-05', end: '2019-08-16', result: 'Passed', foreign: false },
  { si: 4, master: 'Financial Management', course: 'Financial Management', inst: 'Yangon Institute of Economics', loc: 'Yangon', country: 'Myanmar', start: '2017-06-01', end: '2017-06-12', result: 'Distinction', foreign: false },
  { si: 6, master: 'Financial Management', course: 'Financial Management', inst: 'Yangon Institute of Economics', loc: 'Yangon', country: 'Myanmar', start: '2021-09-06', end: '2021-09-17', result: 'Passed', foreign: false },
  { si: 8, master: 'English Language Course', course: 'English Language Course', inst: 'British Council Yangon', loc: 'Yangon', country: 'Myanmar', start: '2018-01-15', end: '2018-03-30', result: 'Completed', foreign: false },
  { si: 11, master: 'Safety Training', course: 'Safety Training', inst: 'MOGE Training Centre', loc: 'Yangon', country: 'Myanmar', start: '2020-02-10', end: '2020-02-14', result: 'Passed', foreign: false },
  { si: 12, master: 'Safety Training', course: 'Safety Training', inst: 'MOGE Training Centre', loc: 'Yangon', country: 'Myanmar', start: '2016-05-09', end: '2016-05-13', result: 'Passed', foreign: false },
  { si: 14, master: 'Project Management', course: 'Project Management', inst: 'Myanmar Management Institute', loc: 'Yangon', country: 'Myanmar', start: '2019-10-07', end: '2019-10-18', result: 'Distinction', foreign: false },
  { si: 16, master: 'Project Management', course: 'Project Management', inst: 'Myanmar Management Institute', loc: 'Yangon', country: 'Myanmar', start: '2022-04-04', end: '2022-04-15', result: 'Passed', foreign: false },
  { si: 18, master: 'English Language Course', course: 'English Language Course', inst: 'British Council Yangon', loc: 'Yangon', country: 'Myanmar', start: '2023-02-06', end: '2023-04-21', result: 'Completed', foreign: false },
  { si: 3, master: 'English Language Course', course: 'English Language Course', inst: 'British Council Yangon', loc: 'Yangon', country: 'Myanmar', start: '2024-06-03', end: '2024-08-16', result: 'Completed', foreign: false },
]

// 10 staff awards (titles from the award master)
const STAFF_AWARDS: Array<{ si: number; award: string; date: string; authority: string; reason: string }> = [
  { si: 0, award: 'Employee of the Year', date: '2015-12-31', authority: 'Ministry of Energy', reason: 'Outstanding leadership of HR reforms' },
  { si: 1, award: 'Long Service Medal', date: '2025-01-31', authority: 'MOGE', reason: 'Nearly 25 years of dedicated service' },
  { si: 2, award: 'Excellence Award', date: '2019-03-15', authority: 'MOGE Management', reason: 'Process improvement in personnel records' },
  { si: 4, award: 'Employee of the Year', date: '2021-12-31', authority: 'Ministry of Energy', reason: 'Digitisation of payroll workflows' },
  { si: 5, award: 'Long Service Medal', date: '2018-08-15', authority: 'MOGE', reason: 'Long and dedicated service' },
  { si: 7, award: 'Excellence Award', date: '2022-05-20', authority: 'MOGE Management', reason: 'Reliable field operations support' },
  { si: 12, award: 'Safety Champion', date: '2021-06-10', authority: 'MOGE Safety Board', reason: 'Zero-accident maintenance record' },
  { si: 10, award: 'Safety Champion', date: '2023-04-28', authority: 'MOGE Safety Board', reason: 'Outstanding site safety performance' },
  { si: 16, award: 'Long Service Medal', date: '2022-02-14', authority: 'MOGE', reason: 'Long and dedicated service' },
  { si: 20, award: 'Long Service Medal', date: '2023-09-29', authority: 'Ministry of Energy', reason: '28 years of distinguished service' },
]

const MILITARY_SERVICES: Array<{ si: number; no: string; unit: string; rank: string; position: string; start: string; end: string; status: string; training: string; remarks: string }> = [
  { si: 9, no: 'MS-118824', unit: 'Light Infantry Battalion 77', rank: 'Sergeant', position: 'Section Commander', start: '1990-03-01', end: '1998-01-15', status: 'Discharged', training: 'Basic Military Training', remarks: 'Served 8 years before joining MOGE' },
  { si: 12, no: 'MS-094512', unit: 'Engineer Battalion 501', rank: 'Corporal', position: 'Combat Engineer', start: '1991-06-01', end: '1996-03-31', status: 'Discharged', training: 'Combat Engineer Course', remarks: 'Honourable discharge' },
  { si: 20, no: 'MS-071203', unit: 'Infantry Battalion 102', rank: 'Sergeant', position: 'Company Clerk', start: '1982-11-05', end: '1995-02-28', status: 'Retired', training: 'Basic Military Training', remarks: '12 years of service before civil career' },
  { si: 10, no: 'MS-221007', unit: 'Military Engineering Corps', rank: 'Lieutenant', position: 'Field Engineer', start: '2000-07-01', end: '2004-09-30', status: 'Discharged', training: 'Officer Training Course', remarks: 'Commissioned officer, engineering branch' },
  { si: 11, no: 'MS-245678', unit: 'Light Infantry Battalion 66', rank: 'Private', position: 'Rifleman', start: '2006-01-10', end: '2008-06-30', status: 'Discharged', training: 'Basic Military Training', remarks: 'National service' },
  { si: 16, no: 'MS-132560', unit: 'Combat Engineer Regiment 2', rank: 'Sergeant', position: 'Demolition Specialist', start: '1994-08-01', end: '2000-02-13', status: 'Discharged', training: 'Combat Engineer Course', remarks: 'Honourable discharge' },
]

const ACTIVITIES: Array<{ si: number; type: string; name: string; role: string; date: string; desc: string }> = [
  { si: 0, type: 'ORGANIZATIONAL', name: 'Staff Welfare Association', role: 'Chairman', date: '2018-01-01', desc: 'Leads welfare planning for HQ staff' },
  { si: 2, type: 'PROFESSIONAL', name: 'Myanmar Engineering Society', role: 'Member', date: '2016-05-01', desc: 'Attends technical seminars' },
  { si: 4, type: 'PROFESSIONAL', name: 'Myanmar Accountants Association', role: 'Member', date: '2019-03-10', desc: 'Continuing professional education' },
  { si: 12, type: 'ORGANIZATIONAL', name: 'Workplace Safety Committee', role: 'Secretary', date: '2020-06-15', desc: 'Coordinates monthly safety inspections' },
  { si: 14, type: 'COMMUNITY', name: 'Myanmar Red Cross Society', role: 'Volunteer', date: '2015-08-20', desc: 'First-aid training volunteer' },
  { si: 7, type: 'SOCIAL', name: 'Staff Sports Club', role: 'Treasurer', date: '2021-02-01', desc: 'Organises annual staff tournament' },
  { si: 9, type: 'COMMUNITY', name: 'Community Library Support Group', role: 'Volunteer', date: '2017-09-05', desc: 'Weekend book sorting and tutoring' },
  { si: 17, type: 'COMMUNITY', name: 'Blood Donation Network', role: 'Regular Donor', date: '2022-01-10', desc: 'Donates twice a year' },
]

const HOBBIES: Array<{ si: number; name: string; desc: string; level: string }> = [
  { si: 0, name: 'Reading', desc: 'Biographies and history', level: 'Casual' },
  { si: 1, name: 'Gardening', desc: 'Orchid cultivation', level: 'Amateur' },
  { si: 2, name: 'Football', desc: 'Weekend league player', level: 'Intermediate' },
  { si: 3, name: 'Photography', desc: 'Street photography', level: 'Amateur' },
  { si: 4, name: 'Cooking', desc: 'Myanmar cuisine', level: 'Intermediate' },
  { si: 5, name: 'Chess', desc: 'Office chess club member', level: 'Intermediate' },
  { si: 6, name: 'Badminton', desc: 'Morning games twice a week', level: 'Intermediate' },
  { si: 8, name: 'Music', desc: 'Plays guitar in the staff band', level: 'Amateur' },
  { si: 10, name: 'Cycling', desc: 'Weekend long rides', level: 'Intermediate' },
  { si: 13, name: 'Fishing', desc: 'Angling on weekends', level: 'Casual' },
]

const POLITICAL_MEMBERSHIPS: Array<{ si: number; party: 'USDP' | 'NLD'; no: string; position: string; join: string; leave?: string; status: string; remarks: string }> = [
  { si: 9, party: 'USDP', no: 'USDP-YGN-2341', position: 'Member', join: '2011-02-10', status: 'ACTIVE', remarks: 'Registered party membership, declared to HR' },
  { si: 15, party: 'NLD', no: 'NLD-YGN-1087', position: 'Member', join: '2013-08-05', status: 'ACTIVE', remarks: 'Registered party membership, declared to HR' },
  { si: 20, party: 'USDP', no: 'USDP-YGN-0912', position: 'Member', join: '2010-06-20', leave: '2019-04-01', status: 'INACTIVE', remarks: 'Membership lapsed; declared to HR' },
]

const CONFLICT_ASSIGNMENTS: Array<{ si: number; area: string; unit: string; position: string; deploy: string; ret?: string; reason: string; notes: string }> = [
  { si: 10, area: 'Northern Command Area', unit: 'Pipeline Security Detachment', position: 'Site Engineer', deploy: '2021-03-15', ret: '2021-06-20', reason: 'Pipeline protection and repair detail', notes: 'Completed without incident' },
  { si: 11, area: 'Eastern Command Area', unit: 'Field Maintenance Team', position: 'Deputy Team Lead', deploy: '2022-08-01', ret: '2022-12-15', reason: 'Field equipment support', notes: 'Rotational deployment' },
  { si: 17, area: 'Western Command Area', unit: 'Offshore Support Group', position: 'Field Engineer', deploy: '2023-01-10', ret: '2023-04-30', reason: 'Offshore platform inspection', notes: 'Four-month rotation' },
  { si: 12, area: 'Northern Command Area', unit: 'Equipment Recovery Unit', position: 'Maintenance Supervisor', deploy: '2019-11-05', ret: '2020-02-28', reason: 'Equipment recovery operation', notes: 'Winter deployment' },
]

const CRIMINAL_RECORDS: Array<{ si: number; caseNumber: string; caseType: string; court: string; offense: string; caseDate: string; status: string; judgment: string; penalty: string; notes: string }> = [
  { si: 24, caseNumber: 'CR-2023-014', caseType: 'Traffic', court: 'Yangon West District Court', offense: 'Traffic violation', caseDate: '2023-05-12', status: 'Closed', judgment: 'Fined; case closed', penalty: 'Fine of MMK 30,000', notes: 'Minor traffic offense; fully resolved' },
]

const DISCIPLINARY_CASES: Array<{
  si: number; caseNumber: string; type: string; title: string; desc: string; opened: string; status: string
  decision?: string; penalty?: string; closed?: string
  action: { actionType: string; desc: string; date: string; authority: string }
}> = [
  {
    si: 19, caseNumber: 'DC-2024-002', type: 'WARNING', title: 'Late attendance', desc: 'Repeated late arrival during March 2024.',
    opened: '2024-03-10', status: 'CLOSED', decision: 'Formal warning issued', penalty: 'Verbal warning', closed: '2024-04-05',
    action: { actionType: 'WARNING_ISSUED', desc: 'Verbal warning delivered and acknowledged', date: '2024-03-15', authority: 'HR Department' },
  },
  {
    si: 24, caseNumber: 'DC-2025-001', type: 'SUSPENSION', title: 'Unauthorized absence during duty hours',
    desc: 'Left duty station without approval on multiple occasions in December 2024.',
    opened: '2024-12-20', status: 'DECIDED', decision: 'Suspension approved', penalty: '3 days suspension', closed: '2025-01-10',
    action: { actionType: 'SUSPENSION', desc: 'Three-day suspension effective 10 January 2025', date: '2025-01-10', authority: 'Disciplinary Committee' },
  },
  {
    si: 11, caseNumber: 'DC-2025-003', type: 'INVESTIGATION', title: 'Allegation of misuse of company vehicle',
    desc: 'Company pickup allegedly used for private trips; under internal investigation.',
    opened: '2025-06-18', status: 'OPEN',
    action: { actionType: 'INVESTIGATION_STARTED', desc: 'Internal audit team assigned to the case', date: '2025-06-20', authority: 'Internal Audit' },
  },
]

const FOREIGN_TRAVELS: Array<{ si: number; purpose: string; country: string; org: string; sponsor: string; start: string; end: string; ref: string }> = [
  { si: 0, purpose: 'CONFERENCE', country: 'Singapore', org: 'International Energy Week', sponsor: 'MOGE', start: '2019-10-21', end: '2019-10-25', ref: 'MOGE/FT/2019/041' },
  { si: 2, purpose: 'TRAINING', country: 'Japan', org: 'JICA Institute, Tokyo', sponsor: 'JICA', start: '2018-09-02', end: '2018-09-16', ref: 'MOGE/FT/2018/027' },
  { si: 4, purpose: 'OFFICIAL', country: 'China', org: 'CNPC Headquarters, Beijing', sponsor: 'MOGE', start: '2019-04-08', end: '2019-04-14', ref: 'MOGE/FT/2019/015' },
  { si: 10, purpose: 'OFFICIAL', country: 'Thailand', org: 'PTTEP Bangkok Office', sponsor: 'MOGE', start: '2017-02-13', end: '2017-02-18', ref: 'MOGE/FT/2017/009' },
  { si: 11, purpose: 'CONFERENCE', country: 'South Korea', org: 'Offshore Technology Seminar, Busan', sponsor: 'MOGE', start: '2023-06-05', end: '2023-06-09', ref: 'MOGE/FT/2023/012' },
  { si: 6, purpose: 'TRAINING', country: 'Germany', org: 'SAP Academy, Walldorf', sponsor: 'GIZ', start: '2022-09-12', end: '2022-09-24', ref: 'MOGE/FT/2022/033' },
]

const CLOSE_CONTACTS: Array<{ si: number; name: string; relationship: string; occupation: string; address: string; phone: string; desc: string }> = [
  { si: 0, name: 'Khin Maung Win', relationship: 'Colleague', occupation: 'Senior Engineer', address: 'No. 45, Insein Road, Yangon', phone: '09-73122100', desc: 'Close friend and former classmate' },
  { si: 1, name: 'Thida Aung', relationship: 'Neighbour', occupation: 'Teacher', address: 'Bahan Township, Yangon', phone: '09-77221400', desc: 'Next-door neighbour' },
  { si: 2, name: 'U Myo Min', relationship: 'Colleague', occupation: 'Accountant', address: 'Kamayut Township, Yangon', phone: '09-98001234', desc: 'Trusted colleague in finance section' },
  { si: 4, name: 'Daw Kyi Kyi Win', relationship: 'Relative', occupation: 'Retired Teacher', address: 'Thingangyun Township, Yangon', phone: '09-45012345', desc: 'Maternal aunt' },
  { si: 24, name: 'Aye Chan', relationship: 'Friend', occupation: 'Pharmacist', address: 'Hlaing Township, Yangon', phone: '09-41200099', desc: 'Emergency contact during suspension period' },
]

const REFERENCES: Array<{ si: number; name: string; relationship: string; position: string; org: string; phone: string; address: string; desc: string }> = [
  { si: 0, name: 'U Thein Hlaing', relationship: 'Former Supervisor', position: 'Director (Retired)', org: 'Ministry of Energy', phone: '09-42133445', address: 'Yangon', desc: 'Supervised candidate during 1995-2005' },
  { si: 2, name: 'Daw Mya Thida', relationship: 'Former Lecturer', position: 'Professor (Retired)', org: 'Yangon Institute of Economics', phone: '09-77110022', address: 'Yangon', desc: 'Academic referee' },
  { si: 3, name: 'U Sein Win', relationship: 'Former Employer', position: 'Office Manager', org: 'Shwebo Trading Co.', phone: '09-73244556', address: 'Yangon', desc: 'Employment reference, 2010-2012' },
  { si: 7, name: 'U Kyaw Htay', relationship: 'Community Elder', position: 'Ward Administrator', org: 'Yangon City', phone: '09-96677889', address: 'Yangon', desc: 'Character reference' },
  { si: 11, name: 'Zaw Min (Retired Captain)', relationship: 'Former Commanding Officer', position: 'Company Commander', org: 'Light Infantry Battalion 66', phone: '09-43322110', address: 'Monywa', desc: 'Military service reference' },
  { si: 14, name: 'Daw Khin Htar', relationship: 'Former Supervisor', position: 'Legal Director (Retired)', org: 'Myanma Oil and Gas Enterprise', phone: '09-78990011', address: 'Yangon', desc: 'Professional reference' },
]

const DOCUMENTS: Array<{ si: number; title: string; category: string; file: string; access: string; size: number; expiry?: string }> = [
  { si: 0, title: 'NRC Copy — Aung Myint', category: 'NRC', file: 'demo-nrc-aung-myint.pdf', access: 'INTERNAL', size: 184320, expiry: '2027-12-31' },
  { si: 2, title: 'MBA Certificate — Kyaw Min Tun', category: 'EDUCATION', file: 'demo-mba-kyaw-min-tun.pdf', access: 'INTERNAL', size: 246784 },
  { si: 0, title: 'Appointment Letter — Director (2012)', category: 'EMPLOYMENT', file: 'demo-appointment-director-2012.pdf', access: 'RESTRICTED', size: 98304 },
  { si: 10, title: 'Japan Training Certificate — Petroleum Engineering (2018)', category: 'TRAINING', file: 'demo-training-japan-2018.pdf', access: 'INTERNAL', size: 131072 },
  { si: 4, title: 'Employee of the Year Certificate (2021)', category: 'AWARD', file: 'demo-award-excellence-2021.pdf', access: 'INTERNAL', size: 76800 },
  { si: 24, title: 'Medical Fitness Report', category: 'MEDICAL', file: 'demo-medical-report-2025.pdf', access: 'CONFIDENTIAL', size: 212992 },
]

/* ====================== per-staff generation pools ====================== */

const YANGON_TOWNSHIPS = [
  { t: 'Hlaing', dd: 'Yangon (West)', r: 'Yangon Region' },
  { t: 'Kamayut', dd: 'Yangon', r: 'Yangon Region' },
  { t: 'Bahan', dd: 'Yangon (East)', r: 'Yangon Region' },
  { t: 'Thingangyun', dd: 'Yangon (East)', r: 'Yangon Region' },
  { t: 'Mayangone', dd: 'Yangon (West)', r: 'Yangon Region' },
  { t: 'Insein', dd: 'Yangon (North)', r: 'Yangon Region' },
  { t: 'Lanmadaw', dd: 'Yangon (West)', r: 'Yangon Region' },
  { t: 'North Okkalapa', dd: 'Yangon (East)', r: 'Yangon Region' },
] as const
const ALL_TOWNSHIPS = [
  ...YANGON_TOWNSHIPS,
  { t: 'Mandalay', dd: 'Mandalay', r: 'Mandalay Region' },
  { t: 'Patheingyi', dd: 'Mandalay', r: 'Mandalay Region' },
  { t: 'Amarapura', dd: 'Mandalay', r: 'Mandalay Region' },
  { t: 'Taunggyi', dd: 'Taunggyi', r: 'Shan State' },
  { t: 'Pyin Oo Lwin', dd: 'Mandalay', r: 'Mandalay Region' },
] as const
const STREETS = ['Pyay Road', 'Insein Road', 'Kabar Aye Pagoda Road', 'University Avenue Road', 'Bogyoke Aung San Road', 'Thiri Road', 'Zabu Road', 'Myo Ma Kyaung Road', 'Yangon-Mandalay Highway', 'Shwekyin Road'] as const
const HOMETOWNS = ['Mandalay', 'Taunggyi', 'Magway', 'Mawlamyine', 'Bago', 'Pyay', 'Monywa', 'Myitkyina', 'Hpa-an', 'Sagaing'] as const

const MALE_NAMES = ['Khin Maung', 'Than Sein', 'Mya Thwin', 'Pe Nyunt', 'Ba Htay', 'Chit Hlaing', 'Thein Maung', 'Win Htein', 'Aung Than', 'Saw Hla', 'Hla Pe', 'Maung Maung', 'Soe Thein', 'Tin Htut', 'Zaw Latt', 'Kyaw Htay', 'Myint Thein', 'Sein Win', 'Myo Min', 'Thaung Tin'] as const
const FEMALE_NAMES = ['Khin Kyi', 'Mya Sein', 'Yin Yin Myat', 'Hla Hla Win', 'Kyi Kyi Thein', 'Nwe Nwe Yi', 'Than Than Win', 'Su Su Hla', 'Mar Mar Win', 'Aye Aye Khaing', 'Khin Thant', 'San San Aye', 'Myat Myat Khine', 'Cho Cho', 'Thiri Mon', 'Khaing Khaing Win', 'Ei Mon', 'Yu Yu'] as const

const FATHER_JOBS = ['Retired Government Officer', 'Farmer', 'Shop Owner', 'Retired Teacher', 'Merchant'] as const
const MOTHER_JOBS = ['Housewife', 'Teacher', 'Shop Owner', 'Nurse'] as const
const SPOUSE_JOBS_M = ['Engineer', 'Merchant', 'Government Officer', 'Bank Officer', 'Retired Officer'] as const // husband of a female staff member
const SPOUSE_JOBS_F = ['Teacher', 'Nurse', 'Shop Owner', 'Government Officer', 'Accountant'] as const // wife of a male staff member

const CHILDREN: Record<number, { name: string; dob: string; occupation: string }> = {
  0: { name: 'Wai Yan Aung', dob: '1992-07-19', occupation: 'University Student' },
  2: { name: 'Htet Htet Aung', dob: '2012-03-02', occupation: 'Student' },
  4: { name: 'Lin Htet Naing', dob: '2010-11-25', occupation: 'Student' },
  9: { name: 'Su Yee Htun', dob: '2001-08-14', occupation: 'Private Sector Employee' },
  10: { name: 'Phoo Pwint Thu', dob: '2013-06-09', occupation: 'Student' },
  12: { name: 'Aung Chan Myae', dob: '1999-12-30', occupation: 'Engineer' },
  14: { name: 'Thiri Yadanar', dob: '2008-04-17', occupation: 'Student' },
  16: { name: 'Kaung Myat Min', dob: '2005-10-05', occupation: 'University Student' },
  20: { name: 'Nyan Win Htet', dob: '1990-02-11', occupation: 'Bank Officer' },
  21: { name: 'Yati Thiri Mo', dob: '1992-09-23', occupation: 'Teacher' },
  23: { name: 'Shwe Yee Lin', dob: '2018-01-08', occupation: 'Student' },
  24: { name: 'Myat Kaung Khant', dob: '2015-05-21', occupation: 'Student' },
}

const UNIS = ['University of Yangon', 'University of Mandalay', 'Rangoon Arts and Science University (RAS)', 'Dagon University', 'Yangon Institute of Education', 'Monywa University', 'Mawlamyine University'] as const
const TECH_UNIS = ['Yangon Technological University (YTU)', 'Mandalay Technological University'] as const

const POS_DEGREE: Record<string, { degree: string; majors: readonly string[]; tech: boolean }> = {
  DIR: { degree: 'BSc', majors: ['Mathematics', 'Physics', 'Geology'], tech: false },
  DEP: { degree: 'BA', majors: ['Economics', 'Myanmar', 'International Relations'], tech: false },
  HRM: { degree: 'BA', majors: ['Myanmar', 'Economics', 'English'], tech: false },
  ACC: { degree: 'BSc', majors: ['Mathematics', 'Physics', 'Economics'], tech: false },
  FIM: { degree: 'BA', majors: ['Economics', 'Business Administration'], tech: false },
  OPS: { degree: 'BA', majors: ['Economics', 'Geography', 'Myanmar'], tech: false },
  FEN: { degree: 'BE', majors: ['Mechanical Engineering', 'Civil Engineering', 'Electrical Power Engineering', 'Petroleum Engineering'], tech: true },
  MNT: { degree: 'BE', majors: ['Mechanical Engineering', 'Electrical Power Engineering'], tech: true },
  LO: { degree: 'BA', majors: ['Law', 'International Relations', 'English'], tech: false },
  AA: { degree: 'BA', majors: ['Myanmar', 'English', 'Economics'], tech: false },
}

const POS_SKILLS: Record<string, Array<[string, string]>> = {
  DIR: [['Leadership', 'PROFESSIONAL'], ['HR Management', 'PROFESSIONAL'], ['Policy Drafting', 'PROFESSIONAL'], ['Report Writing', 'SOFT']],
  DEP: [['HR Management', 'PROFESSIONAL'], ['Supervision', 'PROFESSIONAL'], ['Report Writing', 'SOFT'], ['Training Delivery', 'SOFT']],
  HRM: [['HR Management', 'PROFESSIONAL'], ['Payroll Administration', 'PROFESSIONAL'], ['Microsoft Office', 'TECHNICAL'], ['Communication', 'SOFT']],
  ACC: [['Financial Accounting', 'PROFESSIONAL'], ['Budgeting', 'PROFESSIONAL'], ['Excel Modeling', 'TECHNICAL'], ['Taxation', 'PROFESSIONAL']],
  FIM: [['Financial Management', 'PROFESSIONAL'], ['Budgeting', 'PROFESSIONAL'], ['Excel Modeling', 'TECHNICAL'], ['Audit Coordination', 'PROFESSIONAL']],
  OPS: [['Operations Coordination', 'PROFESSIONAL'], ['Logistics Planning', 'PROFESSIONAL'], ['Microsoft Office', 'TECHNICAL'], ['Report Writing', 'SOFT']],
  FEN: [['AutoCAD', 'TECHNICAL'], ['Pipeline Inspection', 'TECHNICAL'], ['GIS Mapping', 'TECHNICAL'], ['Field Surveying', 'TECHNICAL'], ['Safety Compliance', 'PROFESSIONAL']],
  MNT: [['Equipment Maintenance', 'TECHNICAL'], ['Preventive Maintenance', 'TECHNICAL'], ['Safety Compliance', 'PROFESSIONAL'], ['Supervision', 'PROFESSIONAL']],
  LO: [['Legal Research', 'PROFESSIONAL'], ['Contract Drafting', 'PROFESSIONAL'], ['Compliance Auditing', 'PROFESSIONAL'], ['Report Writing', 'SOFT']],
  AA: [['Microsoft Office', 'TECHNICAL'], ['Records Management', 'PROFESSIONAL'], ['Data Entry', 'TECHNICAL'], ['Communication', 'SOFT']],
}

// education count per staff (1-3)
const EDU_COUNTS = [2, 3, 2, 1, 3, 2, 2, 1, 2, 3, 2, 2, 2, 2, 3, 2, 2, 1, 1, 1, 3, 3, 2, 2, 1]
// English base proficiency per staff
const ENG_BASE = ['EXCELLENT', 'GOOD', 'GOOD', 'FAIR', 'GOOD', 'GOOD', 'FAIR', 'GOOD', 'GOOD', 'GOOD', 'EXCELLENT', 'GOOD', 'FAIR', 'GOOD', 'GOOD', 'FAIR', 'GOOD', 'FAIR', 'FAIR', 'GOOD', 'GOOD', 'FAIR', 'GOOD', 'FAIR', 'FAIR'] as const
const ENG_CERT: Record<number, string> = { 0: 'IELTS 7.0', 2: 'TOEFL 580', 4: 'TOEFL 550', 5: 'IELTS 6.5', 6: 'IELTS 6.0', 8: 'TOEFL 520', 10: 'JLPT N4', 11: 'TOEIC 750', 17: 'JLPT N5' }
const THIRD_LANG: Record<number, string> = { 0: 'Japanese', 8: 'Korean', 10: 'Japanese', 11: 'Korean', 17: 'Japanese' }

/* ============================== permission matrix ============================== */

const PERM_MATRIX: Record<string, string[]> = {
  'profile.view': ['USER', 'ADMIN', 'SUPERADMIN'],
  'profile.edit': ['USER', 'ADMIN', 'SUPERADMIN'],
  'own-record.view': ['USER', 'ADMIN', 'SUPERADMIN'],
  'staff.view': ['ADMIN', 'SUPERADMIN'],
  'staff.create': ['ADMIN', 'SUPERADMIN'],
  'staff.update': ['ADMIN', 'SUPERADMIN'],
  'staff.delete.soft': ['ADMIN', 'SUPERADMIN'],
  'staff.delete.hard': ['SUPERADMIN'],
  'dashboard.full': ['ADMIN', 'SUPERADMIN'],
  'reports.view': ['ADMIN', 'SUPERADMIN'],
  'documents.view': ['ADMIN', 'SUPERADMIN'],
  'documents.manage': ['ADMIN', 'SUPERADMIN'],
  'criminal.view': ['ADMIN', 'SUPERADMIN'],
  'criminal.manage': ['SUPERADMIN'],
  'audit.view': ['SUPERADMIN'],
  'users.manage': ['SUPERADMIN'],
  'settings.manage': ['SUPERADMIN'],
}

/* ============================== the seed itself ============================== */

const deptIds: Record<string, string> = {}
const posIds: Record<string, string> = {}
const rankIds: Record<string, string> = {}
const awardIds: Record<string, string> = {}
const trainingIds: Record<string, string> = {}
const partyIds: Record<string, string> = {}
const conflictIds: Record<string, string> = {}
const staffIds: string[] = []
let adminUserId = ''

async function wipe(): Promise<void> {
  console.log('🧹  Wiping existing data (reverse dependency order)…')
  // AuditLog references User → must be removed before the users themselves
  // (it also appears at the end of the prescribed list; deleting twice is a no-op).
  await db.auditLog.deleteMany()
  await db.document.deleteMany()
  await db.disciplinaryAction.deleteMany()
  await db.disciplinaryCase.deleteMany()
  await db.criminalRecord.deleteMany()
  await db.staffConflictAssignment.deleteMany()
  await db.politicalMembership.deleteMany()
  await db.staffHobby.deleteMany()
  await db.staffActivity.deleteMany()
  await db.militaryService.deleteMany()
  await db.staffTraining.deleteMany()
  await db.staffAward.deleteMany()
  await db.separation.deleteMany()
  await db.transfer.deleteMany()
  await db.promotion.deleteMany()
  await db.staffServiceHistory.deleteMany()
  await db.staffRank.deleteMany()
  await db.staffPosition.deleteMany()
  await db.referencePerson.deleteMany()
  await db.closeContact.deleteMany()
  await db.staffSkill.deleteMany()
  await db.staffLanguage.deleteMany()
  await db.staffEducation.deleteMany()
  await db.familyMember.deleteMany()
  await db.employeeAddress.deleteMany()
  await db.staff.deleteMany()
  await db.user.deleteMany()
  await db.permission.deleteMany()
  await db.role.deleteMany()
  await db.conflictArea.deleteMany()
  await db.politicalParty.deleteMany()
  await db.training.deleteMany()
  await db.award.deleteMany()
  await db.rank.deleteMany()
  await db.position.deleteMany()
  await db.department.deleteMany()
  await db.systemSetting.deleteMany()
  await db.auditLog.deleteMany()
}

async function seedRolesAndPermissions(): Promise<Record<string, string>> {
  console.log('→ Roles + permissions (3 roles, 17 permission keys)')
  const roleIds: Record<string, string> = {}
  for (const [name, label] of [
    ['USER', 'Standard User'],
    ['ADMIN', 'Administrator'],
    ['SUPERADMIN', 'Super Administrator'],
  ] as const) {
    const role = await db.role.create({ data: { name, label } })
    roleIds[name] = role.id
  }
  for (const [key, roles] of Object.entries(PERM_MATRIX)) {
    await db.permission.create({
      data: { key, roles: { connect: roles.map((r) => ({ id: roleIds[r] })) } },
    })
  }
  return roleIds
}

async function seedSystemSetting(): Promise<void> {
  console.log('→ System settings singleton')
  await db.systemSetting.create({
    data: {
      id: 'singleton',
      siteNameEn: 'MOGE HR',
      siteNameMm: 'MOGE HR',
      taglineEn: 'Human Resources Management System',
      taglineMm: 'လူ့စွမ်းအားစီမံခန့်ခွဲမှုစနစ်',
      footerTextEn: '© 2026 MOGE HR — Internal System',
      footerTextMm: '© ၂၀၂၆ MOGE HR — ပြည်တွင်းစနစ်',
    },
  })
}

async function seedOrg(): Promise<void> {
  console.log('→ Org structure (8 departments, 10 positions, 6 ranks)')
  for (const dept of DEPARTMENTS) {
    const row = await db.department.create({
      data: {
        name: dept.name,
        nameMm: dept.nameMm,
        code: dept.key,
        parentId: dept.parent ? deptIds[dept.parent] : null,
        description: dept.description,
      },
    })
    deptIds[dept.key] = row.id
  }
  for (const pos of POSITIONS) {
    const row = await db.position.create({
      data: {
        name: pos.name,
        nameMm: pos.nameMm,
        code: pos.code,
        departmentId: deptIds[pos.dept],
        level: pos.level,
        description: `${pos.name} (${DEPT_MAP[pos.dept].name})`,
      },
    })
    posIds[pos.key] = row.id
  }
  for (const rank of RANKS) {
    const row = await db.rank.create({
      data: { name: rank.name, nameMm: rank.nameMm, code: rank.code, level: rank.level, category: 'GENERAL' },
    })
    rankIds[rank.key] = row.id
  }
}

async function seedMasters(): Promise<void> {
  console.log('→ Master data (4 awards, 5 trainings, 2 parties, 3 conflict areas)')
  for (const [name, mm, desc] of [
    ['Employee of the Year', 'နှစ်ဆန်းပေါ်အလုပ်သမားဆု', 'Awarded to the outstanding employee of the year'],
    ['Long Service Medal', 'ရှေ့ရှည်စွမ်းဆောင်ရွက်မှုဆုတံဆိပ်', 'For long and dedicated service'],
    ['Excellence Award', 'ထူးခြားသောစွမ်းဆောင်မှုဆု', 'For exceptional performance'],
    ['Safety Champion', 'လုံခြုံရေးသူရဲကောင်းဆု', 'For outstanding safety record'],
  ] as const) {
    const row = await db.award.create({ data: { name, nameMm: mm, description: desc } })
    awardIds[name] = row.id
  }
  for (const [name, mm, inst, type] of [
    ['Leadership Development', 'ခေါင်းဆောင်မှုဖွံ့ဖြိုးရေးသင်တန်း', 'Myanmar Management Institute', 'MANAGEMENT'],
    ['Safety Training', 'ဘေးအန္တရာယ်ကင်းရှင်းရေးသင်တန်း', 'MOGE Training Centre', 'SAFETY'],
    ['Financial Management', 'ဘဏ္ဍာရေးစီမံခန့်ခွဲမှုသင်တန်း', 'Yangon Institute of Economics', 'FINANCE'],
    ['Project Management', 'စီမံကိန်းစီမံခန့်ခွဲမှုသင်တန်း', 'Myanmar Management Institute', 'MANAGEMENT'],
    ['English Language Course', 'အင်္ဂလိပ်ဘာသာသင်တန်း', 'British Council Yangon', 'LANGUAGE'],
  ] as const) {
    const row = await db.training.create({ data: { name, nameMm: mm, institution: inst, country: 'Myanmar', type } })
    trainingIds[name] = row.id
  }
  for (const [code, name, mm, desc] of [
    ['USDP', 'Union Solidarity and Development Party', 'ပြည်ထောင်စုကြံ့ခိုင်ရေးနှင့်ဖွံ့ဖြိုးရေးပါတီ', 'Registered political party'],
    ['NLD', 'National League for Democracy', 'အမျိုးသားဒီမိုကရေစီအဖွဲ့ချုပ်', 'Registered political party'],
  ] as const) {
    const row = await db.politicalParty.create({ data: { name, nameMm: mm, description: desc } })
    partyIds[code] = row.id
  }
  for (const [code, name, loc, desc] of [
    ['NORTH', 'Northern Command Area', 'Kachin State & Northern Shan State', 'Area under the Northern Military Command'],
    ['EAST', 'Eastern Command Area', 'Eastern Shan State', 'Area under the Eastern Military Command'],
    ['WEST', 'Western Command Area', 'Rakhine & Chin State', 'Area under the Western Military Command'],
  ] as const) {
    const row = await db.conflictArea.create({ data: { name, location: loc, description: desc } })
    conflictIds[code] = row.id
  }
}

async function seedStaffAndSubRecords(): Promise<void> {
  console.log('→ 25 staff records + sub-records (addresses / family / education / languages / skills / positions / ranks / service history)')

  for (let i = 0; i < STAFF.length; i++) {
    const s = STAFF[i]
    reseed(i) // stable per-staff pseudo-random choices
    const stillEmployed = s.status === 'ACTIVE' || s.status === 'SUSPENDED'
    const finalStage = s.stages[s.stages.length - 1]

    const staff = await db.staff.create({
      data: {
        staffNo: `MOGE-${String(i + 1).padStart(4, '0')}`,
        nameEn: s.nameEn,
        nameMm: s.nameMm,
        gender: s.gender,
        dateOfBirth: s.dob,
        placeOfBirth: s.pob,
        nrcNo: nrcNo(i),
        nationality: s.nationality,
        religion: s.religion,
        bloodGroup: s.blood,
        maritalStatus: s.marital,
        phone: phoneFor(i),
        email: `${s.nameEn.toLowerCase().replace(/\s+/g, '.')}@moge.gov.mm`,
        status: s.status,
        joinDate: s.join,
      },
    })
    staffIds.push(staff.id)

    /* ---- addresses: CURRENT always, PERMANENT for every 3rd staff ---- */
    const cur = pick(YANGON_TOWNSHIPS)
    await db.employeeAddress.create({
      data: {
        staffId: staff.id,
        type: 'CURRENT',
        addressLine: `No. ${(i * 17) % 99 + 11}, ${pick(STREETS)}, ${cur.t} Township`,
        township: cur.t,
        district: cur.dd,
        stateRegion: cur.r,
        phone: phoneFor(i),
        isVerified: i % 2 === 0,
        effectiveFrom: s.join,
      },
    })
    if (i % 3 === 0) {
      const perm = pick(ALL_TOWNSHIPS)
      await db.employeeAddress.create({
        data: {
          staffId: staff.id,
          type: 'PERMANENT',
          addressLine: `No. ${(i * 13) % 90 + 5}, ${pick(STREETS)}, ${perm.t} Township`,
          township: perm.t,
          district: perm.dd,
          stateRegion: perm.r,
          phone: phoneFor(i),
          isVerified: false,
          effectiveFrom: s.join,
          notes: 'Registered permanent address',
        },
      })
    }

    /* ---- family: father + mother (+ spouse, + child) = 2-4 members ---- */
    const hometown = pick(HOMETOWNS)
    await db.familyMember.create({
      data: {
        staffId: staff.id,
        relationship: 'FATHER',
        name: `U ${pick(MALE_NAMES)}`,
        dateOfBirth: new Date(s.dob.getFullYear() - 28, s.dob.getMonth(), s.dob.getDate()),
        occupation: pick(FATHER_JOBS),
        nrcNo: nrcNo(100 + i),
        address: `${hometown} Township`,
        phone: phoneFor(500 + i),
      },
    })
    await db.familyMember.create({
      data: {
        staffId: staff.id,
        relationship: 'MOTHER',
        name: `Daw ${pick(FEMALE_NAMES)}`,
        dateOfBirth: new Date(s.dob.getFullYear() - 25, s.dob.getMonth(), s.dob.getDate()),
        occupation: pick(MOTHER_JOBS),
        address: `${hometown} Township`,
        phone: phoneFor(600 + i),
      },
    })
    if (s.marital === 'MARRIED' || s.marital === 'WIDOWED') {
      await db.familyMember.create({
        data: {
          staffId: staff.id,
          relationship: 'SPOUSE',
          name: s.gender === 'MALE' ? `Daw ${pick(FEMALE_NAMES)}` : `U ${pick(MALE_NAMES)}`,
          dateOfBirth: new Date(s.dob.getFullYear() + (s.gender === 'MALE' ? -2 : 2), s.dob.getMonth(), s.dob.getDate()),
          occupation: s.marital === 'WIDOWED' ? null : s.gender === 'MALE' ? pick(SPOUSE_JOBS_F) : pick(SPOUSE_JOBS_M),
          nrcNo: nrcNo(200 + i),
          phone: phoneFor(700 + i),
          notes: s.marital === 'WIDOWED' ? 'Late spouse — passed away in 2019' : null,
        },
      })
    }
    const child = CHILDREN[i]
    if (child) {
      await db.familyMember.create({
        data: {
          staffId: staff.id,
          relationship: 'CHILD',
          name: child.name,
          dateOfBirth: d(child.dob),
          occupation: child.occupation,
        },
      })
    }

    /* ---- education: 1-3 records, degree matches final position ---- */
    const deg = POS_DEGREE[finalStage.pos]
    const gradY = clamp(s.dob.getFullYear() + 22 + (i % 3), 1985, 2020)
    await db.staffEducation.create({
      data: {
        staffId: staff.id,
        institution: deg.tech ? pick(TECH_UNIS) : pick(UNIS),
        degree: deg.degree,
        major: pick(deg.majors),
        country: 'Myanmar',
        startYear: gradY - 4,
        endYear: gradY,
        graduationYear: gradY,
      },
    })
    const eduCount = EDU_COUNTS[i]
    if (eduCount >= 2) {
      const masterY = clamp(gradY + 5, 1989, 2020)
      await db.staffEducation.create({
        data: {
          staffId: staff.id,
          institution: deg.tech ? 'Yangon Institute of Economics' : rand() < 0.5 ? 'Yangon Institute of Economics' : 'University of Yangon',
          degree: 'MBA',
          major: deg.tech ? 'Project Management' : 'Business Administration',
          country: 'Myanmar',
          startYear: masterY - 2,
          endYear: masterY,
          graduationYear: masterY,
        },
      })
    }
    if (eduCount === 3) {
      const thirdY = clamp(gradY + 9, 1993, 2020)
      await db.staffEducation.create({
        data: {
          staffId: staff.id,
          institution: 'University of Yangon',
          degree: 'MA',
          major: 'Public Administration',
          country: 'Myanmar',
          startYear: thirdY - 2,
          endYear: thirdY,
          graduationYear: thirdY,
        },
      })
    }

    /* ---- languages: Myanmar EXCELLENT + English (+ Japanese/Korean for some) ---- */
    await db.staffLanguage.create({
      data: { staffId: staff.id, language: 'Myanmar', reading: 'EXCELLENT', writing: 'EXCELLENT', speaking: 'EXCELLENT', listening: 'EXCELLENT' },
    })
    const base = ENG_BASE[i]
    await db.staffLanguage.create({
      data: {
        staffId: staff.id,
        language: 'English',
        reading: base,
        writing: shift(base, rand() < 0.5 ? -1 : 0),
        speaking: shift(base, rand() < 0.4 ? -1 : 0),
        listening: base,
        certification: ENG_CERT[i] ?? null,
      },
    })
    const third = THIRD_LANG[i]
    if (third) {
      await db.staffLanguage.create({
        data: { staffId: staff.id, language: third, reading: 'FAIR', writing: 'FAIR', speaking: 'FAIR', listening: 'FAIR' },
      })
    }

    /* ---- skills: 2-3, matched to the held position ---- */
    const skillCount = 2 + (i % 2)
    for (const [name, category] of pickN(POS_SKILLS[finalStage.pos], skillCount)) {
      await db.staffSkill.create({
        data: {
          staffId: staff.id,
          name,
          category,
          level: pick(['GOOD', 'EXCELLENT', 'FAIR'] as const),
          certification: name === 'AutoCAD' ? 'Autodesk Certified Professional' : null,
        },
      })
    }

    /* ---- staff positions (1-2 past + 1 current) ---- */
    for (let k = 0; k < s.stages.length; k++) {
      const st = s.stages[k]
      const isLast = k === s.stages.length - 1
      await db.staffPosition.create({
        data: {
          staffId: staff.id,
          positionId: posIds[st.pos],
          departmentId: deptIds[st.dept],
          startDate: st.start,
          endDate: st.end ?? null,
          isCurrent: isLast && stillEmployed,
          remarks: st.event === 'JOINING' ? 'Initial appointment' : st.event === 'PROMOTION' ? 'Promoted' : 'Transferred',
        },
      })
    }

    /* ---- staff ranks: current rank always consistent with position level ---- */
    const rankRuns: Array<{ rank: string; start: Date; end: Date | null }> = []
    for (const st of s.stages) {
      const rk = LEVEL_TO_RANK[POS_MAP[st.pos].level]
      const prev = rankRuns[rankRuns.length - 1]
      if (prev && prev.rank === rk) prev.end = st.end ?? null
      else rankRuns.push({ rank: rk, start: st.start, end: st.end ?? null })
    }
    for (let k = 0; k < rankRuns.length; k++) {
      const r = rankRuns[k]
      await db.staffRank.create({
        data: {
          staffId: staff.id,
          rankId: rankIds[r.rank],
          appointedDate: r.start,
          effectiveDate: r.start,
          endDate: r.end,
          isCurrent: k === rankRuns.length - 1 && stillEmployed,
          remarks: k === 0 ? 'Initial rank on appointment' : 'Rank promotion',
        },
      })
    }

    /* ---- service history: JOINING first, then PROMOTION/TRANSFER/etc, chronological ---- */
    interface HistEvent { type: string; title: string; date: Date; dept?: string; pos?: string; rank?: string; remarks?: string }
    const evts: HistEvent[] = []
    for (const st of s.stages) {
      const rankKey = LEVEL_TO_RANK[POS_MAP[st.pos].level]
      evts.push({
        type: st.event,
        title:
          st.event === 'JOINING'
            ? `Appointed as ${POS_MAP[st.pos].name} in ${DEPT_MAP[st.dept].name}`
            : st.event === 'PROMOTION'
              ? `Promoted to ${POS_MAP[st.pos].name}`
              : `Transferred to ${DEPT_MAP[st.dept].name} as ${POS_MAP[st.pos].name}`,
        date: st.start,
        dept: st.dept,
        pos: st.pos,
        rank: rankKey,
      })
    }
    for (const ex of s.extras) {
      const active = s.stages.reduce((acc, st) => (st.start <= ex.date ? st : acc), s.stages[0])
      evts.push({ type: ex.type, title: ex.title, date: ex.date, dept: active.dept, pos: active.pos, rank: LEVEL_TO_RANK[POS_MAP[active.pos].level] })
    }
    const sep = SEPARATIONS.find((x) => x.si === i)
    if (sep) {
      evts.push({
        type: sep.type === 'TRANSFER_OUT' ? 'TRANSFER' : sep.type,
        title:
          sep.type === 'RETIREMENT'
            ? 'Retired from service'
            : sep.type === 'RESIGNATION'
              ? 'Resigned from service'
              : 'Transferred out to Ministry of Planning and Finance',
        date: d(sep.effective),
        dept: finalStage.dept,
        pos: sep.finalPos,
        rank: sep.finalRank,
        remarks: sep.reason,
      })
    }
    evts.sort((a, b) => a.date.getTime() - b.date.getTime())
    for (let k = 0; k < evts.length; k++) {
      const ev = evts[k]
      await db.staffServiceHistory.create({
        data: {
          staffId: staff.id,
          type: ev.type,
          title: ev.title,
          fromDate: ev.date,
          toDate: null,
          departmentId: ev.dept ? deptIds[ev.dept] : null,
          positionId: ev.pos ? posIds[ev.pos] : null,
          rankId: ev.rank ? rankIds[ev.rank] : null,
          location: ev.dept ? DEPT_LOCATION[ev.dept] : null,
          orderNo: k + 1,
          remarks: ev.remarks ?? null,
        },
      })
    }
  }
}

async function seedUsers(roleIds: Record<string, string>): Promise<void> {
  console.log('→ 3 users (superadmin@moge.hr / admin@moge.hr / user@moge.hr)')
  const [superHash, adminHash, userHash] = await Promise.all([
    bcrypt.hash('Super@123', 12),
    bcrypt.hash('Admin@123', 12),
    bcrypt.hash('User@123', 12),
  ])
  await db.user.create({
    data: { email: 'superadmin@moge.hr', passwordHash: superHash, name: 'Super Admin', roleId: roleIds.SUPERADMIN, isActive: true, lastLoginAt: d('2025-06-15') },
  })
  const admin = await db.user.create({
    data: { email: 'admin@moge.hr', passwordHash: adminHash, name: 'HR Admin', roleId: roleIds.ADMIN, isActive: true, lastLoginAt: d('2025-06-25') },
  })
  adminUserId = admin.id
  await db.user.create({
    data: { email: 'user@moge.hr', passwordHash: userHash, name: 'Demo User', roleId: roleIds.USER, isActive: true, staffId: staffIds[0], preferredLocale: 'en' },
  })
}

async function seedMovements(): Promise<void> {
  console.log('→ Movements (8 promotions, 5 transfers, 4 separations)')
  for (const p of PROMOTIONS) {
    await db.promotion.create({
      data: {
        staffId: staffIds[p.si],
        fromRankId: rankIds[p.from],
        toRankId: rankIds[p.to],
        appliedDate: d(p.applied),
        effectiveDate: d(p.effective),
        authority: p.authority,
        status: p.status,
        remarks: p.remarks,
      },
    })
  }
  for (const t of TRANSFERS) {
    await db.transfer.create({
      data: {
        staffId: staffIds[t.si],
        fromDepartmentId: deptIds[t.fromDept],
        toDepartmentId: deptIds[t.toDept],
        fromPositionId: posIds[t.fromPos],
        toPositionId: posIds[t.toPos],
        transferDate: d(t.date),
        reason: t.reason,
        status: t.status,
        remarks: t.remarks,
      },
    })
  }
  for (const s of SEPARATIONS) {
    await db.separation.create({
      data: {
        staffId: staffIds[s.si],
        type: s.type,
        reason: s.reason,
        effectiveDate: d(s.effective),
        finalRankId: rankIds[s.finalRank],
        finalPositionId: posIds[s.finalPos],
        remarks: s.remarks,
      },
    })
  }
}

async function seedModules(): Promise<void> {
  console.log('→ Background & development modules (trainings, awards, military, activities, hobbies, political, conflict, criminal, disciplinary, foreign travels, contacts, references)')

  for (const t of STAFF_TRAININGS) {
    await db.staffTraining.create({
      data: {
        staffId: staffIds[t.si],
        trainingId: t.master ? trainingIds[t.master] : null,
        courseName: t.course,
        institution: t.inst,
        location: t.loc,
        country: t.country,
        startDate: d(t.start),
        endDate: d(t.end),
        result: t.result,
        isForeign: t.foreign,
      },
    })
  }

  for (const a of STAFF_AWARDS) {
    await db.staffAward.create({
      data: {
        staffId: staffIds[a.si],
        awardId: awardIds[a.award],
        title: a.award,
        awardedDate: d(a.date),
        authority: a.authority,
        reason: a.reason,
      },
    })
  }

  for (const m of MILITARY_SERVICES) {
    await db.militaryService.create({
      data: {
        staffId: staffIds[m.si],
        serviceNumber: m.no,
        unit: m.unit,
        rank: m.rank,
        position: m.position,
        startDate: d(m.start),
        endDate: d(m.end),
        status: m.status,
        training: m.training,
        remarks: m.remarks,
      },
    })
  }

  for (const a of ACTIVITIES) {
    await db.staffActivity.create({
      data: { staffId: staffIds[a.si], type: a.type, name: a.name, role: a.role, date: d(a.date), description: a.desc },
    })
  }

  for (const h of HOBBIES) {
    await db.staffHobby.create({ data: { staffId: staffIds[h.si], name: h.name, description: h.desc, level: h.level } })
  }

  for (const p of POLITICAL_MEMBERSHIPS) {
    await db.politicalMembership.create({
      data: {
        staffId: staffIds[p.si],
        partyId: partyIds[p.party],
        partyName: p.party === 'USDP' ? 'Union Solidarity and Development Party' : 'National League for Democracy',
        membershipNo: p.no,
        position: p.position,
        joinDate: d(p.join),
        leaveDate: p.leave ? d(p.leave) : null,
        status: p.status,
        remarks: p.remarks,
      },
    })
  }

  const areaId = (name: string): string => (name.startsWith('Northern') ? conflictIds.NORTH : name.startsWith('Eastern') ? conflictIds.EAST : conflictIds.WEST)
  for (const c of CONFLICT_ASSIGNMENTS) {
    await db.staffConflictAssignment.create({
      data: {
        staffId: staffIds[c.si],
        conflictAreaId: areaId(c.area),
        unit: c.unit,
        position: c.position,
        deploymentDate: d(c.deploy),
        returnDate: c.ret ? d(c.ret) : null,
        reason: c.reason,
        notes: c.notes,
      },
    })
  }

  for (const c of CRIMINAL_RECORDS) {
    await db.criminalRecord.create({
      data: {
        staffId: staffIds[c.si],
        caseNumber: c.caseNumber,
        caseType: c.caseType,
        court: c.court,
        offense: c.offense,
        caseDate: d(c.caseDate),
        status: c.status,
        judgment: c.judgment,
        penalty: c.penalty,
        notes: c.notes,
      },
    })
  }

  for (const c of DISCIPLINARY_CASES) {
    const dc = await db.disciplinaryCase.create({
      data: {
        staffId: staffIds[c.si],
        caseNumber: c.caseNumber,
        type: c.type,
        title: c.title,
        description: c.desc,
        dateOpened: d(c.opened),
        status: c.status,
        decision: c.decision ?? null,
        penalty: c.penalty ?? null,
        closedDate: c.closed ? d(c.closed) : null,
      },
    })
    await db.disciplinaryAction.create({
      data: {
        caseId: dc.id,
        actionType: c.action.actionType,
        description: c.action.desc,
        actionDate: d(c.action.date),
        authority: c.action.authority,
      },
    })
  }

  for (const f of FOREIGN_TRAVELS) {
    await db.foreignTravel.create({
      data: {
        staffId: staffIds[f.si],
        purpose: f.purpose,
        destinationCountry: f.country,
        organization: f.org,
        sponsor: f.sponsor,
        startDate: d(f.start),
        endDate: d(f.end),
        approvalRef: f.ref,
        returnStatus: 'RETURNED',
      },
    })
  }

  for (const c of CLOSE_CONTACTS) {
    await db.closeContact.create({
      data: { staffId: staffIds[c.si], name: c.name, relationship: c.relationship, occupation: c.occupation, address: c.address, phone: c.phone, description: c.desc },
    })
  }

  for (const r of REFERENCES) {
    await db.referencePerson.create({
      data: { staffId: staffIds[r.si], name: r.name, relationship: r.relationship, position: r.position, organization: r.org, phone: r.phone, address: r.address, description: r.desc },
    })
  }
}

async function seedDocuments(): Promise<void> {
  console.log('→ 6 polymorphic staff documents')
  for (const doc of DOCUMENTS) {
    await db.document.create({
      data: {
        title: doc.title,
        category: doc.category,
        fileUrl: `/uploads/${doc.file}`,
        fileName: doc.file,
        fileType: 'application/pdf',
        fileSize: doc.size,
        version: 1,
        expiryDate: doc.expiry ? d(doc.expiry) : null,
        uploadedById: adminUserId,
        entityType: 'Staff',
        entityId: staffIds[doc.si],
        accessLevel: doc.access,
      },
    })
  }
}

async function printSummary(): Promise<void> {
  const rows: Array<[string, number]> = [
    ['staff', await db.staff.count()],
    ['users', await db.user.count()],
    ['roles / permissions', (await db.role.count()) + (await db.permission.count())],
    ['departments / positions / ranks', (await db.department.count()) + (await db.position.count()) + (await db.rank.count())],
    ['addresses', await db.employeeAddress.count()],
    ['familyMembers', await db.familyMember.count()],
    ['educations', await db.staffEducation.count()],
    ['languages', await db.staffLanguage.count()],
    ['skills', await db.staffSkill.count()],
    ['staffPositions', await db.staffPosition.count()],
    ['staffRanks', await db.staffRank.count()],
    ['serviceHistory', await db.staffServiceHistory.count()],
    ['promotions / transfers / separations', (await db.promotion.count()) + (await db.transfer.count()) + (await db.separation.count())],
    ['staffTrainings / staffAwards', (await db.staffTraining.count()) + (await db.staffAward.count())],
    ['military / activities / hobbies', (await db.militaryService.count()) + (await db.staffActivity.count()) + (await db.staffHobby.count())],
    ['political / conflict / criminal', (await db.politicalMembership.count()) + (await db.staffConflictAssignment.count()) + (await db.criminalRecord.count())],
    ['disciplinary cases / actions', (await db.disciplinaryCase.count()) + (await db.disciplinaryAction.count())],
    ['foreignTravels', await db.foreignTravel.count()],
    ['documents', await db.document.count()],
    ['closeContacts / references', (await db.closeContact.count()) + (await db.referencePerson.count())],
  ]
  console.log('\n📊 Seeded row counts:')
  for (const [label, n] of rows) console.log(`   ${label.padEnd(40)} ${n}`)
  const byStatus = await db.staff.groupBy({ by: ['status'], _count: { _all: true } })
  console.log('   staff by status:', byStatus.map((g) => `${g.status}=${g._count._all}`).join(', '))
}

async function seedAuditTrail(): Promise<void> {
  // A handful of audit entries so the History tabs and audit log page have demo data.
  const admin = await db.user.findUnique({ where: { email: 'admin@moge.hr' } })
  const staff = await db.staff.findMany({ orderBy: { staffNo: 'asc' }, take: 8, select: { id: true, staffNo: true, nameEn: true, createdAt: true, updatedAt: true } })
  const entries: Array<{ userId: string | null; userName: string; action: string; module: string; entityType: string; entityId: string | null; staffId: string | null; before: string | null; after: string | null; changedFields: string; ipAddress: string; userAgent: string; createdAt: Date }> = []
  let day = 40
  for (const s of staff) {
    entries.push({
      userId: admin?.id ?? null, userName: admin?.name ?? 'HR Admin', action: 'CREATE', module: 'staff', entityType: 'Staff',
      entityId: s.id, staffId: s.id, before: null,
      after: JSON.stringify({ staffNo: s.staffNo, nameEn: s.nameEn, status: 'ACTIVE' }),
      changedFields: JSON.stringify(['staffNo', 'nameEn', 'status']), ipAddress: '10.0.12.8', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      createdAt: s.createdAt,
    })
    entries.push({
      userId: admin?.id ?? null, userName: admin?.name ?? 'HR Admin', action: 'UPDATE', module: 'staff', entityType: 'Staff',
      entityId: s.id, staffId: s.id,
      before: JSON.stringify({ status: 'ACTIVE' }), after: JSON.stringify({ status: 'ACTIVE', phone: '09-7' + (1000000 + Math.floor(Math.random() * 8999999)) }),
      changedFields: JSON.stringify(['phone']), ipAddress: '10.0.12.8', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      createdAt: new Date(Date.now() - day-- * 24 * 3600 * 1000),
    })
  }
  await db.auditLog.createMany({ data: entries })
  console.log(`   audit trail: ${entries.length} entries`)
}

async function main(): Promise<void> {
  try {
    console.log('🌱 MOGE HR — seeding demo database (SQLite @ db/custom.db)\n')
    await wipe()
    const roleIds = await seedRolesAndPermissions()
    await seedSystemSetting()
    await seedOrg()
    await seedMasters()
    await seedStaffAndSubRecords()
    await seedUsers(roleIds)
    await seedMovements()
    await seedAuditTrail()
    await seedModules()
    await seedDocuments()
    await printSummary()
    console.log('\n✅ Seed completed successfully.')
    console.log('   Demo logins: superadmin@moge.hr / Super@123 · admin@moge.hr / Admin@123 · user@moge.hr / User@123')
  } catch (err) {
    console.error('❌ Seed failed:', err)
    await db.$disconnect().catch(() => {})
    process.exit(1)
  } finally {
    await db.$disconnect().catch(() => {})
  }
}

void main()
