import 'server-only'
import { NextRequest } from 'next/server'
import { db } from './db'
import type { SessionUser } from './auth'

const SECRET_FIELDS = new Set(['passwordHash', 'password', 'newPassword', 'currentPassword', 'confirmPassword'])

/** Strip sensitive fields from a payload object before audit storage. */
function sanitize(obj: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!obj) return null
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (SECRET_FIELDS.has(k)) {
      out[k] = '[REDACTED]'
    } else {
      out[k] = v instanceof Date ? v.toISOString() : v
    }
  }
  return out
}

/** Compute a field-level diff between two states. */
export function diffFields(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): string[] {
  const changed: string[] = []
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})])
  for (const key of keys) {
    if (SECRET_FIELDS.has(key)) continue
    const b = before?.[key] == null ? null : String(before[key])
    const a = after?.[key] == null ? null : String(after[key])
    if (b !== a) changed.push(key)
  }
  return changed
}

export interface AuditInput {
  user?: SessionUser | null
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'LOGIN' | 'LOGIN_FAILED' | 'LOGOUT' | 'EXPORT' | 'DOWNLOAD'
  module: string
  entityType: string
  entityId?: string | null
  staffId?: string | null
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  request?: NextRequest | null
}

/** Central audit logging service — every mutation and sensitive view goes through this. */
export async function logAudit(input: AuditInput): Promise<void> {
  try {
    const before = sanitize(input.before)
    const after = sanitize(input.after)
    const changedFields = diffFields(before, after)
    const ip =
      input.request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      input.request?.headers.get('x-real-ip') ||
      'unknown'
    const userAgent = input.request?.headers.get('user-agent') || undefined
    await db.auditLog.create({
      data: {
        userId: input.user?.userId ?? null,
        userName: input.user?.name ?? input.user?.email ?? 'anonymous',
        staffId: input.staffId ?? null,
        action: input.action,
        module: input.module,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        before: before ? JSON.stringify(before) : null,
        after: after ? JSON.stringify(after) : null,
        changedFields: JSON.stringify(changedFields),
        ipAddress: ip,
        userAgent,
      },
    })
  } catch (err) {
    console.error('[audit] failed to write audit log:', err)
  }
}
