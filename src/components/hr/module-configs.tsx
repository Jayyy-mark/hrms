'use client'

import React, { useMemo } from 'react'
import { useI18n } from '@/i18n'
import { useQuery } from '@tanstack/react-query'
import { apiGet, qs } from '@/lib/client-api'
import { StatusBadge, StaffAvatar, type Column, type FieldDef } from './shared'
import {
  GENDERS, MARITAL_STATUS, STAFF_STATUS, ADDRESS_TYPES, RELATIONSHIPS, PROFICIENCY,
  SERVICE_EVENT_TYPES, MOVEMENT_STATUS, SEPARATION_TYPES, ACTIVITY_TYPES, SKILL_CATEGORIES,
  DISCIPLINARY_CASE_TYPES, DISCIPLINARY_STATUS, FOREIGN_TRAVEL_PURPOSES, DOC_CATEGORIES, DOC_ACCESS,
} from '@/lib/constants'

// ============ Master data hook ============

export interface MasterItem { id: string; name: string; nameMm?: string | null; code?: string | null; level?: number | null }

export function useMasters() {
  const departments = useQuery({
    queryKey: ['masters', 'departments'],
    queryFn: () => apiGet<MasterItem[]>('/api/resources/departments' + qs({ pageSize: 100, sortBy: 'name', sortDir: 'asc' })),
  })
  const positions = useQuery({
    queryKey: ['masters', 'positions'],
    queryFn: () => apiGet<(MasterItem & { department?: { id: string; name: string } | null })[]>('/api/resources/positions' + qs({ pageSize: 100, sortBy: 'name', sortDir: 'asc' })),
  })
  const ranks = useQuery({
    queryKey: ['masters', 'ranks'],
    queryFn: () => apiGet<MasterItem[]>('/api/resources/ranks' + qs({ pageSize: 100, sortBy: 'level', sortDir: 'asc' })),
  })
  const awards = useQuery({
    queryKey: ['masters', 'award-catalog'],
    queryFn: () => apiGet<MasterItem[]>('/api/resources/award-catalog' + qs({ pageSize: 100 })),
  })
  const trainings = useQuery({
    queryKey: ['masters', 'training-catalog'],
    queryFn: () => apiGet<MasterItem[]>('/api/resources/training-catalog' + qs({ pageSize: 100 })),
  })
  const parties = useQuery({
    queryKey: ['masters', 'political-parties'],
    queryFn: () => apiGet<MasterItem[]>('/api/resources/political-parties' + qs({ pageSize: 100 })),
  })
  const conflictAreas = useQuery({
    queryKey: ['masters', 'conflict-areas'],
    queryFn: () => apiGet<MasterItem[]>('/api/resources/conflict-areas' + qs({ pageSize: 100 })),
  })
  return {
    departments: departments.data ?? [],
    positions: positions.data ?? [],
    ranks: ranks.data ?? [],
    awards: awards.data ?? [],
    trainings: trainings.data ?? [],
    parties: parties.data ?? [],
    conflictAreas: conflictAreas.data ?? [],
    loading: [departments, positions, ranks].some((q) => q.isLoading),
  }
}

export interface MasterRef { key: string; label: string; options: { value: string; label: string }[] }

// ============ Module config registry ============

type ColType = 'text' | 'date' | 'enum' | 'bool' | 'staff' | 'ref' | 'badge' | 'number'

export interface ColDef {
  key: string
  headerKey: string
  type: ColType
  ref?: string // nested path e.g. 'toRank.name'
  enumPrefix?: string
  hideOnMobile?: boolean
}

export interface FieldDefLite {
  name: string
  labelKey: string
  type: 'text' | 'textarea' | 'select' | 'date' | 'number' | 'checkbox'
  enumValues?: readonly string[]
  master?: 'departments' | 'positions' | 'ranks' | 'awards' | 'trainings' | 'parties' | 'conflictAreas'
  required?: boolean
  full?: boolean
  emptyOption?: boolean
}

export interface ModuleConfig {
  slug: string
  titleKey: string
  subtitleKey?: string
  staffScoped: boolean
  sensitive?: boolean
  showStaffColumn?: boolean
  columns: ColDef[]
  fields: FieldDefLite[]
  filters?: { name: string; labelKey: string; enumValues?: readonly string[] }[]
}

export const MODULE_CONFIGS: Record<string, ModuleConfig> = {
  addresses: {
    slug: 'addresses', titleKey: 'addresses.title', staffScoped: true,
    columns: [
      { key: 'type', headerKey: 'common.type', type: 'enum' },
      { key: 'addressLine', headerKey: 'fields.addressLine', type: 'text' },
      { key: 'township', headerKey: 'fields.township', type: 'text', hideOnMobile: true },
      { key: 'stateRegion', headerKey: 'fields.stateRegion', type: 'text', hideOnMobile: true },
      { key: 'phone', headerKey: 'staff.phone', type: 'text', hideOnMobile: true },
      { key: 'isVerified', headerKey: 'fields.isVerified', type: 'bool' },
    ],
    fields: [
      { name: 'type', labelKey: 'common.type', type: 'select', enumValues: ADDRESS_TYPES, required: true },
      { name: 'addressLine', labelKey: 'fields.addressLine', type: 'textarea', required: true },
      { name: 'township', labelKey: 'fields.township', type: 'text' },
      { name: 'district', labelKey: 'fields.district', type: 'text' },
      { name: 'stateRegion', labelKey: 'fields.stateRegion', type: 'text' },
      { name: 'phone', labelKey: 'staff.phone', type: 'text' },
      { name: 'isVerified', labelKey: 'fields.isVerified', type: 'checkbox' },
      { name: 'effectiveFrom', labelKey: 'fields.effectiveFrom', type: 'date' },
      { name: 'notes', labelKey: 'common.notes', type: 'textarea' },
    ],
  },
  family: {
    slug: 'family', titleKey: 'family.title', staffScoped: true,
    columns: [
      { key: 'name', headerKey: 'common.name', type: 'text' },
      { key: 'relationship', headerKey: 'fields.relationship', type: 'enum' },
      { key: 'occupation', headerKey: 'fields.occupation', type: 'text', hideOnMobile: true },
      { key: 'phone', headerKey: 'staff.phone', type: 'text', hideOnMobile: true },
    ],
    fields: [
      { name: 'name', labelKey: 'common.name', type: 'text', required: true },
      { name: 'relationship', labelKey: 'fields.relationship', type: 'select', enumValues: RELATIONSHIPS, required: true },
      { name: 'dateOfBirth', labelKey: 'staff.dateOfBirth', type: 'date' },
      { name: 'occupation', labelKey: 'fields.occupation', type: 'text' },
      { name: 'nrcNo', labelKey: 'staff.nrcNo', type: 'text' },
      { name: 'phone', labelKey: 'staff.phone', type: 'text' },
      { name: 'address', labelKey: 'nav.addresses', type: 'textarea' },
      { name: 'notes', labelKey: 'common.notes', type: 'textarea' },
    ],
  },
  education: {
    slug: 'education', titleKey: 'education.title', staffScoped: true,
    columns: [
      { key: 'institution', headerKey: 'fields.institution', type: 'text' },
      { key: 'degree', headerKey: 'fields.degree', type: 'text' },
      { key: 'major', headerKey: 'fields.major', type: 'text', hideOnMobile: true },
      { key: 'graduationYear', headerKey: 'fields.graduationYear', type: 'number', hideOnMobile: true },
    ],
    fields: [
      { name: 'institution', labelKey: 'fields.institution', type: 'text', required: true },
      { name: 'degree', labelKey: 'fields.degree', type: 'text' },
      { name: 'major', labelKey: 'fields.major', type: 'text' },
      { name: 'country', labelKey: 'fields.country', type: 'text' },
      { name: 'startYear', labelKey: 'fields.startYear', type: 'number' },
      { name: 'endYear', labelKey: 'fields.endYear', type: 'number' },
      { name: 'graduationYear', labelKey: 'fields.graduationYear', type: 'number' },
      { name: 'certificateUrl', labelKey: 'fields.certificateUrl', type: 'text', full: true },
    ],
  },
  languages: {
    slug: 'languages', titleKey: 'languages.title', staffScoped: true,
    columns: [
      { key: 'language', headerKey: 'fields.language', type: 'text' },
      { key: 'reading', headerKey: 'fields.reading', type: 'enum' },
      { key: 'writing', headerKey: 'fields.writing', type: 'enum' },
      { key: 'speaking', headerKey: 'fields.speaking', type: 'enum', hideOnMobile: true },
      { key: 'listening', headerKey: 'fields.listening', type: 'enum', hideOnMobile: true },
    ],
    fields: [
      { name: 'language', labelKey: 'fields.language', type: 'text', required: true },
      { name: 'reading', labelKey: 'fields.reading', type: 'select', enumValues: PROFICIENCY, required: true },
      { name: 'writing', labelKey: 'fields.writing', type: 'select', enumValues: PROFICIENCY, required: true },
      { name: 'speaking', labelKey: 'fields.speaking', type: 'select', enumValues: PROFICIENCY, required: true },
      { name: 'listening', labelKey: 'fields.listening', type: 'select', enumValues: PROFICIENCY, required: true },
      { name: 'certification', labelKey: 'fields.certification', type: 'text' },
    ],
  },
  skills: {
    slug: 'skills', titleKey: 'skills.title', staffScoped: true,
    columns: [
      { key: 'name', headerKey: 'fields.skillName', type: 'text' },
      { key: 'category', headerKey: 'fields.category', type: 'enum' },
      { key: 'level', headerKey: 'fields.level', type: 'enum' },
    ],
    fields: [
      { name: 'name', labelKey: 'fields.skillName', type: 'text', required: true },
      { name: 'category', labelKey: 'fields.category', type: 'select', enumValues: SKILL_CATEGORIES, required: true },
      { name: 'level', labelKey: 'fields.level', type: 'select', enumValues: PROFICIENCY, required: true },
      { name: 'certification', labelKey: 'fields.certification', type: 'text' },
    ],
  },
  'close-contacts': {
    slug: 'close-contacts', titleKey: 'contactsModule.title', staffScoped: true,
    columns: [
      { key: 'name', headerKey: 'common.name', type: 'text' },
      { key: 'relationship', headerKey: 'fields.relationship', type: 'text' },
      { key: 'occupation', headerKey: 'fields.occupation', type: 'text', hideOnMobile: true },
      { key: 'phone', headerKey: 'staff.phone', type: 'text' },
    ],
    fields: [
      { name: 'name', labelKey: 'common.name', type: 'text', required: true },
      { name: 'relationship', labelKey: 'fields.relationship', type: 'text' },
      { name: 'occupation', labelKey: 'fields.occupation', type: 'text' },
      { name: 'phone', labelKey: 'staff.phone', type: 'text' },
      { name: 'address', labelKey: 'addresses.title', type: 'textarea' },
      { name: 'description', labelKey: 'common.description', type: 'textarea' },
    ],
  },
  references: {
    slug: 'references', titleKey: 'referencesModule.title', staffScoped: true,
    columns: [
      { key: 'name', headerKey: 'common.name', type: 'text' },
      { key: 'position', headerKey: 'fields.position', type: 'text' },
      { key: 'organization', headerKey: 'fields.organization', type: 'text', hideOnMobile: true },
      { key: 'phone', headerKey: 'staff.phone', type: 'text' },
    ],
    fields: [
      { name: 'name', labelKey: 'common.name', type: 'text', required: true },
      { name: 'relationship', labelKey: 'fields.relationship', type: 'text' },
      { name: 'position', labelKey: 'fields.position', type: 'text' },
      { name: 'organization', labelKey: 'fields.organization', type: 'text' },
      { name: 'phone', labelKey: 'staff.phone', type: 'text' },
      { name: 'address', labelKey: 'addresses.title', type: 'textarea' },
      { name: 'description', labelKey: 'common.description', type: 'textarea' },
    ],
  },
  'service-history': {
    slug: 'service-history', titleKey: 'serviceHistoryModule.title', subtitleKey: 'serviceHistoryModule.subtitle', staffScoped: true, showStaffColumn: true,
    columns: [
      { key: 'fromDate', headerKey: 'fields.fromDate', type: 'date' },
      { key: 'title', headerKey: 'common.title', type: 'text' },
      { key: 'type', headerKey: 'common.type', type: 'enum' },
      { key: 'department', headerKey: 'fields.department', type: 'ref', ref: 'department.name', hideOnMobile: true },
      { key: 'rank', headerKey: 'fields.rank', type: 'ref', ref: 'rank.name', hideOnMobile: true },
    ],
    fields: [
      { name: 'type', labelKey: 'common.type', type: 'select', enumValues: SERVICE_EVENT_TYPES, required: true },
      { name: 'title', labelKey: 'common.title', type: 'text', required: true },
      { name: 'fromDate', labelKey: 'fields.fromDate', type: 'date', required: true },
      { name: 'toDate', labelKey: 'fields.toDate', type: 'date' },
      { name: 'departmentId', labelKey: 'fields.department', type: 'select', master: 'departments', emptyOption: true },
      { name: 'positionId', labelKey: 'fields.position', type: 'select', master: 'positions', emptyOption: true },
      { name: 'rankId', labelKey: 'fields.rank', type: 'select', master: 'ranks', emptyOption: true },
      { name: 'location', labelKey: 'fields.location', type: 'text' },
      { name: 'orderNo', labelKey: 'fields.orderNo', type: 'number' },
      { name: 'remarks', labelKey: 'common.remarks', type: 'textarea' },
    ],
  },
  'staff-positions': {
    slug: 'staff-positions', titleKey: 'fields.position', staffScoped: true, showStaffColumn: true,
    columns: [
      { key: 'position', headerKey: 'fields.position', type: 'ref', ref: 'position.name' },
      { key: 'department', headerKey: 'fields.department', type: 'ref', ref: 'department.name' },
      { key: 'startDate', headerKey: 'fields.startDate', type: 'date' },
      { key: 'endDate', headerKey: 'fields.endDate', type: 'date', hideOnMobile: true },
      { key: 'isCurrent', headerKey: 'fields.isCurrent', type: 'bool' },
    ],
    fields: [
      { name: 'positionId', labelKey: 'fields.position', type: 'select', master: 'positions', required: true },
      { name: 'departmentId', labelKey: 'fields.department', type: 'select', master: 'departments', emptyOption: true },
      { name: 'startDate', labelKey: 'fields.startDate', type: 'date', required: true },
      { name: 'endDate', labelKey: 'fields.endDate', type: 'date' },
      { name: 'isCurrent', labelKey: 'fields.isCurrent', type: 'checkbox' },
      { name: 'remarks', labelKey: 'common.remarks', type: 'textarea' },
    ],
  },
  'staff-ranks': {
    slug: 'staff-ranks', titleKey: 'fields.rank', staffScoped: true, showStaffColumn: true,
    columns: [
      { key: 'rank', headerKey: 'fields.rank', type: 'ref', ref: 'rank.name' },
      { key: 'effectiveDate', headerKey: 'fields.effectiveDate', type: 'date' },
      { key: 'appointedDate', headerKey: 'fields.appliedDate', type: 'date', hideOnMobile: true },
      { key: 'endDate', headerKey: 'fields.endDate', type: 'date', hideOnMobile: true },
      { key: 'isCurrent', headerKey: 'fields.isCurrent', type: 'bool' },
    ],
    fields: [
      { name: 'rankId', labelKey: 'fields.rank', type: 'select', master: 'ranks', required: true },
      { name: 'effectiveDate', labelKey: 'fields.effectiveDate', type: 'date', required: true },
      { name: 'appointedDate', labelKey: 'fields.appliedDate', type: 'date' },
      { name: 'endDate', labelKey: 'fields.endDate', type: 'date' },
      { name: 'isCurrent', labelKey: 'fields.isCurrent', type: 'checkbox' },
      { name: 'remarks', labelKey: 'common.remarks', type: 'textarea' },
    ],
  },
  promotions: {
    slug: 'promotions', titleKey: 'promotionsModule.title', subtitleKey: 'promotionsModule.subtitle', staffScoped: true, showStaffColumn: true,
    columns: [
      { key: 'staff', headerKey: 'common.staffMember', type: 'staff', hideOnMobile: true },
      { key: 'fromRank', headerKey: 'fields.fromRank', type: 'ref', ref: 'fromRank.name' },
      { key: 'toRank', headerKey: 'fields.toRank', type: 'ref', ref: 'toRank.name' },
      { key: 'effectiveDate', headerKey: 'fields.effectiveDate', type: 'date' },
      { key: 'status', headerKey: 'common.status', type: 'enum' },
    ],
    fields: [
      { name: 'fromRankId', labelKey: 'fields.fromRank', type: 'select', master: 'ranks', emptyOption: true },
      { name: 'toRankId', labelKey: 'fields.toRank', type: 'select', master: 'ranks', required: true },
      { name: 'appliedDate', labelKey: 'fields.appliedDate', type: 'date' },
      { name: 'effectiveDate', labelKey: 'fields.effectiveDate', type: 'date', required: true },
      { name: 'authority', labelKey: 'common.authority', type: 'text' },
      { name: 'status', labelKey: 'common.status', type: 'select', enumValues: MOVEMENT_STATUS, required: true },
      { name: 'remarks', labelKey: 'common.remarks', type: 'textarea' },
    ],
    filters: [{ name: 'status', labelKey: 'common.status', enumValues: MOVEMENT_STATUS }],
  },
  transfers: {
    slug: 'transfers', titleKey: 'transfersModule.title', subtitleKey: 'transfersModule.subtitle', staffScoped: true, showStaffColumn: true,
    columns: [
      { key: 'staff', headerKey: 'common.staffMember', type: 'staff', hideOnMobile: true },
      { key: 'fromDepartment', headerKey: 'fields.fromDepartment', type: 'ref', ref: 'fromDepartment.name' },
      { key: 'toDepartment', headerKey: 'fields.toDepartment', type: 'ref', ref: 'toDepartment.name' },
      { key: 'transferDate', headerKey: 'fields.transferDate', type: 'date', hideOnMobile: true },
      { key: 'status', headerKey: 'common.status', type: 'enum' },
    ],
    fields: [
      { name: 'fromDepartmentId', labelKey: 'fields.fromDepartment', type: 'select', master: 'departments', emptyOption: true },
      { name: 'toDepartmentId', labelKey: 'fields.toDepartment', type: 'select', master: 'departments', required: true },
      { name: 'fromPositionId', labelKey: 'fields.fromPosition', type: 'select', master: 'positions', emptyOption: true },
      { name: 'toPositionId', labelKey: 'fields.toPosition', type: 'select', master: 'positions', emptyOption: true },
      { name: 'transferDate', labelKey: 'fields.transferDate', type: 'date', required: true },
      { name: 'reason', labelKey: 'common.reason', type: 'textarea' },
      { name: 'status', labelKey: 'common.status', type: 'select', enumValues: MOVEMENT_STATUS, required: true },
      { name: 'remarks', labelKey: 'common.remarks', type: 'textarea' },
    ],
    filters: [{ name: 'status', labelKey: 'common.status', enumValues: MOVEMENT_STATUS }],
  },
  separations: {
    slug: 'separations', titleKey: 'separationsModule.title', subtitleKey: 'separationsModule.subtitle', staffScoped: true, showStaffColumn: true,
    columns: [
      { key: 'staff', headerKey: 'common.staffMember', type: 'staff', hideOnMobile: true },
      { key: 'type', headerKey: 'common.type', type: 'enum' },
      { key: 'effectiveDate', headerKey: 'fields.effectiveDate', type: 'date' },
      { key: 'reason', headerKey: 'common.reason', type: 'text', hideOnMobile: true },
    ],
    fields: [
      { name: 'type', labelKey: 'common.type', type: 'select', enumValues: SEPARATION_TYPES, required: true },
      { name: 'effectiveDate', labelKey: 'fields.effectiveDate', type: 'date', required: true },
      { name: 'reason', labelKey: 'common.reason', type: 'textarea' },
      { name: 'finalRankId', labelKey: 'fields.finalRank', type: 'select', master: 'ranks', emptyOption: true },
      { name: 'finalPositionId', labelKey: 'fields.finalPosition', type: 'select', master: 'positions', emptyOption: true },
      { name: 'remarks', labelKey: 'common.remarks', type: 'textarea' },
    ],
  },
  awards: {
    slug: 'awards', titleKey: 'awardsModule.title', subtitleKey: 'awardsModule.subtitle', staffScoped: true, showStaffColumn: true,
    columns: [
      { key: 'staff', headerKey: 'common.staffMember', type: 'staff', hideOnMobile: true },
      { key: 'title', headerKey: 'common.title', type: 'text' },
      { key: 'awardedDate', headerKey: 'fields.awardedDate', type: 'date' },
      { key: 'authority', headerKey: 'common.authority', type: 'text', hideOnMobile: true },
    ],
    fields: [
      { name: 'awardId', labelKey: 'awardsModule.title', type: 'select', master: 'awards', emptyOption: true },
      { name: 'title', labelKey: 'common.title', type: 'text', required: true },
      { name: 'awardedDate', labelKey: 'fields.awardedDate', type: 'date', required: true },
      { name: 'authority', labelKey: 'common.authority', type: 'text' },
      { name: 'reason', labelKey: 'common.reason', type: 'textarea' },
      { name: 'certificateUrl', labelKey: 'fields.certificateUrl', type: 'text', full: true },
    ],
  },
  trainings: {
    slug: 'trainings', titleKey: 'trainingsModule.title', subtitleKey: 'trainingsModule.subtitle', staffScoped: true, showStaffColumn: true,
    columns: [
      { key: 'staff', headerKey: 'common.staffMember', type: 'staff', hideOnMobile: true },
      { key: 'courseName', headerKey: 'fields.courseName', type: 'text' },
      { key: 'institution', headerKey: 'fields.institution', type: 'text', hideOnMobile: true },
      { key: 'startDate', headerKey: 'fields.startDate', type: 'date' },
      { key: 'isForeign', headerKey: 'fields.isForeign', type: 'bool' },
    ],
    fields: [
      { name: 'trainingId', labelKey: 'trainingsModule.title', type: 'select', master: 'trainings', emptyOption: true },
      { name: 'courseName', labelKey: 'fields.courseName', type: 'text', required: true },
      { name: 'institution', labelKey: 'fields.institution', type: 'text' },
      { name: 'location', labelKey: 'fields.location', type: 'text' },
      { name: 'country', labelKey: 'fields.country', type: 'text' },
      { name: 'startDate', labelKey: 'fields.startDate', type: 'date', required: true },
      { name: 'endDate', labelKey: 'fields.endDate', type: 'date' },
      { name: 'result', labelKey: 'fields.result', type: 'text' },
      { name: 'isForeign', labelKey: 'fields.isForeign', type: 'checkbox' },
      { name: 'certificateUrl', labelKey: 'fields.certificateUrl', type: 'text', full: true },
    ],
    filters: [{ name: 'isForeign', labelKey: 'fields.isForeign' }],
  },
  military: {
    slug: 'military', titleKey: 'militaryModule.title', subtitleKey: 'militaryModule.subtitle', staffScoped: true, showStaffColumn: true,
    columns: [
      { key: 'staff', headerKey: 'common.staffMember', type: 'staff', hideOnMobile: true },
      { key: 'unit', headerKey: 'fields.unit', type: 'text' },
      { key: 'rank', headerKey: 'fields.rank', type: 'text' },
      { key: 'startDate', headerKey: 'fields.startDate', type: 'date', hideOnMobile: true },
      { key: 'status', headerKey: 'common.status', type: 'text', hideOnMobile: true },
    ],
    fields: [
      { name: 'serviceNumber', labelKey: 'fields.serviceNumber', type: 'text' },
      { name: 'unit', labelKey: 'fields.unit', type: 'text' },
      { name: 'rank', labelKey: 'fields.rank', type: 'text' },
      { name: 'position', labelKey: 'fields.position', type: 'text' },
      { name: 'startDate', labelKey: 'fields.startDate', type: 'date' },
      { name: 'endDate', labelKey: 'fields.endDate', type: 'date' },
      { name: 'status', labelKey: 'common.status', type: 'text' },
      { name: 'training', labelKey: 'trainingsModule.title', type: 'text' },
      { name: 'remarks', labelKey: 'common.remarks', type: 'textarea' },
    ],
  },
  activities: {
    slug: 'activities', titleKey: 'activitiesModule.title', subtitleKey: 'activitiesModule.subtitle', staffScoped: true, showStaffColumn: true,
    columns: [
      { key: 'staff', headerKey: 'common.staffMember', type: 'staff', hideOnMobile: true },
      { key: 'name', headerKey: 'common.name', type: 'text' },
      { key: 'type', headerKey: 'common.type', type: 'enum' },
      { key: 'role', headerKey: 'fields.role', type: 'text', hideOnMobile: true },
      { key: 'date', headerKey: 'common.date', type: 'date', hideOnMobile: true },
    ],
    fields: [
      { name: 'name', labelKey: 'common.name', type: 'text', required: true },
      { name: 'type', labelKey: 'common.type', type: 'select', enumValues: ACTIVITY_TYPES, required: true },
      { name: 'role', labelKey: 'fields.role', type: 'text' },
      { name: 'date', labelKey: 'common.date', type: 'date' },
      { name: 'description', labelKey: 'common.description', type: 'textarea' },
    ],
  },
  hobbies: {
    slug: 'hobbies', titleKey: 'hobbiesModule.title', staffScoped: true,
    columns: [
      { key: 'name', headerKey: 'common.name', type: 'text' },
      { key: 'level', headerKey: 'fields.level', type: 'text' },
      { key: 'description', headerKey: 'common.description', type: 'text', hideOnMobile: true },
    ],
    fields: [
      { name: 'name', labelKey: 'common.name', type: 'text', required: true },
      { name: 'level', labelKey: 'fields.level', type: 'text' },
      { name: 'description', labelKey: 'common.description', type: 'textarea' },
    ],
  },
  political: {
    slug: 'political', titleKey: 'politicalModule.title', subtitleKey: 'politicalModule.subtitle', staffScoped: true, showStaffColumn: true,
    columns: [
      { key: 'staff', headerKey: 'common.staffMember', type: 'staff', hideOnMobile: true },
      { key: 'partyName', headerKey: 'common.name', type: 'text' },
      { key: 'position', headerKey: 'fields.position', type: 'text', hideOnMobile: true },
      { key: 'joinDate', headerKey: 'fields.joinDate', type: 'date', hideOnMobile: true },
    ],
    fields: [
      { name: 'partyId', labelKey: 'politicalModule.title', type: 'select', master: 'parties', emptyOption: true },
      { name: 'partyName', labelKey: 'common.name', type: 'text', required: true },
      { name: 'membershipNo', labelKey: 'fields.membershipNo', type: 'text' },
      { name: 'position', labelKey: 'fields.position', type: 'text' },
      { name: 'joinDate', labelKey: 'fields.joinDate', type: 'date' },
      { name: 'leaveDate', labelKey: 'fields.leaveDate', type: 'date' },
      { name: 'status', labelKey: 'common.status', type: 'text' },
      { name: 'remarks', labelKey: 'common.remarks', type: 'textarea' },
    ],
  },
  conflicts: {
    slug: 'conflicts', titleKey: 'conflictsModule.title', subtitleKey: 'conflictsModule.subtitle', staffScoped: true, showStaffColumn: true,
    columns: [
      { key: 'staff', headerKey: 'common.staffMember', type: 'staff', hideOnMobile: true },
      { key: 'conflictArea', headerKey: 'fields.conflictArea', type: 'ref', ref: 'conflictArea.name' },
      { key: 'unit', headerKey: 'fields.unit', type: 'text', hideOnMobile: true },
      { key: 'deploymentDate', headerKey: 'fields.deploymentDate', type: 'date' },
    ],
    fields: [
      { name: 'conflictAreaId', labelKey: 'fields.conflictArea', type: 'select', master: 'conflictAreas', required: true },
      { name: 'unit', labelKey: 'fields.unit', type: 'text' },
      { name: 'position', labelKey: 'fields.position', type: 'text' },
      { name: 'deploymentDate', labelKey: 'fields.deploymentDate', type: 'date', required: true },
      { name: 'returnDate', labelKey: 'fields.returnDate', type: 'date' },
      { name: 'reason', labelKey: 'common.reason', type: 'text' },
      { name: 'notes', labelKey: 'common.notes', type: 'textarea' },
    ],
  },
  disciplinary: {
    slug: 'disciplinary', titleKey: 'disciplinaryModule.title', subtitleKey: 'disciplinaryModule.subtitle', staffScoped: true, showStaffColumn: true,
    columns: [
      { key: 'staff', headerKey: 'common.staffMember', type: 'staff', hideOnMobile: true },
      { key: 'title', headerKey: 'common.title', type: 'text' },
      { key: 'type', headerKey: 'common.type', type: 'enum' },
      { key: 'dateOpened', headerKey: 'fields.dateOpened', type: 'date' },
      { key: 'status', headerKey: 'common.status', type: 'enum' },
    ],
    fields: [
      { name: 'caseNumber', labelKey: 'fields.caseNumber', type: 'text' },
      { name: 'type', labelKey: 'common.type', type: 'select', enumValues: DISCIPLINARY_CASE_TYPES, required: true },
      { name: 'title', labelKey: 'common.title', type: 'text', required: true },
      { name: 'dateOpened', labelKey: 'fields.dateOpened', type: 'date', required: true },
      { name: 'status', labelKey: 'common.status', type: 'select', enumValues: DISCIPLINARY_STATUS, required: true },
      { name: 'description', labelKey: 'common.description', type: 'textarea' },
      { name: 'decision', labelKey: 'fields.decision', type: 'text' },
      { name: 'penalty', labelKey: 'fields.penalty', type: 'text' },
      { name: 'appealStatus', labelKey: 'fields.appealStatus', type: 'text' },
      { name: 'closedDate', labelKey: 'fields.closedDate', type: 'date' },
    ],
    filters: [
      { name: 'status', labelKey: 'common.status', enumValues: DISCIPLINARY_STATUS },
      { name: 'type', labelKey: 'common.type', enumValues: DISCIPLINARY_CASE_TYPES },
    ],
  },
  criminal: {
    slug: 'criminal', titleKey: 'criminalModule.title', subtitleKey: 'criminalModule.subtitle', staffScoped: true, showStaffColumn: true, sensitive: true,
    columns: [
      { key: 'staff', headerKey: 'common.staffMember', type: 'staff', hideOnMobile: true },
      { key: 'caseNumber', headerKey: 'fields.caseNumber', type: 'text' },
      { key: 'offense', headerKey: 'fields.offense', type: 'text' },
      { key: 'caseDate', headerKey: 'fields.caseDate', type: 'date', hideOnMobile: true },
      { key: 'status', headerKey: 'common.status', type: 'text' },
    ],
    fields: [
      { name: 'caseNumber', labelKey: 'fields.caseNumber', type: 'text' },
      { name: 'caseType', labelKey: 'fields.caseType', type: 'text' },
      { name: 'court', labelKey: 'fields.court', type: 'text' },
      { name: 'offense', labelKey: 'fields.offense', type: 'text' },
      { name: 'caseDate', labelKey: 'fields.caseDate', type: 'date' },
      { name: 'status', labelKey: 'common.status', type: 'text' },
      { name: 'judgment', labelKey: 'fields.judgment', type: 'text' },
      { name: 'penalty', labelKey: 'fields.penalty', type: 'text' },
      { name: 'notes', labelKey: 'common.notes', type: 'textarea' },
    ],
  },
  'foreign-travels': {
    slug: 'foreign-travels', titleKey: 'foreignTravelsModule.title', subtitleKey: 'foreignTravelsModule.subtitle', staffScoped: true, showStaffColumn: true,
    columns: [
      { key: 'staff', headerKey: 'common.staffMember', type: 'staff', hideOnMobile: true },
      { key: 'destinationCountry', headerKey: 'fields.destinationCountry', type: 'text' },
      { key: 'purpose', headerKey: 'fields.purpose', type: 'enum' },
      { key: 'startDate', headerKey: 'fields.startDate', type: 'date', hideOnMobile: true },
    ],
    fields: [
      { name: 'purpose', labelKey: 'fields.purpose', type: 'select', enumValues: FOREIGN_TRAVEL_PURPOSES, required: true },
      { name: 'destinationCountry', labelKey: 'fields.destinationCountry', type: 'text', required: true },
      { name: 'organization', labelKey: 'fields.organization', type: 'text' },
      { name: 'sponsor', labelKey: 'fields.sponsor', type: 'text' },
      { name: 'startDate', labelKey: 'fields.startDate', type: 'date', required: true },
      { name: 'endDate', labelKey: 'fields.endDate', type: 'date' },
      { name: 'approvalRef', labelKey: 'fields.approvalRef', type: 'text' },
      { name: 'returnStatus', labelKey: 'fields.returnStatus', type: 'text' },
      { name: 'notes', labelKey: 'common.notes', type: 'textarea' },
    ],
    filters: [{ name: 'purpose', labelKey: 'fields.purpose', enumValues: FOREIGN_TRAVEL_PURPOSES }],
  },
  // ---- Master data ----
  departments: {
    slug: 'departments', titleKey: 'nav.departments', staffScoped: false,
    columns: [
      { key: 'name', headerKey: 'common.name', type: 'text' },
      { key: 'code', headerKey: 'common.code', type: 'text' },
      { key: 'parent', headerKey: 'fields.department', type: 'ref', ref: 'parent.name', hideOnMobile: true },
    ],
    fields: [
      { name: 'name', labelKey: 'common.name', type: 'text', required: true },
      { name: 'nameMm', labelKey: 'staff.nameMm', type: 'text' },
      { name: 'code', labelKey: 'common.code', type: 'text' },
      { name: 'parentId', labelKey: 'fields.department', type: 'select', master: 'departments', emptyOption: true },
      { name: 'description', labelKey: 'common.description', type: 'textarea' },
    ],
  },
  positions: {
    slug: 'positions', titleKey: 'nav.positions', staffScoped: false,
    columns: [
      { key: 'name', headerKey: 'common.name', type: 'text' },
      { key: 'code', headerKey: 'common.code', type: 'text' },
      { key: 'department', headerKey: 'fields.department', type: 'ref', ref: 'department.name', hideOnMobile: true },
      { key: 'level', headerKey: 'fields.level', type: 'number', hideOnMobile: true },
    ],
    fields: [
      { name: 'name', labelKey: 'common.name', type: 'text', required: true },
      { name: 'nameMm', labelKey: 'staff.nameMm', type: 'text' },
      { name: 'code', labelKey: 'common.code', type: 'text' },
      { name: 'departmentId', labelKey: 'fields.department', type: 'select', master: 'departments', emptyOption: true },
      { name: 'level', labelKey: 'fields.level', type: 'number' },
      { name: 'description', labelKey: 'common.description', type: 'textarea' },
    ],
  },
  ranks: {
    slug: 'ranks', titleKey: 'nav.ranks', staffScoped: false,
    columns: [
      { key: 'name', headerKey: 'common.name', type: 'text' },
      { key: 'code', headerKey: 'common.code', type: 'text' },
      { key: 'level', headerKey: 'fields.level', type: 'number' },
      { key: 'category', headerKey: 'fields.category', type: 'text', hideOnMobile: true },
    ],
    fields: [
      { name: 'name', labelKey: 'common.name', type: 'text', required: true },
      { name: 'nameMm', labelKey: 'staff.nameMm', type: 'text' },
      { name: 'code', labelKey: 'common.code', type: 'text' },
      { name: 'level', labelKey: 'fields.level', type: 'number' },
      { name: 'category', labelKey: 'fields.category', type: 'text' },
    ],
  },
  'award-catalog': {
    slug: 'award-catalog', titleKey: 'nav.awards', staffScoped: false,
    columns: [
      { key: 'name', headerKey: 'common.name', type: 'text' },
      { key: 'description', headerKey: 'common.description', type: 'text', hideOnMobile: true },
    ],
    fields: [
      { name: 'name', labelKey: 'common.name', type: 'text', required: true },
      { name: 'nameMm', labelKey: 'staff.nameMm', type: 'text' },
      { name: 'description', labelKey: 'common.description', type: 'textarea' },
    ],
  },
  'training-catalog': {
    slug: 'training-catalog', titleKey: 'nav.trainings', staffScoped: false,
    columns: [
      { key: 'name', headerKey: 'common.name', type: 'text' },
      { key: 'institution', headerKey: 'fields.institution', type: 'text' },
      { key: 'country', headerKey: 'fields.country', type: 'text', hideOnMobile: true },
    ],
    fields: [
      { name: 'name', labelKey: 'common.name', type: 'text', required: true },
      { name: 'nameMm', labelKey: 'staff.nameMm', type: 'text' },
      { name: 'institution', labelKey: 'fields.institution', type: 'text' },
      { name: 'country', labelKey: 'fields.country', type: 'text' },
      { name: 'type', labelKey: 'common.type', type: 'text' },
    ],
  },
  'political-parties': {
    slug: 'political-parties', titleKey: 'nav.political', staffScoped: false,
    columns: [
      { key: 'name', headerKey: 'common.name', type: 'text' },
      { key: 'description', headerKey: 'common.description', type: 'text', hideOnMobile: true },
    ],
    fields: [
      { name: 'name', labelKey: 'common.name', type: 'text', required: true },
      { name: 'nameMm', labelKey: 'staff.nameMm', type: 'text' },
      { name: 'description', labelKey: 'common.description', type: 'textarea' },
    ],
  },
  'conflict-areas': {
    slug: 'conflict-areas', titleKey: 'nav.conflictAreas', staffScoped: false,
    columns: [
      { key: 'name', headerKey: 'common.name', type: 'text' },
      { key: 'location', headerKey: 'fields.location', type: 'text' },
      { key: 'description', headerKey: 'common.description', type: 'text', hideOnMobile: true },
    ],
    fields: [
      { name: 'name', labelKey: 'common.name', type: 'text', required: true },
      { name: 'location', labelKey: 'fields.location', type: 'text' },
      { name: 'description', labelKey: 'common.description', type: 'textarea' },
    ],
  },
}

// ============ Builders ============

function getByPath(obj: Record<string, unknown> | null | undefined, path: string): unknown {
  if (!obj) return undefined
  let cur: unknown = obj
  for (const p of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return cur
}

export function useModuleColumns(config: ModuleConfig, opts: { showStaff?: boolean } = {}): Column<Record<string, unknown>>[] {
  const { t, formatDate } = useI18n()
  return useMemo(() => {
    const cols: Column<Record<string, unknown>>[] = []
    const showStaff = config.showStaffColumn && opts.showStaff
    for (const c of config.columns) {
      if (c.type === 'staff' && !showStaff) continue
      if (c.type === 'staff' || (config.showStaffColumn && c.key === 'staff' && showStaff)) {
        cols.push({
          key: 'staff',
          header: t('common.staffMember'),
          render: (row) => {
            const s = row.staff as { id?: string; nameEn?: string; nameMm?: string | null; staffNo?: string; photoUrl?: string | null } | null | undefined
            if (!s) return '—'
            return (
              <div className="flex items-center gap-2.5">
                <StaffAvatar name={s.nameEn} photoUrl={s.photoUrl} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{s.nameEn}{s.nameMm ? ` · ${s.nameMm}` : ''}</p>
                  <p className="truncate text-xs text-muted-foreground">{s.staffNo}</p>
                </div>
            </div>
            )
          },
          className: 'min-w-44',
        })
        continue
      }
      cols.push({
        key: c.key,
        header: t(c.headerKey),
        hideOnMobile: c.hideOnMobile,
        sortable: ['date', 'number', 'text'].includes(c.type),
        render: (row) => {
          const raw = c.ref ? getByPath(row, c.ref) : row[c.key]
          switch (c.type) {
            case 'date': return formatDate(raw as string | null)
            case 'enum': return raw ? <StatusBadge value={String(raw)} /> : '—'
            case 'bool': return <span className={raw ? 'text-emerald-600 dark:text-emerald-300' : 'text-muted-foreground'}>{raw ? t('common.yes') : t('common.no')}</span>
            case 'number': return raw == null ? '—' : String(raw)
            default: return raw == null || raw === '' ? '—' : String(raw)
          }
        },
      })
    }
    return cols
  }, [config, opts.showStaff, t, formatDate])
}

export function useModuleFields(config: ModuleConfig, masters: ReturnType<typeof useMasters>): FieldDef[] {
  const { t } = useI18n()
  return useMemo(() => {
    const masterMap: Record<string, { value: string; label: string }[]> = {
      departments: masters.departments.map((d) => ({ value: d.id, label: d.name })),
      positions: masters.positions.map((p) => ({ value: p.id, label: p.name + (p.department?.name ? ` — ${p.department.name}` : '') })),
      ranks: masters.ranks.map((r) => ({ value: r.id, label: r.name })),
      awards: masters.awards.map((a) => ({ value: a.id, label: a.name })),
      trainings: masters.trainings.map((x) => ({ value: x.id, label: x.name })),
      parties: masters.parties.map((p) => ({ value: p.id, label: p.name })),
      conflictAreas: masters.conflictAreas.map((c) => ({ value: c.id, label: c.name })),
    }
    return config.fields.map((f) => ({
      name: f.name,
      label: t(f.labelKey),
      type: f.type,
      required: f.required,
      full: f.full,
      options: f.enumValues
        ? f.enumValues.map((v) => ({ value: v, label: t(`enums.${v}`) }))
        : f.master
          ? [...(f.emptyOption ? [{ value: '__none__', label: '—' }] : []), ...(masterMap[f.master] ?? [])]
          : undefined,
    })) as FieldDef[]
  }, [config, masters, t])
}

// Staff form fields (shared by create/edit staff)
export function useStaffFields(): FieldDef[] {
  const { t } = useI18n()
  return useMemo(() => [
    { name: 'staffNo', label: t('staff.staffNo'), type: 'text' as const, required: true },
    { name: 'nameEn', label: t('staff.nameEn'), type: 'text' as const, required: true },
    { name: 'nameMm', label: t('staff.nameMm'), type: 'text' as const },
    { name: 'gender', label: t('staff.gender'), type: 'select' as const, required: true, options: GENDERS.map((g) => ({ value: g, label: t(`enums.${g}`) })) },
    { name: 'dateOfBirth', label: t('staff.dateOfBirth'), type: 'date' as const },
    { name: 'placeOfBirth', label: t('staff.placeOfBirth'), type: 'text' as const },
    { name: 'nrcNo', label: t('staff.nrcNo'), type: 'text' as const },
    { name: 'nationality', label: t('staff.nationality'), type: 'text' as const },
    { name: 'religion', label: t('staff.religion'), type: 'text' as const },
    { name: 'bloodGroup', label: t('staff.bloodGroup'), type: 'text' as const },
    { name: 'maritalStatus', label: t('staff.maritalStatus'), type: 'select' as const, options: [{ value: '__none__', label: '—' }, ...MARITAL_STATUS.map((m) => ({ value: m, label: t(`enums.${m}`) }))] },
    { name: 'phone', label: t('staff.phone'), type: 'text' as const },
    { name: 'email', label: t('staff.email'), type: 'text' as const },
    { name: 'status', label: t('staff.status'), type: 'select' as const, required: true, options: STAFF_STATUS.map((s) => ({ value: s, label: t(`enums.${s}`) })) },
    { name: 'joinDate', label: t('staff.joinDate'), type: 'date' as const },
    { name: 'photoUrl', label: t('staff.photo'), type: 'upload' as const, full: true, hint: t('common.uploadHint') },
  ], [t])
}
