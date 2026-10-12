import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { ok, errors, zodFail, requirePerm, logAudit } from '@/lib/api'
import { PERMISSIONS } from '@/lib/permissions'
import { getSettings, invalidateSettingsCache } from '@/lib/settings'

export async function GET(req: NextRequest) {
  const auth = await requirePerm(req, PERMISSIONS.SETTINGS_MANAGE)
  if ('response' in auth) return auth.response
  const settings = await getSettings(true)
  return ok(settings)
}

const settingsSchema = z.object({
  siteNameEn: z.string().trim().min(1).optional(),
  siteNameMm: z.string().trim().min(1).optional(),
  taglineEn: z.string().trim().max(300).nullable().optional(),
  taglineMm: z.string().trim().max(300).nullable().optional(),
  logoFullUrl: z.string().trim().nullable().optional(),
  logoSmallUrl: z.string().trim().nullable().optional(),
  logoMobileUrl: z.string().trim().nullable().optional(),
  faviconUrl: z.string().trim().nullable().optional(),
  loginBackgroundUrl: z.string().trim().nullable().optional(),
  footerTextEn: z.string().trim().max(500).nullable().optional(),
  footerTextMm: z.string().trim().max(500).nullable().optional(),
})

export async function PUT(req: NextRequest) {
  const auth = await requirePerm(req, PERMISSIONS.SETTINGS_MANAGE)
  if ('response' in auth) return auth.response
  const { session } = auth

  const body = await req.json().catch(() => null)
  const parsed = settingsSchema.safeParse(body)
  if (!parsed.success) return zodFail(parsed.error)

  const before = await getSettings(true)
  const data = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined))

  await db.systemSetting.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', ...data },
    update: data,
  })
  invalidateSettingsCache()
  const after = await getSettings(true)

  await logAudit({
    user: session, action: 'UPDATE', module: 'admin.settings', entityType: 'SystemSetting', entityId: 'singleton',
    before: before as unknown as Record<string, unknown>, after: after as unknown as Record<string, unknown>, request: req,
  })
  return ok(after)
}
