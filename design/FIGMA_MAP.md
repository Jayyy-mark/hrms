# Figma → MOGE HR Design Mapping

**Figma file:** [HR Dashboard – HR Management Dashboard UI Kit (Community)](https://www.figma.com/design/SSy4BWiN9z73g8Q2dzWzti/HRDashboard---HR-Management-Dashboard-UI-Kit--Community-)
**File key:** `SSy4BWiN9z73g8Q2dzWzti`
**Reference frames rendered to:** `design/exports/` (via Figma REST API)

## Precedence rules applied

| Aspect | Source of truth |
|---|---|
| Layout, composition, hierarchy, widget grids, table column ordering | **Figma frames** |
| Colors, theme, typography, glass styling | **Written spec (white-gold glassmorphism + dark theme)** — the kit's blue/green palette was NOT copied |
| Neutral radii, spacing rhythm, elevation patterns | Borrowed from Figma |
| Dark variants | Derived from written §4 dark rules over Figma light-mode layouts |

The kit's screens map to a **single-page app** (environment renders only `/`); "routes" below are in-app views (Zustand-driven navigation).

## Screen → view mapping

| Figma frame (node id) | Rendered reference | MOGE HR view | Notes |
|---|---|---|---|
| Home - Dashboard (`4003:208733`, light · `4003:290259`, dark) | `dashboard-light.png` / `dashboard-dark.png` | `dashboard` | Stat-card row → charts (donut + bar + horizontal bar) → status breakdown → recent staff + activity feed |
| 19. Employee (`4003:205092`) | `employee-list.png` | `staff` | Title + subtitle header, Download/Add New buttons, filter bar (search + 3 selects), table (employee avatar+name+email, position, department, rank, join date, status chip, row actions), pagination; mobile → stacked cards |
| 21. Employee - New Profile (`4003:203490`) | `employee-new-profile.png` | `staff` → "Add New" modal | Slide-over style modal, grouped 2-col form, Cancel/Create footer |
| 23. Employee - Detail - General (`4003:201785`) | `employee-detail-general.png` | `staff-detail` | Left profile column (avatar, name, status, org links, actions) + right tabbed content cards with label:value grids |
| 25. Employee - Detail - Job (`4003:201041`) | `employee-detail-job.png` | `staff-detail` → Career tab | Position/rank history + service timeline |
| 1. Sign in - Empty (`4003:234843`) | `signin.png` | `login` | Split screen: left branding hero (logo + tagline + background from settings), right glass form (email, password, remember me, CTA, demo accounts) |
| 30. Employee - Directory (`4003:199204`) | `employee-directory.png` | `departments` | Tree view card + flat master table |
| 97. Reports (`4003:167905`) | `reports.png` | `reports` | Report selector chips + preview table + CSV/print actions |
| 114. Settings - Permission - Admin (`4003:160026`) | `settings-permission-admin.png` | `admin-users` | User table (name/email, role, linked staff, active, last login, row actions) |
| 124. Settings - Change Password (`4003:156225`, light) | — | `profile` (password tab) | Current/new/confirm password card |
| 107. Settings - Company Info (`4003:162591`, light) | — | `admin-settings` | Settings form + live preview panel |

## Kit screens intentionally NOT mapped

Frames without a counterpart module in the spec were **not** implemented (per §3.3 rules): Messages, Help Center, Recruitment, Payroll, Time Off/Attendance, Onboarding/Checklist, News, Subscription/Integration settings. The kit's employee "General/Job/Payroll/Documents/Account Setting" tab structure was expanded into the 17 spec-defined tabs.

## Spec pages with no Figma frame

Audit logs, criminal records, foreign travels, and all other module list pages reuse the shared `PageHeader + FilterBar + DataTable + FormModal` pattern, styled with the same gold-glass tokens so they blend with Figma-derived screens.
