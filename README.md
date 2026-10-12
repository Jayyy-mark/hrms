# MOGE HR — Human Resources Management System

A full-stack, production-ready HR Management System with **white-gold glassmorphism** UI, bilingual **English / Myanmar** interface, role-based access control (USER / ADMIN / SUPERADMIN), and complete audit logging.

> ⚠️ Environment note: this build runs on **Next.js 16 (App Router) + TypeScript + Prisma/SQLite** (sandbox constraint — PostgreSQL schemas in the original spec were adapted to SQLite: enums → string columns validated by Zod, JSON payloads → JSON-serialized strings). The app is a single-route SPA (`/`) with Zustand-driven view navigation and REST APIs under `/api/*`.

## Quick start

```bash
bun install              # install dependencies
bun run db:push          # create SQLite schema (db/custom.db)
bun run db:seed          # seed roles, users, org, 25 staff + all sub-records
bun run dev              # start dev server on http://localhost:3000
```

## Seeded demo accounts

| Role | Email | Password | Lands on |
|---|---|---|---|
| SUPERADMIN | `superadmin@moge.hr` | `Super@123` | Full dashboard, users, audit logs, site settings, criminal record management, hard delete |
| ADMIN | `admin@moge.hr` | `Admin@123` | Full HR operations (all staff CRUD + modules + reports), soft delete only |
| USER | `user@moge.hr` | `User@123` | Own read-only staff record (MOGE-0001 "Aung Myint"), own profile |

## Role permission matrix (enforced server-side on every API)

| Capability | USER | ADMIN | SUPERADMIN |
|---|---|---|---|
| View/edit own account profile | ✅ | ✅ | ✅ |
| View own staff record (read-only) | ✅ | ✅ | ✅ |
| View all staff & HR modules | ❌ | ✅ | ✅ |
| Create/edit staff & sub-modules | ❌ | ✅ | ✅ |
| Delete (soft) | ❌ | ✅ | ✅ |
| Delete (hard) | ❌ | ❌ | ✅ |
| View criminal records | ❌ | ✅ | ✅ |
| Create/edit criminal records | ❌ | ❌ | ✅ |
| View audit logs | ❌ | ❌ | ✅ |
| Manage users & roles | ❌ | ❌ | ✅ |
| System settings | ❌ | ❌ | ✅ |
| Dashboard / reports | personal only | full | full |

## Features

- **Staff master record architecture** — Staff is the central identity; ALL HR info (addresses, family, education, languages, skills, contacts, references, ranks, positions, service history, promotions, transfers, separations, trainings, awards, military, activities, hobbies, political, conflict assignments, disciplinary, criminal, foreign travels, documents) lives in related tables keyed by `staffId`.
- **17-tab staff detail page** (Overview → History) with inline create/edit modals per module.
- **Movement automation** — approving a Promotion appends service history + updates current rank; approving a Transfer appends service history + updates current position/department; creating a Separation updates staff status and closes assignments.
- **Master data protection** — deleting departments/positions/ranks referenced by staff records is blocked with a clear error.
- **Audit logging** — every CREATE/UPDATE/DELETE/VIEW(sensitive)/LOGIN/LOGIN_FAILED/LOGOUT/EXPORT writes a field-level diff (before/after + changedFields) with IP + user agent. SUPERADMIN audit-log browser with filters, detail drawer, CSV export. Per-staff History tab.
- **i18n** — full English + Myanmar (Padauk font for `mm`, Poppins for `en`), locale switcher in topbar, per-user persisted.
- **White-gold glassmorphism** — light ivory + gold aurora / dark #0B0E14 themes, glass cards, gold CTA gradient, skeletons everywhere, reduced-motion support.
- **Dashboard & 12 reports** — stat cards, gender pie, department/rank/age charts, recent activity feed; reports with CSV export + print stylesheet.
- **Global search** — ⌘K / Ctrl+K glass command palette (staff by name/No/NRC/phone, departments, positions, ranks, trainings, awards — role-filtered).
- **Site settings (SUPERADMIN)** — site name/tagline/footer (EN+MM), logo variants (full/small/mobile), favicon, login background with live preview; branding read by login page, sidebar, topbar, footer, document title. No hardcoded "MOGE" in UI.
- **Security** — bcrypt(12) + JWT httpOnly sessions (jose), login rate-limit 5/min/IP, Zod validation on every mutation, API-level permission re-checks.
- **Responsive** — verified at 360/768/1024/1280/1440/1920px: ≥lg sidebar (collapsible), md icon rail, <md glass drawer + stacked table cards, full-screen-friendly modals, 44px touch targets.

## Project structure

```
prisma/schema.prisma        # 40 models, SQLite-adapted, soft deletes, indexes
prisma/seed.ts              # demo dataset (25 staff + all modules + audit trail)
src/lib/                    # auth (JWT+bcrypt), permissions, audit, resources registry, settings cache
src/app/api/                # REST endpoints (envelope { success, data, meta })
src/app/page.tsx            # SPA entry
src/components/hr/          # shell (sidebar/topbar/palette), dashboard, staff list/detail, module pages, admin, profile
src/i18n/                   # en.json / mm.json (~635 keys, strict parity)
design/exports/             # Figma reference frames (PNG)
design/FIGMA_MAP.md         # frame → view mapping + precedence rules
docs/screenshots/           # verification screenshots
```

## Scripts

| Script | Purpose |
|---|---|
| `bun run dev` | Dev server (port 3000) |
| `bun run lint` | ESLint |
| `bun run db:push` | Push schema to SQLite |
| `bun run db:seed` | Seed demo data |
| `bun run db:reset` | Reset + re-seed via migrations |

## Environment variables (see `.env.example`)

- `DATABASE_URL` — SQLite file URL
- `SESSION_SECRET` — JWT signing secret (set a strong value in production)
- `FIGMA_API_TOKEN` — optional, used to render `design/exports/` references

## API conventions

Envelope: `{ success: true, data, meta?: { page, pageSize, total } }` / `{ success: false, error: { code, message, issues? } }`.
Standard query params: `page`, `pageSize`, `search`, `sortBy`, `sortDir`, `staffId` + module filters.
Generic resource engine: `/api/resources/[type]` + `/api/resources/[type]/[id]` serves all 27 HR sub-modules with Zod validation, permission checks and audit logging.
