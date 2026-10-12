// Central enum option lists (SQLite stores enums as strings; Zod validates).

export const ROLES = ['USER', 'ADMIN', 'SUPERADMIN'] as const
export type RoleName = (typeof ROLES)[number]

export const STAFF_STATUS = ['ACTIVE', 'RETIRED', 'RESIGNED', 'TRANSFERRED', 'SUSPENDED', 'DECEASED', 'OTHER'] as const
export const GENDERS = ['MALE', 'FEMALE', 'OTHER'] as const
export const MARITAL_STATUS = ['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED'] as const
export const ADDRESS_TYPES = ['PERMANENT', 'CURRENT', 'PREVIOUS'] as const
export const RELATIONSHIPS = ['FATHER', 'MOTHER', 'SPOUSE', 'CHILD', 'SIBLING', 'OTHER'] as const
export const PROFICIENCY = ['POOR', 'FAIR', 'GOOD', 'EXCELLENT'] as const
export const SERVICE_EVENT_TYPES = ['JOINING', 'APPOINTMENT', 'TRANSFER', 'PROMOTION', 'DEMOTION', 'REASSIGNMENT', 'RETIREMENT', 'RESIGNATION', 'OTHER'] as const
export const MOVEMENT_STATUS = ['PENDING', 'APPROVED', 'REJECTED', 'EFFECTIVE', 'CANCELLED'] as const
export const SEPARATION_TYPES = ['RETIREMENT', 'RESIGNATION', 'TERMINATION', 'TRANSFER_OUT', 'DEATH', 'OTHER'] as const
export const ACTIVITY_TYPES = ['SOCIAL', 'ORGANIZATIONAL', 'PROFESSIONAL', 'COMMUNITY', 'OTHER'] as const
export const SKILL_CATEGORIES = ['TECHNICAL', 'PROFESSIONAL', 'SOFT'] as const
export const DISCIPLINARY_CASE_TYPES = ['WARNING', 'SUSPENSION', 'ADMIN_ACTION', 'INVESTIGATION', 'OTHER'] as const
export const DISCIPLINARY_STATUS = ['OPEN', 'UNDER_REVIEW', 'DECIDED', 'CLOSED'] as const
export const FOREIGN_TRAVEL_PURPOSES = ['OFFICIAL', 'TRAINING', 'CONFERENCE', 'ASSIGNMENT', 'SECONDMENT', 'OTHER'] as const
export const DOC_CATEGORIES = ['ID', 'NRC', 'EDUCATION', 'EMPLOYMENT', 'TRAINING', 'AWARD', 'MEDICAL', 'LEGAL', 'DISCIPLINARY', 'PROMOTION', 'TRANSFER', 'OTHER'] as const
export const DOC_ACCESS = ['INTERNAL', 'RESTRICTED', 'CONFIDENTIAL'] as const
export const AUDIT_ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'VIEW', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'EXPORT', 'DOWNLOAD'] as const

export const LOCALES = ['en', 'mm'] as const
export type Locale = (typeof LOCALES)[number]
