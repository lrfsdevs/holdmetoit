# HANDOFF.md — Engineering Operational Relay & Milestone Tracker

> **Project:** HoldMeToIt (Gamified Study Accountability & Challenge Management Platform)  
> **Repository:** `github.com/Afnanpathan2004/holdmetoit`  
> **Integration Branch:** `main` (latest: `c174a58`, PR #12) · Personal branches: `krish`, `afnan`, `afnan-jr`, `dev`  
> **Document Status:** Active Operational Relay (Living Document)  
> **Last Updated:** 2026-10-15 (Session 107 — Leaderboard Domain Type Boundary on `afnan-jr`)  
> **Governance:** Subject to strict **Handoff Pruning & Obsolescence Rule (§9.3 in `AGENTS.md`)**

---

## 1. Current State at a Glance

| Gate                                         | Result (2026-10-14, Session 106 — DevBoard & Feature Flags Engine on `afnan-jr`)                                                                                                                                                                                                   |
| :------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                          | ✅ 0 errors (`npx tsc --noEmit`)                                                                                                                                                                                                                                                   |
| `npm run test`                               | ✅ 98 files green (1069/1069 tests passing)                                                                                                                                                                                                                                        |
| `npm run build`                              | ✅ 12 routes compiled (production build clean including `/devboard`)                                                                                                                                                                                                               |
| Phase 0 feature parity (vs `FEATURES.md`)    | ⚠️ **~98%** — Wrapped modal starts at Slide 0 and stops auto-opening once seen; no loop on leaderboard navigation; feedback responses dual-persisted to DB (`ChallengeFeedback`) and Discord channel `1558594247895289877`; remaining gaps are deleted P0 UIs (wall, pardon modal) |
| Phase 0 Milestone Gate 1 (`ROADMAP.md` §3.4) | ❌ Not passed: no live pilot challenge has run; Vercel deployment not recorded in the repo                                                                                                                                                                                         |
| Phase 1 (P1)                                 | ⏸️ Not started                                                                                                                                                                                                                                                                     |

### 1.1 Live Routes

| Route                                         | Purpose                                                                                                                      | Access                                 |
| :-------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------- | :------------------------------------- |
| `/`                                           | Home cockpit: banner variants, progress/deficit card, Log Hours modal, Daily/Weekly task board                               | Guest (local tasks only) / Participant |
| `/challenges`                                 | Dedicated public challenges directory (Events card grid, role-gated Create Challenge button)                                 | Public spectator / Participant / Admin |
| `/changelog`                                  | Public date-grouped product changelog (unlinked; reachable by URL only)                                                      | Public spectator                       |
| `/challenge/[id]`                             | Tabs: Overview (includes Timetable & Forfeit Avatar) · Leaderboard · Summary (post-lock) · Manage (admin only) · Event Audit | Public spectator                       |
| `/challenge/[id]/participant/[participantId]` | Challenge-specific participant statistics, targets, daily history & read-only profile                                        | Public spectator / Participant / Admin |
| `/admin`                                      | Server redirect to `/challenges`                                                                                             | `ADMIN` / `DEV`                        |
| `/admin/challenges/new`                       | Challenge creator wizard (2 required image uploads)                                                                          | `ADMIN` / `DEV`                        |
| `/profile`                                    | Dynamic resolver & redirect to active/enrolled participant profile page                                                      | Authenticated                          |
| `/devboard`                                   | DevBoard runtime feature flag console, instant kill switches, tester assignments                                             | `DEV` only                             |
| `POST /api/feedback`                          | Bug/suggestion intake → DB + Discord embed                                                                                   | Anyone                                 |
| `POST /api/tasks/sync`                        | Offline task queue batch sync                                                                                                | Authenticated                          |

> **Removed routes:** `/dashboard` (replaced by `/`), `/admin/challenges/[id]/roster` (replaced by the Manage tab), and `/challenge/[id]/manual` (deprecated and removed; superseded by challenge scoreboard + admin hours override grid). Several `revalidatePath("/dashboard")` calls remain and do nothing; they're harmless but should be cleaned up.

### 1.2 RBAC Model

- `DEV` → Discord snowflake listed in `DEV_DISCORD_IDS` (JSON array; legacy alias `DISCORD_DEV_IDS` still read).
- `ADMIN` → user holds a role in `DISCORD_ADMIN_ROLE_IDS` within `DISCORD_GUILD_ID` (looked up with `DISCORD_BOT_TOKEN`; OAuth scope stays `identify`).
- `PARTICIPANT` → everyone else. The `DISCORD_ADMIN_IDS` whitelist has been removed.
- **Global Participant Preview:** Admins and devs can toggle a global cookie (`holdmetoit_preview_as_participant`) from the header next to "Admin Console". When active, all pages (`/`, `/challenge/[id]`, etc.) render exactly as regular participants see them (hiding Manage tab, Event Audit tab, host override controls, and DEV badge).

---

## 2. Phase 0 (MVP Core) Feature Status Matrix — Verified Against Code

Legend: ✅ Done end-to-end · ⚠️ Partial / backend-only / deviates from spec · ❌ Missing

| Feature ID      | Feature                            | Status | Evidence / Gap                                                                                                                                                                                                                                                                                                                          |
| :-------------- | :--------------------------------- | :----: | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FEAT-AUTH-01`  | Discord OAuth (`identify`)         |   ✅   | `core/auth/index.ts`; role synced on sign-in via `syncUserRoleFromDiscord`                                                                                                                                                                                                                                                              |
| `FEAT-AUTH-02`  | Public spectator mode              |   ✅   | `app/challenge/[id]/page.tsx` renders without a session                                                                                                                                                                                                                                                                                 |
| `FEAT-CHAL-01`  | Multi-format challenge creator     |   ✅   | `/admin/challenges/new`; banner + PFP uploads go to Supabase Storage                                                                                                                                                                                                                                                                    |
| `FEAT-CHAL-02`  | Host manual kickoff                |   ✅   | Manage tab → `kickoffChallengeAction` (sets `startAt = now`; status is derived from timestamps)                                                                                                                                                                                                                                         |
| `FEAT-CHAL-05`  | Lock final results                 |   ✅   | Manage tab → `lockChallengeResultsAction`. Fix D1: `resultsLockedAt DateTime?` allows idempotent post-expiry locking. Session 83: lock now runs the three-condition evaluator (weekly tasks + hours + winning team; ties never punish) and writes `PunishmentRecord` rows only for punished members                                     |
| `FEAT-CHAL-06`  | Duo partner self-naming            |   ❌   | No participant-side duo naming code exists. Only hosts can rename teams (Manage tab → Team Identities)                                                                                                                                                                                                                                  |
| `FEAT-AUDIT-01` | Append-only audit trail            |   ⚠️   | `features/audit/data/audit-log.repository.ts` stores events in PostgreSQL (`audit_logs`) and in-memory fallback. Event Audit tab UI live in `/challenge/[id]`.                                                                                                                                                                          |
| `FEAT-DECL-01`  | Declared target hours (`HH:MM:SS`) |   ✅   | Entered in the enrollment modal (1–105h). Note: `leaveDays` is accepted by the action but **silently discarded** (no column)                                                                                                                                                                                                            |
| `FEAT-DECL-02`  | Mandatory weekly goals checklist   |   ✅   | Challenge-linked tasks: `Task.challengeId` (nullable; SetNull FK) + soft delete (`deletedAt`, tombstoned category names). New tasks are stamped to the user's current challenge via `resolveTaskChallengeId` (ACTIVE preferred, else soonest UPCOMING); one-time backfill linked all existing tasks to the October challenge            |
| `FEAT-DECL-03`  | Declaration lock on `ACTIVE`       |   ✅   | Targets can't be edited after enrollment at all. Late enrollment is still allowed while `ACTIVE` (only `COMPLETED` blocks it)                                                                                                                                                                                                           |
| `FEAT-DECL-04`  | Host weekly target hours edit      |   ✅   | `AdminTargetOverrideModal`: mods/devs can adjust any participant's weekly target commitment (1h–105h) with immutable `TARGET_HOURS_OVERRIDE` audit logging; integrated across Manage tab, Leaderboard tab, and Participant Stats profile                                                                                                |
| `FEAT-LOG-01`   | Daily `HH:MM:SS` self-logging      |   ✅   | `daily-hours-modal.tsx`: participants restricted to today/yesterday self-logging (`ONLY_TODAY_OR_YESTERDAY_ALLOWED`), non-scrolling 7-day selector, native picker (`max=today`), domain guards                                                                                                                                          |
| `FEAT-LOG-02`   | 24h single-day limit               |   ✅   | `MAX_DAILY_LOG_SECONDS` in `daily-log.validation.ts`                                                                                                                                                                                                                                                                                    |
| `FEAT-LOG-04`   | Admin inline hours override UI     |   ✅   | `AdminHoursOverrideModal`: mods and devs (`ADMIN`, `DEV`) can override any participant's hours for any day of the week (D1..D7) with mandatory audit reason; integrated into Manage tab roster & Leaderboard tab                                                                                                                        |
| `FEAT-LEAD-01`  | Head-to-head scoreboard            |   ✅   | `challenge-leaderboard-tab.tsx`: matchup card with share % and team targets                                                                                                                                                                                                                                                             |
| `FEAT-LEAD-02`  | Unified standings table            |   ✅   | Desktop table plus mobile card layout. Standings now carry real weekly-task counts (challenge-linked, soft-deletes included) which also drive the sort tie-break — no "Goals Done" column                                                                                                                                               |
| `FEAT-LEAD-03`  | Catch-up deficit engine            |   ✅   | `deficit.ts` + `cockpit-progress-card.tsx`                                                                                                                                                                                                                                                                                              |
| `FEAT-PUN-01`   | Three-condition auto-flagging      |   ✅   | `evaluateLockOutcome` (pure): saved = hours met AND all challenge-linked weekly tasks complete (soft-deleted rows count) AND in a winning team; ties never punish (`resolveWinningTeamIds`). `PunishmentRecord` row presence = punished; pardons preserved                                                                              |
| `FEAT-PUN-02`   | Punishment Wall                    |   ❌   | `punishment-wall.tsx` was deleted in `88779bd`. The Overview tab only mentions it in copy                                                                                                                                                                                                                                               |
| `FEAT-PUN-03`   | Punishment PFP download button     |   ✅   | Overview tab contains dedicated Forfeit Avatar & Accountability card with image preview, Law L6 explanation, and direct "Download Forfeit PFP" button                                                                                                                                                                                   |
| `FEAT-PUN-04`   | Host pardon                        |   ⚠️   | `adminPardonAction` preserved and adapted (findFirst update-or-create; `PunishmentRecord` keeps `isPardoned/pardonReason/pardonedById`); **no UI** (`admin-goals-pardons.tsx` was deleted in `364c7a1`)                                                                                                                                 |
| `FEAT-WRAP-01`  | Challenge wrapped story popup      |   ✅   | `features/wrapped/presentation/challenge-wrapped-modal.tsx`: auto-opens for enrolled participants while locked; localStorage-first flags (`hmt:wrapped:{challengeId}`); `isWrappedSeen` flips at the feedback slide; 3-day window + page-load auto-seen (`markWrappedSeenIfExpiredAction`); feedback flow deferred (button ships empty) |
| `FEAT-WRAP-02`  | Challenge wrapped summary tab      |   ✅   | `?tab=summary` (post-lock): `challenge-summary-tab.tsx` renders the challenge-level story for everyone plus the personal wrapped block (verdict, reasons, best day, vs-average, team share, daily bars, weekly tasks) for enrolled participants                                                                                         |
| `FEAT-DISC-01`  | 1-click Discord summary copy       |   ❌   | Removed (superseded by in-app Challenge Summary tab & personal Wrapped story dialog)                                                                                                                                                                                                                                                    |

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
> 1. Restore the remaining deleted P0 UIs:
>    - Host pardon modal (`FEAT-PUN-04`) inside the Manage tab.
>    - Punishment Wall (`FEAT-PUN-02`).
> 2. Promote the migrations to the hosted DB when the team is ready:
>    - `20261011120000_challenge_wrapped_flags_and_punishment_trim`
>    - `20261011120100_challenge_linked_tasks_and_soft_delete`
>    - `20261012120000_add_challenge_feedback_table`
> 3. Reconcile remaining schema drift (D5): generate catch-up migrations for `feedbacks` and the `sort_order` columns.

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

### Session 89 — 2026-10-12 (afnan-jr — 8-Question Challenge Feedback Survey Dialog & Discord Channel 1558594247895289877)

- **Agent Role:** Participant UI Agent, Scoring & Engine Agent, Data & Identity Agent.
- **Pure Domain Schema & Embed Builder (`features/wrapped/domain/`):**
   - Updated `challenge-feedback.schema.ts` defining `submitChallengeFeedbackSchema` covering the 8 community survey questions:
      1. Consistency: `"Yes, significantly"` / `"Somewhat"` / `"No, it did not make a difference"`
      2. Fairness rating: `1` (Unfair) to `5` (Very Fair)
      3. Tracking method preference: `"Strictly YPT"` / `"Allow all apps with no restrictions"`
      4. Team Battle suggestions & complaints: textarea (max 2000 chars)
      5. Work/school hours target adjustment: `"Yes, include work and school hours"` / `"No, dont include them"`
      6. Solo Challenge operating style: `"Competitive (Keep a leaderboard)"` / `"Laid-back (Personal goals for role rewards)"`
      7. Solo punishment PFP system: `"Yes, keep the punishment"` / `"No, remove the punishment"`
      8. Solo Challenge ideas & thoughts: textarea (max 2000 chars)
   - Updated `challenge-feedback-embed.ts` generating Obsidian-styled Discord embeds (`0x22c55e` emerald, dynamic stars, submitter mention `<@discordId>`, scannable inline fields for multiple-choice responses, and full-width fields for multiline feedback).
- **Discord Dispatch Service (`features/wrapped/data/challenge-feedback.service.ts`):**
   - Configured channel resolution: defaults to `1558594247895289877` (with `process.env.DISCORD_CHALLENGE_FEEDBACK_CHANNEL_ID` override).
   - Wired REST API v10 bot messaging (`POST /channels/1558594247895289877/messages`) with robust error handling and fail-soft behavior so downstream rate-limits or network glitches do not disrupt user persistence.
- **Server Action & DB Persistence (`features/wrapped/api/wrapped.actions.ts`):**
   - Updated `submitChallengeFeedbackAction(rawInput)`: authenticates session, verifies challenge enrollment (`requireOwnedParticipant`), updates `ChallengeParticipant.isFeedbackFilled = true` in PostgreSQL, dispatches the formatted embed to Discord, revalidates scoreboard cache tags (`challengeScoreboard(challengeId)`), and logs structured diagnostics.
- **Obsidian Survey Dialog UI (`features/wrapped/presentation/challenge-feedback-dialog.tsx`):**
   - Created `ChallengeFeedbackDialog` with clean Obsidian styling:
      - 2-section progressive layout: _Part 1: Team Battles Review_ and _Part 2: Upcoming Solo Challenge_.
      - Interactive selectable card chips with emerald/blue active borders and radio indicators.
      - 1–5 numerical scale buttons with "Unfair" and "Very Fair" anchor labels.
      - Obsidian dark multiline textareas (`bg-[#1c1c1c] border-[#292929]`).
      - Inline error alerts if required questions are unanswered.
      - Submitting spinner and celebratory Thank You screen with emerald checkmark on completion.
   - Wired Slide 5 "Give feedback" button in `challenge-wrapped-modal.tsx`: opens `ChallengeFeedbackDialog`, triggers `writeWrappedLocalState(challengeId, { feedback: true })`, and automatically closes the wrapped story upon completion.
- **Environment Documentation:**
   - Added `DISCORD_CHALLENGE_FEEDBACK_CHANNEL_ID="1558594247895289877"` to `.env.example` and local `.env`.
- **Unit Testing & Verification:**
   - Added unit test suites `challenge-feedback.schema.test.ts`, `challenge-feedback-embed.test.ts`, `challenge-feedback.service.test.ts`, `challenge-feedback-dialog.test.tsx`, and updated `wrapped.actions.test.ts` (35 new tests added, 89 test files total).
   - `npm run typecheck` passed (0 errors).
   - `npm run test` passed (89 test files, 971/971 tests green).
   - `npm run build` passed (12 routes compiled cleanly).
- **NEXT STEP (completed in Session 90):** Feedback Dialog Obsidian Tokens Harmonization, Badge Removal & Unified Flow.

### Session 90 — 2026-10-12 (afnan-jr — Feedback Dialog Obsidian Tokens Harmonization, Badge Removal & Unified Single-Section Flow)

- **Agent Role:** Participant UI Agent, Scoring & Engine Agent.
- **Header Badge Removal (`features/wrapped/presentation/challenge-feedback-dialog.tsx`):**
   - Removed `<SparklesIcon>` badge/pill before "Challenge Feedback" heading in dialog header.
   - Heading is now clean and directly rendered: `font-display font-bold text-lg sm:text-xl text-[#f4f3f6] tracking-tight`.
- **Unified Single-Section Flow (Elimination of Part 1 / Part 2):**
   - Removed `Part 1 · Team Battles Review` and `Part 2 · Upcoming Solo Challenge` section headers and dividing lines.
   - Merged all 8 community survey questions into a single cohesive, sequentially flowing Obsidian form.
- **Obsidian Dark Token Harmonization (`DESIGN.md` §2):**
   - Replaced all Part 2 blue accents (`#3b82f6`, `#102d40`/40) with project-standard Obsidian Emerald tokens (`#22c55e`, `#144520`/40) for radio buttons, active selection rings, and required asterisks.
   - Standardized option card states: unselected options use `bg-[#1c1c1c] border-[#292929] text-[#d1d1d1] hover:border-[#434343] hover:text-[#f4f3f6]`; selected options use `bg-[#144520]/40 border-[#22c55e] text-[#f4f3f6]`.
   - Harmonized dialog container radius to `rounded-2xl sm:rounded-3xl` and footer to `rounded-b-2xl sm:rounded-b-3xl`.
   - Upgraded both multiline textareas (Q4 and Q8) with unified Obsidian tokens: `bg-[#1c1c1c] border-[#292929] placeholder-[#868686]/70 focus:border-[#22c55e] focus:ring-1 focus:ring-[#22c55e]/40`.
- **Slide 5 Copy Precision (`features/wrapped/presentation/challenge-wrapped-modal.tsx`):**
   - Updated kicker from `"Anonymous · 2 minutes"` to `"Community Feedback · 2 minutes"`.
   - Updated description to `"Tell us what worked and what didn't. Your feedback helps shape future challenges."` to reflect submitter name logging in Discord.
- **Unit Testing & Verification:**
   - Updated `features/wrapped/presentation/challenge-feedback-dialog.test.tsx` asserting the absence of "Part 1" and "Part 2" section headers and verifying unified form structure.
   - `npm run typecheck` passed (0 errors).
   - `npm run test` passed (89 test files, 971/971 tests green).
   - `npm run build` passed (12 routes compiled cleanly).
- **NEXT STEP (completed in Session 91):** Dedicated ChallengeFeedback PostgreSQL Table, Repository & Dual-Persistence Pipeline.

### Session 91 — 2026-10-12 (afnan-jr — Dedicated ChallengeFeedback PostgreSQL Table, Repository & Dual-Persistence Pipeline)

- **Agent Role:** Data & Identity Agent, Scoring & Engine Agent.
- **Prisma Schema & PostgreSQL Migration (`prisma/`):**
   - Added `ChallengeFeedback` model to `prisma/schema.prisma` with fields: `id` (cuid), `challengeId`, `userId`, `consistency`, `fairnessRating` (Int), `trackingPreference`, `teamBattleSuggestions` (optional Text), `workSchoolAdjust`, `soloOperatingStyle`, `soloSuggestions` (optional Text), `soloPunishment`, `discordMessageId` (optional VarChar), `createdAt`, `updatedAt`.
   - Added composite unique index `@@unique([challengeId, userId])` to enforce strict idempotent feedback persistence per user per challenge.
   - Linked reverse relations on `User` (`challengeFeedbacks ChallengeFeedback[]`) and `Challenge` (`challengeFeedbacks ChallengeFeedback[]`) with cascade delete on participant/challenge deletion.
   - Created migration `prisma/migrations/20261012120000_add_challenge_feedback_table/migration.sql` and generated updated Prisma client.
- **Dedicated Data Repository (`features/wrapped/data/challenge-feedback.repository.ts`):**
   - Created repository methods with strict error handling and optional transaction client injection (`dbOrTx`):
      - `saveChallengeFeedback(data, tx?)`: Idempotent upsert matching `challengeId_userId`.
      - `getChallengeFeedback(challengeId, userId)`: Fetches specific participant submission.
      - `listChallengeFeedbacks(challengeId)`: Retrieves all challenge feedback records.
      - `updateChallengeFeedbackDiscordMessageId(id, discordMessageId)`: Records dispatched Discord message ID.
- **Server Action Dual-Persistence Pipeline (`features/wrapped/api/wrapped.actions.ts`):**
   - Updated `submitChallengeFeedbackAction(rawInput)` to execute dual persistence:
      1. Authenticates session and validates input schema via Zod (`submitChallengeFeedbackSchema`).
      2. Runs ACID transaction via `prisma.$transaction`: marks `ChallengeParticipant.isFeedbackFilled = true` AND saves/upserts the full response in `ChallengeFeedback`.
      3. Dispatches formatted Obsidian Discord embed to channel `1558594247895289877` via bot token.
      4. Upon successful Discord message delivery, records `discordMessageId` on the `ChallengeFeedback` record.
      5. Returns `{ success: true, feedbackId: feedbackRecord.id }`.
   - Fail-soft architecture: If Discord webhook or API fails or rate-limits, data is already safely committed in PostgreSQL and participant progress is never blocked.
- **Unit Testing & Verification:**
   - Added `features/wrapped/data/challenge-feedback.repository.test.ts` (4 unit tests passing).
   - Updated `features/wrapped/api/wrapped.actions.test.ts` to assert transactional DB upsert and `feedbackId` return.
   - `npm run typecheck` passed (0 errors).
   - `npm run test` passed (90 test files, 975/975 tests green).
   - `npm run build` passed (12 routes compiled cleanly).
- **NEXT STEP (completed in Session 92):** Wrapped Modal Starting Slide Fix & Server Reset Reconciliation.

### Session 92 — 2026-10-12 (afnan-jr — Wrapped Modal Starting Slide Fix & Server Reset Reconciliation)

- **Agent Role:** Participant UI Agent, Scoring & Engine Agent.
- **Root Cause Resolution (`features/wrapped/presentation/challenge-wrapped-modal.tsx`):**
   - Eliminated `setSlideIndex(mergedSeen ? FEEDBACK_SLIDE_INDEX : 0)` which was forcing the modal to skip slides 0–3 and open directly on Slide 4 (Feedback).
   - Unconditionally initialized modal to `setSlideIndex(0)` upon opening. The modal now always presents the wrapped story from the beginning.
   - Initialized `seenReportedRef.current = effectiveSeen` when opening, ensuring `markWrappedSeenAction` is not triggered on initial mount.
   - Guaranteed `markWrappedSeenAction(id)` and `seen: true` only execute when the participant actively advances to and views Slide 4 (`FEEDBACK_SLIDE_INDEX`).
- **Server Authority & Cache Invalidation:**
   - Added proactive reconciliation: when the server delivers `isWrappedSeen === false` or `isFeedbackFilled === false`, `localStorage` is updated immediately to `{ seen: false }` or `{ feedback: false }`.
   - Fixes the bug where clearing DB flags in PostgreSQL had no effect due to stale browser cache resurrecting `mergedSeen = true`.
- **Database Reset & Testing Verification:**
   - Reset Afnan's participant record (`cmtqgnr7o0000sbp1ua33e720`) in PostgreSQL to `isWrappedSeen = false` and `isFeedbackFilled = false`.
   - Added unit test in `features/wrapped/presentation/challenge-wrapped-modal.test.tsx` verifying Slide 0 active visibility on open.
   - `npm run typecheck` passed (0 errors).
   - `npm run test` passed (90 test files, 976/976 tests green).
   - `npm run build` passed (12 routes compiled cleanly).
- **NEXT STEP (completed in Session 95):** Cockpit Banner Post-Expiry State & Lock-Gated Outcome.

### Session 82 — 2026-10-11 (krish — User Profile Navigation Links & Route Resolution)

- **Agent Role:** Participant UI Agent, Data & Identity Agent.
- **Scope & User Intent:**
   - Make the username displayed next to "Welcome" on the home cockpit dashboard and the user's name capsule in the top navigation header clickable.
   - Both links open the user's challenge participant statistics profile (`/challenge/[id]/participant/[participantId]`).
- **Implementation:**
   - **`/profile` Dynamic Resolution Route (`app/profile/page.tsx` & `page.test.tsx`):**
      - Created a dedicated `/profile` server component route.
      - Checks session; redirects unauthenticated visitors to `/`.
      - Inspects optional `?challengeId=` query param to prioritize participant profile lookup for that specific challenge.
      - Falls back to `findParticipantForUser(session.user.id)` to resolve the user's active, upcoming, or most recent challenge participant record.
      - Redirects to `/challenge/${participant.challengeId}/participant/${participant.id}`, or `/challenges` if the user has no enrollments.
   - **Top Navigation Bar Capsule (`features/auth/presentation/auth-nav.tsx` & `auth-nav.test.tsx`):**
      - Updated `UserNav` and `AppHeader` to support an optional `profileUrl` prop, defaulting to `/profile`.
      - Converted the user identity pill capsule into an accessible, interactive `<Link>` pointing to `profileUrl` with subtle Obsidian hover styling (`hover:bg-[#252525] hover:border-[#666666] group cursor-pointer`).
      - Updated `app/challenge/[id]/layout.tsx` to pass `/profile?challengeId=${params.id}` for contextual challenge navigation.
   - **Home Cockpit View (`features/study-logs/presentation/home-cockpit-view.tsx` & `home-cockpit-view.test.tsx`):**
      - Added optional `profileUrl` prop to `HomeCockpitViewProps`.
      - Computed `activeProfileUrl`: resolves directly to `/challenge/${cockpit.challengeId}/participant/${cockpit.participant.id}` when enrolled, or `/profile`.
      - Rendered the username next to "Welcome" as a clickable `<Link>` with hover underline and emerald green tint (`hover:underline hover:text-[#22c55e] transition-colors`) when authenticated.
   - **Home Page (`app/page.tsx`):**
      - Computes `profileUrl` from `cockpit` and passes it to both `<AppHeader>` and `<HomeCockpitView>`.
- **Quality Gates Verified:**
   - `npm run typecheck` ✅ (0 errors)
   - `npm run test` ✅ (80 test files, 858/858 tests green)
   - `npm run build` ✅ (12 routes compiled cleanly)

### Session 83 — 2026-10-11 (krish — Challenge Hero Banner "Back to challenges" Navigation & Obsidian Pill Enhancement)

- **Agent Role:** Participant UI Agent.
- **Scope & User Intent:**
   - Change the banner navigation arrow on `/challenge/[id]` from "Back to home" to "Back to challenges" pointing to `/challenges` (since home is directly accessible via the top-bar HoldMeToIt logo).
   - Enhance the link's visual prominence so it is noticeably clearer and does not get visually lost against dark or intricate hero artwork.
- **Implementation:**
   - **`features/challenges/presentation/challenge-hero-banner.tsx`:**
      - Updated route destination from `/` to `/challenges`.
      - Updated label from "Back to home" to "Back to challenges".
      - Transformed raw underlined text into an elevated Obsidian frosted glass pill (`rounded-full`, `bg-black/50 hover:bg-black/75`, `border border-white/15 hover:border-white/30`, `backdrop-blur-md`, `text-[#f4f3f6] hover:text-white`).
      - Added responsive padding (`px-3 py-1.5 sm:px-3.5 sm:py-1.5`) and interactive hover nudge micro-interaction on the arrow icon (`group-hover:-translate-x-0.5`).
      - Preserved mobile responsiveness guardrail (360px+).
   - **`features/challenges/presentation/challenge-hero-banner.test.tsx`:**
      - Added unit test asserting the link points to `/challenges` with text "Back to challenges".
- **Quality Gates Verified:**
   - `npm run typecheck` ✅ (0 errors via `npx tsc --noEmit`)
   - `npm run test` ✅ (81 test files, 873/873 tests green)

### Session 95 — 2026-10-12 (afnan-jr — Lock-Gated Cockpit Banner & Unlocked Post-Expiry Logging State)

- **Agent Role:** Participant UI Agent, Scoring & Engine Agent.
- **Root Cause & Diagnosis:**
   - `calculateChallengeStatus(challenge, now)` evaluates to `"COMPLETED"` the moment `now >= endAt` (natural expiry at the start of Day 8).
   - In `determineBannerVariant` (`features/study-logs/domain/cockpit-banner.ts`), `challengeStatus === "COMPLETED"` caused the cockpit banner to immediately render `CHALLENGE_COMPLETED`: _"Congrats, your team secured 1st in this challenge"_ before the host had locked results (`resultsLockedAt === null`).
   - This prematurely finalized the user's dashboard view, hiding daily study progress and preventing participants from logging pending final-day hours before moderation.
- **Pure Domain Lock Gating (`features/study-logs/domain/cockpit-banner.ts`):**
   - Extended `BannerEvaluationInput` with `isResultsLocked?: boolean`.
   - Updated `determineBannerVariant` to gate `CHALLENGE_COMPLETED` strictly on `input.isResultsLocked === true`.
   - When an event expires naturally but results remain unlocked (`!isResultsLocked`), the banner falls through to standard daily logging states:
      - `STUDIED_TODAY` if today's hours are logged.
      - `NOT_LOGGED_TODAY` if today's hours are not logged.
      - `FORGOT_YESTERDAY` if yesterday was missed.
      - `ON_LEAVE_TODAY` if on approved leave.
- **Lifecycle & Logging Permission Harmonization (`features/challenges/domain/challenge-lifecycle.ts`):**
   - Updated `canLogStudyTime(status, resultsLockedAt?)` and `isChallengeReadOnly(status, resultsLockedAt?)`:
      - Before results are locked (`resultsLockedAt == null`), study logging remains open for valid days (`status !== "UPCOMING"`).
      - Once results are locked (`resultsLockedAt != null`), study logging closes unconditionally.
   - Updated `logStudyTimeAction` to pass `participant.challenge.resultsLockedAt` and display clear error message if locked.
- **Cockpit Data Hydration (`features/study-logs/data/cockpit-data.ts` & `cockpit-banner-card.tsx`):**
   - Added `isResultsLocked: boolean` and `resultsLockedAt?: string | null` to `CockpitViewModel`.
   - Hydrated `isResultsLocked = participant.challenge.resultsLockedAt != null` in `getParticipantCockpit`.
   - Refined `isYesterdayMissed` to remain active on unlocked post-expiry events: `!isResultsLocked && challengeStatus !== "UPCOMING" && ...`
   - Gated expensive `teamRank` scoreboard resolution strictly behind `if (isResultsLocked)`.
   - Passed `isResultsLocked` from `CockpitBannerCard` to `determineBannerVariant`.
- **Unit Testing & Verification:**
   - Added 5 new unit tests to `cockpit-banner.test.ts` verifying all post-expiry unlocked and locked permutations.
   - Added 5 new unit tests to `challenge-lifecycle.test.ts` asserting lock-aware logging eligibility.
   - `npm run typecheck` passed (0 errors).
   - `npm run test` passed (90 test files, 984/984 tests green).

### Session 96 — 2026-10-12 (afnan-jr — Day 7 Grace Period Day Resolution / Capping at Day 7)

- **Agent Role:** Participant UI Agent, Scoring & Engine Agent.
- **Issue Reported:** During the post-Day 7 grace period (when a 7-day challenge has ended naturally but host has not yet locked results), the system calculated calendar days as Day 8. Consequently, the cockpit banner treated Day 8 as "today", found 0 seconds logged, and rendered `"You haven't logged today's hours"` even when participants had already logged Day 7, while opening modal options for an invalid Day 8.
- **Pure Domain Days Math (`features/study-logs/domain/challenge-day.ts`):**
   - Added `calculateChallengeTotalDays(startAt, endAt?, fallbackDays = 7)` to compute exact duration in integer days.
   - Updated `getChallengeDayBuckets(startAt, now, totalDays?)` to optionally cap `currentDayNumber` to `totalDays`. When capped, `current.dayNumber` is `totalDays` (Day 7) and `previous.dayNumber` is `totalDays - 1` (Day 6).
   - Updated `getChallengeDayOptions(startAt, now, totalDays = 7)` to always generate exactly `totalDays` options, preventing any 8th day option from appearing.
   - Updated `validateStudyLogChallengeDay` to accept `options.totalDays` and cap `currentDayNumber` during grace periods so that Day 7 logs validate as "today" and Day 6 logs as "yesterday".
- **Cockpit Data Grace Period Resolution (`features/study-logs/data/cockpit-data.ts`):**
   - Computed `isGracePeriod = !isResultsLocked && challengeStatus === "COMPLETED" && rawBuckets.current.dayNumber > totalDays`.
   - When `isGracePeriod` is true, hydrates `challengeDayBuckets` capped to `totalDays` (Day 7), mapping `todayDate` and `todayDayNumber` to Day 7 and `yesterdayDate` / `yesterdayDayNumber` to Day 6.
   - `todayLog` therefore resolves the user's Day 7 study log. If already logged, `determineBannerVariant` correctly renders `STUDIED_TODAY` (`"Wow, you studied [hours] today"`) instead of falsely claiming they haven't logged.
   - Added `totalChallengeDays: totalDays` to `CockpitViewModel` and piped it into `CockpitTasksSection` and `DailyHoursModal` in `home-cockpit-view.tsx`.
- **Leaderboard Standings Grace Period (`features/leaderboard/data/leaderboard-data.ts`):**
   - Synced `todayDateKey` in `buildScoreboardViewModel` to resolve Day 7's date key during `isGracePeriod`, ensuring the standings table's "Today" column shows Day 7 study time instead of blank Day 8.
- **Verification:**
   - Added unit tests in `challenge-day.test.ts` verifying `calculateChallengeTotalDays`, `getChallengeDayBuckets`, `getChallengeDayOptions`, and `validateStudyLogChallengeDay` during Day 7 grace periods.
   - `npm run typecheck` passed (0 errors).
   - `npm run test` passed (90 test files, 991/991 tests green).
   - `npm run build` passed (12 routes compiled cleanly).

### Session 97 — 2026-10-12 (Integration Merge: dev branch into afnan-jr)

- **Agent Role:** All Agents.
- **Merge Scope:** Integrated `origin/dev` into `afnan-jr` (PR resolution).
   - Merged user profile navigation links (`/profile` resolver, header capsule `<Link>`, cockpit Welcome name link).
   - Merged challenge hero banner frosted glass pill navigation ("Back to challenges" → `/challenges`).
   - Reconciled Wrapped modal mock types with new hero banner unit tests.
- **Quality Gates Verified:**
   - `npm run typecheck` ✅ (0 errors).
   - `npm run test` ✅ (90 test files, 992/992 tests green).

### Session 98 — 2026-10-13 (Dashboard Page-Load Wrapped, Shy Card Discovery & Mobile Viewport Hardening)

- **Agent Role:** Participant UI Agent, Scoring & Engine Agent, Data & Identity Agent.
- **Feature Scope:** Implemented post-event Challenge Wrapped dashboard discovery with responsive shy card and mobile viewport containment:
   - **Page-Load Wrapped Fetching (`app/page.tsx` & `features/challenges/data/challenge.repository.ts`):**
      - Added `findLatestCompletedChallengeForWrapped(userId?, now = new Date())` to fetch the completed challenge within 3 days of completion (`resultsLockedAt` or `endAt`).
      - On dashboard page load (`/`), if an eligible challenge exists for the authenticated participant, fetches `getChallengeScoreboard` and passes `wrappedChallenge` to `HomeCockpitView`.
   - **Pure Domain Lifecycle (`features/wrapped/domain/wrapped.ts`):**
      - Updated `isWrappedWindowOpen` and `isWrappedWindowExpired` to support challenge objects with either `resultsLockedAt` or `endAt` (3-day window: $\text{now} < \text{completionDate} + 3\text{ days}$).
      - Added pure calculation helpers `isChallengeCompleted` and `getChallengeCompletionDate`.
      - Added unit tests in `features/wrapped/domain/wrapped.test.ts` verifying all 3-day window boundary conditions.
   - **Shy Card Discovery Component (`features/wrapped/presentation/wrapped-shy-card.tsx`):**
      - Implemented the Shy Card UI with Obsidian Dark theme tokens (`#141414`, `#292929`, `#22c55e`).
      - **Desktop ($\ge 768\text{px}$) Parked:** Sits off the right canvas edge (`md:left-full md:-translate-x-[64px] md:-translate-y-[16px] md:-rotate-12 md:scale-75`), border emerald, with blinking eyes looking towards screen and 5s `@keyframes shy-nudge` animation, nudging on hover (`md:hover:-translate-x-[76px] md:hover:-rotate-8`).
      - **Mobile ($< 768\text{px}$) Parked:** Docked tab strictly inside viewport coordinates (`right-0 top-1/2 -translate-y-1/2 w-[58px] h-[44px] rounded-l-2xl border-l-2 border-y-2 border-r-0 border-[#22c55e]`). Eyes are centered (`justify-center`) inside the snug 58px tab. Revealed card content uses `hidden md:flex` when parked, guaranteeing zero layout void expansion and zero horizontal overflow on mobile viewports ($\ge 360\text{px}$).
      - **Open State:** Centered card / mobile bottom-sheet overlay (`inset-x-3 bottom-4 md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 w-auto max-w-[360px] md:w-[320px] mx-auto`) with `max-h-[85dvh] md:max-h-none overflow-y-auto`, safe-area insets (`env(safe-area-inset-bottom)`), $\ge 42\text{px}$–$44\text{px}$ touch targets, and swipe-down/right to dismiss on touch devices.
      - Displays challenge title, verdict badge (Saved/Punished/Excused), hours studied vs target, leaderboard rank, team status, "Replay Wrapped Story" button, "View Full Summary" link, and "Hide again" button.
      - Full keyboard accessibility (Space/Enter to open, Escape to close) and `prefers-reduced-motion: reduce` support.
   - **Dashboard Coordinator (`features/wrapped/presentation/dashboard-wrapped.tsx`):**
      - Auto-pops up `ChallengeWrappedModal` on dashboard load if unseen (`isWrappedSeen === false`).
      - Once seen/dismissed, parks `WrappedShyCard` on screen edge.
      - Clicking "Replay Story" on the shy card re-opens `ChallengeWrappedModal`.
   - **Mobile Viewport Hardening & Overflow Containment (`app/layout.tsx`, `features/auth/presentation/auth-nav.tsx`, `components/state/cockpit-skeleton.tsx`, `tailwind.config.ts`):**
      - Added `overflow-x-hidden` to `<html>` and `<body>` in `app/layout.tsx` to prevent horizontal canvas drift and ensure fixed overlays dock correctly at physical screen boundaries on mobile ($\le 372\text{px}$).
      - Configured `xs: "400px"` screen breakpoint in `tailwind.config.ts`.
      - Hardened `AppHeader` against overflow: `overflow-x-hidden`, `shrink min-w-0` on children with `gap-1 sm:gap-2`.
      - Compacted `ParticipantPreviewButton` on mobile (`px-1.5 xs:px-2.5`, hiding text label on `< xs`, showing `"Preview"` on `xs:`).
      - Added truncation and responsive max-width to `UserNav` capsule (`max-w-[85px] xs:max-w-[120px] sm:max-w-none`, truncating `displayName` to 36px on small viewports).
      - Constrained `CockpitSkeleton` layout with `max-w-4xl mx-auto px-4 py-8 sm:py-12`.
- **Quality Gates Verified:**
   - `npm run typecheck` ✅ (0 errors).
   - `npm run test` ✅ (94 test files, 1018/1018 tests green).
   - `npm run build` ✅ (11 routes compiled cleanly).

### Session 99 — 2026-10-13 (Full Route Boundaries Coverage: Localized error.tsx, Root & Dynamic not-found.tsx, Missing loading.tsx Skeletons & Hardened global-error.tsx)

- **Agent Role:** Participant UI Agent, Scoring & Engine Agent, Admin Operations & Broadcaster Agent.
- **Scope & Objectives:** Implement end-to-end boundary coverage across all Next.js App Router route segments to satisfy **Law L9 (Zero-State & Error Resilience)** and the **Obsidian Dark Design System**.
- **Root Resilience & `global-error.tsx` Hardening:**
   - **`app/global-error.tsx`:** Upgraded from primitive stub to hardened Obsidian boundary with self-contained inline fallback styles (guaranteeing rendering even if CSS/Tailwind fails to load), LogRocket initialization, structured logger invocation, error digest display (`error.digest`), accessible "Try again" (`reset()`) button, and secondary "Return to Lounge" navigation link (`min-h-[44px]` touch targets).
   - **`app/not-found.tsx`:** Created root 404 handler for any unmapped routes across the platform with Obsidian dark tokens (`#141414`, `#262626`, `#22c55e`), responsive container, and return action linking to `/`.
   - **`app/error.tsx`:** Enhanced root error boundary with dual recovery actions ("Try again" + "Return to Study Lounge") and responsive layout.
- **Localized Route Error Boundaries (`error.tsx`):**
   - Implemented localized error boundaries with structured diagnostics logging (`logError`), accessible `reset()` retry triggers, and contextual fallback exits:
      - `app/challenges/error.tsx` — Challenges directory error boundary.
      - `app/challenge/[id]/error.tsx` — Challenge scoreboard & tabs error boundary.
      - `app/challenge/[id]/manual/error.tsx` — Weekly manual leaderboard error boundary.
      - `app/admin/error.tsx` — Admin console operations error boundary.
      - `app/admin/challenges/new/error.tsx` — Multi-step challenge creator wizard error boundary.
      - `app/profile/error.tsx` — Dynamic participant profile resolver error boundary.
- **Dynamic 404 Boundaries (`not-found.tsx`) & `notFound()` Integration:**
   - Created segment-level 404 boundaries with contextual recovery navigation:
      - `app/challenge/[id]/not-found.tsx` — Displays when a challenge record is not found in DB.
      - `app/challenge/[id]/participant/[participantId]/not-found.tsx` — Displays when a participant is not found in the challenge.
      - `app/challenge/[id]/manual/not-found.tsx` — Displays when a manual challenge record is not found.
   - Refactored server components to call Next.js's native `notFound()` instead of inline 200 OK `<EmptyState>` components, guaranteeing legitimate HTTP 404 status codes.
- **Missing Loading Skeletons (`loading.tsx`):**
   - `app/admin/challenges/new/loading.tsx` — Wizard header, step pill indicators, and form field skeletons.
   - `app/profile/loading.tsx` — Obsidian dark spinning loader for seamless redirect resolution.
- **Unit Testing & Verification:**
   - Created test suite `components/state/route-boundaries.test.tsx` (14 unit tests passing).
   - Updated `app/challenge/[id]/page.test.tsx` and `app/challenge/[id]/participant/[participantId]/page.test.tsx` asserting `notFound()` calls.
   - `npm run typecheck` passed (0 errors).
   - `npm run test` passed (95 test files, 1032/1032 tests green).
   - `npm run build` passed (11 routes compiled cleanly).

### Session 100 — 2026-10-13 (Soft Deletion Architecture for Challenges, Teams, Categories, and Tasks)

- **Agent Role:** Data & Identity Agent, Scoring & Engine Agent, Participant UI Agent, Admin Operations Agent.
- **Scope & Objectives:** Implement end-to-end soft deletion across `Challenge`, `Team`, `Category`, and `Task` entities with database migration, domain integrity, tombstoned unique constraints, client-side exclusion filters, and zero data loss.
- **Database Schema & Migrations (`prisma/schema.prisma`):**
   - Added `isDeleted Boolean @default(false)` and `deletionTime DateTime?` to:
      - `Challenge`: with index `@@index([isDeleted, startAt])`.
      - `Team`: with index `@@index([challengeId, isDeleted])`.
      - `Category`: with index `@@index([userId, isDeleted])`.
      - `Task`: with indexes `@@index([userId, taskType, isDeleted])`, `@@index([categoryId, isDeleted])`, `@@index([challengeId, isDeleted])`.
   - Generated Prisma client with `npx prisma generate`.
   - Created migration `prisma/migrations/20261013000000_add_soft_delete_to_challenges_teams_categories_tasks/migration.sql` with backfill converting legacy `deleted_at` timestamps to `deletion_time` with `is_deleted = true`. Executed safely via `prisma db execute` (zero data loss on existing `ypt_bot_logs` and challenge data). Documented in `prisma/migrations/README.md`.
- **Domain Logic & Invariant Guards:**
   - **Tombstone Naming (`features/challenges/domain/team-deletion.ts`):** Created `buildTeamTombstoneName(name, id)` to rename soft-deleted teams to `<name> ·deleted·<id>` so hosts can recreate teams with the same name without violating Postgres `@@unique([challengeId, name])`.
   - **Score Aggregation (`features/leaderboard/domain/leaderboard.ts`):** Updated `aggregateTeamScores` to ignore `isDeleted` teams from leaderboard standings calculations.
   - **Law L6 Accountability Invariant Preserved (`features/leaderboard/data/leaderboard-data.ts`):** Weekly tasks that were soft-deleted while incomplete still count as incomplete in the three-condition lock evaluation to eliminate "delete-to-pass" loopholes.
- **Data Repositories & Server Actions:**
   - `challenge.repository.ts`: `findChallengeWithTeamsById`, `findLatestAvailableChallenge`, `listAllChallenges`, `findLatestCompletedChallengeForWrapped` all filter `isDeleted: false` on challenges and teams.
   - `challenge-admin.repository.ts`: `findAdminChallengeDetails` rejects soft-deleted challenges; `updateAdminChallengeDetails` soft-deletes removed teams with tombstoned names; `deleteAdminChallenge` executes atomic soft deletion of challenge, active teams, and tasks inside a single interactive transaction with audit trail logging.
   - `participant.repository.ts`: `findParticipantForUser`, `findOwnedParticipant`, and `enrollParticipantInChallenge` validate `challenge.isDeleted: false` and `team.isDeleted: false`.
   - `task.repository.ts` & `task-sync.repository.ts`: all queries and mutations updated from `deletedAt: null` to `isDeleted: false`, with soft deletes recording `{ isDeleted: true, deletionTime: now }`.
- **Client Presentation & Defense-in-Depth Filtering:**
   - `features/challenges/presentation/challenges-list-view.tsx`: filters `activeChallenges = challenges.filter(c => !c.isDeleted)` and excludes soft-deleted teams from search text matching.
   - `features/challenges/presentation/challenge-overview-tab.tsx`: filters `activeTeams = teams?.filter(t => !t.isDeleted)` for head-to-head match cards, team rosters, and team select filter dropdown.
   - `features/challenges/presentation/challenge-manage-tab.tsx`: initializes and resets team rosters filtering out `t.isDeleted`.
   - `features/study-logs/presentation/cockpit/cockpit-tasks-section.tsx`: filters out `isDeleted` categories and tasks during IndexedDB reading, cloud sync state hydration, and initial category seeding.
   - `features/wrapped/presentation/dashboard-wrapped.tsx`: suppresses wrapped modal and shy card if `challenge.isDeleted`.
   - `app/challenge/[id]/page.tsx`: triggers `notFound()` if `challenge.isDeleted`.
- **Unit Testing & Verification:**
   - Added unit test suite `features/challenges/domain/team-deletion.test.ts` (2 tests).
   - Added tests in `challenges-list-view.test.tsx` and `cockpit-tasks-section.test.tsx` verifying client-side soft deletion exclusion.
   - Updated repository test suites (`challenge.repository.test.ts`, `challenge-admin.repository.test.ts`, `participant.repository.test.ts`, `task.repository.test.ts`, `task-sync.repository.test.ts`).
   - `npm run typecheck` passed (0 errors).
   - `npm run test` passed (96 test files, 1040/1040 tests green).
   - `npm run build` passed (11 routes compiled cleanly).
- **NEXT STEP:** Restore the remaining deleted P0 UIs: host pardon modal (`FEAT-PUN-04`), 1-click Discord summary copy (`FEAT-DISC-01`), Punishment Wall (`FEAT-PUN-02`).

### Session 101 — 2026-10-14 (Manual Leaderboard Feature Removal & 100% Law L8 Compliance)

- **Agent Role:** Data & Identity Agent, Scoring & Engine Agent, Participant UI Agent, Admin Operations Agent.
- **Scope & Objectives:** Fully remove the redundant manual weekly leaderboard (`FEAT-LEAD-05` / `/challenge/[id]/manual`), drop legacy tables (`leaderboard_entries`, `team_members`), eliminate technical debt D7 (Law L8 Decimal deviation), and consolidate all team membership under `ChallengeParticipant.teamId`.
- **Files Deleted:**
   - Routes: `app/challenge/[id]/manual/page.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`
   - Presentation: `features/leaderboard/presentation/manual-leaderboard-view.tsx`, `manual-leaderboard-view.test.tsx`
   - Actions: `features/leaderboard/api/manual-leaderboard.actions.ts`
   - Repository: `features/leaderboard/data/manual-leaderboard.repository.ts`, `manual-leaderboard.repository.test.ts`
   - Domain: `features/leaderboard/domain/manual-leaderboard.ts`, `manual-leaderboard.test.ts`
- **Database Schema & Migrations (`prisma/schema.prisma`):**
   - Removed `model LeaderboardEntry` (`leaderboard_entries` table) and `model TeamMember` (`team_members` table).
   - Removed relations from `User` (`teamMemberships`, `leaderboardEntries`), `Challenge` (`leaderboardEntries`), and `Team` (`members`).
   - Created migration `prisma/migrations/20261013010000_remove_manual_leaderboard_tables/migration.sql` and executed via `prisma db execute`. Documented in `prisma/migrations/README.md`.
- **Cross-Cutting Code Cleanups:**
   - `features/challenges/data/challenge-admin.repository.ts`: Removed `tx.leaderboardEntry.deleteMany` and `tx.teamMember.deleteMany` from `adminRemoveParticipantFromChallenge`.
   - `features/challenges/data/challenge-admin.repository.test.ts`: Removed `leaderboardEntry` and `teamMember` mock setups and assertions.
   - `components/state/route-boundaries.test.tsx`: Removed `ManualLeaderboardNotFound` and `ManualLeaderboardError` imports and unit tests.
   - `core/observability/domain/log-events.ts`: Removed `leaderboardManualLogged` and `leaderboardManualBatchLogged`.
- **Documentation Updates:**
   - `FEATURES.md`: Marked `FEAT-LEAD-05` as removed (superseded by `AdminHoursOverrideModal` which uses canonical second-level integer duration precision).
   - `README.md`, `ROADMAP.md`, `ISSUES.md`: Updated to remove `/manual` route references and mark `TeamMember` ambiguity resolved.
- **Quality Gates Verified:**
   - `npm run typecheck` passed (0 errors).
   - `npm run test` passed (93 test files, 1027/1027 tests green).
   - `npm run build` passed (10 routes compiled cleanly).
- **NEXT STEP:** Restore the remaining deleted P0 UIs: host pardon modal (`FEAT-PUN-04`), 1-click Discord summary copy (`FEAT-DISC-01`), Punishment Wall (`FEAT-PUN-02`).

### Session 102 — 2026-10-14 (Database Table Names Standardized to PascalCase)

- **Agent Role:** Data & Identity Agent, Scoring & Engine Agent.
- **Scope & Objectives:** Standardize 100% of application database table names in PostgreSQL to PascalCase, eliminating mixed casing (snake_case vs PascalCase) across models.
- **Database Schema Changes (`prisma/schema.prisma`):**
   - Removed `@@map(...)` from all models (`DailyStudyLogV2`, `Category`, `Task`, `Feedback`, `ChallengeFeedback`, `AuditLog`), allowing Prisma to naturally map every model to its PascalCase model name.
   - All 15 application tables now follow a uniform PascalCase convention: `Account`, `AuditLog`, `Category`, `Challenge`, `ChallengeFeedback`, `ChallengeParticipant`, `DailyStudyLog`, `DailyStudyLogV2`, `Feedback`, `PunishmentRecord`, `Session`, `Task`, `Team`, `User`, `VerificationToken`.
- **Database Migration:**
   - Created migration `prisma/migrations/20261014000000_standardize_tables_to_pascal_case/migration.sql` with safe table renames (`study_logs_v2` -> `DailyStudyLogV2`, `categories` -> `Category`, `tasks` -> `Task`, `feedbacks` -> `Feedback`, `challenge_feedbacks` -> `ChallengeFeedback`, `audit_logs` -> `AuditLog`).
   - Executed safely on local PostgreSQL via `prisma db execute` with verified zero data loss across all tables (Category: 103 rows, Task: 241 rows, AuditLog: 226 rows, DailyStudyLogV2: 228 rows, Feedback: 8 rows, etc.).
   - Documented migration in `prisma/migrations/README.md`.
- **Quality Gates Verified:**
   - `npm run typecheck` passed (0 errors).
   - `npm run test` passed (93 test files, 1027/1027 tests green).
   - `npm run build` passed (10 routes compiled cleanly).
- **NEXT STEP:** Restore the remaining deleted P0 UIs: host pardon modal (`FEAT-PUN-04`), 1-click Discord summary copy (`FEAT-DISC-01`), Punishment Wall (`FEAT-PUN-02`).

### Session 103 — 2026-10-14 (Database Column Names Standardized to camelCase)

- **Agent Role:** Data & Identity Agent, Scoring & Engine Agent.
- **Scope & Objectives:** Standardize 100% of application database column names in PostgreSQL to camelCase, eliminating all `@map(...)` column directives across all models (`Challenge`, `Team`, `Category`, `Task`, `Feedback`, `ChallengeFeedback`, `AuditLog`) so that DB columns and TypeScript Prisma client properties match 1:1.
- **Database Schema Changes (`prisma/schema.prisma`):**
   - Removed every `@map(...)` column annotation from `Challenge`, `Team`, `Category`, `Task`, `Feedback`, `ChallengeFeedback`, and `AuditLog`.
   - With all tables in PascalCase and all columns in camelCase, 100% of the application schema is uniform with zero translation layers.
- **Database Migration:**
   - Created migration `prisma/migrations/20261014010000_standardize_columns_to_camel_case/migration.sql` with safe column renames across all 7 models.
   - Executed safely on local PostgreSQL via `prisma db execute` with verified zero data loss across all tables (`Challenge`: 1 row, `Team`: 2 rows, `Category`: 103 rows, `Task`: 241 rows, `Feedback`: 8 rows, `AuditLog`: 226 rows, etc.).
   - Verified that `scripts/check-schema-migration.sh` passes.
- **Quality Gates Verified:**
   - `npm run typecheck` passed (0 errors).
   - `npm run test` passed (93 test files, 1027/1027 tests green).
   - `npm run build` passed (10 routes compiled cleanly).
- **NEXT STEP:** Restore the remaining deleted P0 UIs: host pardon modal (`FEAT-PUN-04`), Punishment Wall (`FEAT-PUN-02`).

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
- **NEXT STEP:** Await user direction on feature flagging candidates or proceed to restore remaining deleted P0 UIs: host pardon modal (`FEAT-PUN-04`), Punishment Wall (`FEAT-PUN-02`).

### Session 107 — 2026-10-15 (Leaderboard Domain Type Boundary)

- **Scope:** Resolved issue #35 by moving scoreboard view-model contracts out of the Prisma/Next cache repository.
- **Architecture:** Added `features/leaderboard/domain/leaderboard.types.ts` for `ChallengeScoreboardViewModel` and its related scoreboard contracts. Updated the leaderboard data repository, domain modules, presentation components, and tests to import types inward from the domain layer.
- **Boundary Check:** No `features/**/domain/**` file imports types from `features/leaderboard/data/leaderboard-data.ts`. Repository payload types remain in the data layer. No scoreboard calculations or adjacent issue #34 behavior changed.
- **Quality Gates:** `npm run typecheck` passed; focused leaderboard/wrapped/participant-stats tests passed (20 files, 204 tests); `npm run test` passed (100 files, 1076 tests); `npm run build` passed (12 routes).
- **NEXT STEP:** Restore remaining deleted P0 UIs: host pardon modal (`FEAT-PUN-04`) and Punishment Wall (`FEAT-PUN-02`).
