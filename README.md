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
- **Discord Integration:** Frictionless Discord OAuth login with public read-only spectator mode.

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

| Document                                                                         | Primary Authority & Purpose                                                                                                                                            |
| :------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **[FEATURES.md](FEATURES.md)**                                                   | Absolute source of truth for **product behavior, screen layouts, UX flows, and phase tags** (`[P0]` to `[V2]`).                                                        |
| **[DESIGN.md](DESIGN.md)**                                                       | Absolute source of truth for **visual identity, Obsidian theme, color tokens, typography, and mobile responsive rules**.                                               |
| **[AGENTS.md](AGENTS.md)**                                                       | Absolute source of truth for **agent protocol, locked stack, stack laws L1–L9, git safety, and quality matrix**.                                                       |
| **[ROADMAP.md](ROADMAP.md)**                                                     | Product and technical evolution trajectory across phases (`[P0]` MVP $\rightarrow$ `[P1]` $\rightarrow$ `[V1]` $\rightarrow$ `[V2]`), plus current status vs timeline. |
| **[HANDOFF.md](HANDOFF.md)**                                                     | Living operational relay, verified feature completion matrix, known defects, and next step between engineering sessions.                                               |
| **[README.md](README.md)**                                                       | Developer onboarding, mission overview, locked stack matrix, and local dev setup.                                                                                      |
| **[prisma/migrations/README.md](packages/database/prisma/migrations/README.md)** | Migration baseline procedure and known schema drift.                                                                                                                   |

---

## 🗂️ Repository Structure

```text
apps/
├── web/                   # Next.js app (app/, core/, features/, components/, lib/, types/)
├── tasker/                # Discord task/category bot (Node + tsx; src/, test/)
└── ypt-bot/               # YPT study-log ingestion bot (Node ESM; src/, test/)
packages/
├── database/              # Shared Prisma schema, migrations, seed, and client singleton
│   ├── prisma/            # schema.prisma + migrations/
│   └── src/index.ts       # @holdmetoit/database (built to dist/)
└── discord/               # Shared discord.js REST client + bot runtime
    └── src/               # @holdmetoit/discord (built to dist/; ./bot subpath)
docs/                      # Shared feature documentation (pokemon, economy, feature-flags, ypt-bot, tasker)
AGENTS.md · DESIGN.md · FEATURES.md · ROADMAP.md · HANDOFF.md · CHANGELOG.md
```

`apps/web` keeps the Feature-First slices (`features/<slice>/` → `domain/ · data/ · api/ · presentation/`). Both apps consume the single `@holdmetoit/database` client against the same PostgreSQL database.

### Discord integration packages

- `@holdmetoit/discord` — discord.js v14 REST helpers used by the web app (feedback embeds, avatar sync, guild-role lookup). Rate limiting, retries and 429 handling come from discord.js.
- `@holdmetoit/discord/bot` — gateway runtime for long-lived bots: client factory, command/event loaders, interaction + prefix dispatch, slash-command deployment, `/health`, and graceful shutdown.
- `apps/tasker` — the migrated Tasker bot; see [`docs/tasker/README.md`](docs/tasker/README.md).

---

## 👥 Engineering Roles & Responsibilities

| Role                 | Primary Layer Responsibilities                                                                                        |
| :------------------- | :-------------------------------------------------------------------------------------------------------------------- |
| **Data & Identity**  | Database schema, Prisma migrations, Auth.js Discord OAuth, session hydration, and repositories.                       |
| **Scoring & Engine** | Pure domain math, `HH:MM:SS` duration converters, team score aggregations, catch-up deficit calculator, Vitest suite. |
| **Participant UI**   | Home cockpit, `HH:MM:SS` Log Hours modal, Daily/Weekly task board, progress meters, mobile responsiveness (360px+).   |
| **Admin Operations** | Host wizard, Manage tab (teams, assignments, kickoff/lock), admin inline hours override, pardons, Punishment PFP hub. |

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
npm install            # workspaces + prisma generate + builds @holdmetoit/database
cp apps/web/.env.example apps/web/.env
# The bots read the repo-root .env (apps/tasker/.env.example documents its variables)
```

| Variable                                                                      | Purpose                                                                    |
| :---------------------------------------------------------------------------- | :------------------------------------------------------------------------- |
| `DATABASE_URL`, `DIRECT_URL`                                                  | Pooled and direct Postgres connections                                     |
| `AUTH_SECRET`, `AUTH_URL`                                                     | Auth.js session secret and base URL                                        |
| `AUTH_DISCORD_ID`, `AUTH_DISCORD_SECRET`                                      | Discord OAuth app (`identify` scope)                                       |
| `DISCORD_GUILD_ID`, `DISCORD_BOT_TOKEN`                                       | Guild + bot used to read member roles                                      |
| `DISCORD_ADMIN_ROLE_IDS`                                                      | Comma-separated guild role IDs that map to `ADMIN`                         |
| `DEV_DISCORD_IDS`                                                             | JSON array of Discord snowflakes that map to `DEV` (full access)           |
| `DISCORD_FEEDBACK_CHANNEL_ID` / `_BUG_CHANNEL_ID` / `_SUGGESTIONS_CHANNEL_ID` | Feedback embed destinations (optional; falls back to a default channel)    |
| `GITHUB_TOKEN`, `GITHUB_REPO`                                                 | Optional GitHub issue sync (fine-grained PAT with Issues read/write)       |
| `GITHUB_ISSUE_LABELS_BUG`, `GITHUB_ISSUE_LABELS_ENHANCEMENT`                  | Comma-separated labels for auto-created issues                             |
| `GITHUB_ISSUE_ASSIGNEES`, `GITHUB_API_URL`                                    | Optional assignees and API base URL (defaults to `https://api.github.com`) |
| `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_PROJECT_KEY`           | Optional Jira Cloud issue sync (API token Basic auth)                      |
| `JIRA_LABELS`, `JIRA_ASSIGNEE_ACCOUNT_ID`                                     | Optional base labels and assignee for auto-created Jira issues             |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`                                   | Server-only storage client (never prefix with `NEXT_PUBLIC_`)              |
| `SUPABASE_STORAGE_BUCKET`                                                     | Public bucket name                                                         |
| `SUPABASE_EVENT_BANNERS_FOLDER`, `SUPABASE_PUNISHMENT_PFPS_FOLDER`            | Separate directories for event headers and punishment PFPs                 |
| `SUPABASE_FEEDBACK_ATTACHMENTS_FOLDER`                                        | Feedback media directory (optional; defaults to `feedback-attachments`)    |

### 3. Database Setup and Local Development

Review [`packages/database/prisma/migrations/README.md`](packages/database/prisma/migrations/README.md) before applying migrations.

> [!WARNING]
> **Known schema drift:** the `feedbacks` table and the `sort_order` columns on `categories`/`tasks` were applied with `prisma db push` and have no migration files yet. On a fresh database, `prisma migrate deploy` alone produces an incomplete schema. Until catch-up migrations land (`HANDOFF.md` D5), run `npx prisma db push` on **fresh local dev databases only**.

```bash
npm run db:migrate          # apply migration history (packages/database)
npm run dev:web             # http://localhost:3000
```

Existing databases previously created with `db push` must be backed up and verified against the baseline before marking it applied (see the migration README). Don't run the baseline SQL against a populated database.

### 4. Seed Scripts (local database only)

```bash
# Seed/refresh the normalized Pokémon catalogue (offline bundle; idempotent)
npm run db:seed:pokemon
```

### 5. Verification (run before every PR)

```bash
npm run typecheck:web   # tsc --noEmit (apps/web)
npm run test:web        # vitest run (apps/web)
npm run build:web       # next build (apps/web)
npm run typecheck:tasker # tsc --noEmit (apps/tasker)
npm run test:tasker     # vitest run (apps/tasker)
npm run test:ypt-bot    # node --test (apps/ypt-bot)
```
