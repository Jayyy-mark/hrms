import 'server-only'
import { db } from './db'

export interface SiteSettings {
  siteNameEn: string
  siteNameMm: string
  taglineEn: string | null
  taglineMm: string | null
  logoFullUrl: string | null
  logoSmallUrl: string | null
  logoMobileUrl: string | null
  faviconUrl: string | null
  loginBackgroundUrl: string | null
  footerTextEn: string | null
  footerTextMm: string | null
}

const DEFAULTS: SiteSettings = {
  siteNameEn: 'MOGE HR',
  siteNameMm: 'MOGE HR',
  taglineEn: 'Human Resources Management System',
  taglineMm: 'လူ့စွမ်းအားစီမံခန့်ခွဲမှုစနစ်',
  logoFullUrl: null,
  logoSmallUrl: null,
  logoMobileUrl: null,
  faviconUrl: null,
  loginBackgroundUrl: null,
  footerTextEn: null,
  footerTextMm: null,
}

let cache: { value: SiteSettings; expiresAt: number } | null = null
const TTL = 30_000 // 30s cache

export async function getSettings(force = false): Promise<SiteSettings> {
  if (!force && cache && Date.now() < cache.expiresAt) return cache.value
  try {
    const row = await db.systemSetting.findUnique({ where: { id: 'singleton' } })
    const value: SiteSettings = row
      ? {
          siteNameEn: row.siteNameEn || DEFAULTS.siteNameEn,
          siteNameMm: row.siteNameMm || DEFAULTS.siteNameMm,
          taglineEn: row.taglineEn ?? DEFAULTS.taglineEn,
          taglineMm: row.taglineMm ?? DEFAULTS.taglineMm,
          logoFullUrl: row.logoFullUrl ?? DEFAULTS.logoFullUrl,
          logoSmallUrl: row.logoSmallUrl ?? DEFAULTS.logoSmallUrl,
          logoMobileUrl: row.logoMobileUrl ?? DEFAULTS.logoMobileUrl,
          faviconUrl: row.faviconUrl ?? DEFAULTS.faviconUrl,
          loginBackgroundUrl: row.loginBackgroundUrl ?? DEFAULTS.loginBackgroundUrl,
          footerTextEn: row.footerTextEn ?? DEFAULTS.footerTextEn,
          footerTextMm: row.footerTextMm ?? DEFAULTS.footerTextMm,
        }
      : DEFAULTS
    cache = { value, expiresAt: Date.now() + TTL }
    return value
  } catch {
    return DEFAULTS
  }
}

export function invalidateSettingsCache() {
  cache = null
}
