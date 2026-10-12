'use client'

import { create } from 'zustand'

export interface SessionUser {
  userId: string
  email: string
  name: string
  role: 'USER' | 'ADMIN' | 'SUPERADMIN' | string
  staffId: string | null
  avatarUrl?: string | null
  preferredLocale?: string
  theme?: string
}

export type ViewName =
  | 'dashboard' | 'staff' | 'staff-detail' | 'staff-new' | 'my-record' | 'my-record-detail'
  | 'departments' | 'positions' | 'ranks' | 'service-history' | 'promotions' | 'transfers' | 'separations'
  | 'trainings' | 'awards' | 'military' | 'activities' | 'conflict-areas' | 'disciplinary' | 'criminal-records'
  | 'foreign-travels' | 'documents' | 'reports'
  | 'admin-users' | 'admin-audit' | 'admin-settings'
  | 'profile'

interface UIState {
  session: SessionUser | null
  sessionLoading: boolean
  setSession: (s: SessionUser | null) => void
  setSessionLoading: (b: boolean) => void

  view: ViewName
  viewParams: Record<string, string>
  navigate: (view: ViewName, params?: Record<string, string>) => void

  sidebarOpen: boolean
  setSidebarOpen: (b: boolean) => void
  sidebarCollapsed: boolean
  toggleSidebarCollapsed: () => void

  commandOpen: boolean
  setCommandOpen: (b: boolean) => void
}

export const useUI = create<UIState>((set) => ({
  session: null,
  sessionLoading: true,
  setSession: (s) => set({ session: s }),
  setSessionLoading: (b) => set({ sessionLoading: b }),

  view: 'dashboard',
  viewParams: {},
  navigate: (view, params = {}) => set({ view, viewParams: params, sidebarOpen: false }),

  sidebarOpen: false,
  setSidebarOpen: (b) => set({ sidebarOpen: b }),
  sidebarCollapsed: false,
  toggleSidebarCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  commandOpen: false,
  setCommandOpen: (b) => set({ commandOpen: b }),
}))
