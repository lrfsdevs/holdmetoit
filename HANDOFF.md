# HANDOFF.md — Engineering Operational Relay & Milestone Tracker

> **Project:** HoldMeToIt (Gamified Study Accountability & Challenge Management Platform)  
> **Repository:** `github.com/Afnanpathan2004/holdmetoit`  
> **Integration Branch:** `main` (latest: `c174a58`, PR #12) · Personal branches: `krish`, `afnan`, `afnan-jr`, `dev`  
> **Document Status:** Active Operational Relay (Living Document)  
> **Last Updated:** 2026-10-13 (Session 98 — Dashboard Page-Load Wrapped, Shy Card & Mobile Responsive Hardening on `afnan-jr`)  
> **Governance:** Subject to strict **Handoff Pruning & Obsolescence Rule (§9.3 in `AGENTS.md`)**

---

## 1. Current State at a Glance

| Gate                                         | Result (2026-10-13, Session 98 — Dashboard Page-Load Wrapped, Shy Card & Mobile Responsive Hardening on `afnan-jr`)                                                                                                                                                                                        |
| :------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                          | ✅ 0 errors (`npx tsc --noEmit`)                                                                                                                                                                                                                                                                           |
| `npm run test`                               | ✅ 94 files green (1018/1018 tests passing)                                                                                                                                                                                                                                                                |
| `npm run build`                              | ✅ 11 routes compiled (production build clean)                                                                                                                                                                                                                                                             |
| Phase 0 feature parity (vs `FEATURES.md`)    | ⚠️ **~98%** — Wrapped modal starts at Slide 0 and stops auto-opening once seen; no loop on leaderboard navigation; feedback responses dual-persisted to DB (`challenge_feedbacks`) and Discord channel `1558594247895289877`; remaining gaps are deleted P0 UIs (wall, pardon modal, Discord summary copy) |
| Phase 0 Milestone Gate 1 (`ROADMAP.md` §3.4) | ❌ Not passed: no live pilot challenge has run; Vercel deployment not recorded in the repo                                                                                                                                                                                                                 |
| Phase 1 (P1)                                 | ⏸️ Not started                                                                                                                                                                                                                                                                                             |

### 1.1 Live Routes

| Route                                         | Purpose                                                                                                                      | Access                                 |
| :-------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------- | :------------------------------------- |
| `/`                                           | Home cockpit: banner variants, progress/deficit card, Log Hours modal, Daily/Weekly task board                               | Guest (local tasks only) / Participant |
| `/challenges`                                 | Dedicated public challenges directory (Events card grid, role-gated Create Challenge button)                                 | Public spectator / Participant / Admin |
| `/changelog`                                  | Public date-grouped product changelog (unlinked; reachable by URL only)                                                      | Public spectator                       |
| `/challenge/[id]`                             | Tabs: Overview (includes Timetable & Forfeit Avatar) · Leaderboard · Summary (post-lock) · Manage (admin only) · Event Audit | Public spectator                       |
| `/challenge/[id]/participant/[participantId]` | Challenge-specific participant statistics, targets, daily history & read-only profile                                        | Public spectator / Participant / Admin |
| `/challenge/[id]/manual`                      | Manual weekly slot-hours leaderboard (host-entered)                                                                          | Public view, admin entry               |
| `/admin`                                      | Server redirect to `/challenges`                                                                                             | `ADMIN` / `DEV`                        |
| `/admin/challenges/new`                       | Challenge creator wizard (2 required image uploads)                                                                          | `ADMIN` / `DEV`                        |
| `/profile`                                    | Dynamic resolver & redirect to active/enrolled participant profile page                                                      | Authenticated                          |
| `POST /api/feedback`                          | Bug/suggestion intake → DB + Discord embed                                                                                   | Anyone                                 |
| `POST /api/tasks/sync`                        | Offline task queue batch sync                                                                                                | Authenticated                          |

> **Removed routes:** `/dashboard` (replaced by `/`) and `/admin/challenges/[id]/roster` (replaced by the Manage tab). Several `revalidatePath("/dashboard")` calls remain and do nothing; they're harmless but should be cleaned up.

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
| `FEAT-DISC-01`  | 1-click Discord summary copy       |   ⚠️   | `generateDiscordSummary()` is a pure domain function; **no UI** (`discord-summary-card.tsx` was deleted in `364c7a1`)                                                                                                                                                                                                                   |

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
| D3  | 🔴 High  | Two P0 features have backend code but no UI: pardon modal, Discord summary copy (Punishment PFP download & Target override complete)                                                                                                                                                                                                                                  | Rebuild them in Obsidian styling inside the Manage tab (admin pardon & Discord summary)                                                                                                  |
| D4  |    ✅    | **RESOLVED (2026-10-11, Session 83):** Law L6 amended to the Three-Condition Invariant — challenge-linked weekly tasks (`Task.challengeId` + soft delete) + target hours + winning team; ties never punish. `lockChallengeResults` evaluates all three conditions and records only punished members                                                                   | —                                                                                                                                                                                        |
| D5  |  🟠 Med  | Schema drift: the `feedbacks` table and the `sort_order` columns on `categories`/`tasks` were applied with `db push` and have **no migration files**. `prisma migrate deploy` on a fresh DB would produce an incomplete schema. **Partially resolved (Session 79):** `isLeave` migration (`20261010120000`) applied; CI now blocks schema changes without a migration | Generate catch-up migrations (`prisma migrate diff`) and `migrate resolve` them on existing DBs                                                                                          |
| D6  |  🟡 Low  | `leaveDays` is collected in the enrollment modal and then discarded                                                                                                                                                                                                                                                                                                   | Either persist it and feed it into the deficit/target math, or remove it from the UI                                                                                                     |
| D7  |  🟡 Low  | Manual leaderboard uses `Decimal` hours (Law L8 deviation)                                                                                                                                                                                                                                                                                                            | Migrate to integer `sessionSeconds`                                                                                                                                                      |
| D8  |  🟡 Low  | Stale `revalidatePath("/dashboard")` calls; `DISCORD_DEV_IDS` alias; `DEFAULT_FEEDBACK_CHANNEL_ID` hardcoded                                                                                                                                                                                                                                                          | Clean up                                                                                                                                                                                 |
| D9  |  🟡 Low  | "E2E J1–J6" suite (`features/e2e/quality-matrix-j1-j6.test.ts`) mocks Prisma; there's no real browser E2E                                                                                                                                                                                                                                                             | Add Playwright journeys once the D3 UIs are back                                                                                                                                         |
| D10 |  🟡 Low  | Duplicate lockfiles (`bun.lock` + `package-lock.json`); `npm audit` reports 20 vulns (3 critical)                                                                                                                                                                                                                                                                     | Pick one package manager; run `npm audit` triage                                                                                                                                         |

---

## 4. Open Product Decisions (Require Team Sign-off)

1. **~~Goals vs Law L6~~ — ✅ Resolved (2026-10-11, Session 83):** challenge-scoped goals returned as challenge-linked tasks (`Task.challengeId`, default stamping + soft delete); Law L6 amended to the Three-Condition Accountability Invariant (weekly tasks + hours + winning team; ties never punish).
2. **Leave days:** Should declared leave days reduce the target or the days remaining in the catch-up math? Law L3 forbids grace passes, so this needs an explicit ruling.
3. **Late enrollment while `ACTIVE`:** Is this intended? It's allowed today.
4. **Design authority:** `DESIGN.md` now documents the Obsidian system (it replaced "Cozy Study Café" on 2026-10-04). Confirm this is ratified.

---

## 5. Foundational Laws — Compliance Snapshot

| Law                        | Status | Note                                                                                             |
| :------------------------- | :----: | :----------------------------------------------------------------------------------------------- |
| L1 Mathematical Unity      |   ✅   | Single `Team` entity with `maxMembers`                                                           |
| L2 Spreadsheet Exorcism    |   ✅   | Full-week admin override UI and auto-aggregating standings eliminate manual arithmetic           |
| L3 Catch-Up Deficit        |   ✅   | `deficit.ts`; no grace passes                                                                    |
| L4 Discord Identity        |   ✅   | OAuth only; public spectator                                                                     |
| L5 Admin Override Absolute |   ✅   | `adminOverrideStudyHoursAction` + `AdminHoursOverrideModal` live in Manage tab & Leaderboard tab |
| L6 Three-Condition         |   ✅   | Weekly tasks + hours + winning team; ties never punish (D4 resolved)                             |
| L7 Pure Domain Isolation   |   ✅   | `domain/` folders are framework-free                                                             |
| L8 Second-Level Precision  |   ⚠️   | Main logs ✅; manual leaderboard uses `Decimal` hours (D7)                                       |
| L9 Zero-State Resilience   |   ✅   | `loading.tsx` on all routes; `EmptyState` / `ErrorState` components                              |

---

## 6. Immediate Next Step (For Incoming Agent)

> [!IMPORTANT]
> **EXACT NEXT STEP (For Incoming Agent):**
>
> 1. Restore the remaining deleted P0 UIs:
>    - Host pardon modal (`FEAT-PUN-04`) inside the Manage tab.
>    - 1-click Discord summary copy (`FEAT-DISC-01`).
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
- **NEXT STEP:** Restore the remaining deleted P0 UIs: host pardon modal (`FEAT-PUN-04`), 1-click Discord summary copy (`FEAT-DISC-01`), Punishment Wall (`FEAT-PUN-02`).
