import type { RoleName } from './constants'

// Permission keys
export const PERMISSIONS = {
  // own data
  PROFILE_VIEW: 'profile.view',
  PROFILE_EDIT: 'profile.edit',
  OWN_RECORD_VIEW: 'own-record.view',
  // staff & HR modules
  STAFF_VIEW: 'staff.view',
  STAFF_CREATE: 'staff.create',
  STAFF_UPDATE: 'staff.update',
  STAFF_DELETE_SOFT: 'staff.delete.soft',
  STAFF_DELETE_HARD: 'staff.delete.hard',
  DASHBOARD_FULL: 'dashboard.full',
  REPORTS_VIEW: 'reports.view',
  DOCUMENTS_VIEW: 'documents.view',
  DOCUMENTS_MANAGE: 'documents.manage',
  CRIMINAL_VIEW: 'criminal.view',
  CRIMINAL_MANAGE: 'criminal.manage',
  // admin
  AUDIT_VIEW: 'audit.view',
  USERS_MANAGE: 'users.manage',
  SETTINGS_MANAGE: 'settings.manage',
} as const

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

const USER_PERMS: PermissionKey[] = [
  PERMISSIONS.PROFILE_VIEW,
  PERMISSIONS.PROFILE_EDIT,
  PERMISSIONS.OWN_RECORD_VIEW,
]

const ADMIN_PERMS: PermissionKey[] = [
  ...USER_PERMS,
  PERMISSIONS.STAFF_VIEW,
  PERMISSIONS.STAFF_CREATE,
  PERMISSIONS.STAFF_UPDATE,
  PERMISSIONS.STAFF_DELETE_SOFT,
  PERMISSIONS.DASHBOARD_FULL,
  PERMISSIONS.REPORTS_VIEW,
  PERMISSIONS.DOCUMENTS_VIEW,
  PERMISSIONS.DOCUMENTS_MANAGE,
  PERMISSIONS.CRIMINAL_VIEW,
]

const SUPERADMIN_PERMS: PermissionKey[] = [
  ...ADMIN_PERMS,
  PERMISSIONS.STAFF_DELETE_HARD,
  PERMISSIONS.CRIMINAL_MANAGE,
  PERMISSIONS.AUDIT_VIEW,
  PERMISSIONS.USERS_MANAGE,
  PERMISSIONS.SETTINGS_MANAGE,
]

export const ROLE_PERMISSIONS: Record<RoleName, PermissionKey[]> = {
  USER: USER_PERMS,
  ADMIN: ADMIN_PERMS,
  SUPERADMIN: SUPERADMIN_PERMS,
}

export function can(role: string | undefined | null, permission: PermissionKey): boolean {
  if (!role) return false
  const perms = ROLE_PERMISSIONS[role as RoleName]
  return !!perms && perms.includes(permission)
}

export function requireRole(role: string | undefined | null, allowed: RoleName[]): boolean {
  return !!role && allowed.includes(role as RoleName)
}
