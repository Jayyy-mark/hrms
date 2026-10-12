import { NextRequest } from 'next/server'
import { ok } from '@/lib/api'
import { getSettings } from '@/lib/settings'

/** Public (unauthenticated) site branding — used by the login screen. */
export async function GET(_req: NextRequest) {
  const s = await getSettings()
  return ok({
    siteNameEn: s.siteNameEn, siteNameMm: s.siteNameMm,
    taglineEn: s.taglineEn, taglineMm: s.taglineMm,
    logoFullUrl: s.logoFullUrl, logoMobileUrl: s.logoMobileUrl, logoSmallUrl: s.logoSmallUrl,
    faviconUrl: s.faviconUrl, loginBackgroundUrl: s.loginBackgroundUrl,
    footerTextEn: s.footerTextEn, footerTextMm: s.footerTextMm,
  })
}
