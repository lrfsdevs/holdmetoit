# AGENTS.md — Multi-Agent Coordination Protocol & Engineering Standards

> **Project:** HoldMeToIt (Gamified Study Accountability & Challenge Management Platform)  
> **Repository:** Absolute source of truth. All contributing human engineers and AI agents are equal peers.  
> **Rule:** No single agent owns the codebase. Quality gates and stack laws apply unconditionally.  
> **Last Updated:** 2026-09-05

---

## 1. Agents & Responsibilities

HoldMeToIt is developed collaboratively by autonomous agents and human developers organized into four specialized functional roles:

| Role / Agent ID                          | Scope / Focus                                                                                                                                                             | Primary Layer Responsibilities                                                                                      |
| :--------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------ |
| **Data & Identity Agent**                | Database schema, Prisma migrations, Auth.js Discord OAuth, User/Challenge/Team/Task repositories, session hydration                                                       | `prisma/`, `core/db/`, `core/auth/`, `features/auth/`, `features/challenges/data/`                                  |
| **Scoring & Engine Agent**               | Domain business math, `HH:MM:SS` duration converters, cumulative team aggregations, dynamic catch-up deficit engine, dual-failure punishment validator, Vitest test suite | `features/leaderboard/domain/`, `features/study-logs/domain/`, `features/accountability/domain/`, domain unit tests |
| **Participant UI Agent**                 | Student cockpit views, `HH:MM:SS` duration self-logging input, interactive weekly goal checklist, progress meters, mobile viewport responsiveness (360px+)                | `features/study-logs/presentation/`, `features/declarations/presentation/`, `app/(dashboard)/`, Tailwind components |
| **Admin Operations & Broadcaster Agent** | Host wizard, team balancer & roster editor, admin inline hours override grid, challenge lock/freeze controls, Punishment PFP hub                                          | `features/challenges/presentation/`, `features/accountability/presentation/`, `app/(admin)/`                        |

### 1.1 Equality & Collaboration Posture

- All agents and human contributors possess equal authority.
- No agent shall unilaterally overwrite another agent's work without running pre-checks and verifying behavioral regression.
- Work is broken down into parallel-safe vertical slices to minimize file collisions.
- Autonomous agents must strictly adhere to the Document Authority Hierarchy:
   1. `FEATURES.md` has absolute override authority on **product behavior, screen layouts, and roadmap phases**.
   2. `DESIGN.md` has absolute override authority on **visual identity, cozy theme, color palette, typography, and component styling**.
   3. `AGENTS.md` (this file) has absolute override authority on **agent behavior, stack laws, git safety, and quality gates**.
   4. `ROADMAP.md` defines **phased milestones (`[P0]` to `[V2]`) and technical evolution gates**.
   5. `README.md` provides **developer onboarding, repository structure, and local environment setup**.
      _(Note: `HANDOFF.md` will be instantiated at repository root once active codebase implementation begins)._

---

## 2. Development Strategy (Feature-First Vertical Slices)

We adhere strictly to **Feature-First Vertical Slices**. Work units are sliced through all necessary layers for a specific capability rather than horizontally across all files.

### 2.1 Anatomy of a Feature Slice

```text
features/<feature_name>/
├── domain/            # Pure business entities, calculation math, zero framework/ORM imports
├── data/              # Prisma repositories, database queries, external API clients
├── presentation/      # React UI components, client hooks, forms, responsive views
└── api/               # Next.js Route Handlers / Server Actions
```

### 2.2 Definition of Done (DoD) per Slice

A vertical slice or work unit is only complete when:

1. **Typesafe:** Zero TypeScript compiler errors (`npm run typecheck` or `tsc --noEmit` exits with 0).
2. **Tested:** Unit tests for domain logic and math pass with 100% green exit (`npm run test`).
3. **Designed States Handled (Law L9):** Loading skeleton, Empty state, and Error fallback screens are fully implemented.
4. **Mobile Verified:** Layout renders cleanly without horizontal overflow or clipped buttons on a 360px viewport.
5. **Feature Documented (Rule §9.4):** Comprehensive architecture and developer usage documentation written in `docs/<feature>/README.md`.
6. **Handoff Documented & Pruned (Rule §9.3):** Session changes, status transitions, and the exact next step are recorded in `HANDOFF.md`, and any obsolete/superseded content is actively pruned.

---

## 3. Baseline Pre-Checks (Before Every Task)

Every agent or developer beginning a task must follow this exact sequential checklist:

1. **Read `AGENTS.md` (this file):** Re-align on stack laws, locked technologies, git safety, and quality gates.
2. **Read `FEATURES.md`:** Review authoritative UX, phase tags (`[P0]`, `[P1]`, `[V1]`, `[V2]`), and product intent for the targeted feature.
3. **Read `DESIGN.md`:** Review cozy color tokens, typography, component blueprints, and mobile responsive rules.
4. **Read `ROADMAP.md`:** Review the active phase milestone, non-goals, and evolution trajectory.
5. **Run Git Pre-Checks:** Execute `git status` and `git log -n 3` to verify working tree cleanliness.
6. **Inspect Target Directory:** Inspect existing code in the target feature folder before writing code; never assume file contents.
7. **Strict Archive Quarantine Policy:** All legacy and background specifications in `.archive/` (`SRS.md`, `MVP.md`, `ARCHITECTURE.md`, `EXECUTION_PLAN.md`, etc.) are historical references only. Autonomous agents must never modify files in `.archive/` or introduce deprecated mechanics.
8. **Implementation Plans Rule:** Follow planning mode for architectural changes, but do not generate duplicate design documents for items already specified in `FEATURES.md`. Proceed directly to execution.

---

## 4. Git Workflow & Safety Rules

### 4.1 Branching Strategy

| Branch            | Purpose                                     | Merge Criteria                       |
| :---------------- | :------------------------------------------ | :----------------------------------- |
| `main`            | Production-ready, deployable release code   | Peer review + all E2E journeys green |
| `dev`             | Shared integration branch for active sprint | All unit/integration tests passing   |
| `feature/<slice>` | Vertical slice development branch           | Slice Definition of Done satisfied   |
| `fix/<slice>`     | Hotfixes and defect resolutions             | Targeted regression test passing     |
| `prototyping`     | Early exploratory mockups and wireframes    | Team review / visual alignment       |

### 4.2 Conventional Commits

All commits must follow the conventional commit format:

- `feat(scope): ...` (New user-facing capability or domain feature)
- `fix(scope): ...` (Defect resolution or bugfix)
- `docs(scope): ...` (Documentation changes or updates)
- `refactor(scope): ...` (Code changes without behavior changes)
- `test(scope): ...` (Adding or updating tests)
- `chore(scope): ...` (Dependency updates, tooling configs)

### 4.3 Strictly Forbidden Git Commands

The following commands are **strictly prohibited** in all environments:

- `git reset --hard` (Data loss hazard)
- `git clean -fd` (Unrecoverable file deletion)
- `git push --force` or `git push -f` (Overwriting shared remote history)
- Rebasing shared public branches (`dev` or `main`)

---

## 5. Conflict Resolution Protocol

When encountering conflicting code or architectural divergence:

1. **STOP:** Halt automated code generation immediately.
2. **INSPECT:** Read git blame and recent commit logs to understand the original author's intent.
3. **UNDERSTAND:** Evaluate which approach adheres more strictly to `FEATURES.md` and the Foundational Stack Laws.
4. **EVALUATE:** If the existing code functions and satisfies tests, preserve it. Improve incrementally rather than replacing wholesale.
5. **DECIDE & LOG:** Document any forced deviations in `HANDOFF.md` under session notes.

---

## 6. Technology Stack (Locked vs Explicitly Rejected)

To eliminate architectural drift, the core technology stack is permanently locked. Any agent introducing dependencies outside this matrix will fail review.

### 6.1 Locked Reference Stack

| Layer / Dimension        | Ratified Choice                            | Version / Tooling | Architectural Purpose                                                                                        |
| :----------------------- | :----------------------------------------- | :---------------- | :----------------------------------------------------------------------------------------------------------- |
| **Framework & Runtime**  | Next.js (App Router)                       | 14+               | Unified fullstack SSR/Client architecture, zero CORS, zero multi-repo overhead                               |
| **Language**             | TypeScript                                 | 5.x               | Strict end-to-end type safety (`strict: true`) across UI, API, and DB layers                                 |
| **Styling & Components** | Tailwind CSS + shadcn/ui                   | Obsidian Dark     | Atomic utilities, responsive layouts (360px+), accessible Radix UI primitives, Obsidian tokens (`DESIGN.md`) |
| **Database Engine**      | PostgreSQL (Supabase / Neon)               | 15+               | Relational data integrity, ACID transactions for batch logging, Discord Snowflake keys                       |
| **Object Storage**       | Supabase Storage (`@supabase/supabase-js`) | 2.x               | Server-only uploads of event banners and punishment PFPs; public bucket URLs stored as strings               |
| **ORM & Migrations**     | Prisma ORM                                 | 6.x               | Declarative schemas, type-safe queries, migration control                                                    |
| **Authentication**       | Auth.js (NextAuth.js v5 beta)              | Latest            | Discord OAuth 2.0 (`identify` scope), session cookie management, spectator fallback                          |
| **Offline Storage**      | Browser IndexedDB                          | Native            | Offline-first task checklist (`holdmetoit_db`) with silent background cloud sync (`/api/tasks/sync`)         |
| **Observability**        | LogRocket                                  | 12.x              | Client session replays, exception capture in error boundaries                                                |
| **Schema Validation**    | Zod                                        | 4.x               | Strict runtime payload validation at API boundaries and form inputs                                          |
| **Unit & Math Testing**  | Vitest                                     | 3.x               | Fast ESM test runner for pure domain math and time calculations                                              |
| **Hosting & Deployment** | Vercel                                     | Production        | Native Next.js edge and serverless runtime support                                                           |

### 6.2 Explicitly Rejected Technologies

The following technologies were evaluated and are **strictly banned** from the codebase:

- ❌ **No Document Stores (MongoDB, CouchDB, Firebase Firestore):** Challenge leaderboards, team standings, and user logs are relational by nature. No non-relational stores.
- ❌ **No Custom Password / Email Authentication:** Local passwords, JWT email login, Auth0, or Firebase Auth are rejected. The community lives on Discord; Discord OAuth 2.0 is the sole identity mechanism.
- ❌ **No Heavy Client-Side State Managers (Redux, MobX):** Unnecessary boilerplate. Leverage React Server Components, server actions, and local UI state.
- ❌ **No GraphQL:** REST endpoints and Next.js Server Actions provide direct, type-safe RPC without GraphQL schema overhead.
- ❌ **No 24/7 Discord Bot Daemons in Phase 0 (P0):** A permanent bot service increases hosting costs and operational failure modes. P0 uses a 1-click clipboard markdown copy generator and webhooks. The full `@HoldMeToItBot` daemon is reserved for Phase 1 (P1).
- ❌ **No In-Browser Stopwatch / Pomodoro Timers:** Study community members use Yeolpumta (YPT) or physical timers on phones. In-browser web timers distract and invite anti-cheat complications.
- ❌ **No Grace Passes / Freeze Days:** Formally rejected. Deficits must be recovered dynamically via the Catch-Up model.

---

## 7. Foundational Product & Stack Laws (Non-Negotiables)

These nine foundational laws govern all implementation choices. They apply unconditionally to every agent:

### Law L1: Single Entity & Mathematical Unity

- **Rule:** Solos, Duos, and Squad battles are mathematically identical. A "Solo" is a `Team` where `maxMembers = 1`. A "Duo" has `maxMembers = 2`. All scoreboard aggregation queries group over `Team` entities.
- **Rationale:** Prevents fragmented codebases and duplicate calculation logic for different battle modes.
- **Forbidden Anti-Pattern:** Creating separate `SoloLeaderboard` and `TeamLeaderboard` tables or calculation services.

### Law L2: Spreadsheet Exorcism & Zero Manual Arithmetic

- **Rule:** If a community host has to open Google Sheets, perform manual addition, or calculate catch-up deficits by hand, the platform has failed.
- **Rationale:** The core mission is curing moderator burnout by automating event setup, tracking, standings, and punishment enforcement.
- **Forbidden Anti-Pattern:** Exporting raw unaggregated data that forces the host to calculate totals outside the application.

### Law L3: The Catch-Up Deficit Model (Zero Grace Passes)

- **Rule:** Grace passes and freeze days do not exist. If a participant logs fewer hours than their daily requirement, the deficit accumulates into their remaining days:
  $$\text{Remaining Deficit} = \max(0, \text{Target Seconds} - \text{Logged Seconds})$$
  $$\text{Required Daily Pace} = \frac{\text{Remaining Deficit}}{\text{Days Remaining}}$$
- **Rationale:** Community study battles reward sustained weekly effort and allow redemption without arbitrary pass mechanics.
- **Forbidden Anti-Pattern:** Decrementing "pass tokens" or pausing tracking on specific days.

### Law L4: Discord Identity Primacy

- **Rule:** Users authenticate exclusively via Discord OAuth 2.0. Display names, Discord Snowflakes, and avatar URLs are synchronized on login. Spectators can view all public challenge data without logging in.
- **Rationale:** Zero onboarding friction for Discord community members; eliminates password reset flows and credential security burdens.
- **Forbidden Anti-Pattern:** Adding username/password registration forms or requiring login to view the public scoreboard.

### Law L5: Admin Override Absolute

- **Rule:** Community hosts possess unconditional authority to manually adjust any participant's logged hours, edit goal descriptions, pardon punishments, or finalize results. Every manual edit is flagged with `is_override = true` and the host's `adminId`.
- **Rationale:** In real-world challenges, timers crash, apps bug out, and real-life emergencies happen. The host is the ultimate referee.
- **Forbidden Anti-Pattern:** Creating immutable participant records that cannot be corrected by an administrator.

### Law L6: Three-Condition Accountability Invariant

- **Rule:** At event conclusion (host lock), a participant is saved only when **ALL three** hold: (1) every challenge-linked weekly task is completed, (2) the declared target hours are met, and (3) their team is a winning team. A team wins when **no other team has strictly more combined hours** — equal totals never punish (every team at the maximum counts as a winner). If any condition fails, the participant is flagged `PUNISHED` **regardless of team**.
- **Rationale:** Studying without clear goals is aimless; declaring goals without studying is hollow; and personal effort must still contribute to the team result. Accountability demands all three commitments together, while ties are draws — not defeats.
- **Forbidden Anti-Pattern:** Granting a pass when hours are met but challenge-linked weekly tasks are ignored; punishing participants of a team when combined hours are tied.

### Law L7: Pure Domain Isolation (Inward Dependency Rule)

- **Rule:** All calculation math (hours-to-seconds conversions, deficit rates, standings rankings, punishment checks) must reside in pure TypeScript functions inside `domain/` with zero imports from Next.js, React, Prisma, or external UI libraries.
- **Rationale:** Enables instant, isolated Vitest unit testing without database spinning or framework mock overhead.
- **Forbidden Anti-Pattern:** Embedding score calculations or deficit math directly inside React UI components or database route handlers.

### Law L8: Second-Level Clock Precision

- **Rule:** All study times are stored internally as integer total seconds and formatted in UI views as standard clock format (`HH:MM:SS` or `Xh Ym Zs`).
- **Rationale:** Yeolpumta (YPT) logs down to the second. Floating-point hours (e.g. `4.33h`) introduce rounding discrepancies that erode participant trust.
- **Forbidden Anti-Pattern:** Storing durations as `Float` numbers in PostgreSQL or displaying raw unformatted seconds to participants.

### Law L9: Zero-State & Error Resilience

- **Rule:** Every UI view, data card, and table must provide polished visual designs for all three transient states: Loading (skeleton animation), Empty (helpful call-to-action), and Error (clear recovery prompt).
- **Rationale:** Prevents layout shifting, blank white screens, and unhandled promise rejections.
- **Forbidden Anti-Pattern:** Leaving data grids blank or displaying unstyled browser errors when data is missing or loading.

---

## 8. E2E Quality Matrix & User Journeys (J1–J6)

Every release candidate must pass these six automated end-to-end user journeys:

```mermaid
journey
    title HoldMeToIt E2E Quality Matrix (J1–J6)
    section J1: Auth & Public Spectator
      Visit /challenge/:id as Guest: 5: Spectator
      Scoreboard & Standings Visible: 5: System
      Click Login with Discord: 5: Participant
      User Record Upserted in DB: 5: System
    section J2: Challenge Operations
      Admin Creates Duo/Team Challenge: 5: Admin
      Assigns Balanced Rosters: 5: Admin
      Status Becomes UPCOMING: 5: System
    section J3: Pre-Kickoff Declarations
      Participant Enters Target (HH:MM:SS): 5: Participant
      Participant Adds Weekly Goals: 5: Participant
      Host Triggers Kickoff: 5: Admin
      Declarations Permanently Locked: 5: System
    section J4: Daily Logging & Catch-Up
      Participant Logs 04:30:00: 5: Participant
      Deficit Pace Recalculates: 5: System
      Scoreboard Margin Updates: 5: System
    section J5: Host Manual Override
      Admin Edits Glitched Log Entry: 5: Admin
      Log Flagged is_override=true: 5: System
      Team Total Recalculates Instantly: 5: System
    section J6: Event Lock & Accountability
      Admin Locks Final Results: 5: Admin
      Three-Condition Flags Punishments: 5: System
      Punishment PFP Download Enabled: 5: System
```

### J1: Discord OAuth Login & Profile Provisioning

- **Trigger:** Unauthenticated guest opens `/challenge/:id` (Spectator mode active, read-only). Guest clicks "Login with Discord".
- **Action:** Authenticates via Discord OAuth 2.0 (`identify` scope); redirected to Home Cockpit (`/`).
- **Database Assertion:** Record upserted in `User` table matching Discord `id`, `username`, `displayName`, and `avatar`.
- **Laws Gated:** Law L4 (Discord Identity Primacy), Law L9 (Zero-State & Error Resilience).

### J2: Admin Challenge Creation & Team Rostering

- **Trigger:** Authenticated Admin navigates to `/admin/challenges/new`.
- **Action:** Enters challenge title, start/end timestamps, selects `TEAM_VS_TEAM` (e.g. _Bees vs Butterflies_), names teams, and assigns participants.
- **Database Assertion:** `Challenge` created with status `UPCOMING`; `Team` records created with assigned `TeamMember` rows.
- **Laws Gated:** Law L1 (Single Entity Unity), Law L2 (Spreadsheet Exorcism).

### J3: Participant Pre-Kickoff Declaration & Goal Locking

- **Trigger:** Enrolled participant visits challenge page during `UPCOMING` phase.
- **Action:** Submits declared target hours (`35:00:00`) in enrollment modal. Admin clicks "Start Event Now".
- **Database Assertion:** `ChallengeParticipant` records updated; challenge transitions to `ACTIVE`. Target hours become read-only (`disabled`).
- **Laws Gated:** Law L6 (Three-Condition Invariant), Law L8 (Second-Level Precision).

### J4: Daily Study Logging & Dynamic Catch-Up Recalculation

- **Trigger:** Participant logs daily study time (`04:30:00`) for the current date via Home Cockpit (`/`).
- **Action:** Form validates duration $\le 86,400\text{ s}$ and submits server action (`logStudyTimeAction`).
- **Database Assertion:** `DailyStudyLog` inserted/upserted; team cumulative score increases by $16,200\text{ s}$; required daily deficit pace updates dynamically.
- **Laws Gated:** Law L2 (Spreadsheet Exorcism), Law L3 (Catch-Up Deficit Model), Law L7 (Pure Domain Isolation).

### J5: Admin Inline Hours Override & Audit Logging

- **Trigger:** Host opens challenge Manage tab (`/challenge/:id?tab=manage`) to correct a member's crashed timer.
- **Action:** Edits participant daily study log from `00:00:00` to `03:45:00` in the admin grid and saves (`adminOverrideStudyHoursAction`).
- **Database Assertion:** `DailyStudyLog` updated with `durationSeconds = 13500`, `isOverride = true`, `overrideById = adminUserId`; leaderboard re-aggregates.
- **Laws Gated:** Law L5 (Admin Override Absolute).

### J6: Event Lock, Three-Condition Auto-Punishment & Result Finalization

- **Trigger:** Challenge duration reaches end time; Host clicks "Lock Final Results".
- **Action:** System evaluates all enrolled members on the three conditions (challenge-linked weekly tasks, target hours, winning team — ties never punish). Challenge status becomes `COMPLETED`.
- **Database Assertion:** Challenge transitions to `COMPLETED`; `PunishmentRecord` rows created for punished members (row presence = punished; pardons preserved). The wrapped becomes available (Summary tab + popup).
- **Laws Gated:** Law L2 (Spreadsheet Exorcism), Law L6 (Three-Condition Accountability Invariant).

---

## 9. Agent Toolchain & Verification Protocol

### 9.1 Verification Commands

Before concluding any session or merging any pull request, agents must execute and verify:

```bash
# 1. Type Safety (Zero Errors)
npm run typecheck

# 2. Domain Unit Tests & Math Verification (100% Green)
npm run test

# 3. Production Build Validation
npm run build
```

### 9.2 Session Documentation Mandate

Once active codebase implementation begins and `HANDOFF.md` is instantiated at repository root, the active agent must update `HANDOFF.md` at the conclusion of each engineering session:

- Record session date and concise summary of changes.
- Update milestone progress table.
- Declare the exact, unambiguous **NEXT STEP** for the incoming agent.

### 9.3 Handoff Pruning & Obsolescence Rule (Zero Stale Context)

- **Mandate:** `HANDOFF.md` is a living operational relay document, **not** an append-only archive.
- **Active Pruning Requirement:** During every session update, the active agent MUST inspect `HANDOFF.md` and prune, compress, or delete any content that has become outdated, superseded, or obsolete:
   - **Completed & Resolved Items:** Resolved blockers, completed immediate tasks, and temporary workarounds must be deleted from the active work sections once integrated.
   - **Lean Session Logs:** Session logs must remain concise. Retain only the last 3–5 active engineering sessions; older entries must be summarized or purged.
   - **No Conflicting Instructions:** Outdated architectural notes, superseded API signatures, or stale checklist items must be scrubbed immediately to ensure incoming agents are never misled.
- **Quality Gate Invariant:** Leaving obsolete or conflicting instructions in `HANDOFF.md` constitutes a quality gate failure.

### 9.4 Feature Documentation Mandate (`docs/<feature>/README.md`)

- **Mandate:** For every new feature implementation or major architectural slice, the contributing agent or engineer MUST author or update comprehensive technical and operator documentation in `docs/<feature>/README.md` (e.g., `docs/feature-flags/README.md`, `docs/study-logs/README.md`).
- **Required Content Structure:**
   1. **Executive Summary & Scope:** What the feature achieves, key user journeys supported, and architectural guardrails (anti-overengineering rules).
   2. **Domain State Machine & Decisions:** Detailed decision flowcharts, matrix of rollout/evaluation states, and core business invariants (Law L7: Pure Domain Isolation).
   3. **Database Persistence Models:** Relational models, fields, foreign keys, and indexes added or updated in Prisma.
   4. **Developer & Operator Usage Guide:** Concrete TypeScript/React code snippets demonstrating how to consume the feature across Server Components (RSC), Client Components, Server Actions, and Route Handlers.
   5. **Security & Authorization Rules:** Explicit RBAC validation rules (`isDevRole`, `hasAdminPrivileges`), authenticated actor integrity, and data access boundary rules.
   6. **Feature Lifecycle & Decommissioning:** Release lifecycle stages (Dormant Deploy $\rightarrow$ Targeted Beta $\rightarrow$ Global GA $\rightarrow$ Decommission & Prune).
- **Quality Gate Invariant:** A feature slice is incomplete and fails the Definition of Done (DoD §2.2) if its corresponding `docs/<feature>/README.md` is omitted.
