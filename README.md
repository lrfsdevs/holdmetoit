# HoldMeToIt ⚡

> **Gamified Study Accountability & Challenge Management Platform**  
> Replacing manual Discord spreadsheets, YPT screenshot tracking, and host burnout with an automated challenge engine.

---

## 🎯 Overview & Mission

Study challenges in Discord communities (running weekly team accountability duels, productivity sprints, and study seasons) suffer from severe **Admin Burnout**. Community moderators spend 5–10 hours every week manually building complex spreadsheets, copy-pasting YPT daily timestamps across 20+ columns, calculating team hour differences, verifying individual to-do goals, and enforcing server Punishment PFPs.

**HoldMeToIt** automates the entire lifecycle of Discord study battles:

- **Instant Challenge Setup:** Hosts configure battle cycles (e.g. Tuesday–Monday), team rosters, and punishment rules in minutes.
- **Declared Individual Targets & Weekly Goals:** Each participant declares their own weekly study-hour target (e.g. 20h, 35h, 50h, 70h) and mandatory weekly goals in the pre-kickoff phase.
- **Clock-Time Self-Logging (`HH:MM:SS`):** Instant daily logging matching Yeolpumta (YPT) clock displays down to the second with a 24-hour daily safety limit.
- **The Catch-Up Deficit Engine:** Zero grace days. Missed hours dynamically roll over into remaining challenge days with real-time pace guidance.
- **Team vs Team Match Scoreboard:** Live head-to-head banner (e.g., _Bees vs Butterflies_), lead delta (`+Xh Ym Zs ahead`), and unified standings table.
- **Dual-Failure Accountability & Punishment PFP:** Automatic flagging if hours or goals fail, paired with a direct 1-click **Download Punishment PFP** button.
- **Discord Integration:** Frictionless Discord OAuth login with public read-only spectator mode and a 1-click formatted markdown summary copy generator for hosts.

---

## 🛠️ Ratified Technology Stack

The technology stack is locked to guarantee high velocity, zero CORS overhead, and strict end-to-end type safety:

| Layer / Role         | Ratified Technology             | Architectural Purpose                                                     |
| :------------------- | :------------------------------ | :------------------------------------------------------------------------ |
| **Framework**        | Next.js 14 (App Router)         | Unified fullstack SSR/Client architecture, zero CORS, edge-ready          |
| **Language**         | TypeScript 5.x (`strict: true`) | End-to-end type safety across DB, API, and UI                             |
| **Styling & Theme**  | Tailwind CSS + shadcn/ui        | Obsidian dark theme (`DESIGN.md`), responsive down to 360px               |
| **Database Engine**  | PostgreSQL (Supabase / Neon)    | Relational integrity for challenges, teams, and daily logs                |
| **Object Storage**   | Supabase Storage                | Server-only uploads of event banners & punishment PFPs                    |
| **ORM & Migrations** | Prisma ORM 6.x                  | Declarative schemas, type-safe queries, migration control                 |
| **Authentication**   | Auth.js (NextAuth.js v5 beta)   | Discord OAuth 2.0 (`identify` scope), guild-role RBAC, spectator fallback |
| **Offline Storage**  | Browser IndexedDB               | Offline-first to-do tasks with background sync (`/api/tasks/sync`)        |
| **Observability**    | LogRocket                       | Session replay, error boundaries, feedback correlation                    |
| **Testing & Math**   | Vitest 3.x                      | Fast ESM runner for pure domain time math and deficit logic               |
| **Validation**       | Zod 4.x                         | Strict runtime payload validation at API boundaries                       |

---

## 📍 Project Status (2026-10-06)

- **Phase 0 (MVP Core):** ~65% feature parity. The core loop (login → enroll → log hours → live scoreboard → catch-up pace) works. Several host and accountability UIs still need rebuilding after the Obsidian redesign.
- **Quality gates:** typecheck ✅ · 559/559 tests ✅ · production build ✅
- See **[ROADMAP.md §0](ROADMAP.md)** for status vs timeline and **[HANDOFF.md](HANDOFF.md)** for the verified feature matrix, defect list, and exact next step.

---

## 📚 Core Documentation Suite (Sources of Truth)

The project maintains a lean, highly focused documentation and specification suite:

| Document                                                       | Primary Authority & Purpose                                                                                                                                            |
| :------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **[FEATURES.md](FEATURES.md)**                                 | Absolute source of truth for **product behavior, screen layouts, UX flows, and phase tags** (`[P0]` to `[V2]`).                                                        |
| **[DESIGN.md](DESIGN.md)**                                     | Absolute source of truth for **visual identity, Obsidian theme, color tokens, typography, and mobile responsive rules**.                                               |
| **[AGENTS.md](AGENTS.md)**                                     | Absolute source of truth for **agent protocol, locked stack, stack laws L1–L9, git safety, and quality matrix**.                                                       |
| **[ROADMAP.md](ROADMAP.md)**                                   | Product and technical evolution trajectory across phases (`[P0]` MVP $\rightarrow$ `[P1]` $\rightarrow$ `[V1]` $\rightarrow$ `[V2]`), plus current status vs timeline. |
| **[HANDOFF.md](HANDOFF.md)**                                   | Living operational relay, verified feature completion matrix, known defects, and next step between engineering sessions.                                               |
| **[README.md](README.md)**                                     | Developer onboarding, mission overview, locked stack matrix, and local dev setup.                                                                                      |
| **[prisma/migrations/README.md](prisma/migrations/README.md)** | Migration baseline procedure and known schema drift.                                                                                                                   |

---

## 🗂️ Repository Structure

```text
app/                     # Next.js App Router routes
├── page.tsx             # Home cockpit (/)
├── admin/               # Admin console + /admin/challenges/new wizard
├── challenge/[id]/      # Public challenge view (Overview, Leaderboard, Summary, Manage, Audit)
└── api/                 # auth, feedback, tasks/sync route handlers
core/                    # auth (Auth.js), db (Prisma client), storage (Supabase), observability (LogRocket)
features/<slice>/        # Vertical slices: domain/ · data/ · api/ · presentation/
│                        #   accountability, audit, auth, challenges, e2e, feedback,
│                        #   leaderboard, notifications, study-logs, tasks
components/              # shadcn/ui primitives + shared Loading/Empty/Error states
prisma/                  # schema.prisma, migrations/, seed.ts
```

---

## 👥 Engineering Roles & Responsibilities

| Role                 | Primary Layer Responsibilities                                                                                                                           |
| :------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Data & Identity**  | Database schema, Prisma migrations, Auth.js Discord OAuth, session hydration, and repositories.                                                          |
| **Scoring & Engine** | Pure domain math, `HH:MM:SS` duration converters, team score aggregations, catch-up deficit calculator, Vitest suite.                                    |
| **Participant UI**   | Home cockpit, `HH:MM:SS` Log Hours modal, Daily/Weekly task board, progress meters, mobile responsiveness (360px+).                                      |
| **Admin Operations** | Host wizard, Manage tab (teams, assignments, kickoff/lock), admin inline hours override, pardons, 1-click Discord summary generator, Punishment PFP hub. |

---

## 🚀 Getting Started

### 1. Prerequisites

- **Node.js 22+** (required by `@supabase/supabase-js` 2.117+)
- A [Supabase](https://supabase.com/) (or Neon) PostgreSQL database, plus a public Supabase Storage bucket
- A [Discord Developer Portal](https://discord.com/developers/applications) application (OAuth 2.0) and a bot token that's a member of your guild (used for role lookup and feedback embeds)

### 2. Environment Setup

```bash
git clone https://github.com/Afnanpathan2004/holdmetoit.git
cd holdmetoit
npm install            # also runs `prisma generate`
cp .env.example .env.local
```

| Variable                                                                      | Purpose                                                                 |
| :---------------------------------------------------------------------------- | :---------------------------------------------------------------------- |
| `DATABASE_URL`, `DIRECT_URL`                                                  | Pooled and direct Postgres connections                                  |
| `AUTH_SECRET`, `AUTH_URL`                                                     | Auth.js session secret and base URL                                     |
| `AUTH_DISCORD_ID`, `AUTH_DISCORD_SECRET`                                      | Discord OAuth app (`identify` scope)                                    |
| `DISCORD_GUILD_ID`, `DISCORD_BOT_TOKEN`                                       | Guild + bot used to read member roles                                   |
| `DISCORD_ADMIN_ROLE_IDS`                                                      | Comma-separated guild role IDs that map to `ADMIN`                      |
| `DEV_DISCORD_IDS`                                                             | JSON array of Discord snowflakes that map to `DEV` (full access)        |
| `DISCORD_FEEDBACK_CHANNEL_ID` / `_BUG_CHANNEL_ID` / `_SUGGESTIONS_CHANNEL_ID` | Feedback embed destinations (optional; falls back to a default channel) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`                                   | Server-only storage client (never prefix with `NEXT_PUBLIC_`)           |
| `SUPABASE_STORAGE_BUCKET`                                                     | Public bucket name                                                      |
| `SUPABASE_EVENT_BANNERS_FOLDER`, `SUPABASE_PUNISHMENT_PFPS_FOLDER`            | Separate directories for event headers and punishment PFPs              |

### 3. Database Setup and Local Development

Review [`prisma/migrations/README.md`](prisma/migrations/README.md) before applying migrations.

> [!WARNING]
> **Known schema drift:** the `feedbacks` table and the `sort_order` columns on `categories`/`tasks` were applied with `prisma db push` and have no migration files yet. On a fresh database, `prisma migrate deploy` alone produces an incomplete schema. Until catch-up migrations land (`HANDOFF.md` D5), run `npx prisma db push` on **fresh local dev databases only**.

```bash
npx prisma migrate deploy   # apply migration history
npm run dev                 # http://localhost:3000
```

Existing databases previously created with `db push` must be backed up and verified against the baseline before marking it applied (see the migration README). Don't run the baseline SQL against a populated database.

### 4. Ops Scripts (local database only)

Both scripts hard-abort unless `DATABASE_URL` points at a local host (`localhost` / `127.0.0.1`), are **dry-run by default**, and require `--apply` to write.

```bash
# Link every user's tasks to the October challenge (idempotent; --force relinks everything)
npm run db:link-tasks
npm run db:link-tasks -- --apply

# Roll back a mistaken "Lock Final Results" — resets statuses to NORMAL, deletes all
# punishment records, resets wrapped flags, and restores the pre-lock endAt
npm run db:unlock-results                                  # dry run (auto-picks the locked challenge)
npm run db:unlock-results -- --challenge-id <id> --apply
```

> The Manage tab also exposes the same rollback as a **10-second Undo** prompt right after locking.

### 5. Verification (run before every PR)

```bash
npm run typecheck   # tsc --noEmit (delete a stale .next/ folder if it references removed routes)
npm run test        # vitest run
npm run build       # next build
```
