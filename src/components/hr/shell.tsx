'use client'

import React, { useEffect, useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { AnimatePresence, motion } from 'framer-motion'
import { useI18n } from '@/i18n'
import { apiGet, apiPost } from '@/lib/client-api'
import { useUI, type ViewName } from '@/store/ui'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandDialog } from '@/components/ui/command'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { StaffAvatar, GlassCard } from './shared'
import { DashboardView } from './dashboard'
import { StaffListView, StaffFormModal } from './staff-list'
import { StaffDetailView } from './staff-detail'
import { ModuleListPage } from './module-list'
import { MasterDataPage } from './masters'
import { DocumentsView } from './documents'
import { ReportsView } from './reports'
import { UsersView, AuditLogsView, SettingsView } from './admin'
import { ProfileView } from './profile'
import {
  LayoutDashboard, Users, Building2, Briefcase, Award, GraduationCap, Shield, Scale, Globe2,
  FileText, BarChart3, UserCog, ScrollText, Settings2, User, ChevronLeft, ChevronRight,
  Menu, Search, Languages, Sun, Moon, Monitor, LogOut, KeyRound, BookOpen, Swords, MapPin,
  History, TrendingUp, ArrowLeftRight, DoorOpen, Wrench, Activity, X,
} from 'lucide-react'

interface NavItem {
  view: ViewName
  labelKey: string
  icon: React.ElementType
  permission?: 'staff' | 'admin' | 'superadmin'
  slug?: string
}

interface NavSection {
  labelKey: string
  items: NavItem[]
  permission?: 'admin' | 'superadmin'
}

const NAV_SECTIONS: NavSection[] = [
  {
    labelKey: 'nav.dashboard',
    items: [{ view: 'dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard, permission: 'staff' }],
  },
  {
    labelKey: 'nav.personnel',
    items: [
      { view: 'staff', labelKey: 'nav.staff', icon: Users, permission: 'staff' },
    ],
  },
  {
    labelKey: 'nav.employment',
    items: [
      { view: 'departments', labelKey: 'nav.departments', icon: Building2, permission: 'staff' },
      { view: 'positions', labelKey: 'nav.positions', icon: Briefcase, permission: 'staff' },
      { view: 'ranks', labelKey: 'nav.ranks', icon: Award, permission: 'staff' },
      { view: 'service-history', labelKey: 'nav.serviceHistory', icon: History, permission: 'staff', slug: 'service-history' },
      { view: 'promotions', labelKey: 'nav.promotions', icon: TrendingUp, permission: 'staff', slug: 'promotions' },
      { view: 'transfers', labelKey: 'nav.transfers', icon: ArrowLeftRight, permission: 'staff', slug: 'transfers' },
      { view: 'separations', labelKey: 'nav.separations', icon: DoorOpen, permission: 'staff', slug: 'separations' },
    ],
  },
  {
    labelKey: 'nav.development',
    items: [
      { view: 'trainings', labelKey: 'nav.trainings', icon: GraduationCap, permission: 'staff', slug: 'trainings' },
      { view: 'awards', labelKey: 'nav.awards', icon: Award, permission: 'staff', slug: 'awards' },
    ],
  },
  {
    labelKey: 'nav.background',
    items: [
      { view: 'military', labelKey: 'nav.military', icon: Shield, permission: 'staff', slug: 'military' },
      { view: 'activities', labelKey: 'nav.activities', icon: Activity, permission: 'staff', slug: 'activities' },
      { view: 'conflict-areas', labelKey: 'nav.conflictAreas', icon: Swords, permission: 'admin' },
      { view: 'disciplinary', labelKey: 'nav.disciplinary', icon: Scale, permission: 'staff', slug: 'disciplinary' },
      { view: 'criminal-records', labelKey: 'nav.criminal', icon: FileText, permission: 'admin' },
    ],
  },
  {
    labelKey: 'nav.foreignAffairs',
    items: [{ view: 'foreign-travels', labelKey: 'nav.foreignTravels', icon: Globe2, permission: 'staff', slug: 'foreign-travels' }],
  },
  {
    labelKey: 'nav.documents',
    items: [{ view: 'documents', labelKey: 'nav.documents', icon: FileText, permission: 'staff' }],
  },
  {
    labelKey: 'nav.reports',
    items: [{ view: 'reports', labelKey: 'nav.reports', icon: BarChart3, permission: 'admin' }],
  },
  {
    labelKey: 'nav.administration',
    permission: 'superadmin',
    items: [
      { view: 'admin-users', labelKey: 'nav.users', icon: UserCog },
      { view: 'admin-audit', labelKey: 'nav.auditLogs', icon: ScrollText },
      { view: 'admin-settings', labelKey: 'nav.siteSettings', icon: Settings2 },
    ],
  },
]

function GoldLogo({ size = 36 }: { size?: number }) {
  return (
    <div className="relative flex items-center justify-center rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#F1D98B] shadow-md shadow-[#C9A227]/25"
      style={{ height: size, width: size }}>
      <svg viewBox="0 0 24 24" fill="none" className="h-1/2 w-1/2 text-[#221A00]">
        <path d="M12 2L14.5 8.5L21 11L14.5 13.5L12 20L9.5 13.5L3 11L9.5 8.5L12 2Z" fill="currentColor" />
        <circle cx="19" cy="5" r="1.6" fill="currentColor" opacity="0.7" />
      </svg>
    </div>
  )
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useI18n()
  const { session, view, viewParams, navigate, sidebarCollapsed } = useUI()
  const { data: settings } = useQuery({ queryKey: ['public-settings-2'], queryFn: () => apiGet<{ logoFullUrl: string | null; logoSmallUrl: string | null; siteNameEn: string }>('/api/public/settings') })
  const isSuperadmin = session?.role === 'SUPERADMIN'
  const isAdmin = isSuperadmin || session?.role === 'ADMIN'
  const collapsed = sidebarCollapsed

  const siteName = settings?.siteNameEn || 'MOGE HR'

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-4 ${collapsed ? 'justify-center' : ''}`}>
        {collapsed ? (
          settings?.logoSmallUrl ? <img src={settings.logoSmallUrl} alt={siteName} className="h-9 w-9 rounded-xl object-contain" /> : <GoldLogo size={36} />
        ) : settings?.logoFullUrl ? (
          <img src={settings.logoFullUrl} alt={siteName} className="h-9 w-auto max-w-40 object-contain" />
        ) : (
          <>
            <GoldLogo size={36} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">{siteName}</p>
              <p className="truncate text-[10px] text-muted-foreground">HR Management</p>
            </div>
          </>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-2 pb-4" aria-label="Main navigation">
        {NAV_SECTIONS.map((section, si) => {
          if (section.permission === 'superadmin' && !isSuperadmin) return null
          if (section.permission === 'admin' && !isAdmin) return null
          const items = section.items.filter((item) => {
            if (item.permission === 'staff') return isAdmin
            if (item.permission === 'admin') return isAdmin
            if (item.permission === 'superadmin') return isSuperadmin
            return true
          })
          if (items.length === 0) return null
          return (
            <div key={si} className="pb-1">
              {!collapsed && section.items.length > 0 && si > 0 && (
                <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">{t(section.labelKey)}</p>
              )}
              {si === 0 && !collapsed ? null : null}
              {items.map((item) => {
                const isActive = view === item.view
                return (
                  <button
                    key={item.view}
                    type="button"
                    onClick={() => { navigate(item.view); onNavigate?.() }}
                    title={collapsed ? t(item.labelKey) : undefined}
                    aria-current={isActive ? 'page' : undefined}
                    className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all min-h-[44px] ${
                      isActive
                        ? 'bg-primary/12 font-medium text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    } ${collapsed ? 'justify-center' : ''}`}
                  >
                    {isActive && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-primary" />}
                    <item.icon className={`h-4.5 w-4.5 h-[18px] w-[18px] shrink-0 ${isActive ? 'text-primary' : ''}`} />
                    {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
                  </button>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* My record for USER */}
      {!collapsed && session?.staffId && !isAdmin && (
        <div className="px-2 pb-2">
          <button
            type="button"
            onClick={() => { navigate('my-record-detail', { id: session.staffId! }); onNavigate?.() }}
            className="flex w-full items-center gap-3 rounded-xl bg-secondary/60 px-3 py-2.5 text-sm text-secondary-foreground transition-colors hover:bg-secondary min-h-[44px]"
          >
            <BookOpen className="h-[18px] w-[18px] text-primary" />
            <span className="truncate">{t('common.myRecord')}</span>
          </button>
        </div>
      )}
    </div>
  )
}

const emptySubscribe = () => () => {}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const { t } = useI18n()
  const mounted = React.useSyncExternalStore(emptySubscribe, () => true, () => false)
  if (!mounted) return <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={t('common.theme')}><Sun className="h-4 w-4" /></Button>
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={t('common.theme')}>
          {theme === 'dark' ? <Moon className="h-4 w-4" /> : theme === 'light' ? <Sun className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="glass w-40">
        <DropdownMenuItem onClick={() => setTheme('light')}><Sun className="h-4 w-4 mr-2" />{t('common.light')}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}><Moon className="h-4 w-4 mr-2" />{t('common.dark')}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}><Monitor className="h-4 w-4 mr-2" />{t('common.system')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function LocaleSwitcher() {
  const { locale, setLocale, t } = useI18n()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={t('common.language')}>
          <Languages className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="glass w-36">
        <DropdownMenuItem onClick={() => setLocale('en')} className={locale === 'en' ? 'text-primary' : ''}>English</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLocale('mm')} className={locale === 'mm' ? 'text-primary' : ''}>မြန်မာ</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface SearchGroup { group: string; items: { id: string; title: string; subtitle?: string; view: string }[] }

function CommandPalette() {
  const { t } = useI18n()
  const { commandOpen, setCommandOpen, navigate } = useUI()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchGroup[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandOpen(!useUI.getState().commandOpen)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setCommandOpen])

  useEffect(() => {
    if (!commandOpen) { setQuery(''); setResults([]) }
  }, [commandOpen])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const timeout = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await apiGet<{ groups: SearchGroup[] }>(`/api/search?q=${encodeURIComponent(query)}`)
        setResults(data.groups || [])
      } catch { setResults([]) }
      finally { setLoading(false) }
    }, 250)
    return () => clearTimeout(timeout)
  }, [query])

  const groupLabels: Record<string, string> = {
    staff: t('search.groups.staff'), departments: t('search.groups.departments'),
    positions: t('search.groups.positions'), ranks: t('search.groups.ranks'),
    trainings: t('search.groups.trainings'), awards: t('search.groups.awards'),
  }

  return (
    <CommandDialog open={commandOpen} onOpenChange={setCommandOpen} className="glass">
      <DialogTitle className="sr-only">{t('search.placeholder')}</DialogTitle>
      <Command shouldFilter={false}>
        <CommandInput placeholder={t('search.placeholder')} value={query} onValueChange={setQuery} />
        <CommandList className="max-h-80">
          {loading && <p className="py-6 text-center text-sm text-muted-foreground">{t('common.loading')}</p>}
          {!loading && query && results.length === 0 && (
            <CommandEmpty>{t('search.noResults')} — {t('search.noResultsHint')}</CommandEmpty>
          )}
          {!query && (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">{t('search.navigateHint')}</div>
          )}
          {results.map((g) => (
            <CommandGroup key={g.group} heading={groupLabels[g.group] || g.group}>
              {g.items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${g.group}:${item.id}`}
                  onSelect={() => {
                    if (g.group === 'staff') navigate('staff-detail', { id: item.id })
                    else if (g.group === 'departments') navigate('departments')
                    else if (g.group === 'positions') navigate('positions')
                    else if (g.group === 'ranks') navigate('ranks')
                    else if (g.group === 'trainings') navigate('trainings')
                    else if (g.group === 'awards') navigate('awards')
                    setCommandOpen(false)
                  }}
                >
                  <Search className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{item.title}</span>
                  {item.subtitle && <span className="ml-auto truncate text-xs text-muted-foreground">{item.subtitle}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}

function Topbar() {
  const { t } = useI18n()
  const { session, setSidebarOpen, navigate, setSession, setSessionLoading } = useUI()
  const { data: settings } = useQuery({ queryKey: ['public-settings-2'], queryFn: () => apiGet<{ logoMobileUrl: string | null; siteNameEn: string }>('/api/public/settings') })
  const isAdmin = session?.role === 'ADMIN' || session?.role === 'SUPERADMIN'

  const logout = async () => {
    try { await apiPost('/api/auth/logout') } catch { /* ignore */ }
    setSession(null)
    setSessionLoading(false)
    useUI.getState().navigate('dashboard')
    toastLogout()
  }
  const toastLogout = () => { import('sonner').then(({ toast }) => toast.success(t('auth.signOutSuccess'))) }

  return (
    <header className="glass sticky top-0 z-30 flex h-16 items-center gap-2 border-x-0 border-t-0 px-3 sm:px-4">
      <Button variant="ghost" size="icon" className="h-9 w-9 lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </Button>
      <div className="flex items-center gap-2 lg:hidden">
        {settings?.logoMobileUrl ? (
          <img src={settings.logoMobileUrl} alt={settings.siteNameEn} className="h-8 w-auto" />
        ) : (
          <span className="text-sm font-semibold text-gold-gradient">{settings?.siteNameEn || 'MOGE HR'}</span>
        )}
      </div>

      <button
        type="button"
        onClick={() => useUI.getState().setCommandOpen(true)}
        className="ml-1 hidden h-9 flex-1 max-w-md items-center gap-2 rounded-xl border border-border/60 bg-background/50 px-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground md:flex"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">{t('search.placeholder')}</span>
        <kbd className="rounded border border-border/60 bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{t('search.commandHint')}</kbd>
      </button>
      <Button variant="ghost" size="icon" className="h-9 w-9 md:hidden" onClick={() => useUI.getState().setCommandOpen(true)} aria-label={t('common.search')}>
        <Search className="h-4 w-4" />
      </Button>

      <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
        <LocaleSwitcher />
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="ml-1 flex items-center gap-2 rounded-full border-2 border-primary/25 p-0.5 transition-colors hover:border-primary/60" aria-label={t('common.profile')}>
              <StaffAvatar name={session?.name} photoUrl={session?.avatarUrl} size="sm" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="glass w-56">
            <div className="px-3 py-2">
              <p className="truncate text-sm font-medium">{session?.name}</p>
              <p className="truncate text-xs text-muted-foreground">{session?.email}</p>
              <p className="mt-1 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{t(`enums.${session?.role}`)}</p>
            </div>
            <DropdownMenuItem onClick={() => navigate('profile')}><User className="mr-2 h-4 w-4" />{t('common.profile')}</DropdownMenuItem>
            {session?.staffId && (
              <DropdownMenuItem onClick={() => navigate('my-record-detail', { id: session.staffId! })}>
                <BookOpen className="mr-2 h-4 w-4" />{t('common.myRecord')}
              </DropdownMenuItem>
            )}
            {isAdmin && null}
            <DropdownMenuItem onClick={() => navigate('profile', { tab: 'password' })}><KeyRound className="mr-2 h-4 w-4" />{t('common.changePassword')}</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" />{t('common.logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

// ============ View router ============

function ViewRouter() {
  const { view, viewParams, navigate, session } = useUI()
  const isAdmin = session?.role === 'ADMIN' || session?.role === 'SUPERADMIN'

  switch (view) {
    case 'dashboard':
      // USER role: personal landing = own staff record (read-only)
      if (!isAdmin) {
        if (session?.staffId) return <StaffDetailView id={session.staffId} readOnly />
        return <UserNoRecordView />
      }
      return <DashboardView />
    case 'staff': return <StaffListView />
    case 'staff-detail': return <StaffDetailView id={viewParams.id} />
    case 'my-record-detail': return <StaffDetailView id={viewParams.id} readOnly />
    case 'departments': return <MasterDataPage slug="departments" />
    case 'positions': return <MasterDataPage slug="positions" />
    case 'ranks': return <MasterDataPage slug="ranks" />
    case 'service-history': return <ModuleListPage slug="service-history" />
    case 'promotions': return <ModuleListPage slug="promotions" />
    case 'transfers': return <ModuleListPage slug="transfers" />
    case 'separations': return <ModuleListPage slug="separations" />
    case 'trainings': return <ModuleListPage slug="trainings" />
    case 'awards': return <ModuleListPage slug="awards" />
    case 'military': return <ModuleListPage slug="military" />
    case 'activities': return <ModuleListPage slug="activities" />
    case 'conflict-areas': return <MasterDataPage slug="conflict-areas" />
    case 'disciplinary': return <ModuleListPage slug="disciplinary" />
    case 'criminal-records': return <ModuleListPage slug="criminal" />
    case 'foreign-travels': return <ModuleListPage slug="foreign-travels" />
    case 'documents': return <DocumentsView />
    case 'reports': return isAdmin ? <ReportsView /> : null
    case 'admin-users': return session?.role === 'SUPERADMIN' ? <UsersView /> : null
    case 'admin-audit': return session?.role === 'SUPERADMIN' ? <AuditLogsView /> : null
    case 'admin-settings': return session?.role === 'SUPERADMIN' ? <SettingsView /> : null
    case 'profile': return <ProfileView />
    default: return <DashboardView />
  }
}

function UserNoRecordView() {
  const { t } = useI18n()
  const { navigate } = useUI()
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <GlassCard className="max-w-md p-8 text-center">
        <h2 className="text-lg font-semibold">{t('common.welcome')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t('common.personalOnly')}</p>
        <Button className="gold-cta mt-4" onClick={() => navigate('profile')}>
          <User className="mr-2 h-4 w-4" /> {t('common.profile')}
        </Button>
      </GlassCard>
    </div>
  )
}

// ============ App shell ============

export function AppShell() {
  const { t } = useI18n()
  const { sidebarOpen, setSidebarOpen, sidebarCollapsed, toggleSidebarCollapsed, view } = useUI()
  const { data: settings } = useQuery({ queryKey: ['public-settings-2'], queryFn: () => apiGet<{ footerTextEn: string | null; footerTextMm: string | null }>('/api/public/settings') })
  const { locale } = useI18n()
  const footerText = locale === 'mm' ? settings?.footerTextMm ?? settings?.footerTextEn : settings?.footerTextEn

  return (
    <div className="flex min-h-screen flex-col">
      <div className="aurora" />
      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <motion.aside
          animate={{ width: sidebarCollapsed ? 72 : 264 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="glass sticky top-0 hidden h-screen shrink-0 border-y-0 border-l-0 md:block"
          aria-label="Sidebar"
        >
          <SidebarContent />
          <div className="border-t border-border/40 p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-center text-muted-foreground"
              onClick={toggleSidebarCollapsed}
              aria-label="Toggle sidebar"
            >
              {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /><span className="text-xs">{t('common.close')}</span></>}
            </Button>
          </div>
        </motion.aside>

        {/* Mobile drawer */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="glass w-72 border-y-0 border-l-0 p-0">
            <SheetHeader className="sr-only"><SheetTitle>Menu</SheetTitle></SheetHeader>
            <SidebarContent onNavigate={() => setSidebarOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 px-3 py-4 sm:px-5 sm:py-6 lg:px-7" id="main-content">
            <AnimatePresence mode="wait">
              <motion.div
                key={view}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                <ViewRouter />
              </motion.div>
            </AnimatePresence>
          </main>
          <footer className="glass mt-auto border-x-0 border-b-0 py-3 text-center text-xs text-muted-foreground no-print">
            {footerText || `© ${new Date().getFullYear()} MOGE HR`}
          </footer>
        </div>
      </div>
      <CommandPalette />
    </div>
  )
}
