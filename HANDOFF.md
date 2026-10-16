# HANDOFF.md — Engineering Operational Relay & Milestone Tracker

> **Project:** HoldMeToIt (Gamified Study Accountability & Challenge Management Platform)  
> **Repository:** `github.com/Afnanpathan2004/holdmetoit`  
> **Integration Branch:** `main` (latest: `c174a58`, PR #12) · Personal branches: `krish`, `afnan`, `afnan-jr`, `dev`  
> **Document Status:** Active Operational Relay (Living Document)  
> **Last Updated:** 2026-10-16 (Session 113 — Dynamic Challenge Description & Timetable Layout Adjustment (KAN-8 / GitHub #90) on `krish`)  
> **Governance:** Subject to strict **Handoff Pruning & Obsolescence Rule (§9.3 in `AGENTS.md`)**

---

## 1. Current State at a Glance

| Gate                                         | Result (2026-10-16, Session 113 — Dynamic Challenge Description & Timetable Layout Adjustment (KAN-8 / GitHub #90) on `krish`)                                                                                                                                                                                                                                                                                |
| :------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run typecheck`                          | ✅ 0 errors (`npx tsc --noEmit`)                                                                                                                                                                                                                                                                                                                                                                              |
| `npm run test`                               | ✅ 105 files green (1131/1131 tests passing)                                                                                                                                                                                                                                                                                                                                                                  |
| `npm run build`                              | ✅ 12 routes compiled (production build clean including `/devboard`)                                                                                                                                                                                                                                                                                                                                          |
| Phase 0 feature parity (vs `FEATURES.md`)    | ⚠️ **~98%** — Wrapped (dashboard popup + Shy Card, Summary tab, feedback survey) is now gated behind `challenge_wrapped_v1` and dark by default; modal starts at Slide 0 and stops auto-opening once seen; no loop on leaderboard navigation; feedback responses dual-persisted to DB (`ChallengeFeedback`) and Discord channel `1558594247895289877`; remaining gaps are deleted P0 UIs (wall, pardon modal) |
| Phase 0 Milestone Gate 1 (`ROADMAP.md` §3.4) | ❌ Not passed: no live pilot challenge has run; Vercel deployment not recorded in the repo                                                                                                                                                                                                                                                                                                                    |
| Phase 1 (P1)                                 | ⏸️ Not started                                                                                                                                                                                                                                                                                                                                                                                                |

### 1.1 Live Routes

| Route                                         | Purpose                                                                                                                                                    | Access                                 |
| :-------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------- |
| `/`                                           | Home cockpit: banner variants, progress/deficit card, Log Hours modal, Daily/Weekly task board; wrapped popup + Shy Card when `challenge_wrapped_v1` is on | Guest (local tasks only) / Participant |
| `/challenges`                                 | Dedicated public challenges directory (Events card grid, role-gated Create Challenge button)                                                               | Public spectator / Participant / Admin |
| `/changelog`                                  | Public date-grouped product changelog (unlinked; reachable by URL only)                                                                                    | Public spectator                       |
| `/challenge/[id]`                             | Tabs: Overview (includes Timetable & Forfeit Avatar) · Leaderboard · Summary (post-lock, `challenge_wrapped_v1`-gated) · Manage (admin only) · Event Audit | Public spectator                       |
| `/challenge/[id]/participant/[participantId]` | Challenge-specific participant statistics, targets, daily history & read-only profile                                                                      | Public spectator / Participant / Admin |
| `/admin`                                      | Server redirect to `/challenges`                                                                                                                           | `ADMIN` / `DEV`                        |
| `/admin/challenges/new`                       | Challenge creator wizard (2 required image uploads)                                                                                                        | `ADMIN` / `DEV`                        |
| `/profile`                                    | Dynamic resolver & redirect to active/enrolled participant profile page                                                                                    | Authenticated                          |
| `/devboard`                                   | DevBoard runtime feature flag console, instant kill switches, tester assignments                                                                           | `DEV` only                             |
| `POST /api/feedback`                          | Bug/suggestion intake → DB + Discord embed                                                                                                                 | Anyone                                 |
| `POST /api/tasks/sync`                        | Offline task queue batch sync                                                                                                                              | Authenticated                          |

> **Removed routes:** `/dashboard` (replaced by `/`), `/admin/challenges/[id]/roster` (replaced by the Manage tab), and `/challenge/[id]/manual` (deprecated and removed; superseded by challenge scoreboard + admin hours override grid). Several `revalidatePath("/dashboard")` calls remain and do nothing; they're harmless but should be cleaned up.

### 1.2 RBAC Model

- `DEV` → Discord snowflake listed in `DEV_DISCORD_IDS` (JSON array; legacy alias `DISCORD_DEV_IDS` still read).
- `ADMIN` → user holds a role in `DISCORD_ADMIN_ROLE_IDS` within `DISCORD_GUILD_ID` (looked up with `DISCORD_BOT_TOKEN`; OAuth scope stays `identify`).
- `PARTICIPANT` → everyone else. The `DISCORD_ADMIN_IDS` whitelist has been removed.
- **Global Participant Preview:** Admins and devs can toggle a global cookie (`holdmetoit_preview_as_participant`) from the header next to "Admin Console". When active, all pages (`/`, `/challenge/[id]`, etc.) render exactly as regular participants see them (hiding Manage tab, Event Audit tab, host override controls, and DEV badge).

---

## 2. Phase 0 (MVP Core) Feature Status Matrix — Verified Against Code

Legend: ✅ Done end-to-end · ⚠️ Partial / backend-only / deviates from spec · ❌ Missing

| Feature ID      | Feature                            | Status | Evidence / Gap                                                                                                                                                                                                                                                                                                                                                                             |
| :-------------- | :--------------------------------- | :----: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FEAT-AUTH-01`  | Discord OAuth (`identify`)         |   ✅   | `core/auth/index.ts`; role synced on sign-in via `syncUserRoleFromDiscord`                                                                                                                                                                                                                                                                                                                 |
| `FEAT-AUTH-02`  | Public spectator mode              |   ✅   | `app/challenge/[id]/page.tsx` renders without a session                                                                                                                                                                                                                                                                                                                                    |
| `FEAT-CHAL-01`  | Multi-format challenge creator     |   ✅   | `/admin/challenges/new`; banner + PFP uploads go to Supabase Storage                                                                                                                                                                                                                                                                                                                       |
| `FEAT-CHAL-02`  | Host manual kickoff                |   ✅   | Manage tab → `kickoffChallengeAction` (sets `startAt = now`; status is derived from timestamps)                                                                                                                                                                                                                                                                                            |
| `FEAT-CHAL-05`  | Lock final results                 |   ✅   | Manage tab → `lockChallengeResultsAction`. Fix D1: `resultsLockedAt DateTime?` allows idempotent post-expiry locking. Session 83: lock now runs the three-condition evaluator (weekly tasks + hours + winning team; ties never punish) and writes `PunishmentRecord` rows only for punished members                                                                                        |
| `FEAT-CHAL-06`  | Duo partner self-naming            |   ❌   | No participant-side duo naming code exists. Only hosts can rename teams (Manage tab → Team Identities)                                                                                                                                                                                                                                                                                     |
| `FEAT-AUDIT-01` | Append-only audit trail            |   ⚠️   | `features/audit/data/audit-log.repository.ts` stores events in PostgreSQL (`audit_logs`) and in-memory fallback. Event Audit tab UI live in `/challenge/[id]`.                                                                                                                                                                                                                             |
| `FEAT-DECL-01`  | Declared target hours (`HH:MM:SS`) |   ✅   | Entered in the enrollment modal (1–105h). Note: `leaveDays` is accepted by the action but **silently discarded** (no column)                                                                                                                                                                                                                                                               |
| `FEAT-DECL-02`  | Mandatory weekly goals checklist   |   ✅   | Challenge-linked tasks: `Task.challengeId` (nullable; SetNull FK) + soft delete (`deletedAt`, tombstoned category names). New tasks are stamped to the user's current challenge via `resolveTaskChallengeId` (ACTIVE preferred, else soonest UPCOMING); one-time backfill linked all existing tasks to the October challenge                                                               |
| `FEAT-DECL-03`  | Declaration lock on `ACTIVE`       |   ✅   | Targets can't be edited after enrollment at all. Late enrollment is still allowed while `ACTIVE` (only `COMPLETED` blocks it)                                                                                                                                                                                                                                                              |
| `FEAT-DECL-04`  | Host weekly target hours edit      |   ✅   | `AdminTargetOverrideModal`: mods/devs can adjust any participant's weekly target commitment (1h–105h) with immutable `TARGET_HOURS_OVERRIDE` audit logging; integrated across Manage tab, Leaderboard tab, and Participant Stats profile                                                                                                                                                   |
| `FEAT-LOG-01`   | Daily `HH:MM:SS` self-logging      |   ✅   | `daily-hours-modal.tsx`: participants restricted to today/yesterday self-logging (`ONLY_TODAY_OR_YESTERDAY_ALLOWED`), non-scrolling 7-day selector, native picker (`max=today`), domain guards                                                                                                                                                                                             |
| `FEAT-LOG-02`   | 24h single-day limit               |   ✅   | `MAX_DAILY_LOG_SECONDS` in `daily-log.validation.ts`                                                                                                                                                                                                                                                                                                                                       |
| `FEAT-LOG-04`   | Admin inline hours override UI     |   ✅   | `AdminHoursOverrideModal`: mods and devs (`ADMIN`, `DEV`) can override any participant's hours for any day of the week (D1..D7) with mandatory audit reason; integrated into Manage tab roster & Leaderboard tab                                                                                                                                                                           |
| `FEAT-LEAD-01`  | Head-to-head scoreboard            |   ✅   | `challenge-leaderboard-tab.tsx`: matchup card with share % and team targets                                                                                                                                                                                                                                                                                                                |
| `FEAT-LEAD-02`  | Unified standings table            |   ✅   | Desktop table plus mobile card layout. Standings now carry real weekly-task counts (challenge-linked, soft-deletes included) which also drive the sort tie-break — no "Goals Done" column                                                                                                                                                                                                  |
| `FEAT-LEAD-03`  | Catch-up deficit engine            |   ✅   | `deficit.ts` + `cockpit-progress-card.tsx`                                                                                                                                                                                                                                                                                                                                                 |
| `FEAT-PUN-01`   | Three-condition auto-flagging      |   ✅   | `evaluateLockOutcome` (pure): saved = hours met AND all challenge-linked weekly tasks complete (soft-deleted rows count) AND in a winning team; ties never punish (`resolveWinningTeamIds`). `PunishmentRecord` row presence = punished; pardons preserved                                                                                                                                 |
| `FEAT-PUN-02`   | Punishment Wall                    |   ❌   | `punishment-wall.tsx` was deleted in `88779bd`. The Overview tab only mentions it in copy                                                                                                                                                                                                                                                                                                  |
| `FEAT-PUN-03`   | Punishment PFP download button     |   ✅   | Overview tab contains dedicated Forfeit Avatar & Accountability card with image preview, Law L6 explanation, and direct "Download Forfeit PFP" button                                                                                                                                                                                                                                      |
| `FEAT-PUN-04`   | Host pardon                        |   ⚠️   | `adminPardonAction` preserved and adapted (findFirst update-or-create; `PunishmentRecord` keeps `isPardoned/pardonReason/pardonedById`); **no UI** (`admin-goals-pardons.tsx` was deleted in `364c7a1`)                                                                                                                                                                                    |
| `FEAT-WRAP-01`  | Challenge wrapped story popup      |   ✅   | `features/wrapped/presentation/challenge-wrapped-modal.tsx`: auto-opens for enrolled participants while locked; localStorage-first flags (`hmt:wrapped:{challengeId}`); `isWrappedSeen` flips at the feedback slide; 3-day window + page-load auto-seen (`markWrappedSeenIfExpiredAction`); feedback flow deferred (button ships empty); gated behind `challenge_wrapped_v1` (fail-closed) |
| `FEAT-WRAP-02`  | Challenge wrapped summary tab      |   ✅   | `?tab=summary` (post-lock): `challenge-summary-tab.tsx` renders the challenge-level story for everyone plus the personal wrapped block (verdict, reasons, best day, vs-average, team share, daily bars, weekly tasks) for enrolled participants; gated behind `challenge_wrapped_v1`                                                                                                       |
| `FEAT-DISC-01`  | 1-click Discord summary copy       |   ❌   | Removed (superseded by in-app Challenge Summary tab & personal Wrapped story dialog)                                                                                                                                                                                                                                                                                                       |

### 2.1 Shipped Beyond the Original P0 Spec

| Capability                                            | Location                                                            | Notes                                                                                                                                                                                                              |
| :---------------------------------------------------- | :------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Categorized Daily/Weekly to-do board with drag & drop | `features/tasks/`, `cockpit-tasks-section.tsx`                      | Offline-first IndexedDB (`holdmetoit_db`), debounced background sync, guest→user migration on login                                                                                                                |
| Global Participant Preview Mode                       | `features/auth/presentation/auth-nav.tsx`, `preview-mode.ts`        | 1-click header toggle for mods/devs to view all pages as regular participants globally                                                                                                                             |
| Feedback & bug reporting                              | `features/feedback/`, `app/api/feedback/route.ts`                   | Floating trigger button, `FB-XX` codes, Discord bot embeds, LogRocket session link                                                                                                                                 |
| LogRocket observability                               | `core/observability/`                                               | Session replay, `error.tsx` / `global-error.tsx` boundaries                                                                                                                                                        |
| Structured diagnostics logging                        | `core/observability/logger.ts`, `core/observability/domain/`        | Unified server/client logger (pure `domain/` model + Vitest), `LOG_LEVEL` filtering, one-line JSON on the server; instrumented across all server actions, routes, auth events and error boundaries                 |
| Manual weekly slot leaderboard                        | `features/leaderboard/*manual*`, `/challenge/[id]/manual`           | ⚠️ Stores `sessionHours` as `Decimal(6,2)`, which violates **Law L8** (integer seconds)                                                                                                                            |
| Dynamic cockpit banner (7 variants) & hero banner     | `cockpit-banner.ts`, `challenge-hero-banner.tsx`                    | Matches the Figma                                                                                                                                                                                                  |
| `DEV` role                                            | `auth-roles.ts`, `discord-guild.service.ts`                         | Grants full admin plus developer access                                                                                                                                                                            |
| Admin roster participant removal                      | `challenge-manage-tab.tsx`, `challenge-admin.repository.ts`         | Host removes a participant (`UPCOMING`/`ACTIVE` only) with a mandatory audit reason; purges logs, punishment, leaderboard entry, and team-member rows                                                              |
| Public date-based changelog                           | `CHANGELOG.md`, `features/changelog/`, `app/changelog/`             | `/changelog` renders the root `CHANGELOG.md` (parsed dep-free); `[user]` entries are public, untagged are admin-only; unlinked public route                                                                        |
| Challenge Wrapped & Three-Condition lock              | `features/wrapped/`, `features/accountability/domain/punishment.ts` | Post-lock wrapped (`?tab=summary` + auto-popup, localStorage-first flags, 3-day auto-seen); challenge-linked tasks + soft delete; `evaluateLockOutcome` saves only on tasks+hours+winning team (ties never punish) |

---

## 3. Known Defects & Technical Debt (Prioritized)

|  #  | Severity | Issue                                                                                                                                                                                                                                                                                                                                                                 | Suggested Fix                                                                                                                                                                            |
| :-: | :------: | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  |    ✅    | **RESOLVED (2026-10-11):** Lock Results fails after natural expiry                                                                                                                                                                                                                                                                                                    | Added `resultsLockedAt DateTime?` column, updated lifecycle domain guards to permit lock on expired unlocked events, set `resultsLockedAt` inside transaction, and updated Manage tab UI |
| D2  | 🔴 High  | Audit trail in-memory fallback needs full persistence validation                                                                                                                                                                                                                                                                                                      | Add migration check and verify Prisma `audit_logs` model insertion across all environments                                                                                               |
| D3  | 🔴 High  | One P0 feature has backend code but no UI: host pardon modal (Punishment PFP download & Target override complete; Discord summary copy removed)                                                                                                                                                                                                                       | Rebuild host pardon modal in Obsidian styling inside the Manage tab                                                                                                                      |
| D4  |    ✅    | **RESOLVED (2026-10-11, Session 83):** Law L6 amended to the Three-Condition Invariant — challenge-linked weekly tasks (`Task.challengeId` + soft delete) + target hours + winning team; ties never punish. `lockChallengeResults` evaluates all three conditions and records only punished members                                                                   | —                                                                                                                                                                                        |
| D5  |  🟠 Med  | Schema drift: the `feedbacks` table and the `sort_order` columns on `categories`/`tasks` were applied with `db push` and have **no migration files**. `prisma migrate deploy` on a fresh DB would produce an incomplete schema. **Partially resolved (Session 79):** `isLeave` migration (`20261010120000`) applied; CI now blocks schema changes without a migration | Generate catch-up migrations (`prisma migrate diff`) and `migrate resolve` them on existing DBs                                                                                          |
| D6  |    ✅    | **RESOLVED (2026-10-14, Session 105):** Challenge Participant Leave Budget feature implemented: `plannedLeaveDays` collected on enrollment, `usedLeaveDays` tracked transactionally on `ChallengeParticipant` upon daily study logs with `isLeave: true`. Quota enforced (`Maximum leaves taken for the challenge`).                                                  | —                                                                                                                                                                                        |
| D7  |    ✅    | **RESOLVED (2026-10-14, Session 101):** Manual leaderboard and Decimal sessionHours removed; all tracking handled via DailyStudyLog in integer seconds                                                                                                                                                                                                                | —                                                                                                                                                                                        |
| D8  |  🟡 Low  | Stale `revalidatePath("/dashboard")` calls; `DISCORD_DEV_IDS` alias; `DEFAULT_FEEDBACK_CHANNEL_ID` hardcoded                                                                                                                                                                                                                                                          | Clean up                                                                                                                                                                                 |
| D9  |  🟡 Low  | "E2E J1–J6" suite (`features/e2e/quality-matrix-j1-j6.test.ts`) mocks Prisma; there's no real browser E2E                                                                                                                                                                                                                                                             | Add Playwright journeys once the D3 UIs are back                                                                                                                                         |
| D10 |  🟡 Low  | Duplicate lockfiles (`bun.lock` + `package-lock.json`); `npm audit` reports 20 vulns (3 critical)                                                                                                                                                                                                                                                                     | Pick one package manager; run `npm audit` triage                                                                                                                                         |

---

## 4. Open Product Decisions (Require Team Sign-off)

1. **~~Goals vs Law L6~~ — ✅ Resolved (2026-10-11, Session 83):** challenge-scoped goals returned as challenge-linked tasks (`Task.challengeId`, default stamping + soft delete); Law L6 amended to the Three-Condition Accountability Invariant (weekly tasks + hours + winning team; ties never punish).
2. **~~Leave days~~ — ✅ Resolved (2026-10-14, Session 105):** Challenge participant leave budget implemented. Declared leave days (`plannedLeaveDays`) are budgeted on enrollment; logging `isLeave = true` increments `usedLeaveDays` up to quota with `"Maximum leaves taken for the challenge"`.
3. **Late enrollment while `ACTIVE`:** Is this intended? It's allowed today.
4. **Design authority:** `DESIGN.md` now documents the Obsidian system (it replaced "Cozy Study Café" on 2026-10-04). Confirm this is ratified.

---

## 5. Foundational Laws — Compliance Snapshot

| Law                        | Status | Note                                                                                                                                      |
| :------------------------- | :----: | :---------------------------------------------------------------------------------------------------------------------------------------- |
| L1 Mathematical Unity      |   ✅   | Single `Team` entity with `maxMembers`                                                                                                    |
| L2 Spreadsheet Exorcism    |   ✅   | Full-week admin override UI and auto-aggregating standings eliminate manual arithmetic                                                    |
| L3 Catch-Up Deficit        |   ✅   | `deficit.ts`; no grace passes                                                                                                             |
| L4 Discord Identity        |   ✅   | OAuth only; public spectator                                                                                                              |
| L5 Admin Override Absolute |   ✅   | `adminOverrideStudyHoursAction` + `AdminHoursOverrideModal` live in Manage tab & Leaderboard tab                                          |
| L6 Three-Condition         |   ✅   | Weekly tasks + hours + winning team; ties never punish (D4 resolved)                                                                      |
| L7 Pure Domain Isolation   |   ✅   | `domain/` folders are framework-free                                                                                                      |
| L8 Second-Level Precision  |   ✅   | 100% compliant. All durations and logs use integer seconds (`DailyStudyLogV2`); legacy `Decimal` manual leaderboard removed (D7 resolved) |
| L9 Zero-State Resilience   |   ✅   | Full boundary coverage: localized `error.tsx`, root & dynamic `not-found.tsx`, `loading.tsx` skeletons, and hardened `global-error.tsx`   |

---

## 6. Immediate Next Step (For Incoming Agent)

> [!IMPORTANT]
> **EXACT NEXT STEP (For Incoming Agent):**
>
> 1. Create the `challenge_wrapped_v1` feature flag in the target DB via `/devboard` (key `challenge_wrapped_v1`, `isEnabled = true`, `rolloutMode = TARGETED` for testers → `GLOBAL` for everyone). Wrapped is fail-closed and stays dark until this row exists.
> 2. Restore the remaining deleted P0 UIs:
>    - Host pardon modal (`FEAT-PUN-04`) inside the Manage tab.
>    - Punishment Wall (`FEAT-PUN-02`).
> 3. Promote the migrations to the hosted DB when the team is ready:
>    - `20261011120000_challenge_wrapped_flags_and_punishment_trim`
>    - `20261011120100_challenge_linked_tasks_and_soft_delete`
>    - `20261012120000_add_challenge_feedback_table`
> 4. Reconcile remaining schema drift (D5): generate catch-up migrations for `feedbacks` and the `sort_order` columns.

---

## 7. Session Changelog (Last 3–5 Sessions)

### Sessions 1–84 (Summarized)

- Core domain math, Prisma models, Discord OAuth, participant cockpit, mobile pass, drag & drop across Daily/Weekly boards, offline-first IndexedDB task sync (`holdmetoit_db`), 2-card participant logging, admin 7-day hours overrides, law labels UI cleanup, moderator future hours prevention, cross-day task moving/rescheduling with validation, participant study log audit trail integration (`STUDY_LOG_ADDED`), dedicated public challenges catalog (`/challenges`) with role-gated admin controls, multi-view pagination guards (`DataPagination`), challenge-specific participant statistics profiles (`/challenge/[id]/participant/[participantId]`), multi-view search & team filtering with "View by Team" mode, dynamic team color palettes with WCAG AA contrast calculation (`team-colors.ts`), overall time reset to 0 (`executeAdminResetOverallHours`), and challenge tab reload URL sync (`challenge-tabs.ts`). Also: full migration of daily study logs from legacy V1 to `DailyStudyLogV2` (cockpit/participant-stats log resolution simplified). Also (Session 76, afnan): leaderboard view-mode URL sync (`?view=individual|today|team`) with `popstate` restoration and participant-profile breadcrumb/empty-state context preservation. Session 77 (afnan-jr): merged the "About" tab into Overview — `CHALLENGE_TABS` is now overview/leaderboard/manage/audit with a legacy `about`→`overview` redirect; the UTC timetable + description were folded into the Overview Welcome card, and a Forfeit Avatar download card was added. Session 78: Admin roster participant removal and target-hours override UI. Session 79: PR #67 `isLeave` production regression fixed with migration. Session 80: Structured logger. Session 81: Dependabot, Vitest 5, Fix D1 results lock. Session 82: Changelog page. Session 83: Challenge Wrapped + Three-Condition lock + challenge-linked tasks and soft delete. Session 84: Result unlock rollback action + CLI scripts.

### Sessions 85–88 (Summarized)

- **Session 85:** Ported `holdmetoit Wrapped.html` into `challenge-wrapped-modal.tsx` with 5-slide flow, pure domain story models (`wrapped-story.ts`), count-up, charts, and hold-to-reveal stamp.
- **Session 86:** Unified Challenge Summary tab (`challenge-summary-tab.tsx`) to Obsidian dark tokens and migrated wrapped modal from CSS modules to Tailwind CSS v4.
- **Session 87:** Harmonized wrapped modal to Obsidian tokens, eliminated prototype hexes/variables, fixed icon button flex expansion, and built desktop 16:9 2-column split responsive layout.
- **Session 88:** Implemented dynamic midpoint anchoring for Slide 2 best-day label to eliminate right-column collisions, and edge-aware tooltip translation.
   - `npm run test` passed (85 test files, 936/936 tests green).
   - `npm run build` passed (12 routes compiled cleanly).
- **NEXT STEP (completed in Session 89):** Challenge Feedback Backend Bridge & Discord Channel 1558594247895289877.

### Sessions 89–104 (Summarized; includes late 82/83 addenda)

- **Session 89** (2026-10-12): 8-Question Challenge Feedback Survey Dialog & Discord Channel 1558594247895289877
- **Session 90** (2026-10-12): Feedback Dialog Obsidian Tokens Harmonization, Badge Removal & Unified Single-Section Flow
- **Session 91** (2026-10-12): Dedicated ChallengeFeedback PostgreSQL Table, Repository & Dual-Persistence Pipeline
- **Session 92** (2026-10-12): Wrapped Modal Starting Slide Fix & Server Reset Reconciliation
- **Session 82** (2026-10-11): User Profile Navigation Links & Route Resolution
- **Session 83** (2026-10-11): Challenge Hero Banner "Back to challenges" Navigation & Obsidian Pill Enhancement
- **Session 95** (2026-10-12): Lock-Gated Cockpit Banner & Unlocked Post-Expiry Logging State
- **Session 96** (2026-10-12): Day 7 Grace Period Day Resolution / Capping at Day 7
- **Session 97** (2026-10-12): Integration Merge: dev branch into afnan-jr
- **Session 98** (2026-10-13): Dashboard Page-Load Wrapped, Shy Card Discovery & Mobile Viewport Hardening
- **Session 99** (2026-10-13): Full Route Boundaries Coverage: Localized error.tsx, Root & Dynamic not-found.tsx, Missing loading.tsx Skeletons & Hardened global-error.tsx
- **Session 100** (2026-10-13): Soft Deletion Architecture for Challenges, Teams, Categories, and Tasks
- **Session 101** (2026-10-14): Manual Leaderboard Feature Removal & 100% Law L8 Compliance
- **Session 102** (2026-10-14): Database Table Names Standardized to PascalCase
- **Session 103** (2026-10-14): Database Column Names Standardized to camelCase
- **Session 104** (2026-10-14): Removal of Discord Summary Feature (`FEAT-DISC-01`) and its dead domain code, tests, and docs references

### Session 105 — 2026-10-14 (Participant Leave Budget Feature & Elimination of Legacy DailyStudyLog V1)

- **Agent Role:** Data & Identity Agent, Scoring & Engine Agent, Participant UI Agent.
- **Scope & Objectives:**
   1. Implement the Challenge Participant Leave Budget feature: collect `plannedLeaveDays` upon enrollment, track `usedLeaveDays` on `ChallengeParticipant`, and enforce quota when logging study days with `isLeave: true`. If `usedLeaveDays >= plannedLeaveDays`, return exact error: `"Maximum leaves taken for the challenge"`.
   2. Remove all traces ("namo nishaan") of `DailyStudyLog` (V1) and unify the active `DailyStudyLogV2` into the canonical `DailyStudyLog` across the entire database, schema, repositories, actions, and test suites.
- **Pure Domain & Validation (`features/study-logs/domain/`):**
   - Created `leave-allowance.ts` with `validateLeaveAllowance()`, `assertLeaveAllowance()`, `MAX_LEAVES_ERROR = "Maximum leaves taken for the challenge"`, and `MaximumLeavesExceededError`.
   - Added unit test suite `leave-allowance.test.ts` (9 tests covering quota enforcement, zero-leave edge cases, idempotent re-saves, and unmarking decrement).
- **Database Migration & Schema (`prisma/`):**
   - Created migration `prisma/migrations/20261014020000_unify_study_logs_and_add_leave_budget/migration.sql`:
      - Dropped legacy unused `"DailyStudyLog"` (V1) table cascade.
      - Renamed `"DailyStudyLogV2"` to canonical `"DailyStudyLog"`.
      - Renamed legacy constraints and indexes to canonical names (`DailyStudyLog_pkey`, `DailyStudyLog_overrideById_fkey`, `DailyStudyLog_participantId_fkey`, `DailyStudyLog_logDate_idx`, `DailyStudyLog_participantId_idx`, `DailyStudyLog_participantId_logDate_key`).
      - Added `plannedLeaveDays` and `usedLeaveDays` (default 0) to `ChallengeParticipant`.
      - Backfilled existing `usedLeaveDays` count from study logs where `isLeave = true`.
   - Executed migration safely via `prisma db execute` (228 active logs preserved 100%).
   - Updated `prisma/schema.prisma` removing `DailyStudyLogV2`, removing `overriddenLogsV2` and `dailyStudyLogsV2`, adding `plannedLeaveDays` and `usedLeaveDays` to `ChallengeParticipant`.
- **Application Code & Repositories:**
   - `features/study-logs/data/daily-study-log.repository.ts`: updated `upsertDailyStudyLog` to run in a transaction, validate leave quota against participant's budget, update `ChallengeParticipant.usedLeaveDays`, and use canonical `prisma.dailyStudyLog`.
   - `features/study-logs/api/log-study-time.actions.ts`: catches `MaximumLeavesExceededError` and returns `{ ok: false, code: "MAX_LEAVES_REACHED", message: "Maximum leaves taken for the challenge" }`.
   - `features/challenges/data/participant.repository.ts`: accepts and stores `plannedLeaveDays` in `enrollParticipantInChallenge`.
   - `features/challenges/api/enroll-participant.actions.ts`: passes `leaveDays` -> `plannedLeaveDays`.
   - Replaced `dailyStudyLogsV2`/`dailyStudyLogV2` with `dailyStudyLogs`/`dailyStudyLog` across all repository, service, and test files (`admin-override.repository.ts`, `cockpit-data.ts`, `challenge-admin.repository.ts`, `leaderboard-data.ts`, `participant-stats.repository.ts`, and all corresponding test suites).
   - `features/study-logs/presentation/daily-hours-modal.tsx`: displays leave budget counter (`🌴 Leaves: {usedLeaveDays}/{plannedLeaveDays}`), guards `handleMarkAsLeave` against exhausted quotas with `"Maximum leaves taken for the challenge"`.
- **Quality Gates Verified:**
   - `npm run typecheck` passed (0 errors).
   - `npm run test` passed (93 test files, 1037/1037 tests green).
   - `npm run build` passed (11 routes compiled cleanly).
   - `bash scripts/check-schema-migration.sh origin/main` passed.
- **NEXT STEP (completed in Session 106):** Fix todo context menu alignment on scroll and resolution change (KAN-18 / GitHub #100).

### Session 106 — 2026-10-15 (Self-Aligning Task & Category Context Menus via Radix/shadcn — KAN-18 / GitHub #100)

- **Agent Role:** Participant UI Agent, Scoring & Engine Agent.
- **Scope & Objectives:**
   - Resolve Jira KAN-18 (GitHub Issue #100): "the todo's context menu does not self align itself with scrolls and resolution change".
   - Replace the legacy manual fixed-coordinate floating `<div>` implementation with modular `shadcn` components (`@radix-ui/react-dropdown-menu` and `@radix-ui/react-context-menu`) as recommended by collaborators.
- **Component Primitives Added (`components/ui/`):**
   - `dropdown-menu.tsx`: Radix UI DropdownMenu wrapped and styled with Obsidian Dark palette tokens (`#222222`, `#383838`, `rounded-xl`, `border-stone-700/60`, elevated shadow, accessible keyboard navigation).
   - `context-menu.tsx`: Radix UI ContextMenu styled identically to match Obsidian Dark theme with support for Submenus, Checkboxes, Radio items, and keyboard shortcuts.
- **Modular Presentation (`features/study-logs/presentation/cockpit/`):**
   - `cockpit-task-menu.tsx`: Pure, reusable menu items component providing `TaskMenuItems` and `CategoryMenuItems`. Designed with generic item primitives (`Item`, `Separator`, `Label`) so the exact same menu items render seamlessly within both `<DropdownMenuContent>` (3-dots button trigger) and `<ContextMenuContent>` (right-click trigger).
   - Fully supports all task and category operations: status toggles (In Progress / Complete / Reopen), challenge-day move targets (with Past-day move guards via `validateMoveTaskChallengeDay`), editing, and locked past-day deletion safeguards.
- **Cockpit Tasks Section Refactored (`cockpit-tasks-section.tsx`):**
   - Removed legacy manual `contextMenu` React state (`{ x, y, type, task, category }`).
   - Removed manual coordinate calculators and window resize/scroll listeners (`openCategoryMenuFromButton`, `handleCategoryContextMenu`, `openTaskMenuFromButton`, `handleTaskContextMenu`).
   - Removed the legacy absolute-positioned `<div>` (`style={{ top: contextMenu.y, left: contextMenu.x }}`).
   - Wrapped category headers and task items in `<ContextMenu modal={false}>` with `<ContextMenuTrigger asChild>`.
   - Converted 3-dots action buttons to `<DropdownMenu modal={false}>` with `<DropdownMenuTrigger asChild>`.
   - Radix Popper / Floating UI (`modal={false}`) continuously tracks trigger positions during container and ancestor scrolling and dynamically recalculates positioning during resolution changes and window resizing.
- **Quality Gates Verified:**
   - `features/study-logs/presentation/cockpit/cockpit-task-menu.test.tsx`: 5 unit tests verifying task status transitions, challenge-day move options, past-day delete lockdown, and category menu actions.
   - `npm run typecheck` passed (0 errors).
   - `npm run test` passed (95 test files, 1053/1053 tests green).
   - `npm run build` passed (11 routes compiled cleanly).
- **NEXT STEP:** Restore the remaining deleted P0 UIs: host pardon modal (`FEAT-PUN-04`), Punishment Wall (`FEAT-PUN-02`).

### Session 107 — 2026-10-14 (DevBoard & Lightweight Self-Hosted Feature Flags System)

- **Agent Role:** Data & Identity Agent, Scoring & Engine Agent, Participant UI Agent, Admin Operations & Broadcaster Agent.
- **Scope & Objectives:**
   1. Implement a lightweight, zero-overhead, self-hosted feature flag system with Supabase Postgres storage (via Prisma 6.x). No external services, no Redis, no Supabase Realtime.
   2. Build **DevBoard** (`/devboard`), an exclusive developer console accessible strictly by users with the `DEV` role (`isDevRole(session.user.role)`).
   3. Maintain strict boundary: **zero features flagged yet**. Only the flag engine, persistence models, atomic transactions, evaluator, and DevBoard interface are built.
- **Database Migration & Schema (`prisma/`):**
   - Added `enum RolloutMode { DISABLED, TARGETED, GLOBAL }` to `prisma/schema.prisma`.
   - Added models `FeatureFlag`, `FeatureFlagTarget`, `FeatureFlagAuditLog`, and inverse relations on `User`.
   - Created migration `prisma/migrations/20261015000000_create_feature_flags/migration.sql`.
   - Executed migration on PostgreSQL via `prisma db execute --schema prisma/schema.prisma --file prisma/migrations/20261015000000_create_feature_flags/migration.sql`.
   - Generated Prisma client (`npm run db:generate`).
- **Pure Domain & Validation (`features/feature-flags/domain/`):**
   - Created `feature-flags.types.ts`: `RolloutModeType`, `FeatureFlagEntity`, `FeatureFlagTargetEntity`, `FeatureFlagAuditLogEntry`, `FlagEvaluationContext`.
   - Created `evaluator.ts`: pure domain evaluation function adhering to Law L7 (zero external dependencies). Master switch overrides all modes; soft-deleted flags return safe fallback; targeted mode evaluates against user ID; global mode returns true.
   - Created `feature-flags.schema.ts`: Zod 4 schemas for `createFeatureFlagSchema`, `updateFeatureFlagSchema`, `toggleMasterSwitchSchema`, `setRolloutModeSchema`, `manageTesterSchema`.
   - Added unit test suites `evaluator.test.ts` (7 tests) and `feature-flags.schema.test.ts` (9 tests), 100% green.
- **Data Layer & Atomic Transactions (`features/feature-flags/data/`):**
   - Created `feature-flags.repository.ts`:
      - `listFeatureFlags`, `getFlagWithTargetsByKey`, `getAllActiveFlagsWithTargets`.
      - Atomic mutations via `prisma.$transaction`: `createFeatureFlagTx`, `updateFeatureFlagTx`, `toggleMasterSwitchTx`, `setRolloutModeTx`, `assignTesterTx`, `removeTesterTx`, `softDeleteFeatureFlagTx`. Each mutation records an immutable audit log entry in the same transaction.
      - `searchAssignableDiscordUsers`: search Discord users by display name, username, or Snowflake.
   - Added repository unit test suite `feature-flags.repository.test.ts` (7 tests, 100% green).
- **API Layer & Evaluator Helper (`features/feature-flags/api/`):**
   - Created `require-dev.ts` in `features/auth/api/` enforcing strict `DEV` role check.
   - Created `server.ts`: public server-side helper with React `cache()` memoization (`isFeatureEnabled`, `getFeatureFlags`) preventing duplicate N+1 database queries.
   - Created `feature-flags.actions.ts`: Server Actions (`createFeatureFlagAction`, `updateFeatureFlagAction`, `toggleMasterSwitchAction`, `setRolloutModeAction`, `assignTesterAction`, `removeTesterAction`, `deleteFeatureFlagAction`, `getFlagAuditTrailAction`, `searchDiscordUsersAction`) strictly guarded with `requireDevUser()`.
   - Added action unit test suite `feature-flags.actions.test.ts` (7 tests, 100% green).
- **Presentation & Routes (`app/devboard/` & `features/feature-flags/presentation/`):**
   - Created `app/devboard/layout.tsx` (strictly redirects non-DEV users to `/`).
   - Created `app/devboard/page.tsx` (server-renders DevBoard with initial flags).
   - Created `app/devboard/loading.tsx` (skeleton loader per Law L9).
   - Created `app/devboard/error.tsx` (error recovery boundary per Law L9).
   - Created UI components adhering to Emil Kowalski design engineering principles (`emil-design-eng`, `make-interfaces-feel-better`):
      - `devboard-header.tsx`: title banner, `[⚡ DEVBOARD]` badge, tabular monospace metric counters, search and filter bar, create flag CTA.
      - `flag-card.tsx`: concentric border radii, master switch toggle, segmented rollout pill selector, Discord avatar chips (`outline outline-1 outline-white/10`), audit, edit, and delete triggers.
      - `flag-editor-modal.tsx`: accessible dialog for creating/editing flags (key immutable on edit).
      - `tester-selector-dialog.tsx`: live search & 1-click assign/remove of Discord testers.
      - `flag-audit-drawer.tsx`: chronological audit history with diff visualizer.
      - `devboard-view.tsx`: master interactive client orchestrator with optimistic state updates.
   - Added `[⚡ DEVBOARD]` header navigation link in `features/auth/presentation/auth-nav.tsx` for `DEV` users.
   - Added presentation test suite `devboard-view.test.tsx` (2 tests, 100% green).
- **Documentation (`docs/feature-flags/` & `docs/feature-flag/`):**
   - Created comprehensive documentation in `docs/feature-flags/README.md` and mirrored to `docs/feature-flag/README.md` per Rule §9.4.
- **DevBoard Tabular Data Grid & Status Refinements (Session 106):**
   - Redesigned `features/feature-flags/presentation/devboard-header.tsx`:
      - Top filter cluster: `All [count]`, `🟢 Active Global [count]`, `◆ Targeted Beta [count]`, and `✖ Killed/Dormant [count]`. Removed `Draft` tab and divider.
      - Primary CTA: solid white `+ New Flag` button with active scale feedback.
      - Sub-bar: `Filter flags...` search input and `Sort: Updated ⌵` dropdown (removed `Show draft only` checkbox).
   - Created pure domain helper `features/feature-flags/domain/relative-time.ts` with Vitest unit tests (`relative-time.test.ts`).
   - Created `features/feature-flags/presentation/flag-table.tsx`:
      - Clean dark table container with selection checkboxes (`[ ]`).
      - Columns: `KEY & DESCRIPTION` (monospace key + 1-click copy + description), `ENVIRONMENT STATUS` (normal clean text without colored pill borders: `Global`, `Targeted`, `Off`), `ROLLOUT` (segmented control `[ Disabled | Targeted | Global ]`), `TARGETING` (`👥 X testers` trigger button), `LAST MODIFIED` (`Updated 2h ago • by Afnan`), and `•••` action menu.
   - Updated `features/feature-flags/presentation/devboard-view.tsx` orchestrating table selection, sorting, status filtering, and modal triggers.
   - Updated presentation tests `devboard-view.test.tsx` verifying column headers, text statuses, and filters.
- **Quality Gates Verified:**
   - `npm run typecheck` passed (0 errors).
   - `npm run test` passed (99 test files, 1075/1075 tests green).
   - `npm run build` passed (12 routes compiled cleanly, `/devboard` size 10.9 kB).
- **NEXT STEP (completed in Session 108):** Gate the Challenge Wrapped experience behind the `challenge_wrapped_v1` feature flag.

### Session 108 — 2026-10-15 (Leaderboard Domain Type Boundary)

- **Scope:** Resolved issue #35 by moving scoreboard view-model contracts out of the Prisma/Next cache repository.
- **Architecture:** Added `features/leaderboard/domain/leaderboard.types.ts` for `ChallengeScoreboardViewModel` and its related scoreboard contracts. Updated the leaderboard data repository, domain modules, presentation components, and tests to import types inward from the domain layer.
- **Boundary Check:** No `features/**/domain/**` file imports types from `features/leaderboard/data/leaderboard-data.ts`. Repository payload types remain in the data layer. No scoreboard calculations or adjacent issue #34 behavior changed.
- **Quality Gates:** `npm run typecheck` passed; focused leaderboard/wrapped/participant-stats tests passed (20 files, 204 tests); `npm run test` passed (100 files, 1076 tests); `npm run build` passed (12 routes).
- **NEXT STEP:** Restore remaining deleted P0 UIs: host pardon modal (`FEAT-PUN-04`) and Punishment Wall (`FEAT-PUN-02`).

### Session 109 — 2026-10-15 (Challenge Wrapped Gated Behind `challenge_wrapped_v1` Feature Flag)

- **Scope:** Put the entire Challenge Wrapped experience behind the self-hosted feature-flag engine so it can be dark-launched or killed from `/devboard` without a deploy.
- **Single Source of Truth:** New `features/wrapped/api/wrapped-flag.ts` exports `WRAPPED_FEATURE_FLAG_KEY = "challenge_wrapped_v1"` and the server-only `isWrappedFeatureEnabled()` helper (delegates to `isFeatureEnabled`, fails closed).
- **Gated Surfaces:**
   - Home dashboard: `app/page.tsx` reads the flag inside the existing `Promise.all` (skipped for guests) and only fetches `getChallengeScoreboard` when enabled, so `HomeCockpitView` receives `wrappedChallenge = null` → no story popup, no Shy Card.
   - Challenge page: `app/challenge/[id]/page.tsx` folds the flag into `isSummaryVisible` (`resultsLockedAt && isWrappedEnabled`), so `?tab=summary` clamps to Overview, and passes `isWrappedEnabled` down to `ChallengeView`.
   - `challenge-view.tsx`: new optional `isWrappedEnabled` prop (defaults `true`) gates the Summary tab button, `ChallengeSummaryTab`, and `ChallengeWrappedModal`; `resolveAllowedChallengeTab` now receives `{ isSummaryVisible }` in both the state initializer and the sync effect.
   - `wrapped.actions.ts`: `markSeen` no-ops (`{ ok: true }`) and `submitChallengeFeedbackAction` returns `FEATURE_DISABLED` while the flag is off — a disabled flag is authoritative even for stale clients.
- **Deliberately Unchanged:** No Prisma schema/migration or seed change (the `FeatureFlag` row is created in the DB by the operator); `challenge-tabs.ts` untouched (availability stays dynamic via `isSummaryVisible`); `findLatestCompletedChallengeForWrapped` untouched (repository stays flag-free per Law L7).
- **Docs:** Added §6.1 Flag Registry + operator notes for `challenge_wrapped_v1` to `docs/feature-flags/README.md` and mirror `docs/feature-flag/README.md`; logged in `CHANGELOG.md` (2026-10-15).
- **Tests:** New `features/wrapped/api/wrapped-flag.test.ts` (3) plus flag-off/flag-on coverage in `wrapped.actions.test.ts` (3), `challenge-view.test.tsx` (3), `app/challenge/[id]/page.test.tsx` (2) and `app/page.test.tsx` (2).
- **Quality Gates Verified:**
   - `npm run typecheck` passed (0 errors).
   - `npm run test` passed (101 test files, 1089/1089 tests green).
   - `npm run build` passed (12 routes compiled cleanly).
- **NEXT STEP:** Create the `challenge_wrapped_v1` row in the target DB via `/devboard` (`isEnabled = true` + `rolloutMode = TARGETED` for testers, then `GLOBAL`), then restore the remaining deleted P0 UIs: host pardon modal (`FEAT-PUN-04`) and Punishment Wall (`FEAT-PUN-02`).

### Session 109 — 2026-10-15 (Participant Preview Mode Admin/Host Leak Fix)

- **Scope:** Resolved `ISSUES.md` #47 — "Preview as Participant" still rendered admin-side controls because three paths re-derived admin/host status from the raw session instead of the preview-aware `getEffectiveAdminState()`.
- **Finding A (host re-grant):** `GetChallengeParticipantStatsOptions` gained `isPreviewActive`; `participant-stats.repository.ts` now computes `isEffectiveAdmin = isAdmin || (isHost && !isPreviewActive)`. `app/challenge/[id]/participant/[participantId]/page.tsx` forwards `isPreviewActive` from `getEffectiveAdminState`, so a previewing host no longer sees **Admin Controls** / **Edit Target** / the target-override modal.
- **Finding B (raw session in header):** `app/page.tsx` now passes `user={effectiveUser}` (role downgraded to `PARTICIPANT`) to `AppHeader` instead of the raw `session.user`.
- **Finding C (DevBoard link):** `auth-nav.tsx` gates the DevBoard nav link with `&& !(isPreviewActive ?? false)`, matching the preview-aware DEV badge.
- **Finding D (admin routes):** `app/admin/layout.tsx` and `app/devboard/layout.tsx` read the preview cookie and `redirect("/")` while preview is active.
- **Tests:** New `features/auth/domain/preview-mode.test.ts` (8 tests; also closes `ISSUES.md` #19) plus preview regression cases in `participant-stats.repository.test.ts`, `app/challenge/[id]/participant/[participantId]/page.test.tsx`, `auth-nav.test.tsx`, and `app/page.test.tsx`.
- **Quality Gates Verified:**
   - `npm run typecheck` passed (0 errors).
   - `npm run test` passed (102 test files, 1102/1102 tests green).
   - `npm run build` passed (12 routes compiled cleanly).
- **NEXT STEP (unchanged from Session 108):** Create the `challenge_wrapped_v1` row in the target DB via `/devboard` (`isEnabled = true` + `rolloutMode = TARGETED` for testers, then `GLOBAL`), then restore the remaining deleted P0 UIs: host pardon modal (`FEAT-PUN-04`) and Punishment Wall (`FEAT-PUN-02`).

### Session 111 — 2026-10-16 (PR #111 Context Menu Alignment, Touch/Keyboard Selection & Design Token Fixes)

- **Agent Role:** Participant UI Agent, Scoring & Engine Agent.
- **Scope & Problem Analysis (KAN-18 / GitHub #100 / PR #111):**
   - Collaborator `@HyperAfnan` reported that PR #111 was giving issues and held off merging.
   - **Root Cause 1 (Mid-Air Orphaned Context Menus):** With `<ContextMenu modal={false}>`, Radix UI positions the menu at a virtual point `(clientX, clientY)`. Without external scroll or window resize dismissal listeners, scrolling the page or resizing the window left the context menu floating in mid-air at the old screen coordinates, detached from the task/category.
   - **Root Cause 2 (Touchscreen & Keyboard Selection Failure):** All items in `cockpit-task-menu.tsx` only had `onClick`. Radix `ContextMenuItem` and `DropdownMenuItem` unmount on `pointerup`, canceling synthetic `click` events on mobile browsers. For keyboard users (Enter/Space), Radix fires `onSelect`, not `onClick`.
   - **Root Cause 3 (Design Token Regression):** `components/ui/dropdown-menu.tsx` was reverted to generic shadcn tokens (`bg-popover`, `text-popover-foreground`, `focus:bg-accent`, etc.) instead of the ratified Obsidian Dark tokens.
- **Implementation & Resolution:**
   - **`components/ui/context-menu.tsx`:** Added captured passive `scroll` and `resize` event listeners in `ContextMenuContent`. When any external container or the window scrolls, or when the window resizes, the menu cleanly self-dismisses via an Escape keydown dispatch. Added `collisionPadding={8}` to prevent edge clipping.
   - **`components/ui/dropdown-menu.tsx`:** Fully harmonized with Obsidian Dark design tokens (`bg-[#222222]`, `border-[#383838]`, `rounded-xl`, `p-1.5`, `text-[#f4f3f6]`, `focus:bg-[#333333] focus:text-[#ffffff]`, `collisionPadding={8}`).
   - **`features/study-logs/presentation/cockpit/cockpit-task-menu.tsx`:** Added both `onSelect` and `onClick` handlers across all items in `TaskMenuItems` and `CategoryMenuItems`, ensuring reliable execution on mouse, touchscreen, and keyboard interactions.
   - **Data & Test Restorations:** Re-exported required scoreboard types in `features/leaderboard/data/leaderboard-data.ts`; updated mock parameters in `app/challenge/[id]/page.test.tsx` and `challenge-manage-tab.test.tsx`.
   - **Test Coverage:** Added `components/ui/context-menu.test.tsx` (2 tests) and added selection callback verification tests to `cockpit-task-menu.test.tsx` (7 tests).
- **Quality Gates Verified:**
   - `npm run typecheck` passed (0 errors).
   - `npm run test` passed (104 test files, 1110/1110 tests green).
   - `npm run build` passed (12 routes compiled cleanly).
- **NEXT STEP:** Push `krish` branch to remote for collaborator review and merge PR #111.

### Session 112 — 2026-10-16 (Fix: Daily Study History Cumulative Hours on Upcoming Days — GitHub #118)

- **Agent Role:** Scoring & Engine Agent, Participant UI Agent.
- **Scope & Problem Analysis (GitHub #118):**
   - Collaborator `@HyperAfnan` reported that the Daily Study History table continues to display running cumulative study totals (e.g. `53:57:45`) for challenge days marked with the status `Upcoming`.
   - **Root Cause:** In `features/participant-stats/domain/participant-stats.ts` (`calculateParticipantDailyTimeline`), the loop iterated over all challenge `dayOptions` without checking whether a day was in the future (`isFuture: true`). Even though future days had zero study logs, `cumulativeSeconds` retained the cumulative sum achieved up to the present day and assigned it to every upcoming day row, which was subsequently displayed unconditionally in `ParticipantDailyHistory` (desktop table & mobile cards) and `ParticipantProgressChart` tooltips.
- **Implementation & Resolution:**
   - **`features/participant-stats/domain/participant-stats.ts`:**
      - Updated `calculateParticipantDailyTimeline` so that `cumulativeSeconds` only increments when `!day.isFuture`.
      - For future days (`day.isFuture === true`), `cumulativeSeconds` defaults to `0`, and both `cumulativeClock` and `cumulativeHuman` are set to `"—"`.
   - **`features/participant-stats/presentation/participant-daily-history.tsx`:**
      - Added defensive checks in both the mobile cards view and the desktop table view: `day.isFuture ? "—" : day.cumulativeClock`.
   - **`features/participant-stats/presentation/participant-progress-chart.tsx`:**
      - Updated hover tooltip to display `"Upcoming Day"` instead of misleading cumulative times when hovering future chart bars.
   - **Test Coverage:**
      - Added unit test in `features/participant-stats/domain/participant-stats.test.ts` verifying that future days (`isFuture: true`) set `cumulativeSeconds = 0`, `cumulativeClock = "—"`, and `cumulativeHuman = "—"`.
      - Added view test in `features/participant-stats/presentation/participant-stats-view.test.tsx` verifying that upcoming days render em-dash (`—`) in the rendered markup.
- **Quality Gates Verified:**
   - `npm run typecheck` passed (0 errors).
   - `npm run test` passed (105 test files, 1125/1125 tests green).
   - `npm run build` passed (12 routes compiled cleanly).
- **NEXT STEP (completed in Session 113):** Dynamic challenge description and timetable repositioning (KAN-8 / GitHub #90).

### Session 113 — 2026-10-16 (Dynamic Challenge Description & Timetable Layout Adjustment — KAN-8 / GitHub #90)

- **Agent Role:** Data & Identity Agent, Scoring & Engine Agent, Participant UI Agent, Admin Operations & Broadcaster Agent.
- **Scope & Problem Analysis (KAN-8 / GitHub #90):**
   - Collaborator `@HyperAfnan` requested adding a `description` field to `Challenge` in the challenge table to make the "Welcome to the [Title]!" container dynamic instead of static.
   - User requirement: Fallback seamlessly to the current boilerplate paragraph so older/legacy challenges without a description do not break. Pre-fill the default paragraph in the challenge creation modal/wizard with an editable textarea field. Also allow editing in the Manage tab. Move the `Timetable (UTC)` component lower so the overview reads naturally.
- **Implementation & Resolution:**
   - **Database & Prisma Migration:**
      - Added `description String? @db.Text` to `model Challenge` in `prisma/schema.prisma`.
      - Generated and applied declarative migration `prisma/migrations/20261016000000_add_description_to_challenge/migration.sql`.
      - Documented in `prisma/migrations/README.md`.
      - Successfully ran `npx prisma migrate deploy` and `npx prisma generate`.
   - **Domain & Repository Layer:**
      - Updated `ChallengeCreationInput` (`challenge-lifecycle.ts`) to accept `description?: string | null`.
      - Updated `ExistingEventState` and `IncomingEventInput` in `event-audit-diff.ts` to log description modifications to the audit trail.
      - Updated `createAdminChallenge`, `UpdateAdminChallengeInput`, and `updateAdminChallenge` in `challenge-admin.repository.ts` to persist `description`.
      - Updated `createChallengeSchema` and `updateChallengeSchema` in `challenge-admin.actions.ts` with optional string validation.
      - Updated `ChallengeScoreboardViewModel` in `leaderboard.types.ts` and `buildScoreboardViewModel` in `leaderboard-data.ts` to surface `challenge.description`.
   - **Presentation Layer:**
      - **`features/challenges/presentation/challenge-overview-tab.tsx`:**
         - Replaced hardcoded paragraphs with dynamic `challenge.description` supporting multi-line spacing (`whitespace-pre-line`).
         - Preserved exact backward compatibility: falls back to the default boilerplate paragraph when `description` is null, undefined, or empty string.
         - Repositioned `Timetable (UTC)` component lower to the bottom of the card, directly after "Prizes & Rewards".
      - **`features/challenges/presentation/challenge-creator-wizard.tsx`:**
         - Added `DEFAULT_CHALLENGE_DESCRIPTION` constant and editable textarea input in Step 2 right below `Challenge Title`.
         - Passed `description` payload to `createChallengeAction`.
      - **`features/challenges/presentation/challenge-manage-tab.tsx`:**
         - Added editable `description` textarea input in Section 1 ("Challenge Details & Timetable") with full form hydration and reset on cancel.
         - Passed `description` payload to `updateChallengeAction`.
   - **Test Coverage:**
      - Unit tests for fallback and custom description rendering in `challenge-overview-tab.test.tsx`.
      - Event audit diff tests for description field changes in `event-audit-diff.test.ts`.
      - Repository tests for challenge creation and updates with description in `challenge-admin.repository.test.ts`.
      - Server action tests for description validation in `challenge-admin.actions.test.ts`.
      - Updated mock models in catalog tests (`app/challenges/page.test.tsx`, `challenges-list-view.test.tsx`).
- **Quality Gates Verified:**
   - `npm run typecheck` passed (0 errors).
   - `npm run test` passed (105 test files, 1131/1131 tests green).
   - `npm run build` passed (12 routes compiled cleanly).
- **NEXT STEP:** Commit and push branch updates to `krish` for collaborator review and merge.
