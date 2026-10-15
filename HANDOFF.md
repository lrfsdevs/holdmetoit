# HANDOFF.md — Engineering Operational Relay & Milestone Tracker

> **Project:** HoldMeToIt (Gamified Study Accountability & Challenge Management Platform)  
> **Repository:** `github.com/Afnanpathan2004/holdmetoit`  
> **Integration Branch:** `main` (latest: `c174a58`, PR #12) · Personal branches: `krish`, `afnan`, `afnan-jr`, `dev`  
> **Document Status:** Active Operational Relay (Living Document)  
> **Last Updated:** 2026-10-15 (Session 108 — Challenge Wrapped Feature Flag on `afnan-jr`)  
> **Governance:** Subject to strict **Handoff Pruning & Obsolescence Rule (§9.3 in `AGENTS.md`)**

---

## 1. Current State at a Glance

| Gate                                                         | Result (2026-10-16 — Session 114: Phase 4 — Pokémon Acquisition, Gacha, Pity, Progression & Economy Integrity on `afnan`)                                                                                                                                                                    |
| :----------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                          | ✅ 0 errors (`npx prisma generate && tsc --noEmit`)                                                                                                                                                                                                                                          |
| `npm run test`                                               | ✅ 136 files green (1325/1325 tests passing, 100% green across all modules)                                                                                                                                                                                                                  |
| `npm run build`                                              | ✅ 16 routes compiled (production build clean including `/pokemon`, `/pokedex`, `/wallet`, `/devboard`)                                                                                                                                                                                      |
| Phase 1 (Economy Foundation)                                 | ✅ 100% Shipped & Verified: Wallets, immutable append-only ledger, study rewards (100 coins/hr with fractional carry), available vs. reserved balance tracking                                                                                                                               |
| Phase 2 (YPT, Challenge Economy, & Betting)                  | ✅ 100% Shipped & Verified: YPT webhook ingest & account linking, incremental study rewards, challenge reward settlement on lock, virtual-coin betting on Solo/Duo/Team challenges with atomic stake reservation and idempotent settlement                                                   |
| Phase 2A (Pokémon Metadata Bundle Importer)                  | ✅ 100% Shipped & Verified: Tri-format inspection (CSV/JSON/SQLite, 1351 rows, 0 mismatches), JSON canonical importer with `--dry-run`, 1025 canonical species, 326 alternate forms consolidated into species metadata, Gen 1–9 & classification filters                                     |
| Phase 3 (Pokémon Catalogue, Collection & Progression Found.) | ✅ 100% Shipped & Verified: Normalized schema (`PokemonSpecies`, `UserPokemon`), 6-tier rarity hierarchy, pure domain progress engine, Pokédex catalogue & collection views at `/pokemon`, detail modal, idempotent seeding script, spectator support                                        |
| Phase 4 (Pokémon Acquisition, Gacha & Economy Integrity)     | ✅ 100% Shipped & Verified: Elimination of arbitrary manual adjustments, authoritative deduplicated study hours (capped at 86.4ks/day), 500h/1000h hidden lifetime progression gates, CSPRNG acquisition engine, pity lock preservation, atomic transactions, 3-stage cinematic reveal modal |

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
| `/wallet`                                     | Virtual currency wallet, ledger history, reconciliation audit & coin balances                                                                              | Authenticated / Participant            |
| `/pokemon`                                    | Pokédex catalogue, personal study-backed companion collection, species detail modal, progress metrics                                                      | Public spectator / Participant         |
| `/pokedex`                                    | Public alias and permanent redirect to `/pokemon`                                                                                                          | Public spectator / Participant         |
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

### Sessions 89–103 (Summarized; includes late 82/83 addenda)

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

### Session 104 — 2026-10-14 (Removal of Discord Summary Feature)

- **Agent Role:** Admin Operations & Broadcaster Agent, Scoring & Engine Agent.
- **Scope & Objectives:** Fully remove the Discord Summary feature (`FEAT-DISC-01`), eliminating dead domain code, test suites, and documentation references.
- **Code & Test Removals:**
   - Deleted `features/notifications/domain/discord-summary.ts` and `features/notifications/domain/discord-summary.test.ts`.
   - Removed empty directory `features/notifications/`.
   - Updated E2E Quality Matrix test `features/e2e/quality-matrix-j1-j6.test.ts`: removed `generateDiscordSummary` import and Step 3 assertion from Journey J6. J6 now focuses cleanly on Event Lock and Three-Condition Auto-Punishment evaluation.
- **Documentation Alignments:**
   - Updated `AGENTS.md`: removed `features/notifications/` and Discord summary copy step from J6 Mermaid diagram and specification.
   - Updated `FEATURES.md`: marked `FEAT-DISC-01` as removed (superseded by Challenge Summary tab and personal Wrapped dialog).
   - Updated `README.md`, `ROADMAP.md`, `ISSUES.md`: removed Discord summary generator references and resolved Defect D3 Discord summary debt.
- **Quality Gates Verified:**
   - `npm run typecheck` passed (0 errors).
   - `npm run test` passed (92 test files, 1024/1024 tests green).
   - `npm run build` passed (11 routes compiled cleanly).
- **NEXT STEP (completed in Session 105):** Participant Leave Budget Feature & Elimination of Legacy DailyStudyLog V1.

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

### Session 106 — 2026-10-14 (DevBoard & Lightweight Self-Hosted Feature Flags System)

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

### Session 107 — 2026-10-15 (Leaderboard Domain Type Boundary)

- **Scope:** Resolved issue #35 by moving scoreboard view-model contracts out of the Prisma/Next cache repository.
- **Architecture:** Added `features/leaderboard/domain/leaderboard.types.ts` for `ChallengeScoreboardViewModel` and its related scoreboard contracts. Updated the leaderboard data repository, domain modules, presentation components, and tests to import types inward from the domain layer.
- **Boundary Check:** No `features/**/domain/**` file imports types from `features/leaderboard/data/leaderboard-data.ts`. Repository payload types remain in the data layer. No scoreboard calculations or adjacent issue #34 behavior changed.
- **Quality Gates:** `npm run typecheck` passed; focused leaderboard/wrapped/participant-stats tests passed (20 files, 204 tests); `npm run test` passed (100 files, 1076 tests); `npm run build` passed (12 routes).
- **NEXT STEP:** Restore remaining deleted P0 UIs: host pardon modal (`FEAT-PUN-04`) and Punishment Wall (`FEAT-PUN-02`).

### Session 108 — 2026-10-15 (Challenge Wrapped Gated Behind `challenge_wrapped_v1` Feature Flag)

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
- **NEXT STEP (completed in Session 109):** Implemented Phase 1 Virtual Economy Foundation.

### Session 109 — 2026-10-15 (Phase 1 — Economy Foundation on `afnan`)

- **Scope:** Implemented the complete Phase 1 HoldMeToIt Virtual Economy Foundation: user wallets, append-only transaction ledger, 100 coins/hr proportional rewards with fractional progress preservation, idempotent study logging, available vs reserved funds accounting, live reconciliation audit, and responsive Obsidian dark cockpit.
- **Database Architecture (`prisma/schema.prisma` & migration `20261016000000_create_economy_models`):**
   - `Wallet`: 1-to-1 with `User`, tracking `balance` (total held coins), `reservedBalance` (committed), `lifetimeEarned`, `lifetimeSpent`, and `rewardProgress` (accumulated eligible seconds modulo 36).
   - `LedgerTransaction`: Append-only immutable ledger with signed amounts (`+` credit, `-` debit), `balanceDelta`, `reservedDelta`, `TransactionType` (STUDY_REWARD, CHALLENGE_REWARD, WAGER_RESERVATION, WAGER_SETTLEMENT, WAGER_REFUND, GACHA_PURCHASE, TRADE_RESERVATION, TRADE_SETTLEMENT, TRADE_REFUND, ADMIN_ADJUSTMENT, REVERSAL), and unique `idempotencyKey`.
   - `StudyRewardRecord`: Exactly-once tracking with unique compound index `@@unique([sourceType, studySessionId])` and status tracking.
- **Domain Logic (Law L7 Pure Isolation):**
   - `features/economy/domain/economy-constants.ts`: Base rates (100 coins/hr, 36s/coin).
   - `features/economy/domain/reward-calculation.ts`: Exact integer arithmetic $Q = \lfloor (P + S) / 36 \rfloor, P_{\text{next}} = (P + S) \pmod{36}$.
   - `features/economy/domain/wallet-accounting.ts`: Pure accounting transitions enforcing $\text{availableBalance} = \text{totalBalance} - \text{reservedBalance} \ge 0$.
   - `features/economy/domain/reconciliation.ts`: Audit verification comparing stored wallet totals against ledger delta sums.
- **Data & API Layer (`features/economy/data/` & `features/economy/api/`):**
   - `wallet.repository.ts`: Serializable Prisma transactions (`TransactionIsolationLevel.Serializable`) with retry loop for P2034 write conflicts.
   - `study-reward.service.ts`: Server-authoritative session evaluation and idempotency verification.
   - `wallet.actions.ts`: Authenticated server actions for summary, paginated history, admin adjustments, reconciliation audit, and reversals.
   - `log-study-time.actions.ts`: Non-blocking, fail-safe trigger integration into study time logging.
- **Presentation & Routes (`app/wallet/` & `features/economy/presentation/`):**
   - `/wallet` route (Page, loading skeleton, error recovery boundary per Law L9).
   - `wallet-summary-card.tsx`: Metric cards, fractional progress bar.
   - `transaction-history-table.tsx`: Desktop table + mobile card layout (<640px) with category filter tabs and pagination.
   - `admin-adjustment-dialog.tsx`: Native dialog for authorized adjustments.
   - `reconciliation-dialog.tsx`: Native dialog rendering live discrepancy audits.
   - Header coin badge in `features/economy/presentation/header-coin-badge.tsx` and `/wallet` navigation link in `auth-nav.tsx`.
   - Projected coin reward preview in `DailyHoursModal`.
- **Quality Gates Verified:**
   - `npm run typecheck` passed (0 errors).
   - `npm run test` passed (110 test files, 1150/1150 tests green, 60 new tests).
   - `npm run lint` passed (0 errors in new economy code).
   - `npm run build` passed (13 routes compiled cleanly, `/wallet` size 8.33 kB).
- **Documentation:** Created comprehensive `docs/economy/README.md`.
- **NEXT STEP (completed in Session 110):** Implemented Phase 3 Pokémon Catalogue, Collection & Progression Foundation.

### Session 110 — 2026-10-15 (Phase 3 — Pokémon Catalogue, Collection & Progression Foundation on `afnan`)

- **Scope:** Established the normalized Pokémon species catalogue, user collection management, 6-tier rarity system, Pokédex completion progress engine, Obsidian dark presentation views at `/pokemon` (with `/pokedex` redirect), idempotent seeding mechanism, and server-side authorization controls.
- **Database Architecture (`prisma/schema.prisma` & migration `20261018000000_phase3_pokemon_catalogue_and_collection`):**
   - `PokemonRarity`: Enum (`NORMAL`, `UNCOMMON`, `RARE`, `EPIC`, `LEGENDARY`, `MYTHICAL`).
   - `PokemonAcquisitionSource`: Enum (`STARTER`, `STUDY_REWARD`, `ACHIEVEMENT`, `GACHA`, `EVENT`, `ADMIN_GRANT`).
   - `PokemonSpecies`: Global catalogue entry (`pokedexNumber` UK, `name`, `slug` UK, `rarity`, `primaryType`, `secondaryType`, `description`, `classification`, `imageUrl`, `spriteUrl`, `baseHp`, `baseAttack`, `baseDefense`, `generation`, `isAvailable`, `referenceUrl`).
   - `UserPokemon`: Owned participant instance (`userId` FK -> `User` with Cascade, `speciesId` FK -> `PokemonSpecies` with `onDelete: Restrict`, `obtainedAt`, `source`, `sourceReferenceId`, `idempotencyKey` UK, `nickname`, `isFavorite`, `metadata`). Foreign key constraint `onDelete: Restrict` prevents accidental cascade deletion of user collections.
- **Domain Layer (Law L7 Pure Isolation):**
   - `features/pokemon/domain/pokemon-rarity.ts`: Rarity hierarchy, visual star ratings (1★ to 6★), indicative planning costs (Normal 10k, Uncommon 50k, Rare 100k, Epic 250k, Legendary 500k, Mythical 1M), custom sort comparator (`compareRarity`), and validators.
   - `features/pokemon/domain/pokemon-types.ts`: All 18 official elemental types with color tokens, badges, and validation.
   - `features/pokemon/domain/collection-progress.ts`: Pure mathematics for completion percentage: $(uniqueOwned / totalAvailable) \times 100$, denominator safety (only available species count), division-by-zero protection, and mastery tiers (Novice, Collector, Master, Champion).
   - `features/pokemon/domain/pokemon.schema.ts`: Zod validation schemas for catalogue listing, collection filtering, and admin upsert.
- **Data & API Repositories (`features/pokemon/data/` & `features/pokemon/api/`):**
   - `pokemon-catalogue.repository.ts`: Catalogue queries with case-insensitive search, rarity/type filtering, stable sorting, and admin upsert.
   - `user-pokemon.repository.ts`: Isolated collection queries scoped strictly by `userId`, collection summary metrics with duplicate count mapping, and server-internal idempotent `grantUserPokemon` operation.
   - `pokemon.actions.ts`: Server Actions supporting spectator access for catalogue and species detail, session-authenticated collection retrieval, and `requireAdminUser()` gated catalogue administration.
- **Catalogue Seeding & Data Quality (`prisma/seed-pokemon.ts`):**
   - Idempotent upsert script (`npm run db:seed:pokemon`) populating 23 canonical Pokémon across Generations 1–4 referencing official Pokédex metadata (https://www.pokemon.com/us/pokedex).
   - Integrated into root `prisma/seed.ts` runner.
- **Presentation & Routes (`app/pokemon/`, `app/pokedex/`, & `features/pokemon/presentation/`):**
   - `/pokemon`: Server component rendering `PokemonView` with initial catalogue and summary.
   - `/pokedex`: Permanent redirect to `/pokemon`.
   - `PokemonProgressHeader`: Progress gauge, completion percentage, species/total counters, and spectator login guidance.
   - `PokemonFilterBar`: Tab switcher (Catalogue vs Collection), search input, rarity filter, type filter, sort selector, and filter reset.
   - `PokemonCard`: Ambient rarity glow, `#XXXX` Pokédex number, ownership badge (`xN Owned` vs `Unowned`), sprite/artwork with resilient fallback SVG Pokéball silhouette, and click-to-detail interaction.
   - `PokemonDetailModal`: Accessible modal with high-res art, rarity stars, official classification, description, base stat progress bars (HP, ATK, DEF), ownership history, and official Pokédex external reference link.
   - `AppHeader` navigation: Added "Pokédex" link with `BookOpen` icon.
- **Quality Gates Verified:**
   - `npm run typecheck` passed (0 errors).
   - `npm run test` passed (126 test files, 1257/1257 tests green, 56 new tests across domain, repo, actions, and presentation).
   - `npm run build` passed (production build clean across all routes).
- **Strict Exclusions Preserved:**
   - No Gacha pull buttons, no pity counters, no trading, no combat/battle stats, no secondary currency, no production migrations or deployments.
- **NEXT STEP:** Run `npm run db:import:pokemon -- --dry-run` to validate catalogue import or `npm run db:import:pokemon` to execute live database upsert once migration is applied.

### Session 111 — 2026-10-15 (Phase 2A — Pokémon Metadata Bundle Importer on `afnan`)

- **Scope:** Inspected, verified, and integrated the complete Pokémon metadata bundle (`pokemon_metadata.json`, `pokemon_metadata.csv`, `pokemon_metadata.sqlite`) covering Generations 1 through 9 (1,351 entries), distinguished canonical species from alternate forms, separated source lore classification from HoldMeToIt game economy rarity, implemented an idempotent CLI importer with `--dry-run`, and connected Generation and Classification filters into the Pokédex UI.
- **Triple-Format Dataset Inspection (Step 1 & Step 2):**
   - Confirmed 100% record parity across all three files: exactly 1,351 rows, 37 columns, zero field or row discrepancies.
   - Selected `pokemon_metadata.json` as canonical repeatable import format (natively parsed types/abilities, avoids native SQLite C-bindings).
   - Provenance: PokéAPI / Veekun open-source relational database dump and Pokémon Showdown battle sprites mirrored by PokéAPI on GitHub.
   - IP & Licensing: Trademarks and copyright belong to Nintendo, Creatures Inc., and GAME FREAK Inc. Non-commercial fair-use educational study gamification without redistribution. Resilient fallback SVG Pokéball silhouettes prevent external host dependency breakage.
- **Species vs. Form Distinction (Step 3):**
   - 1,025 canonical species (`is_default_form: true`, National Dex #1 to #1025).
   - 326 alternate forms (`is_default_form: false`, IDs 10001..10326) consolidated into `species.metadata.forms`.
   - Strictly prevents duplicate Pokédex entries and unique constraint collisions on `pokedexNumber`.
- **Lore vs. Game Economy Rarity Separation (Step 4):**
   - Stored source classifications (`is_legendary`, `is_mythical`, `is_baby`) as distinct boolean flags in `PokemonSpecies`.
   - HoldMeToIt Game Rarity (`PokemonRarity`) calculated via approved domain heuristic (`calculateHoldMeToItRarity` in `features/pokemon/domain/pokemon-rarity.ts`):
      - Mythical -> `MYTHICAL` (23 species, 2.2%)
      - Legendary -> `LEGENDARY` (71 species, 6.9%)
      - BST >= 540 -> `EPIC` (59 species, 5.8%)
      - 450 <= BST < 540 -> `RARE` (372 species, 36.3%)
      - 320 <= BST < 450 -> `UNCOMMON` (262 species, 25.6%)
      - BST < 320 -> `NORMAL` (238 species, 23.2%)
   - Non-negotiable: Combat stats and rarity do NOT alter study coin generation rates, challenge deficits, or betting odds.
- **Repeatable CLI Importer (`scripts/import-pokemon-bundle.ts` & `features/pokemon/data/pokemon-bundle-importer.ts`) (Step 5):**
   - Command: `npm run db:import:pokemon`
   - Flags: `--dry-run`, `--limit=<N>`, `--file=<path>`.
   - Idempotent upserts on `slug` preserving existing user collections (`UserPokemon`), wallets, wagers, and study logs.
   - Zod validation on all records against `UpsertPokemonSpeciesSchema`.
- **Pokédex Presentation Integration (Step 7):**
   - Added Generation Filter (Gen 1 to Gen 9) in `pokemon-filter-bar.tsx`.
   - Added Source Classification Quick Filter (All, Legendary, Mythical, Standard) in `pokemon-filter-bar.tsx`.
   - Added Mythical / Legendary visual badges in `PokemonCard.tsx` and `PokemonDetailModal.tsx`.
   - Added physical dimensions (Height, Weight) and alternate form variant chips in `PokemonDetailModal.tsx`.
   - Verified collection progress denominator dynamically tracks available canonical species count (1,025).
- **Quality Gates Verified:**
   - `npm run typecheck` passed (0 errors).
   - `npm run test` passed (127 test files, 1269/1269 tests green, 12 new importer tests).
   - `npm run build` passed (production build clean across all routes).
   - Dry run validated 100% of the 1,025 species with 0 rejected records.
- **Strict Data Protection (Step 9):**
   - Zero database resets, zero destructive migrations, zero touches on participant wallets, ledger transactions, or challenge records.
- **NEXT STEP:** Maintainer applies database migration `20261018000000_phase3_pokemon_catalogue_and_collection` on development database (`npx prisma migrate deploy`), then executes `npm run db:import:pokemon` to populate all 1,025 canonical species and 326 form variants into the catalogue.

### Session 112 — 2026-10-16 (Frontend Design System Audit & Token Refactoring of Economy & Pokédex on `afnan`)

- **Scope:** Frontend design system audit and token refactor strictly confined to the recently created Economy, Wallet, Betting, YPT, and Pokédex feature slices (`app/wallet/`, `app/pokemon/`, `features/economy/presentation/`, `features/pokemon/presentation/`, `features/ypt/presentation/ypt-settings-card.tsx`, `features/challenges/presentation/challenge-betting-card.tsx`, and `features/auth/presentation/auth-nav.tsx`).
- **Phase 1: Centralized Theme Tokens & CSS Custom Properties (`app/globals.css` & `tailwind.config.ts`):**
   - Extended `:root` in `app/globals.css` with semantic CSS variables:
      - `--economy-gold`, `--economy-gold-light`, `--economy-gold-dark` (amber/gold virtual currency)
      - `--economy-credit` (emerald green study earnings & win payouts)
      - `--economy-debit` (rose/red stake deductions & debits)
      - `--economy-refund` (sky blue wager refunds)
      - `--economy-admin` (purple admin adjustments & reconciliations)
      - `--pokedex-bg`, `--pokedex-card`, `--pokedex-card-subtle`, `--pokedex-inset`, `--pokedex-elevated` (mystical dark surfaces)
      - `--pokedex-border`, `--pokedex-border-subtle`, `--pokedex-border-light` (purple/slate borders)
      - `--pokedex-text`, `--pokedex-text-secondary`, `--pokedex-text-muted`, `--pokedex-text-dim` (hierarchical text)
      - `--pokedex-accent`, `--pokedex-accent-light` (rose/pink interactive highlights)
   - Extended `tailwind.config.ts` to map `economy` and `pokedex` color families using `<alpha-value>` for full Tailwind opacity modifier support (e.g., `bg-economy-gold/15`, `border-pokedex-border/60`), along with Obsidian helper tokens (`obsidian.subtle`, `obsidian.cardHover`, `obsidian.borderSubtle`, `obsidian.borderHighlight`).
- **Phase 2: shadcn/ui Component Infrastructure & Consistency (`components/ui/`):**
   - Added `components/ui/badge.tsx` with CVA variants (`default`, `secondary`, `outline`, `destructive`, `gold`, `credit`, `debit`, `admin`).
   - Added `components/ui/card.tsx` with Radix/shadcn standard primitives styled to match Obsidian tokens (`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`).
   - Extended `components/ui/button.tsx` with `gold` and `admin` semantic button variants.
- **Phase 3: Economy & Wallet Presentation Standardization:**
   - `coins-icon.tsx`: Migrated SVG fill/stroke to `hsl(var(--economy-gold))` and `hsl(var(--economy-gold-light))`.
   - `header-coin-badge.tsx`: Converted to `border-economy-gold/40 bg-economy-gold/10 text-economy-gold`.
   - `wallet-summary-card.tsx`: Replaced all hardcoded hex borders, surfaces, badges, and progress meters with Obsidian and Economy tokens.
   - `transaction-history-table.tsx`: Migrated all badge styles, credit/debit indicators, table headers, and mobile cards to semantic tokens.
   - `wallet-view.tsx`: Standardized loading and error states with tokenized styling and shadcn `Button`.
   - `admin-adjustment-dialog.tsx`: Standardized frame, inputs, and actions using `Button variant="admin"` and tokens.
   - `reconciliation-dialog.tsx`: Migrated discrepancy lists, audit info cards, and buttons to tokens.
   - `ypt-settings-card.tsx`: Replaced ad-hoc `zinc-*` classes with Obsidian tokens and shadcn `Button variant="gold"`.
   - `challenge-betting-card.tsx`: Converted form inputs to shadcn `Input`, submit actions to shadcn `Button variant="gold"`, and colors to tokens.
   - `app/wallet/page.tsx`, `loading.tsx`, `error.tsx`: Migrated all layout backgrounds and cards to Obsidian tokens.
- **Phase 4: Pokédex Presentation Standardization:**
   - `pokemon-progress-header.tsx`: Converted to `pokedex-*` surfaces, text, and `economy-gold` tokens.
   - `pokemon-filter-bar.tsx`: Converted tab switcher, search input, and selects to `pokedex-*` tokens.
   - `pokemon-card.tsx`: Replaced all hardcoded dark purple hex values (`#2d2544`, `#100d1a`, `#221c33`, `#382f54`, `#9f9ba8`, `#757082`, `#141021`) with `pokedex-*` tokens; zero hardcoded hex colors remaining.
   - `pokemon-detail-modal.tsx`: Replaced modal gradient, borders, stat bar tracks, dimension cards, variant chips, and external link styling with `pokedex-*` tokens; zero hardcoded hex colors remaining.
   - `pokemon-view.tsx`: Standardized empty state with `pokedex-*` tokens.
   - `app/pokemon/page.tsx`: Standardized page container with `bg-obsidian-bg text-obsidian-text`.
   - `auth-nav.tsx`: Converted wallet coin icon to `text-economy-gold`.
- **Quality Gates Verified:**
   - `npm run typecheck` passed (0 errors).
   - `npm run lint` passed (0 errors).
   - `npm run test` passed (127 test files, 1269/1269 tests green).
   - `npm run build` passed (production build clean across all 16 routes).
- **Strict Exclusions Preserved:**
   - No changes to UI outside the economy and Pokédex scopes.
   - No database resets, migrations, or schema modifications.
   - No commits or pushes without explicit user instruction.
- **NEXT STEP:** Maintainer applies database migrations on development database (`npx prisma migrate deploy`), runs `npm run db:import:pokemon` to populate the catalogue, and creates/activates promotional banners via Admin Console.

### Session 113 — 2026-10-16 (Phase 4: Pokémon Acquisition, Gacha, Pity System & Cinematic Reveal on `afnan`)

- **Scope:** Implementation of Phase 4 — server-authoritative Pokémon acquisition, configurable banners, pity engine, atomic coin ledger integration, duplicate tracking, cursor-paginated acquisition history, administrative controls, and 3-stage cinematic reveal modal.
- **Database & Prisma Architecture (`prisma/schema.prisma`):**
   - Added `enum PokemonBannerStatus { DRAFT, ACTIVE, PAUSED, ENDED, DISABLED }`.
   - Added `model PokemonBanner`: ID, name, slug, description, bannerType, status, startAt, endAt, pullCost, allowedQuantities, version, featuredSpeciesId, rarityRates (basis points JSON), poolFilter, pityConfig, duplicatePolicy, audit timestamps.
   - Added `model UserBannerPity`: composite key `@@unique([userId, bannerId])`, pityCount, guaranteedFeatured (50/50 rule), lastPulledAt.
   - Added `model PokemonAcquisition`: unique acquisition ID, userId, bannerId, bannerVersion, speciesId, gameplayRarity, isFeatured, pullCost, ledgerTxId (foreign key to `LedgerTransaction`), pityCountBefore, pityCountAfter, pityTriggered, isDuplicate, duplicateOutcome, idempotencyKey (unique), createdAt.
   - Reverse relations wired into `User`, `PokemonSpecies`, `UserPokemon`, and `LedgerTransaction`.
   - Migration created: `prisma/migrations/20261019000000_phase4_pokemon_acquisition_and_pity/migration.sql`.
- **Pure Domain Engine (`features/pokemon/domain/acquisition/`):**
   - `banner-config.ts`: Configuration assertion enforcing basis points summing to 10,000 (100.00%), positive pull costs, active time windows, and valid duplicate policies.
   - `pity-engine.ts`: `evaluatePity` and `calculateNextPityState` evaluating hard-pity threshold guarantees, natural reset rarities, and 50/50 featured guarantee transitions.
   - `pokemon-selector.ts`: Cryptographically secure random selection (`crypto.randomInt`) with injectable `RandomSource` for deterministic testing.
- **Data & Transaction Safety (`features/pokemon/data/`):**
   - `acquisition.repository.ts`: `executePokemonAcquisition` running inside serializable database transactions ($transaction) with retry loop on P2034 conflicts. Atomic sequence: checks available balance (`totalBalance - reservedBalance >= pullCost`), reserves/debits coins via `applyDebit`, inserts `LedgerTransaction` (`type: "GACHA_PURCHASE"`), creates `UserPokemon` record (`source: "GACHA"`, `isDuplicate: true/false`), upserts `UserBannerPity`, and logs `PokemonAcquisition`.
   - `acquisition-history.repository.ts`: `getUserAcquisitionHistory` with cursor pagination, total counts, and strict participant isolation.
- **API & Server Actions (`features/pokemon/api/acquisition.actions.ts`):**
   - `listActiveBannersAction` and `getBannerDetailAction` for public discovery.
   - `getUserBannerPityAction`, `pullPokemonAction`, `getUserAcquisitionHistoryAction` with strict Discord session authentication.
   - `adminListAllBannersAction`, `adminCreateBannerAction`, `adminUpdateBannerAction`, `adminSetBannerStatusAction` strictly protected by `requireAdminUser()`.
- **Presentation & Cinematic Reveal UI (`features/pokemon/presentation/`):**
   - `pokemon-reveal-modal.tsx`: 3-stage visual sequence (Stage A/B Anticipation Pokéball energy burst -> Stage C Flash Burst -> Stage D/E Result Details with Pokédex #, typing, rarity aura, and coin summary). Accessible visible "Skip Reveal" button (`data-testid="skip-reveal-button"`), `prefers-reduced-motion` compliance, escape key handler, and fallback SVG Pokéball for missing artwork.
   - `banner-card.tsx`: Banner showcase with featured companion pill, pity meter, probability breakdown dropdown, loading state, and client-generated idempotency key.
   - `acquisition-history-modal.tsx`: Cursor-paginated history modal showing all past summons with copyable acquisition IDs.
   - `admin-banner-modal.tsx`: Dedicated host portal to create draft banners and toggle banner statuses.
   - `pokemon-filter-bar.tsx` & `pokemon-view.tsx`: Seamless "Summon Portal" tab switcher, auto-hiding catalogue filters, and real-time balance and collection state updates upon successful pulls.
   - `app/pokemon/page.tsx`: Server page concurrently preloading active banners, user wallet balance, and user pity states.
- **Verification & Quality Gates (100% Green):**
   - `npm run typecheck`: 0 errors (`prisma generate && tsc --noEmit`).
   - `npm run lint`: 0 errors.
   - `npx vitest run features/pokemon`: 17 test files, 107/107 tests passing.
   - `npm test`: 134 test files, 1,308/1,308 tests passing.
   - `npm run build`: 16/16 routes compiled successfully without hydration errors or missing types.
- **Migration Deployment & Operational Scripts:**
   - Added `npm run db:migrate` and `npm run db:migrate:status` to `package.json` with `.env.local` bindings.
   - Successfully deployed migration `20261019000000_phase4_pokemon_acquisition_and_pity` to the Supabase database. Schema is fully up to date (`PokemonBanner`, `UserBannerPity`, `PokemonAcquisition` created).
- **NEXT STEP:** Maintainer or admin navigates to `/pokemon` to view the sealed summon portal empty state, opens Admin Banner Manager to create and configure banners (or activate draft banners), and pulls companions with study coins.

### Session 114 — 2026-10-16 (Phase 4: Pokémon Acquisition, Gacha, Pity, Progression & Economy Integrity on `afnan`)

- **Scope:** Complete audit and enforcement of Phase 4 progression and economy integrity: elimination of arbitrary manual study-hour adjustments, establishment of authoritative deduplicated study hours, enforcement of 500h (Legendary) and 1,000h (Mythical) hidden lifetime progression gates across all gacha selection and pity pathways, mathematical probability redistribution, auditable technical corrections, and full E2E quality matrix verification.
- **Key Changes Implemented:**
   - **Elimination of Arbitrary Manual Adjustments (Section 4 & 6):**
      - `features/study-logs/data/admin-override.repository.ts`: Explicitly removed arbitrary overall hours reset (`executeAdminResetOverallHours` throws policy violation error).
      - Restricted `executeAdminHoursOverride` strictly to existing validated study sessions (`prisma.dailyStudyLog.findUnique`); throws if no session exists for that calendar date; requires minimum 10-character technical audit reason; logs `HOURS_OVERRIDE` with prior and new values.
      - `features/study-logs/api/admin-override.actions.ts`: Enforces audit reason constraint (>= 10 chars) and disables overall resets.
      - `features/study-logs/presentation/admin-hours-override-modal.tsx`: Removed overall reset UI; displays existing session notice/warning; enforces 10-character minimum explanation.
   - **Authoritative Deduplicated Study-Hour Source (Section 5):**
      - `features/study-logs/data/study-hours.repository.ts`: Implemented `getUserAuthoritativeStudySeconds` which queries `DailyStudyLog` for active (non-deleted) challenges, excludes leave days (`isLeave = false`), deduplicates across overlapping challenges per calendar date (`YYYY-MM-DD`), and strictly caps study duration at 86,400s per day.
   - **Hidden Lifetime Progression Gates (Section 7):**
      - `features/study-logs/domain/study-eligibility.ts`: Pure domain thresholds `LEGENDARY_THRESHOLD_HOURS = 500` (1,800,000s) and `MYTHICAL_THRESHOLD_HOURS = 1000` (3,600,000s). Exact boundary testing (499h locked, 500h unlocked; 999h locked, 1000h unlocked).
      - `features/pokemon/domain/acquisition/pokemon-selector.ts`: Computes effective probability redistribution (`calculateEffectiveProbabilities`) scaling base probabilities proportionally among unlocked rarities without silent substitution.
   - **Pity Engine Progression Integration (Section 11):**
      - `features/pokemon/domain/acquisition/pity-engine.ts`: Hard pity checks rarity eligibility (`isRarityEligible`). If target rarity is locked, hard pity does NOT trigger; player pity counter is safely preserved at `threshold - 1` without consuming pity pulls.
   - **Server-Authoritative Acquisition Transaction (Section 10 & 12):**
      - `features/pokemon/data/acquisition.repository.ts`: Calls `getUserAuthoritativeStudySeconds(userId, tx)`, passes authoritative study seconds into `evaluatePity` and `selectPokemon`, debits coins, logs to immutable ledger, updates `UserBannerPity`, and logs `PokemonAcquisition`.
- **Quality Gates & Verification Results:**
   - `npm test`: 136/136 test files passing, 1,325/1,325 tests passing (100% GREEN, including Journey J1–J6).
   - `npm run typecheck`: 0 errors.
   - `npm run lint`: 0 errors.
   - `npm run build`: 16/16 routes compiled successfully.
- **NEXT STEP:** Maintainer or admin navigates to `/pokemon` to test and manage banners in the staging environment.
