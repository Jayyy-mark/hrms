import 'server-only'
import { z } from 'zod'
import { db } from './db'
import { PERMISSIONS, type PermissionKey } from './permissions'
import {
  ADDRESS_TYPES, RELATIONSHIPS, PROFICIENCY, SERVICE_EVENT_TYPES, MOVEMENT_STATUS,
  SEPARATION_TYPES, ACTIVITY_TYPES, SKILL_CATEGORIES, DISCIPLINARY_CASE_TYPES,
  DISCIPLINARY_STATUS, FOREIGN_TRAVEL_PURPOSES, GENDERS, MARITAL_STATUS, STAFF_STATUS,
} from './constants'

const dateField = z.union([z.coerce.date(), z.string().transform((v) => new Date(v))]).nullable().optional()
const idField = z.string().min(1).nullable().optional()
const textField = z.string().trim().max(500).nullable().optional()
const requiredText = z.string().trim().min(1).max(500)
const intField = z.coerce.number().int().nullable().optional()
const boolField = z.union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')]).optional()

export interface ResourceDef {
  slug: string
  model: string
  module: string
  entityType: string
  staffScoped: boolean
  writePerm: PermissionKey
  sensitive?: boolean // VIEW is audited
  caseScoped?: boolean // scoped by caseId (disciplinary actions)
  schema: z.ZodType<any>
  searchFields?: string[]
  includeKeys?: string[] // relation names to include
  defaultSort?: { field: string; dir: 'asc' | 'desc' }
}

const staffInclude = ['staff']

export const RESOURCES: Record<string, ResourceDef> = {
  // ---------- Personnel sub-resources ----------
  addresses: {
    slug: 'addresses', model: 'employeeAddress', module: 'staff.addresses', entityType: 'EmployeeAddress',
    staffScoped: true, writePerm: PERMISSIONS.STAFF_UPDATE,
    schema: z.object({
      type: z.enum(ADDRESS_TYPES).default('CURRENT'),
      addressLine: requiredText,
      township: textField, district: textField, stateRegion: textField, phone: textField,
      isVerified: boolField, effectiveFrom: dateField, notes: textField,
    }),
    searchFields: ['addressLine', 'township', 'district'],
    includeKeys: staffInclude,
    defaultSort: { field: 'createdAt', dir: 'desc' },
  },
  family: {
    slug: 'family', model: 'familyMember', module: 'staff.family', entityType: 'FamilyMember',
    staffScoped: true, writePerm: PERMISSIONS.STAFF_UPDATE,
    schema: z.object({
      relationship: z.enum(RELATIONSHIPS).default('OTHER'),
      name: requiredText, dateOfBirth: dateField, occupation: textField,
      nrcNo: textField, address: textField, phone: textField, notes: textField,
    }),
    searchFields: ['name', 'occupation', 'nrcNo'],
    includeKeys: staffInclude,
    defaultSort: { field: 'createdAt', dir: 'asc' },
  },
  education: {
    slug: 'education', model: 'staffEducation', module: 'staff.education', entityType: 'StaffEducation',
    staffScoped: true, writePerm: PERMISSIONS.STAFF_UPDATE,
    schema: z.object({
      institution: requiredText, degree: textField, major: textField, country: textField,
      startYear: intField, endYear: intField, graduationYear: intField, certificateUrl: textField,
    }),
    searchFields: ['institution', 'degree', 'major'],
    includeKeys: staffInclude,
    defaultSort: { field: 'graduationYear', dir: 'desc' },
  },
  languages: {
    slug: 'languages', model: 'staffLanguage', module: 'staff.languages', entityType: 'StaffLanguage',
    staffScoped: true, writePerm: PERMISSIONS.STAFF_UPDATE,
    schema: z.object({
      language: requiredText,
      reading: z.enum(PROFICIENCY).default('FAIR'),
      writing: z.enum(PROFICIENCY).default('FAIR'),
      speaking: z.enum(PROFICIENCY).default('FAIR'),
      listening: z.enum(PROFICIENCY).default('FAIR'),
      certification: textField,
    }),
    searchFields: ['language'],
    includeKeys: staffInclude,
    defaultSort: { field: 'language', dir: 'asc' },
  },
  skills: {
    slug: 'skills', model: 'staffSkill', module: 'staff.skills', entityType: 'StaffSkill',
    staffScoped: true, writePerm: PERMISSIONS.STAFF_UPDATE,
    schema: z.object({
      name: requiredText, category: z.enum(SKILL_CATEGORIES).default('TECHNICAL'),
      level: z.enum(PROFICIENCY).default('GOOD'), certification: textField,
    }),
    searchFields: ['name'],
    includeKeys: staffInclude,
    defaultSort: { field: 'name', dir: 'asc' },
  },
  'close-contacts': {
    slug: 'close-contacts', model: 'closeContact', module: 'staff.contacts', entityType: 'CloseContact',
    staffScoped: true, writePerm: PERMISSIONS.STAFF_UPDATE,
    schema: z.object({
      name: requiredText, relationship: textField, occupation: textField,
      address: textField, phone: textField, description: textField,
    }),
    searchFields: ['name', 'relationship', 'occupation'],
    includeKeys: staffInclude,
    defaultSort: { field: 'name', dir: 'asc' },
  },
  references: {
    slug: 'references', model: 'referencePerson', module: 'staff.contacts', entityType: 'ReferencePerson',
    staffScoped: true, writePerm: PERMISSIONS.STAFF_UPDATE,
    schema: z.object({
      name: requiredText, relationship: textField, position: textField, organization: textField,
      phone: textField, address: textField, description: textField,
    }),
    searchFields: ['name', 'organization', 'position'],
    includeKeys: staffInclude,
    defaultSort: { field: 'name', dir: 'asc' },
  },

  // ---------- Career ----------
  'service-history': {
    slug: 'service-history', model: 'staffServiceHistory', module: 'staff.service-history', entityType: 'StaffServiceHistory',
    staffScoped: true, writePerm: PERMISSIONS.STAFF_UPDATE,
    schema: z.object({
      type: z.enum(SERVICE_EVENT_TYPES),
      title: requiredText,
      fromDate: z.union([z.coerce.date(), z.string().transform((v) => new Date(v))]),
      toDate: dateField, departmentId: idField, positionId: idField, rankId: idField,
      location: textField, orderNo: intField, remarks: textField,
    }),
    searchFields: ['title', 'location'],
    includeKeys: [...staffInclude, 'department', 'position', 'rank'],
    defaultSort: { field: 'fromDate', dir: 'desc' },
  },
  'staff-positions': {
    slug: 'staff-positions', model: 'staffPosition', module: 'staff.positions', entityType: 'StaffPosition',
    staffScoped: true, writePerm: PERMISSIONS.STAFF_UPDATE,
    schema: z.object({
      positionId: z.string().min(1),
      departmentId: idField,
      startDate: z.union([z.coerce.date(), z.string().transform((v) => new Date(v))]),
      endDate: dateField, isCurrent: boolField, remarks: textField,
    }),
    includeKeys: [...staffInclude, 'position', 'department'],
    defaultSort: { field: 'startDate', dir: 'desc' },
  },
  'staff-ranks': {
    slug: 'staff-ranks', model: 'staffRank', module: 'staff.ranks', entityType: 'StaffRank',
    staffScoped: true, writePerm: PERMISSIONS.STAFF_UPDATE,
    schema: z.object({
      rankId: z.string().min(1),
      appointedDate: dateField,
      effectiveDate: z.union([z.coerce.date(), z.string().transform((v) => new Date(v))]),
      endDate: dateField, isCurrent: boolField, remarks: textField,
    }),
    includeKeys: [...staffInclude, 'rank'],
    defaultSort: { field: 'effectiveDate', dir: 'desc' },
  },

  // ---------- Movements (with automation side-effects) ----------
  promotions: {
    slug: 'promotions', model: 'promotion', module: 'movements.promotions', entityType: 'Promotion',
    staffScoped: true, writePerm: PERMISSIONS.STAFF_UPDATE,
    schema: z.object({
      staffId: z.string().min(1).optional(),
      fromRankId: idField, toRankId: z.string().min(1),
      appliedDate: dateField,
      effectiveDate: z.union([z.coerce.date(), z.string().transform((v) => new Date(v))]),
      authority: textField, status: z.enum(MOVEMENT_STATUS).default('PENDING'), remarks: textField,
    }),
    searchFields: ['authority', 'remarks'],
    includeKeys: [...staffInclude, 'fromRank', 'toRank'],
    defaultSort: { field: 'effectiveDate', dir: 'desc' },
  },
  transfers: {
    slug: 'transfers', model: 'transfer', module: 'movements.transfers', entityType: 'Transfer',
    staffScoped: true, writePerm: PERMISSIONS.STAFF_UPDATE,
    schema: z.object({
      staffId: z.string().min(1).optional(),
      fromDepartmentId: idField, toDepartmentId: z.string().min(1),
      fromPositionId: idField, toPositionId: idField,
      transferDate: z.union([z.coerce.date(), z.string().transform((v) => new Date(v))]),
      reason: textField, status: z.enum(MOVEMENT_STATUS).default('PENDING'), remarks: textField,
    }),
    searchFields: ['reason', 'remarks'],
    includeKeys: [...staffInclude, 'fromDepartment', 'toDepartment', 'fromPosition', 'toPosition'],
    defaultSort: { field: 'transferDate', dir: 'desc' },
  },
  separations: {
    slug: 'separations', model: 'separation', module: 'movements.separations', entityType: 'Separation',
    staffScoped: true, writePerm: PERMISSIONS.STAFF_UPDATE,
    schema: z.object({
      staffId: z.string().min(1).optional(),
      type: z.enum(SEPARATION_TYPES),
      reason: textField,
      effectiveDate: z.union([z.coerce.date(), z.string().transform((v) => new Date(v))]),
      finalRankId: idField, finalPositionId: idField, remarks: textField,
    }),
    searchFields: ['reason', 'remarks'],
    includeKeys: [...staffInclude, 'finalRank', 'finalPosition'],
    defaultSort: { field: 'effectiveDate', dir: 'desc' },
  },

  // ---------- Development ----------
  awards: {
    slug: 'awards', model: 'staffAward', module: 'development.awards', entityType: 'StaffAward',
    staffScoped: true, writePerm: PERMISSIONS.STAFF_UPDATE,
    schema: z.object({
      staffId: z.string().min(1).optional(),
      awardId: idField, title: requiredText,
      awardedDate: z.union([z.coerce.date(), z.string().transform((v) => new Date(v))]),
      authority: textField, reason: textField, certificateUrl: textField,
    }),
    searchFields: ['title', 'authority'],
    includeKeys: [...staffInclude, 'award'],
    defaultSort: { field: 'awardedDate', dir: 'desc' },
  },
  trainings: {
    slug: 'trainings', model: 'staffTraining', module: 'development.trainings', entityType: 'StaffTraining',
    staffScoped: true, writePerm: PERMISSIONS.STAFF_UPDATE,
    schema: z.object({
      staffId: z.string().min(1).optional(),
      trainingId: idField, courseName: requiredText, institution: textField,
      location: textField, country: textField,
      startDate: z.union([z.coerce.date(), z.string().transform((v) => new Date(v))]),
      endDate: dateField, result: textField, certificateUrl: textField, isForeign: boolField,
    }),
    searchFields: ['courseName', 'institution', 'location'],
    includeKeys: [...staffInclude, 'training'],
    defaultSort: { field: 'startDate', dir: 'desc' },
  },

  // ---------- Background ----------
  military: {
    slug: 'military', model: 'militaryService', module: 'background.military', entityType: 'MilitaryService',
    staffScoped: true, writePerm: PERMISSIONS.STAFF_UPDATE,
    schema: z.object({
      serviceNumber: textField, unit: textField, rank: textField, position: textField,
      startDate: dateField, endDate: dateField, status: textField, training: textField, remarks: textField,
    }),
    searchFields: ['unit', 'serviceNumber', 'position'],
    includeKeys: staffInclude,
    defaultSort: { field: 'createdAt', dir: 'desc' },
  },
  activities: {
    slug: 'activities', model: 'staffActivity', module: 'background.activities', entityType: 'StaffActivity',
    staffScoped: true, writePerm: PERMISSIONS.STAFF_UPDATE,
    schema: z.object({
      type: z.enum(ACTIVITY_TYPES).default('OTHER'),
      name: requiredText, role: textField, date: dateField, description: textField,
    }),
    searchFields: ['name', 'role', 'description'],
    includeKeys: staffInclude,
    defaultSort: { field: 'date', dir: 'desc' },
  },
  hobbies: {
    slug: 'hobbies', model: 'staffHobby', module: 'background.hobbies', entityType: 'StaffHobby',
    staffScoped: true, writePerm: PERMISSIONS.STAFF_UPDATE,
    schema: z.object({
      name: requiredText, description: textField, level: textField,
    }),
    searchFields: ['name'],
    includeKeys: staffInclude,
    defaultSort: { field: 'name', dir: 'asc' },
  },
  political: {
    slug: 'political', model: 'politicalMembership', module: 'background.political', entityType: 'PoliticalMembership',
    staffScoped: true, writePerm: PERMISSIONS.STAFF_UPDATE,
    schema: z.object({
      partyId: idField, partyName: requiredText, membershipNo: textField, position: textField,
      joinDate: dateField, leaveDate: dateField, status: textField, remarks: textField,
    }),
    searchFields: ['partyName', 'position'],
    includeKeys: [...staffInclude, 'party'],
    defaultSort: { field: 'joinDate', dir: 'desc' },
  },
  conflicts: {
    slug: 'conflicts', model: 'staffConflictAssignment', module: 'background.conflicts', entityType: 'StaffConflictAssignment',
    staffScoped: true, writePerm: PERMISSIONS.STAFF_UPDATE,
    schema: z.object({
      conflictAreaId: z.string().min(1),
      unit: textField, position: textField,
      deploymentDate: z.union([z.coerce.date(), z.string().transform((v) => new Date(v))]),
      returnDate: dateField, reason: textField, notes: textField,
    }),
    searchFields: ['unit', 'position'],
    includeKeys: [...staffInclude, 'conflictArea'],
    defaultSort: { field: 'deploymentDate', dir: 'desc' },
  },
  disciplinary: {
    slug: 'disciplinary', model: 'disciplinaryCase', module: 'background.disciplinary', entityType: 'DisciplinaryCase',
    staffScoped: true, writePerm: PERMISSIONS.STAFF_UPDATE,
    schema: z.object({
      caseNumber: textField,
      type: z.enum(DISCIPLINARY_CASE_TYPES).default('OTHER'),
      title: requiredText, description: textField,
      dateOpened: z.union([z.coerce.date(), z.string().transform((v) => new Date(v))]),
      status: z.enum(DISCIPLINARY_STATUS).default('OPEN'),
      decision: textField, penalty: textField, appealStatus: textField, closedDate: dateField,
    }),
    searchFields: ['title', 'caseNumber', 'description'],
    includeKeys: staffInclude,
    defaultSort: { field: 'dateOpened', dir: 'desc' },
  },
  'disciplinary-actions': {
    slug: 'disciplinary-actions', model: 'disciplinaryAction', module: 'background.disciplinary', entityType: 'DisciplinaryAction',
    staffScoped: true, caseScoped: true, writePerm: PERMISSIONS.STAFF_UPDATE,
    schema: z.object({
      caseId: z.string().min(1),
      actionType: requiredText, description: textField,
      actionDate: z.union([z.coerce.date(), z.string().transform((v) => new Date(v))]),
      authority: textField, remarks: textField,
    }),
    searchFields: ['actionType', 'description'],
    includeKeys: ['case'],
    defaultSort: { field: 'actionDate', dir: 'desc' },
  },
  criminal: {
    slug: 'criminal', model: 'criminalRecord', module: 'background.criminal', entityType: 'CriminalRecord',
    staffScoped: true, writePerm: PERMISSIONS.CRIMINAL_MANAGE, sensitive: true,
    schema: z.object({
      caseNumber: textField, caseType: textField, court: textField, offense: textField,
      caseDate: dateField, status: textField, judgment: textField, penalty: textField, notes: textField,
    }),
    searchFields: ['caseNumber', 'offense', 'court'],
    includeKeys: staffInclude,
    defaultSort: { field: 'createdAt', dir: 'desc' },
  },

  // ---------- Foreign affairs ----------
  'foreign-travels': {
    slug: 'foreign-travels', model: 'foreignTravel', module: 'foreign.travels', entityType: 'ForeignTravel',
    staffScoped: true, writePerm: PERMISSIONS.STAFF_UPDATE,
    schema: z.object({
      purpose: z.enum(FOREIGN_TRAVEL_PURPOSES).default('OFFICIAL'),
      destinationCountry: requiredText, organization: textField, sponsor: textField,
      startDate: z.union([z.coerce.date(), z.string().transform((v) => new Date(v))]),
      endDate: dateField, approvalRef: textField, returnStatus: textField, notes: textField,
    }),
    searchFields: ['destinationCountry', 'organization', 'sponsor'],
    includeKeys: staffInclude,
    defaultSort: { field: 'startDate', dir: 'desc' },
  },

  // ---------- Master data ----------
  departments: {
    slug: 'departments', model: 'department', module: 'master.departments', entityType: 'Department',
    staffScoped: false, writePerm: PERMISSIONS.STAFF_UPDATE,
    schema: z.object({
      name: requiredText, nameMm: textField, code: textField,
      parentId: idField, description: textField,
    }),
    searchFields: ['name', 'code'],
    includeKeys: ['parent', 'children'],
    defaultSort: { field: 'name', dir: 'asc' },
  },
  positions: {
    slug: 'positions', model: 'position', module: 'master.positions', entityType: 'Position',
    staffScoped: false, writePerm: PERMISSIONS.STAFF_UPDATE,
    schema: z.object({
      name: requiredText, nameMm: textField, code: textField,
      departmentId: idField, level: intField, description: textField,
    }),
    searchFields: ['name', 'code'],
    includeKeys: ['department'],
    defaultSort: { field: 'name', dir: 'asc' },
  },
  ranks: {
    slug: 'ranks', model: 'rank', module: 'master.ranks', entityType: 'Rank',
    staffScoped: false, writePerm: PERMISSIONS.STAFF_UPDATE,
    schema: z.object({
      name: requiredText, nameMm: textField, code: textField, level: intField, category: textField,
    }),
    searchFields: ['name', 'code'],
    includeKeys: [],
    defaultSort: { field: 'level', dir: 'asc' },
  },
  'award-catalog': {
    slug: 'award-catalog', model: 'award', module: 'master.awards', entityType: 'Award',
    staffScoped: false, writePerm: PERMISSIONS.STAFF_UPDATE,
    schema: z.object({
      name: requiredText, nameMm: textField, description: textField,
    }),
    searchFields: ['name'],
    includeKeys: [],
    defaultSort: { field: 'name', dir: 'asc' },
  },
  'training-catalog': {
    slug: 'training-catalog', model: 'training', module: 'master.trainings', entityType: 'Training',
    staffScoped: false, writePerm: PERMISSIONS.STAFF_UPDATE,
    schema: z.object({
      name: requiredText, nameMm: textField, institution: textField, country: textField, type: textField,
    }),
    searchFields: ['name', 'institution'],
    includeKeys: [],
    defaultSort: { field: 'name', dir: 'asc' },
  },
  'political-parties': {
    slug: 'political-parties', model: 'politicalParty', module: 'master.political-parties', entityType: 'PoliticalParty',
    staffScoped: false, writePerm: PERMISSIONS.STAFF_UPDATE,
    schema: z.object({
      name: requiredText, nameMm: textField, description: textField,
    }),
    searchFields: ['name'],
    includeKeys: [],
    defaultSort: { field: 'name', dir: 'asc' },
  },
  'conflict-areas': {
    slug: 'conflict-areas', model: 'conflictArea', module: 'master.conflict-areas', entityType: 'ConflictArea',
    staffScoped: false, writePerm: PERMISSIONS.STAFF_UPDATE,
    schema: z.object({
      name: requiredText, location: textField, description: textField,
    }),
    searchFields: ['name', 'location'],
    includeKeys: [],
    defaultSort: { field: 'name', dir: 'asc' },
  },
}

export const STAFF_SCHEMA = z.object({
  staffNo: requiredText,
  nameEn: requiredText,
  nameMm: textField,
  gender: z.enum(GENDERS).default('MALE'),
  dateOfBirth: dateField,
  placeOfBirth: textField,
  nrcNo: textField,
  nationality: textField,
  religion: textField,
  bloodGroup: textField,
  maritalStatus: z.enum([...MARITAL_STATUS, ''] as [string, ...string[]]).transform((v) => v || null).optional(),
  phone: textField,
  email: z.union([z.string().email().nullable(), z.literal('').transform(() => null), z.string().transform((v) => v === '' ? null : v)]).optional(),
  photoUrl: textField,
  status: z.enum(STAFF_STATUS).default('ACTIVE'),
  joinDate: dateField,
})

export function getResource(slug: string): ResourceDef | null {
  return RESOURCES[slug] ?? null
}

export function getDelegate(def: ResourceDef): any {
  return (db as any)[def.model]
}

/** Build a prisma `include` object from includeKeys. */
export function buildInclude(def: ResourceDef, list = false): any {
  const inc: any = {}
  for (const key of def.includeKeys || []) {
    if (key === 'staff') inc.staff = { select: { id: true, staffNo: true, nameEn: true, nameMm: true, photoUrl: true, status: true } }
    else if (key === 'children' && !list) inc.children = { select: { id: true, name: true } }
    else inc[key] = key === 'case' ? { include: { staff: { select: { id: true, nameEn: true, staffNo: true } } } } : true
  }
  return Object.keys(inc).length ? inc : undefined
}

/** Fields referenced by masters that block deletion when in use. */
export const MASTER_USAGE: Record<string, { model: string; relation: string; label: string }[]> = {
  departments: [
    { model: 'staffPosition', relation: 'departmentId', label: 'staff positions' },
    { model: 'transfer', relation: 'toDepartmentId', label: 'transfers' },
    { model: 'position', relation: 'departmentId', label: 'positions' },
    { model: 'staffServiceHistory', relation: 'departmentId', label: 'service history records' },
  ],
  positions: [
    { model: 'staffPosition', relation: 'positionId', label: 'staff positions' },
    { model: 'transfer', relation: 'toPositionId', label: 'transfers' },
    { model: 'staffServiceHistory', relation: 'positionId', label: 'service history records' },
    { model: 'separation', relation: 'finalPositionId', label: 'separations' },
  ],
  ranks: [
    { model: 'staffRank', relation: 'rankId', label: 'staff ranks' },
    { model: 'promotion', relation: 'toRankId', label: 'promotions' },
    { model: 'staffServiceHistory', relation: 'rankId', label: 'service history records' },
    { model: 'separation', relation: 'finalRankId', label: 'separations' },
  ],
  'award-catalog': [{ model: 'staffAward', relation: 'awardId', label: 'staff awards' }],
  'training-catalog': [{ model: 'staffTraining', relation: 'trainingId', label: 'staff trainings' }],
  'political-parties': [{ model: 'politicalMembership', relation: 'partyId', label: 'political memberships' }],
  'conflict-areas': [{ model: 'staffConflictAssignment', relation: 'conflictAreaId', label: 'conflict assignments' }],
}
