# HANDOFF.md — Engineering Operational Relay & Milestone Tracker

> **Project:** HoldMeToIt (Gamified Study Accountability & Challenge Management Platform)  
> **Repository:** `github.com/Afnanpathan2004/holdmetoit`  
> **Integration/Deploy Branch:** `dev` (latest `c8f9447`; Vercel deploys `dev`; `main` trails) · Personal branches: `krish`, `afnan`, `afnan-jr`, `dev`  
> **Document Status:** Active Operational Relay (Living Document)  
> **Last Updated:** 2026-10-18 (Session 136 — Design System Phase D: D1 DevBoard Tabs + D2 Label adoption, on `afnan-jr`)
> **Governance:** Subject to strict **Handoff Pruning & Obsolescence Rule (§9.3 in `AGENTS.md`)**

---

## 1. Current State at a Glance

| Gate                                                         | Result (2026-10-18 — Session 132 + `dev` merge @ `e257d2d`)                                                                                                                                                                                                                                                                                                                                                      |
| :----------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                          | ✅ 0 errors                                                                                                                                                                                                                                                                                                                                                                                                      |
| `npm run lint`                                               | ✅ 0 errors (design-token guard: no hex / no primitive access / no legacy aliases)                                                                                                                                                                                                                                                                                                                               |
| `npm test`                                                   | ✅ 157 files green (1466/1466 tests passing)                                                                                                                                                                                                                                                                                                                                                                     |
| `npm run build`                                              | ✅ 17 routes + Edge Middleware compiled (production build clean including `/leaderboard`, `/admin`, `/wallet`, `/pokemon`, `/pokedex`, `/devboard`)                                                                                                                                                                                                                                                              |
| Phase 0 feature parity (vs `FEATURES.md`)                    | ✅ **100%** — Solo auto-punishment math, uncapped solo capacity, ⚡ Solo Scholar branding, Host Pardon modal (`FEAT-PUN-04`), Punishment Wall (`FEAT-PUN-02`), Solo lifecycle E2E suite; canonical route redirects + edge guard landed from `dev`                                                                                                                                                                |
| Phase 0 Milestone Gate 1 (`ROADMAP.md` §3.4)                 | ❌ Not passed: no live pilot challenge has run; Vercel deployment not recorded in the repo                                                                                                                                                                                                                                                                                                                       |
| Phase 1 (Economy Foundation)                                 | ✅ 100% Shipped & Verified: Wallets, immutable append-only ledger, study rewards (100 coins/hr with fractional carry), available vs. reserved balance tracking                                                                                                                                                                                                                                                   |
| Phase 2 (YPT, Challenge Economy, & Betting)                  | ✅ 100% Shipped & Verified: YPT webhook ingest & account linking, incremental study rewards, challenge reward settlement on lock, virtual-coin betting on Solo/Duo/Team challenges with atomic stake reservation and idempotent settlement                                                                                                                                                                       |
| Phase 2A (Pokémon Catalogue Data — DB-resident)              | ✅ Catalogue lives entirely in the DB (1,025 species + 326 forms). The one-off bundle importer, its CLI, and the 21-species seed were removed; the `metadata` JSON was normalized into `PokemonForm` / `PokemonAbility` tables + scalar columns via `20261022000000_normalize_pokemon_catalogue`. The DB is the source of truth; the offline seeder `npm run db:seed:pokemon` re-populates an empty environment. |
| Phase 3 (Pokémon Catalogue, Collection & Progression Found.) | ✅ 100% Shipped & Verified: Normalized schema (`PokemonSpecies`, `UserPokemon`), 6-tier rarity hierarchy, pure domain progress engine, Pokédex catalogue & collection views at `/pokemon`, detail modal, idempotent seeding script, spectator support                                                                                                                                                            |
| Phase 4 (Pokémon Acquisition, Gacha & Economy Integrity)     | ✅ 100% Shipped & Verified: Elimination of arbitrary manual adjustments, authoritative deduplicated study hours (capped at 86.4ks/day), 500h/1000h hidden lifetime progression gates, CSPRNG acquisition engine, pity lock preservation, atomic transactions                                                                                                                                                     |
| Phase 5 (Verified YPT Identity & Trophy Ranking System)      | ✅ 100% Shipped & Verified: Searchable member selector dropdown, strict admin approval gate, 1:1 verified YPT identity protection, immutable TrophyTransaction ledger, Clash of Clans–style ranking (Recruit -> Champion), 3-layer progression profile                                                                                                                                                           |
| Phase 6 (ypt-js Integration & Automated Study Sync)          | ✅ 100% Shipped & Verified: Official ypt-js client, AES-256 encrypted refresh tokens, real group member discovery, explicit 8 connection states, live study-hour sync with 1 coin / 36s rewards and fractional carry, admin verification & audits                                                                                                                                                                |

### 1.1 Live Routes

| Route                                         | Purpose                                                                                                                                                    | Access                                 |
| :-------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------- |
| `/`                                           | Home cockpit: banner variants, progress/deficit card, Log Hours modal, Daily/Weekly task board; wrapped popup + Shy Card when `challenge_wrapped_v1` is on | Guest (local tasks only) / Participant |
| `/challenges`                                 | Dedicated public challenges directory (Events card grid, role-gated Create Challenge button)                                                               | Public spectator / Participant / Admin |
| `/changelog`                                  | Public date-grouped product changelog (unlinked; reachable by URL only)                                                                                    | Public spectator                       |
| `/challenge/[id]`                             | Tabs: Overview (includes Timetable & Forfeit Avatar) · Leaderboard · Summary (post-lock, `challenge_wrapped_v1`-gated) · Manage (admin only) · Event Audit | Public spectator                       |
| `/challenge/[id]/participant/[participantId]` | Challenge-specific participant statistics, targets, daily history & read-only profile                                                                      | Public spectator / Participant / Admin |
| `/admin`                                      | Host management console for YPT claims verification, audited trophy adjustments, and challenge operations                                                  | `ADMIN` / `DEV`                        |
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
| Global Participant Preview Mode                       | `components/ui/header.tsx`, `preview-mode.ts`                       | 1-click header toggle for mods/devs to view all pages as regular participants globally                                                                                                                             |
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
> 5. Apply the Pokémon catalogue normalization migration on the hosted DB (**backup first** — it is a one-time, non-reversible backfill that drops `PokemonSpecies.metadata`), then seed the catalogue:
>    - `npx prisma migrate deploy`
>    - `npm run db:seed:pokemon`
>
> **DS PROGRAM TRACK (separate from the product gate above):**
> Continue design-system Phase D/E — see `docs/design-system/README.md` §6.1–6.2.
> Order: ✅ DevBoard `Tabs` · ✅ `Label` (67) → **next:** `Skeleton` (~20) →
> `ScrollArea` (9) / `Avatar` (31, decide `next/image`) / `Separator` (3) / `Progress` (1)
> → per-page 9-state coverage → a11y/360px/motion sweeps → DevBoard "Design" styleguide.

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
   - Added `[⚡ DEVBOARD]` header navigation link in `components/ui/header.tsx` for `DEV` users.
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
   - Header coin badge in `features/economy/presentation/header-coin-badge.tsx` and `/wallet` navigation link in `header.tsx`.
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
- **Catalogue Seeding & Data Quality (superseded by Session 119):**
   - The 23-species idempotent upsert script (`npm run db:seed:pokemon`) and `prisma/seed-pokemon.ts` were removed in Session 119 — the catalogue is DB-resident and there is no re-seed path.
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
- **NEXT STEP (superseded by Session 119):** The catalogue importer was removed; the catalogue now lives in the DB. See Session 119.

### Session 111 — 2026-10-15 (Phase 2A — Pokémon Metadata Bundle Importer on `afnan`) — ⛔ SUPERSEDED by Session 119 (importer removed; schema normalized)

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
- **NEXT STEP (superseded by Session 119):** Live DB upsert completed; the importer and `npm run db:import:pokemon` were removed in Session 119.

### Session 112 — 2026-10-16 (Frontend Design System Audit & Token Refactoring of Economy & Pokédex on `afnan`)

- **Scope:** Frontend design system audit and token refactor strictly confined to the recently created Economy, Wallet, Betting, YPT, and Pokédex feature slices (`app/wallet/`, `app/pokemon/`, `features/economy/presentation/`, `features/pokemon/presentation/`, `features/ypt/presentation/ypt-settings-card.tsx`, `features/challenges/presentation/challenge-betting-card.tsx`, and `components/ui/header.tsx`).
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
   - `header.tsx`: Converted wallet coin icon to `text-economy-gold`.
- **Quality Gates Verified:**
   - `npm run typecheck` passed (0 errors).
   - `npm run lint` passed (0 errors).
   - `npm run test` passed (127 test files, 1269/1269 tests green).
   - `npm run build` passed (production build clean across all 16 routes).
- **Strict Exclusions Preserved:**
   - No changes to UI outside the economy and Pokédex scopes.
   - No database resets, migrations, or schema modifications.
   - No commits or pushes without explicit user instruction.
- **NEXT STEP (superseded by Session 119):** The catalogue is DB-resident and the importer was removed. See Session 119.

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

### Session 115 — 2026-10-16 (Verified YPT Identity + Trophy Ranking System on `afnan`)

- **Scope:** Complete implementation and verification of Verified YPT Identity claim workflow and Clash of Clans–style Trophy Ranking system:
   1. Searchable member selection dropdown replacing manual YPT ID entry.
   2. Strict admin approval boundary with full identity protection (1 verified YPT ID -> 1 account).
   3. Automatic study-hour synchronization restriction exclusively to verified accounts; rejection of unverified sync attempts.
   4. Authoritative trophy settlement on challenge lock (Win: +25, Loss: -15, Draw/Tie: 0, Cancelled: 0) with zero floor and idempotency keys.
   5. Compensating reversal transactions on challenge unlock.
   6. Clash of Clans–style rank tier hierarchy (Recruit -> Bronze -> Silver -> Gold -> Platinum -> Diamond -> Master -> Grandmaster -> Champion).
   7. Dedicated `/admin` console with YPT claim approval/rejection and audited trophy adjustments.
   8. Dedicated public `/leaderboard` route with podium decorations, search, and sorting.
   9. Unified 3-progression layer participant profiles (Competitive, Study, Economy).
- **Key Changes Implemented:**
   - **Prisma Schema & Migration:**
      - Added `trophyBalance Int @default(0)` to `User` model with index.
      - Added `enum YptClaimStatus { PENDING, VERIFIED, REJECTED, REVOKED }`.
      - Added `model YptIdentityClaim` with relation to `User` and `reviewedBy`.
      - Added `enum TrophyTransactionType { CHALLENGE_WIN, CHALLENGE_LOSS, ADMIN_ADJUSTMENT, REVERSAL, SEASON_RESET }`.
      - Added `model TrophyTransaction` with composite index `[userId, createdAt]`, unique `idempotencyKey`, and self-referencing reversal links.
      - Applied database migration `prisma/migrations/20261020000000_ypt_identity_and_trophy_system/migration.sql` with automatic backfill of existing verified `yptId` users.
   - **Pure Domain Engine (`features/trophies/domain/` & `features/ypt/domain/`):**
      - `trophy-types.ts` & `trophy-rank.ts`: 9-tier progression math, 0-trophy floor, rank promotion/demotion detection, milestone progress calculation.
      - `ypt-claim-state-machine.ts`: Explicit state machine validating allowed transitions (PENDING -> VERIFIED/REJECTED, VERIFIED -> REVOKED, REJECTED -> PENDING).
   - **Data Repositories & Ingest Safeguards (`features/ypt/` & `features/trophies/`):**
      - `ypt-claim.repository.ts`: Single-group member discovery, claim creation, pending conflict resolution, approval/rejection/revocation.
      - `trophy.repository.ts`: Append-only immutable `recordTrophyTransaction`, `getTrophyHistory`, `getTrophyLeaderboard`, `getUserCompetitiveStats`, `adminAdjustTrophies`, `settleChallengeTrophies`, `reverseChallengeTrophies`.
      - `ypt-ingest.service.ts`: Enforces `user.yptClaims` status check; rejects unverified users with `YPT_NOT_VERIFIED` to protect economy.
   - **Challenge Lifecycle Integration:**
      - `challenge-admin.repository.ts`: Integrated `settleChallengeTrophies` into `lockChallengeResults` and `reverseChallengeTrophies` into `unlockChallengeResults` transactions.
   - **Server Actions & Presentation UI:**
      - `ypt-claim.actions.ts` & `trophy.actions.ts`: Secure server actions with `requireAdminUser` for administrative operations.
      - `ypt-member-selector.tsx`: Searchable dropdown displaying display name, @username, YPT ID, and available/linked status.
      - `ypt-settings-card.tsx`: Integrated member dropdown with Not Connected, Pending, Verified, and Rejected status states.
      - `admin-console-view.tsx`: Host admin console with claim counters, approve/reject/revoke actions, and trophy adjustment modal.
      - `trophy-leaderboard-view.tsx` & `app/leaderboard/page.tsx`: Group competitive leaderboard with podium cards and rank filters.
      - `unified-progression-card.tsx`: Unified 3-progression layer (Competitive, Study, Economy) on participant profiles.
      - `trophy-role-badge.tsx`, `trophy-progress-bar.tsx`, `trophy-history-list.tsx`, `trophy-result-animation.tsx`.
- **Quality Gates & Verification Results (100% Green):**
   - `npm run typecheck`: 0 errors (`npx prisma generate && tsc --noEmit`).
   - `npm test`: 141 test files passing, 1,356/1,356 tests passing (100% green across all modules).
   - `npm run build`: 17/17 routes compiled successfully (including `/leaderboard`, `/admin`, `/wallet`, `/pokemon`, `/pokedex`, `/devboard`).
- **NEXT STEP:** Verify ypt-js authentication, member selection, and automatic study synchronization in the wallet cockpit.

### Session 116 — 2026-10-16 (Yeolpumta `ypt-js` Integration Foundation on `afnan`)

- **Scope:** Replacement of legacy placeholder YPT workflow with genuine Yeolpumta integration using `ypt-js` (`v0.1.0`):
   1. Package inspection: verified `YptJs` client, auth resource, groups resource, and root exports.
   2. Prisma schema migration: added `YptConnectionStatus` enum, `YptConnection` model (AES-256-GCM encrypted refresh token), `YptSyncRun` audit model, and `groupId` on `YptIdentityClaim`.
   3. Encryption service (`core/security/encryption.ts`): AES-256-GCM encryption/decryption with authenticated tags.
   4. Server client service (`features/ypt/data/ypt-client.service.ts`): authentication, session restoration, joined group listing, group member rosters with live study statuses.
   5. Connection repository (`features/ypt/data/ypt-connection.repository.ts`): upserts, session decryption, claim submission with uniqueness enforcement.
   6. Synchronization service (`features/ypt/api/ypt-sync.service.ts`): queries live stats (`todayStudyMs`), feeds `ingestYptActivity`, credits 1 coin / 36s, and logs `YptSyncRun`.
   7. Presentation: updated `ypt-settings-card.tsx` with all 8 explicit connection states, Connect Modal, and live feedback banners.

### Session 117 — 2026-10-16 (YPT Error 112 Root Cause Investigation, Error Sanitization & Session State Fix on `afnan`)

- **Scope:** Resolved the `YPT API error (code 112)` issue and fixed connection state handling for verified users without active sessions:
   1. **Traced Error 112:**
      - Origin: Yeolpumta's `POST /user/sign-in-jwt` endpoint (`https://pi.tgclab.com/v1/user/sign-in-jwt`) returning `{ s: false, c: 112, m: "" }`.
      - Meaning: `c: 112` is Yeolpumta's internal error code for **"Wrong password" / Invalid credentials** (`c: 113` = Unknown email, `c: 114` = Account suspended).
      - In `ypt-js`: throws `YptAuthError("YPT API error (code 112)")`.
      - Cause of frontend display: backend action was passing `error.message` verbatim without classifying or sanitizing it.
   2. **Pure Domain Error Classification (`features/ypt/domain/ypt-error-classifier.ts`):**
      - Created pure domain classifier mapping error codes, HTTP statuses, and network failures to user-friendly, sanitized messages:
         - Code 112 -> `INVALID_CREDENTIALS` ("Unable to authenticate with Yeolpumta. Incorrect password. Please check your credentials and try again.")
         - Code 113 -> `ACCOUNT_NOT_FOUND` ("Unable to authenticate with Yeolpumta. No account found with this email. Please check your email and try again.")
         - Code 114 -> `ACCOUNT_SUSPENDED` ("Your Yeolpumta account has been suspended. Please contact Yeolpumta support.")
         - HTTP 401 -> `SESSION_EXPIRED` ("Your Yeolpumta session has expired. Please reconnect your account.")
         - HTTP 429 -> `RATE_LIMITED` ("Too many authentication attempts. Please wait before retrying.")
         - Network errors -> `NETWORK_ERROR` ("Yeolpumta servers are temporarily unreachable. Please check your internet connection and try again.")
      - Generates safe structured logging context excluding passwords, tokens, or credentials.
   3. **Authentication Rate Limiting (`core/security/rate-limiter.ts`):**
      - In-memory sliding window rate limiter enforcing max 5 authentication attempts per 5 minutes per user. Resets on success.
   4. **Connection State Management (Phase 5 Fixes):**
      - **CASE 2 (Preserve valid session):** Reconnection failure leaves existing valid session and tokens completely untouched.
      - **CASE 3 (Verified ID without active session):** For users with legacy verified `yptId` (e.g. `11338944`) who haven't connected their session, the UI no longer falsely claims "Study synchronization is active." Instead, displays "Verified • Session Inactive" and provides a direct `[Connect YPT Session]` call to action while disabling sync until connected.
      - **CASE 4 & 5 (Safe updates):** `saveAuthenticatedYptConnection` preserves `status: VERIFIED` when connecting for an already verified user. Authentication failures do not modify or delete stored identities.
   5. **Credential Security & Disclosures (Phase 6 Fixes):**
      - Corrected misleading UI text: credentials are processed securely server-side to authenticate with Yeolpumta's official API and are never stored in plaintext (only encrypted refresh tokens retained).
      - Passwords are automatically cleared from client state on error (`setPassword("")`).
- **Quality Gates & Verification Results (100% Green):**
   - `npm run typecheck`: 0 errors.
   - `npm test`: 149 test files passed, 1,397/1,397 tests green (including new classifier, rate limiter, actions, and settings card tests).
   - `npm run build`: 17/17 App Router routes compiled cleanly.
- **NEXT STEP:** Maintainer or participant opens `/wallet` to connect YPT session, select group identity, and synchronize study hours.

### Session 119 — 2026-10-16 (Pokémon Catalogue Importer Removal & Schema Normalization via DB Backfill on `afnan`)

- **Scope:** Resolved the CI failure caused by the gitignored `pokemon_metadata.json` bundle by making the database the single source of truth for the Pokémon catalogue, deleting the one-off importer path, and normalizing the denormalized `PokemonSpecies.metadata` JSON into typed columns + child tables via a one-time backfill migration.
- **Root Cause:** `features/pokemon/data/pokemon-bundle-importer.test.ts` dry-ran the real `pokemon_metadata.json` at repo root, which is now in `.gitignore` (lines 40–43). It exists locally but never in CI checkout, so `npm run test` failed with `Pokemon metadata bundle file not found`.
- **Schema Normalization (`prisma/schema.prisma`):**
   - Promoted `PokemonSpecies` metadata scalars to columns: `specialAttack`, `specialDefense`, `speed`, `baseStatTotal`, `heightDecimetres`, `weightHectograms`, `baseExperience`, `color`, `captureRate`, `baseHappiness`, `hatchCounter`, `evolvesFromSpeciesId`, `evolutionChainId`, `growthRateId`.
   - Added `PokemonForm` (unique `pokemonId`/`slug`, `speciesId` FK cascade) and `PokemonAbility` (`@@unique([speciesId, name])`, `speciesId` FK cascade).
   - Dropped the denormalized `PokemonSpecies.metadata` column (kept `UserPokemon.metadata`).
- **Backfill Migration (`prisma/migrations/20261022000000_normalize_pokemon_catalogue/migration.sql`):**
   - Adds the columns/tables, then one-time transforms the existing `metadata` JSON in the DB into the new shape (`jsonb_array_elements` for `abilities`/`forms`, scalar casts for the rest), then drops the column.
   - Non-reversible — requires a DB snapshot before deploy.
- **Importer Removal:** Deleted `features/pokemon/data/pokemon-bundle-importer.ts`, its `...test.ts`, `scripts/import-pokemon-bundle.ts`, and the vestigial `prisma/seed-pokemon.ts`. Removed the `db:import:pokemon` and `db:seed:pokemon` npm scripts and the `seedPokemonCatalogue` call from `prisma/seed.ts`. `.gitignore` bundle entries and the local raw files were left in place.
- **Consumer Updates:** `pokemon.schema.ts` (dropped `metadata`, added new fields + `PokemonFormSchema`/`PokemonAbilitySchema`), `pokemon-catalogue.repository.ts` (new DTO fields, `forms`/`abilities` includes on detail queries and `forms` on the list query, admin upsert remapped), `pokemon-detail-modal.tsx` (reads normalized columns + `forms` relation). Updated affected pokemon test fixtures.
- **Quality Gates Verified:**
   - `npm run typecheck`: 0 errors.
   - `npm run test`: 152 test files, 1417/1417 tests green (importer test removed).
- **Re-seed path (`scripts/seed-pokemon-catalogue.ts` + `npm run db:seed:pokemon`):** Offline seeder that reads a raw metadata bundle and writes the normalized catalogue (idempotent upserts on `slug`; replaces `forms`/`abilities` on re-run). Flags: `--file=<path>` (default `./pokemon_metadata.json`), `--limit=<N>`, `--dry-run`. Used to seed the dev DB `holdmetoit3`: **1,025 species / 326 forms / 2,411 abilities** (generation coverage 1–9 exact).
- **NEXT STEP:** Maintainer snapshots the hosted DB, applies `20261022000000_normalize_pokemon_catalogue` (`npx prisma migrate deploy`), then runs `npm run db:seed:pokemon` (with the raw bundle available) and spot-checks `PokemonForm` (326) / `PokemonAbility` counts and the `/pokemon` detail modal.

### Session 120 — 2026-10-16 (Header Nav Icon Cleanup, Preview-Button Removal & Ctrl+P Preview Hotkey on `afnan`)

- **Scope:** Removed icons from the header navigation links; removed the "Preview as Participant" header button and replaced it with a global Ctrl+P (Cmd+P on macOS) hotkey that toggles participant preview for admins/devs.
- **Header (`components/ui/header.tsx`):** Removed the `CoinsIcon`/`Trophy`/`BookOpen` icons from the Wallet/Leaderboard/Pokédex nav links (now text-only); removed the preview toggle button from `UserNav` (and its now-unused `isActualAdmin` prop); mounted the new `PreviewModeHotkey` inside `AppHeader`.
- **Toast infra (`components/ui/sonner.tsx` + `app/layout.tsx`):** Added the `sonner` dependency; `<Toaster>` mounted in the root layout at `position="bottom-right"`, offset (88px) so it clears the fixed Feedback button. (Not fired by the preview toggle — see Session 121.)
- **Hotkey (`features/auth/presentation/preview-mode-hotkey.tsx`):** Client component listening for Ctrl+P/Cmd+P; reuses the preview cookie + `toggleParticipantPreviewAction` + `router.refresh()`. Gated to admins/devs; `preventDefault` keeps normal browser print for non-admins.
- **Domain (`features/auth/domain/preview-mode.ts`):** Added the pure `isParticipantPreviewHotkey(event)` matcher (Law L7).
- **Tests:** Updated `components/ui/header.test.tsx` (removed enter/exit-preview-button assertions); added matcher tests to `features/auth/domain/preview-mode.test.ts`.
- **Quality Gates:** `npm run typecheck` 0 errors; `npm run test` green; `npm run build` clean.
- **NEXT STEP:** Optional — verify Ctrl+P UX on Windows/macOS; reuse the `sonner` `<Toaster>` for other admin actions.

### Session 121 — 2026-10-17 (Trophy Leaderboard Pagination, Search & Alphabetical Sort on `afnan`)

- **Scope:** `/leaderboard` now paginates 10 players per page, keeps search by name/@username, and adds an alphabetical A–Z / Z–A sort alongside the existing Trophies / Win Rate / Total Wins sorts. Also removed the per-toggle Sonner toast on the Ctrl+P participant-preview hotkey (Session 120 follow-up) so toggling is silent.
- **Domain (`features/trophies/domain/leaderboard-query.ts`, NEW):** Pure, generic helpers (Law L7): `filterLeaderboardEntries`, `sortLeaderboardEntries`, `paginateLeaderboard`, plus `LEADERBOARD_PAGE_SIZE = 10`. No data/React/Prisma imports — the domain never depends on `TrophyLeaderboardEntry`.
- **Data (`features/trophies/data/trophy.repository.ts`):** `getTrophyLeaderboard` gained an `all?: boolean` option (`skip=0`, `take=undefined`) so the page can load the full set for client-side pagination. Default `{ page, limit: 50 }` behaviour is unchanged for the admin console + action wrappers.
- **Page (`app/leaderboard/page.tsx`):** Fetches `{ all: true }`; dropped the dead `?page=` search param and the unused `initialPagination` prop.
- **View (`features/trophies/presentation/trophy-leaderboard-view.tsx`):** Uses `useMemo` filter → sort → paginate; renders the `paginated.items` slice + `DataPagination` (`itemLabel="players"`); added a `Name A–Z / Z–A` toggle button (reuses the previously-unused `ArrowUpDown` icon); search/sort changes reset to page 1; rank medals still reflect the true global `entry.rank`.
- **NEXT STEP:** Optional — if the user base grows large enough that a single full fetch becomes heavy, revisit server-side paging (a server-side variant was implemented and then reverted the same day per maintainer preference for the client-side approach); otherwise none.
- **Reverted (same day):** The server-side pagination/search/sort variant (server-action refetch, Prisma `where`/`orderBy`/`skip`/`take`, `groupBy` win/loss counts, `$queryRaw` trophy rank) was removed and the client-side approach above restored.

### Session 123 — 2026-10-17 (Server-Side Pokédex Catalogue Pagination on `afnan`)

- **Scope:** `/pokemon`'s catalogue grid is now **server-side** paginated (24/page). Previously the page fetched all ~1,025 species (with forms) on every visit — including spectators — which risked overloading the DB. Search, filters and sort now resolve in the DB so pages stay correct.
- **Domain (`features/pokemon/domain/catalogue-query.ts`, NEW):** `CATALOGUE_PAGE_SIZE = 24` + `CatalogueSortKey` / `CatalogueScope` types.
- **Data (`features/pokemon/data/pokemon-catalogue.repository.ts`):** `listPokemonSpecies` gains an `ownedByUserId` option (`instances.some`), defaults `take` to 24, and orders rarity via DB `orderBy: [{ rarity }, { pokedexNumber }]` (the `PokemonRarity` enum order matches the domain rank, so this is now correct across pages — the old in-memory rarity sort is removed). `recent` + collection uses a bounded two-step query (owned ids → earliest `UserPokemon.obtainedAt` → slice) since Prisma can't `orderBy` a relation field.
- **Schema (`features/pokemon/domain/pokemon.schema.ts`):** `ListPokemonFilterSchema` gains `scope`, `page`, `classification`.
- **Action (`features/pokemon/api/pokemon.actions.ts`):** `getPokemonCatalogueAction` now pages/filters/sorts; `scope: "collection"` derives the user from the session (`UNAUTHORIZED` otherwise), `scope: "catalogue"` stays public.
- **Page (`app/pokemon/page.tsx`):** fetches only the first page (`limit: CATALOGUE_PAGE_SIZE`) and passes `initialTotalCount`.
- **View (`features/pokemon/presentation/pokemon-view.tsx`):** server-refetch state (search debounced ~300 ms, `useTransition`, stale-response guard); renders `DataPagination` (`itemLabel="Pokémon"`); the filter-bar "Showing N entries" text is removed; loading skeleton + error/Retry states added (Law L9); any tab/search/filter/sort change resets to page 1.
- **Filter bar (`features/pokemon/presentation/pokemon-filter-bar.tsx`):** `totalFilteredCount` prop + count text removed.
- **Tests:** repository tests cover owned scoping, DB rarity `orderBy`, 24-row page/offset, and the recent-collection branch; action tests cover collection scoping/`UNAUTHORIZED`; view test updated + a page-1-of-25 pagination case.
- **Quality Gates:** `npm run typecheck` 0 errors; `npm run test` 154 files / 1,452 tests green; `npm run build` clean (17 routes); live DB spot-check via temporary `tsx` scripts (since removed) confirmed 24/page, 1025 total, rarity/name ordering, search, and the ownership filter.
- **Docs:** `docs/pokemon/README.md` §6 added.
- **NEXT STEP:** Optional — layer request caching on the catalogue action if the extra round-trips per interaction feel slow in practice; otherwise none.

### Session 124 — 2026-10-18 (Header Admin Color, `/admin` Obsidian Theming & YPT Verification → DevBoard)

- **Scope:** (1) header Admin nav link recolored to match the other nav items; (2) the `/admin` shell moved onto `obsidian-*` tokens; (3) YPT identity verification moved from the host admin console into the DEV-only DevBoard.
- **Header (`components/ui/header.tsx`):** Admin link `text-emerald-400 hover:text-emerald-300` → `text-[#868686] hover:text-[#f4f3f6]` (identical to every other nav item).
- **`/admin` theming:** `app/admin/layout.tsx`, `app/admin/loading.tsx`, `app/admin/challenges/new/page.tsx`, `app/admin/challenges/new/loading.tsx` converted from hardcoded hex to `obsidian-*` tokens (`bg-obsidian-bg`/`card`/`elevated`/`cardHover`, `border-obsidian-border`/`borderSubtle`, `text-obsidian-text`/`textDim`, `bg-obsidian-text/20`). `AdminConsoleView` was already token-based. No hex remains under `app/admin`.
- **YPT → DevBoard:** NEW `features/ypt/presentation/ypt-verification-panel.tsx` (extracted from the admin console; themed; non-blocking inline error instead of `alert()`; reject dialog now traps focus, closes on Escape, and restores focus; stat counters are real buttons with `aria-pressed`). `features/feature-flags/presentation/devboard-view.tsx` gained a `Feature Flags | YPT Verification` section switcher (`role="tablist"`, `aria-selected`, `aria-controls`) that mounts the panel.
- **DEV-only guard:** `features/ypt/api/ypt-claim.actions.ts` — the four admin actions (`getAdminClaimsListAction`, `adminApproveClaimAction`, `adminRejectClaimAction`, `adminRevokeClaimAction`) now call `requireDevUser()` and return `FORBIDDEN_NOT_DEV`; participant-facing actions untouched. Added `revalidatePath("/devboard")` on mutations.
- **Admin console (`features/admin/presentation/admin-console-view.tsx`):** YPT tab/section/handlers/reject modal removed; now a trophy-management console (+ Challenges link).
- **Access change (intended):** YPT verification is DEV-only; ADMINs no longer see it.
- **Tests:** NEW `features/ypt/api/ypt-claim.actions.test.ts` (DEV guard allow/deny); `devboard-view.test.tsx` mocks the panel and asserts the section switcher.
- **Quality Gates:** `npm run typecheck` 0 errors; `npm run test` 155 files / 1,455 tests green; `npm run build` clean (17 routes).
- **Docs:** `docs/feature-flags/README.md` §8 added.
- **NEXT STEP:** Optional — bring the DevBoard's remaining hardcoded hex onto `obsidian-*` (deferred; only the new switcher + YPT panel are tokenized); otherwise none.

### Session 125 — 2026-10-18 (shadcn Select / Textarea / Input Migration)

- **Scope:** Replaced all **14 native `<select>`** with a new Radix-based `Select`, all **7 native `<textarea>`** with a new `Textarea`, and the remaining raw text/number/date `<input>`s with the shared `Input`. Kept native by design: the hidden file input, `<input type="color">` (×2), and the borderless emoji field.
- **Primitives:** NEW `components/ui/select.tsx` (added `@radix-ui/react-select@2.4.1`) and `components/ui/textarea.tsx`, hand-authored in the obsidian palette (trigger mirrors `input.tsx`; popover mirrors `dropdown-menu.tsx`). No shadcn CLI run (avoids rewriting the Tailwind v4 / `globals.css` setup).
- **Selects (14):** `pokemon-filter-bar` (×5; `""`↔`"ALL"` sentinel mapping keeps filter/reset semantics), `flag-editor-modal`, `challenge-leaderboard-tab` (×2), `challenge-manage-tab` (×2, incl. per-row reassign `disabled`), `challenge-overview-tab`, `challenges-list-view`, `admin-banner-modal`, `cockpit-tasks-section` (optgroups → `SelectGroup`/`SelectLabel`, `__NEW__` action item, trigger ref type → `HTMLButtonElement`).
- **Textareas (7):** `flag-editor-modal`, `admin-banner-modal`, `challenge-manage-tab`, `challenge-feedback-dialog` (×2), `challenge-creator-wizard`, `feedback-form`.
- **Inputs:** `pokemon-filter-bar` search, `ypt-member-selector` search, `feedback-form` title, `enrollment-modal` numbers (×2, pill preserved), `daily-hours-modal` date. (The other `type="number"` fields already used `Input`.)
- **Tests:** 3 static-markup tests now assert Select triggers via new `data-testid`s instead of `<option>` text (Radix portals options on open): `challenges-list-view.test`, `challenge-overview-tab.test`, `challenge-leaderboard-tab.test`.
- **Quality Gates:** `npm run typecheck` 0 errors; `npm run test` 155 files / 1,455 tests green; `npm run build` clean. Note: `/pokemon` First Load JS grew ~153 → 184 kB (five Radix Selects).
- **NEXT STEP:** Optional — continue the design-system migration for modals (Dialog/AlertDialog/Sheet), tabs, tables, switches and tooltips; verify the new Selects visually in-browser at 360px.

### Session 126 — 2026-10-18 (Monorepo Migration: `apps/web` + `apps/ypt-bot` + `packages/database`)

- **Scope:** Restructured the repo into an npm-workspaces monorepo. The Next.js app moved to `apps/web` (`@holdmetoit/web`) with history preserved via `git mv`; the YPT bot was copied from `/home/afnan/Projects/YPT` into `apps/ypt-bot` (`@holdmetoit/ypt-bot`) **without its git history and without Docker**; Prisma moved into a shared `packages/database` (`@holdmetoit/database`).
- **Layout:** root `package.json` (workspaces `apps/*`, `packages/*`, single lockfile); shared `docs/` (existing web docs + bot docs under `docs/ypt-bot/`); governance markdown at root; one root `.github/workflows/ci.yml`.
- **Database:** canonical **web** schema + 27 migrations moved to `packages/database/prisma`. The bot's separate Phase-0 14-migration history was discarded; its stale tables (`study_logs_v2`, `audit_logs`, `categories`, `tasks`, `feedbacks`, `team_members`, `leaderboard_entries`) are **absent** from the local DB (already dropped by the web's standardization migrations), so **no data migration was required**. `prisma migrate status` is clean and `prisma migrate deploy` is a no-op.
- **Shared client:** `packages/database/src/index.ts` builds to `dist/`; `apps/web/core/db/index.ts` now re-exports `@holdmetoit/database` (all 59 `@/core/db` imports untouched); the bot's `src/db.js` imports `./config/env.js` (dotenv) then the shared `prisma`.
- **Bot port:** `challenge_sync.js` + `ingestStudyLogs.js` now write `prisma.dailyStudyLog` (table `"DailyStudyLog"`) with `source: "YPT_BOT"`; the summary raw SQL uses `"DailyStudyLog"`; `challengeService` audit writes already match the canonical `AuditLog`. The DB-backed `challenge-sync.test.js` was updated to the canonical model. Dockerfile/.dockerignore dropped → **standard Node process** (`npm start -w @holdmetoit/ypt-bot`).
- **Config:** `next.config.mjs` changelog trace path → `../../CHANGELOG.md`; root `.gitignore` (`**/node_modules`, `**/.next`, `**/dist`); lint-staged → Prettier-only; `scripts/check-schema-migration.sh` watches `packages/database/prisma/**`; root CI runs install → guard → database build → web typecheck/test/build → bot tests. README updated for the monorepo commands.
- **Docs:** bot `README.md`/`doc.md`/`HANDOFF.md`/`AGENTS.md` → `docs/ypt-bot/`.
- **Quality Gates:** `npm run typecheck -w @holdmetoit/web` 0 errors; web Vitest **155 files / 1,455 tests** green; `next build` clean (from `apps/web`); bot tests **63/63**; `db:migrate:status` clean; `db:migrate` no-op.
- **Known pre-existing drift (not addressed):** `prisma migrate diff` reports `YptConnection.updatedAt` DB default and `ypt_bot_logs` FKs that the schema does not model.
- **NEXT STEP:** Point the Vercel project's **Root Directory** to `apps/web` (install at repo root); set the bot's standard-Node start command to `npm start -w @holdmetoit/ypt-bot`; add `deploy.yml` once the bot host is confirmed; optionally codemod the 59 `@/core/db` imports to `@holdmetoit/database`.

### Session 127 — 2026-10-18 (Design-System Sprint: Dialog / AlertDialog / Sheet + Table Migration)

- **Scope:** Completed the design-system migration for **alerts/confirms, custom dropdown/combobox, tables and dialogs**. Native/ hand-rolled overlays are gone from these surfaces in favour of Radix primitives.
- **Primitives (NEW):** `components/ui/{dialog,alert-dialog,sheet,table,popover,command}.tsx`, hand-authored in the obsidian palette. Added `@radix-ui/react-dialog`, `@radix-ui/react-alert-dialog`, `@radix-ui/react-popover`, `cmdk`; dev `@testing-library/react`, `@testing-library/user-event`, `jsdom`. No shadcn CLI run.
- **Alerts/confirms:** `devboard-view` 5× `alert()` → `toast.error()`; delete-flag + YPT revoke + YPT disconnect confirms → `AlertDialog`.
- **Dropdown/combobox:** `devboard-header` sort (hand-rolled mousedown) → `DropdownMenu` radio group; `ypt-member-selector` (search + `role="listbox"`) → `Popover` + `Command`.
- **Tables:** `flag-table`, `challenge-leaderboard-tab`, `participant-daily-history`, `transaction-history-table` → `Table`; the two `sr-only` accessibility tables were intentionally left.
- **Standalone dialogs → `Dialog`/`Sheet`:** `flag-audit-drawer` → `Sheet` (right); `admin-trophy-adjustment`, `admin-adjustment`, `reconciliation`, `pokemon-detail`, `acquisition-history`, `admin-banner`, `flag-editor`, `tester-selector`, `feedback`, `enrollment`, `admin-target-override`, `daily-hours`, `admin-hours-override`, `challenge-feedback` → `Dialog`. Radix now supplies overlay, focus trap, Escape, scroll lock and the close button; the per-modal backdrops, manual Escape handlers and hand-rolled X buttons were removed.
- **Inline dialogs:** YPT reject → `AlertDialog` (reason input kept, auto-focus); `challenge-manage-tab` delete-challenge + remove-participant → `AlertDialog`; `cockpit-tasks-section` add-todo / edit-task / rename-category → `Dialog`, delete-category → `AlertDialog`.
- **a11y:** each converted dialog's heading was promoted to `DialogTitle` / `AlertDialogTitle` so Radix gets an accessible name (the enrollment modal uses a `sr-only` title).
- **Tests:** the five suites that used `renderToStaticMarkup` (which cannot see Radix portal content) were converted to `// @vitest-environment jsdom` + `@testing-library/react` with a small `renderToHtml` helper — `feedback-dialog`, `challenge-feedback-dialog`, `admin-target-override-modal`, `admin-hours-override-modal`, `daily-hours-modal`. NEW `challenge-manage-tab.confirm.test.tsx` covers open → confirm → action and cancel-no-op.
- **Quality Gates:** `npm run typecheck -w @holdmetoit/web` 0 errors; web Vitest **156 files / 1,457 tests** green; `next build` clean (17 routes).
- **NEXT STEP:** Optional — continue the design-system migration for the remaining primitives (tabs, switches, tooltips, avatars/progress already exist) and do a manual 360px pass over the migrated dialogs; otherwise none.

### Session 128 — 2026-10-18 (Design-System Unification: `pokedex` + `economy` → `obsidian`)

- **Scope:** Removed both parallel token systems (`pokedex-*`, `economy-*`) so `obsidian` is the single design-system namespace. Only **color tokens** moved — the economy feature (wallet/coins/ledger) and the pokemon feature are untouched.
- **Config/CSS:** `tailwind.config.ts` gained `obsidian` accents `gold`/`goldLight`/`goldDark`/`admin`/`adminHover`/`rose` and lost the entire `economy` + `pokedex` blocks. `app/globals.css` lost all `--economy-*` (11) and `--pokedex-*` (15) vars.
- **Economy mapping (22 files + `coins-icon`, ~172 usages):** gold family → `obsidian-gold*`; `credit → obsidian-serpents-border`; `refund → obsidian-raven-border`; `adjustment → obsidian-purple-border`; `debit`/`reversal` → `obsidian-rose`; `reserved` → `obsidian-gold`; `admin*` → `obsidian-admin*`. `Badge`/`Button` variant **names** are unchanged (values repointed), so the ~24 call sites were untouched. `coins-icon` SVG uses literal obsidian hex.
- **Pokédex mapping (8 files, ~176 usages):** surfaces/borders/text collapse onto the obsidian neutral scale (`cardSubtle`+`inset → obsidian-subtle`; `textSecondary → obsidian-textMuted`; `textMuted`+`textDim → obsidian-textDim`); accents `accentPurple → obsidian-purple-border`, `accentRose → obsidian-rose`, `accentAmber → obsidian-gold`. Pokéball SVG fills use `#141414`.
- **Intended visual change:** `/pokemon` shifts from a violet-tinted dark to neutral obsidian; the `adjustment` violet shifts `#a855f7 → #8b5cf6`. All other economy mappings are value-identical to the house presets they now reuse.
- **Quality Gates:** namespace guard returns 0 (`*-pokedex-*`, `*-economy-*`, `var(--pokedex|economy)`); `npm run typecheck -w @holdmetoit/web` 0 errors; web Vitest **156 files / 1,457 tests** green; `next build` clean (17 routes); post-build CSS inspected to confirm the new utilities (incl. `/opacity` variants) are actually generated.
- **Docs:** `DESIGN.md` §2.1 updated with the accent extensions and a single-palette note.
- **NEXT STEP:** Add the ESLint guard banning arbitrary `*-[#…]` color utilities in `app/`/`features/` (the enforcement phase), then continue the design-system work (missing primitives: tabs, switch, tooltip, progress, avatar, separator, skeleton, label).

### Session 129 — 2026-10-18 (Design-System: 3-Tier Token Architecture + Raw Hex Eliminated)

- **Scope:** Slices 0–1 of the design-system program. The DS is now a **three-tier token architecture** (Primitive → Semantic → Component) and **all arbitrary hex is gone** from UI code.
- **Tiers (all in `apps/web/app/globals.css`):** Tier 1 primitives as plain `:root` vars (`--primitive-*` — no Tailwind utilities generated, so UI cannot reach them); Tier 2 semantic as `@theme inline` (`--color-*` → `text-*`/`surface-*`/`border-*`/`action-*`/`feedback-*`/`input-*`/`overlay-*`); Tier 3 component as `@theme inline` (`--color-button-*`, `card-*`, `modal-*`, `dropdown-*`, `nav-*`, `badge-*`).
- **Primitives:** neutral 50–950 (anchored on the old obsidian values), brand-1 gold / brand-2 admin / brand-3 rose, and green/blue/red/violet palettes (300/500/950 anchored) with full 50–950 ramps; plus typography, size/spacing, radius, border-width, elevation, opacity and motion primitives.
- **Slice 1 codemod:** **2,703 arbitrary hex utilities across 78 files** rewritten to semantic tokens (252 prefix+value pairs; reviewed via `--report` before `--write`). Also rewrote the 24 SVG-illustration + inline-style hex in `challenge-wrapped-modal`, the pokéball fills, the coins icon and `app/global-error.tsx` to `var(--color-*)`.
- **Legacy layer:** `obsidian-*` stays as a **deprecated alias** in `tailwind.config.ts` (hex kept so `/opacity` keeps working) — removed in slice 4. `body`/`*` now use `bg-surface-page`/`text-text-primary`/`border-border-default`.
- **Tests:** updated `challenge-wrapped-modal.test.tsx` SVG-attribute assertions. (The 5 earlier jsdom conversions unchanged.)
- **Quality Gates:** `npm run typecheck -w @holdmetoit/web` 0 errors; web Vitest **156 files / 1,457 tests** green; `next build` clean (17 routes); emitted CSS inspected — semantic utilities (incl. `color-mix` opacity variants) compile to `var(--primitive-…)`, and `--color-*`/`--primitive-*` vars are present in the output.
- **Docs:** `DESIGN.md` §1.2 (new "No raw hex, no primitive access" law) and §2 rewritten into the three tiers; NEW `docs/design-system/README.md`.
- **Known allowlists (data, not tokens):** `challenge-creator-wizard.tsx` preset team colours; test fixtures.
- **NEXT STEP:** Slice 2 — migrate the **894 `obsidian-*` class usages (38 files)** to semantic tokens, then slice 3 (component tokens for all `components/ui`), slice 4 (delete the alias layer), slice 5 (ESLint enforcement: no hex / no `var(--primitive-*)` outside `globals.css` + CI lint step). Deferred: 332 arbitrary font sizes + 157 arbitrary spacing/size values; missing primitives (tabs/switch/tooltip/progress/avatar/separator/skeleton/label); page adoption; a11y/motion/responsive sweeps.

### Session 130 — 2026-10-18 (Design System: Slices 2–5 — Alias Layer Removed & Enforced)

- **Scope:** Completed the design-system program. `obsidian-*` is gone (alias layer deleted) and the token rules are now enforced by ESLint + CI.
- **Slice 2 — `obsidian-*` → semantic:** 894 usages across 38 files remapped 1:1 (`obsidian-textDim → text-tertiary`, `obsidian-border → border-default`, `obsidian-gold → brand-1`, `serpents/raven/purple/crimson → feedback-success/info/error + accent`, etc.); opacity modifiers preserved. Fixed the stale `bg-obsidian-cardSubtle` → `bg-surface-secondary`.
- **Slice 3 — component tokens:** `components/ui` now consume their own tier-3 tokens (button, badge, input, textarea, select, card, dialog, alert-dialog, sheet, dropdown-menu, popover, command, header). Tier 3 expanded with `button-outline/ghost/secondary-*`, `input-field-*`, badge variant borders, and aligned values so there is **no visual change** (`action-primary` = white, `modal-bg` = `surface-primary`, `dropdown-border` = `border-strong`, `overlay-backdrop` = 70%).
- **Slice 4 — alias deletion:** removed the entire `obsidian: { … }` block from `tailwind.config.ts` after confirming 0 usages.
- **Slice 5 — enforcement:** added four core `no-restricted-syntax` rules to `.eslintrc.json` (raw hex classes, raw hex in `fill/stroke/color` attrs, `var(--primitive-*)`, legacy `obsidian-*`); `lint` now covers `app · components · features · core · lib`; added an explicit **Web lint** step to `.github/workflows/ci.yml`. Verified with a throwaway probe: all four rules error, then removed the probe.
- **Quality Gates:** `obsidian-*` grep = 0; hex-utility grep = 0; `var(--primitive-*)` outside `globals.css` = 0; `npm run typecheck` 0; `npm run lint` 0 errors; web Vitest **156 files / 1,457 tests** green; `next build` clean (17 routes).
- **Docs:** `docs/design-system/README.md` migration table marked complete + enforcement section.
- **NEXT STEP (deferred program):** typography/spacing tokenisation (332 arbitrary font sizes, 157 arbitrary spacing/size values); missing primitives (tabs/switch/tooltip/progress/avatar/separator/skeleton/label); page-by-page adoption incl. 9-state coverage; a11y/360px/motion sweeps; DevBoard living styleguide.

### Session 131 — 2026-10-18 (Typography & Recurring-Size Tokenisation)

- **Scope:** Moved arbitrary font sizes and the recurring fixed dimensions onto tokens. Values are **exact** (no visual change); only naming/consolidation changed.
- **Typography (332 occurrences, 76 files touched):** added primitives `--primitive-font-size-8/9/10/11/15/36/38/60/80` and semantic `--text-micro` 8 · `--text-caption` 9 · `--text-label` 10 · `--text-meta` 11 · `--text-body` 15 · `--text-body-lg` 16 · `--text-display-sm/md/lg/xl/2xl` 32/36/38/60/80. Codemod replaced every `text-[Npx]`; 7 fluid/relative values (`clamp(...)`, `0.3em`) left arbitrary by design.
- **Sizing (9 recurring values):** `--spacing-control-sm/md/lg` (44/50/74) · `--spacing-dropdown-min` (170) · `--spacing-panel-sm` (400) · `--container-artwork-sm/md` (200/240) · `--container-panel-sm/md/lg` (400/620/840); `min-w-[8rem]` → native `min-w-32`. Layout math (`calc/min/vh/var/env`) and ~80 one-off dimensions remain arbitrary intentionally.
- **Enforcement:** two new rules — arbitrary px font sizes (`text-[Npx]`) and re-introduced tokenised sizes (`min-h/h/min-w/max-w-[44|50|74|170|200|240|400|620|840px]`). `clamp`/`em` and layout math pass.
- **Quality Gates:** `text-[Npx]` = 0 · tokenised-size literals = 0 · typecheck 0 · lint 0 errors · web Vitest **156 files / 1,457 tests** green · `next build` clean · emitted CSS confirmed (`.text-meta`, `.min-h-control-sm{min-height:44px}`, `.md:text-display-lg`, `.md:max-w-panel-lg`).
- **Docs:** `DESIGN.md` §2.2 (sizing row) + §3.2 type-scale token table; `docs/design-system/README.md` §3.3 + migration table.
- **Remaining arbitrary values:** 7 fluid font sizes; 83 spacing/size values (layout math + one-offs) — intentional, not linted.
- **NEXT STEP:** missing primitives (tabs/switch/tooltip/progress/avatar/separator/skeleton/label), then page adoption + 9-state coverage, then a11y/360px/motion sweeps and the DevBoard styleguide.

### Session 132 — 2026-10-18 (Missing UI Primitives Added)

- **Scope:** Added the 11 missing primitives, bringing `components/ui` to **29**. All are additive — no existing page changed.
- **New primitives:** `tabs` (Radix), `switch`, `tooltip` (+ `TooltipProvider` mounted once in `app/layout.tsx`), `progress`, `avatar`, `separator`, `label`, `alert` (plain + cva, 5 variants), `radio-group`, `scroll-area`, `skeleton` (plain).
- **Dependencies:** added `@radix-ui/react-{tabs,switch,tooltip,progress,avatar,separator,label,radio-group,scroll-area}` to `@holdmetoit/web`.
- **Tokens:** Tier 3 gained `radio-*` (bg/border/selected), `switch-*` (track/track-active/thumb) and `checkbox-*` (bg/border/check). `checkbox.tsx` migrated off the shadcn `primary/ring` vars onto these tokens.
- **Styling:** all obsidian — semantic tokens for surfaces/text/borders, `brand-1` for active switch/progress/radio, `feedback-*` for alert variants, `shadow-dropdown` for tooltips.
- **Tests:** NEW `components/ui/primitives.test.tsx` (jsdom/RTL) — tabs activation, switch toggle, radio selection, progress `aria-valuenow/max`, avatar fallback, alert role/content, label↔input association, separator role, skeleton `aria-hidden`. **9/9 green.**
- **Quality Gates:** `npm run typecheck` 0; `npm run lint` 0 errors; web Vitest **157 files / 1,466 tests** green; `next build` clean (17 routes, First Load JS unchanged at 87.4 kB); emitted CSS confirmed for `bg-switch-track-active`, `border-radio-selected`, `bg-checkbox-bg`, `rounded-pill`, `shadow-dropdown`.
- **Docs:** `docs/design-system/README.md` §3.4 (component tokens + inventory); `DESIGN.md` §4 inventory note.
- **NEXT STEP:** Phase D adoption — Tabs → the 6 `role="tablist"` surfaces (DevBoard switcher first), Skeleton → 22 `animate-pulse` placeholders, Separator → 3 `<hr>`, ScrollArea → selective `overflow-y-auto` containers, Progress → the 1 `role="progressbar"`, Avatar → header/profile/leaderboard images; then the a11y/360px/motion sweeps.

### Incoming from `dev` (PR #126, merged 2026-10-18)

> These sessions ran on the `krish`/`dev` line in parallel with the `afnan` sessions above; original session numbers are preserved.

### Session 114 — 2026-10-17 (Fallback Profile Page for Unenrolled & Post-Event Registered Users on `krish`)

- **Agent Role:** Data & Identity Agent, Participant UI Agent, Scoring & Engine Agent.
- **Scope & Problem Analysis:**
   - Users who signed up after a challenge concluded, or who do not have any participation data in the website, received an error page (404 Not Found "Participant Record Not Found" or redirection away) when attempting to view their profile for a challenge.
   - Root causes:
      1. `/challenge/[id]/participant/[participantId]/page.tsx` called `notFound()` whenever `getChallengeParticipantStats` returned `null`.
      2. `getChallengeParticipantStats` only matched on `participantId` (not `userId`) and returned `null` for unenrolled users.
      3. In `app/profile/page.tsx`, if the user was unenrolled, it attempted to look for another challenge or redirected to `/challenges` instead of allowing viewing of their profile in that challenge context.
- **Implementation & Resolution:**
   - **Domain & ViewModel:**
      - Added `isFallback?: boolean` property to `ParticipantStatsViewModel` in `features/participant-stats/domain/participant-stats.types.ts`.
   - **Data Layer (`features/participant-stats/data/participant-stats.repository.ts`):**
      - Updated `getChallengeParticipantStats`:
         1. First queries `prisma.challengeParticipant.findUnique({ where: { id: participantId } })`.
         2. If not found, checks `prisma.challengeParticipant.findFirst` matching `userId: participantId` (or `currentUserId` when `participantId === "me"`).
         3. If still not found, queries `prisma.user.findUnique({ where: { id: targetUserId } })` and `prisma.challenge.findUnique({ where: { id: challengeId, isDeleted: false } })`. If both exist, returns a complete fallback `ParticipantStatsViewModel` with `isFallback: true`, total participants, unranked metrics, and viewer permissions.
   - **Routing (`app/profile/page.tsx`):**
      - When `searchParams?.challengeId` is provided and the user is not enrolled, redirects to `/challenge/${searchParams.challengeId}/participant/${session.user.id}` to render the fallback profile in that challenge.
      - When `searchParams?.challengeId` is not provided and the user has no enrollments across any challenge, finds the latest active/concluded challenge via `prisma.challenge.findFirst({ where: { isDeleted: false }, orderBy: { createdAt: "desc" } })` and redirects to `/challenge/${latestChallenge.id}/participant/${session.user.id}` (falling back to `/challenges` only if no challenges exist at all).
   - **Presentation Layer:**
      - **`features/participant-stats/presentation/participant-fallback-banner.tsx` (New):**
         - Created Obsidian Dark alert card with distinct contextual messaging for completed events vs open enrollment, and for profile owner vs external spectator.
         - Provides accessible $\ge 44\text{px}$ action buttons (`Browse Challenges Directory`, `View Challenge Scoreboard`, `Return to Lounge`).
      - **`features/participant-stats/presentation/participant-profile-header.tsx`:**
         - Displays "Spectating in [Challenge]" instead of "Competing in", neutral "Not Enrolled" status badge, "Unranked", and hides admin controls.
      - **`features/participant-stats/presentation/participant-summary-cards.tsx`:**
         - Renders `—` ("No target declared") for target, `0%` ("Not enrolled in challenge") for progress, `Unranked` for rank, and `Not Enrolled` for target status.
      - **`features/participant-stats/presentation/participant-daily-history.tsx`:**
         - Renders clean dashed Obsidian zero-state container ("No Study Sessions Recorded") clarifying that daily logs and leave days appear only for enrolled participants.
      - **`features/participant-stats/presentation/participant-stats-view.tsx`:**
         - Surfaces `ParticipantFallbackBanner` and suppresses enrolled-only widgets (`ParticipantProgressChart`, `ParticipantTeamStats`, `ParticipantAccountability`, `AdminTargetOverrideModal`).
- **Test Coverage:**
   - `features/participant-stats/data/participant-stats.repository.test.ts`: Added unit tests for fallback profile generation, userId lookup, and `me` alias lookup. (9 tests passing).
   - `app/profile/page.test.tsx`: Added tests verifying fallback routing to targeted challenge or latest challenge for unenrolled users. (6 tests passing).
   - `features/participant-stats/presentation/participant-stats-view.test.tsx`: Added test cases for fallback profile rendering and spectator-focused fallback messaging. (10 tests passing).
- **Quality Gates Verified:**
   - `npx tsc --noEmit` passed (0 errors).
   - `npm run test` passed (105 test files, 1138/1138 tests green).

### Session 115 — 2026-10-18 (Solo Free-For-All Blocker Resolutions & Host Pardon UI on `krish`)

- **Agent Role:** Scoring & Engine Agent, Admin Operations Agent, Participant UI Agent.
- **Scope & Problem Analysis:**
   - Prepared platform for Monday's Solo Free-For-All Challenge.
   - Identified 2 critical showstoppers:
      1. _Solo Auto-Punishment Math:_ In `SOLOS` format, evaluating participants on `isInWinningTeam` caused every solo participant to be punished regardless of hours or completed tasks.
      2. _Team Capacity Bottleneck:_ `createAdminChallenge` capped solo teams at `maxMembers = 1`, blocking all participants beyond the first from joining the challenge team.
   - Identified missing Host Pardon UI (`FEAT-PUN-04`), leaving admins unable to excuse participants from punishments.
   - Identified branding discrepancies ("Unassigned ⏳" instead of "⚡ Solo Scholar" for solo participants).
- **Implementation & Resolution:**
   - **Solo Auto-Punishment Math:**
      - Updated `lockChallengeResults` (`features/challenges/data/challenge-admin.repository.ts`) and `buildParticipantWrapped` (`features/wrapped/domain/wrapped.ts`): for `SOLOS` format, `isInWinningTeam = true` automatically.
      - Solo participants are judged solely on meeting declared target hours and finishing all challenge-linked weekly tasks.
   - **Team Capacity Uncapped for Solos:**
      - Updated `createAdminChallenge` to set `maxMembers = null` for `SOLOS`.
      - Updated `enrollParticipantInChallenge`, `adminEnrollParticipant`, and `reassignParticipantTeam` in `participant.repository.ts` to bypass team capacity checks when `challenge.format === "SOLOS"`.
   - **Branding Polish:**
      - Replaced "Unassigned ⏳" with "⚡ Solo Scholar" across `cockpit-data.ts`, `leaderboard-data.ts`, `participant-stats.repository.ts`, and `challenge-manage-tab.tsx`.
   - **Host Pardon UI (`FEAT-PUN-04`):**
      - Built `AdminPardonModal` (`features/accountability/presentation/admin-pardon-modal.tsx`) with Obsidian tokens, reason validation ($\ge 3$ characters), loading states, and error handling.
      - Integrated "Pardon" action button and modal into `ChallengeManageTab`.
      - Added cache invalidation (`cacheTags.challengeScoreboard`) to `adminPardonAction`.
      - Decoupled client modal imports from server-only auth dependencies via dynamic import.
- **Test Coverage:**
   - `challenge-admin.repository.test.ts`: Added tests for solo challenge locking with target deficits vs target achievements.
   - `participant.repository.test.ts`: Added tests verifying uncapped enrollment for `SOLOS` challenges.
   - `admin-pardon-modal.test.tsx`: Added 4 unit tests covering modal rendering, reason validation, action submission, and close handlers.
   - `challenge-manage-tab.test.tsx` and `challenge-images.test.tsx`: Verified all tests pass.
- **NEXT STEP (completed in Session 116):** Restore Punishment Wall UI (`FEAT-PUN-02`) and build automated Solo Challenge lifecycle E2E verification suite.

### Session 117 — 2026-10-18 (Safe Routing, Canonical Path Normalization & Edge Guard Optimization on `krish`)

- **Agent Role:** Data & Identity Agent, Admin Operations & Broadcaster Agent, Participant UI Agent.
- **Scope & Objectives:**
   - Audit paths, guards, and routes across the application for security, discoverability, and zero regression.
   - Implement URL normalization, dead revalidation cleanup, auth dev-bypass hardening, changelog navigation, and lightweight edge guard middleware.
- **Implementation & Resolution:**
   - **Phase 1 — Canonical Redirects (`next.config.mjs`):**
      - Added HTTP 308 permanent redirects: `/challenges/:id` -> `/challenge/:id`, `/challenge` -> `/challenges`, `/challenges/new` -> `/admin/challenges/new`, `/dashboard` -> `/`.
      - Preserved negative lookahead `(?!new$)` to ensure admin challenge creation is never misdirected.
      - Verified with `next.config.test.ts`. Commit: `c469028`.
   - **Phase 2 — Ghost Route & Revalidation Purge:**
      - Purged dead `revalidatePath("/dashboard")` and `/admin/challenges/[id]` across Server Actions: `admin-pardon.actions.ts`, `challenge-admin.actions.ts`, `enroll-participant.actions.ts`, `admin-override.actions.ts`, `log-study-time.actions.ts`, and `task.actions.ts`.
      - Updated test assertions in `log-study-time.actions.test.ts`. Commit: `5b11b5e`.
   - **Phase 3 — Auth Dev-Bypass Hardening:**
      - Hardened `isDevBypass` in `app/admin/layout.tsx` and `app/devboard/layout.tsx` to strictly require `process.env.NODE_ENV === "development"`, closing accidental exposure if `AUTH_DISCORD_ID` is omitted in staging or preview deployments.
      - Added unit test suites `app/admin/layout.test.tsx` and `app/devboard/layout.test.tsx`. Commit: `d04ac07`.
   - **Phase 4 — Navigation Discoverability & Fallback Sanitization:**
      - Added Changelog navigation link in `features/auth/presentation/auth-nav.tsx` `<AppHeader>` alongside Challenges.
      - Sanitized hardcoded `"seed-honey-bees-vs-lavender-butterflies"` cockpit challenge fallback in `app/page.tsx` and `home-cockpit-view.tsx`.
      - Updated tests in `auth-nav.test.tsx`. Commit: `6809675`.
   - **Phase 5 — Lightweight Edge Guard Middleware:**
      - Created `middleware.ts` running at Edge runtime to intercept `/admin/:path*` and `/devboard/:path*`.
      - Evaluates session token presence (`authjs.session-token`, `__Secure-authjs.session-token`) to deflect unauthenticated traffic to `/` before Server Components run.
      - Preserves database session model without triggering `@prisma/client` edge runtime incompatibility.
      - Added test suite `middleware.test.ts` (6 tests). Commit: `b05393b`.
- **Quality Gates Verified:**
   - `npx tsc --noEmit` passed (0 errors).
   - `npm run test` passed (112 test files, 1164/1164 tests green).
   - `npx next build` passed (all 12 routes + Edge Middleware compiled cleanly).

### Session 116 — 2026-10-18 (Punishment Wall Restoration & Solo Challenge Lifecycle E2E Suite on `krish`)

- **Agent Role:** Participant UI Agent, Scoring & Engine Agent, Admin Operations Agent.
- **Scope & Objectives:**
   1. Restore and integrate the Punishment Wall (`FEAT-PUN-02`) into the challenge Overview tab (`ChallengeOverviewTab`), completing the final missing P0 user interface component.
   2. Implement an automated end-to-end Solo Challenge Lifecycle verification suite (`features/e2e/solo-challenge-lifecycle.test.ts`), completing Phase 4 of `solo-blockers.md`.
- **Implementation & Resolution:**
   - **`PunishmentWall` Component (`features/accountability/presentation/punishment-wall.tsx`):**
      - Built using Obsidian Dark design tokens (`#141414`, `#1c1c1c`, `#262626`, `#ff5757`, `#85ff93`).
      - Pre-lock mode: Previews scholars in live deficit / catch-up mode, remaining deficit hours, and weekly goals progress, with an accessible zero-state alert when all participants are on track.
      - Post-lock mode: Renders the final accountability roster displaying punished scholars and excused scholars (host pardons).
      - Preserves 1-click direct Forfeit Avatar download button (`FEAT-PUN-03`).
      - Integrated directly into `features/challenges/presentation/challenge-overview-tab.tsx`.
   - **Automated Solo Challenge Lifecycle E2E Suite (`features/e2e/solo-challenge-lifecycle.test.ts`):**
      - Tests full end-to-end Solo Free-For-All challenge lifecycle:
         1. Admin creates `SOLOS` challenge with uncapped solo team (`maxMembers: null`).
         2. Multiple scholars enroll without hitting capacity limits; declarations lock upon kickoff transition (`UPCOMING` -> `ACTIVE`).
         3. Dynamic daily study logging and catch-up deficit pace calculation without grace passes (Law L3).
         4. Results lock evaluation (Law L6): verifies participants meeting hours and goals are saved (bypassing losing_team penalty for `SOLOS`), participants with deficits are punished with `hours_deficit`, and participants with incomplete tasks are punished with `incomplete_weekly_tasks`.
         5. Wrapped story generation (`buildChallengeWrappedViewModel`): verifies `verdict: "saved"` for compliant scholars, `verdict: "punished"` for deficit scholars, and `teamResult: "winner"` across all solo participants.
- **Test Coverage:**
   - `features/accountability/presentation/punishment-wall.test.tsx`: 4 unit tests covering header rendering, zero-state active, live deficit members, and completed roster.
   - `features/challenges/presentation/challenge-overview-tab.test.tsx`: Updated tests verifying integrated PunishmentWall rendering.
   - `features/e2e/solo-challenge-lifecycle.test.ts`: 1 comprehensive E2E journey test passing.
- **Quality Gates Verified:**
   - `npx tsc --noEmit` passed (0 errors).
   - `npm run test` passed (108 test files, 1149/1149 tests green).
   - `npx next build` passed (all 12 routes compiled cleanly).
- **NEXT STEP (Monday Kickoff Operations):**
   1. Confirm Supabase storage environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
   2. Confirm Discord OAuth configuration (`DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `AUTH_SECRET`, redirect URI) and admin credentials (`DISCORD_ADMIN_ROLE_IDS` or `DEV_DISCORD_IDS`).
   3. Run `npx prisma migrate status` on the production database.
   4. Host creates the Solo Free-For-All challenge on Monday, participants enroll, and host triggers "Start Event Now".

### Session 133 — 2026-10-18 (System Kill Switches: Pokémon, Betting, Global Leaderboard)

- **Scope:** Three DB-driven, **default-off** feature flags gate the public and mutation surface of each system. Missing/disabled flags evaluate `false`, so the systems are locked until enabled.
- **Keys (`features/feature-flags/domain/feature-flag-keys.ts`):** `pokemon_system_v1`, `betting_system_v1`, `global_leaderboard_v1`.
- **Pokémon:** `/pokemon` returns a locked `EmptyState` and skips all data loading; the header Pokédex link is hidden; `pullPokemonAction` returns `FEATURE_DISABLED`. Admin banner/species CRUD stays available for preparation.
- **Betting:** the overview card is not rendered; `placeWagerAction` returns `FEATURE_DISABLED`. **Wager settlement at lock remains unconditional** so placed stakes always resolve.
- **Leaderboard:** `/leaderboard` locked state + hidden nav; `getTrophyLeaderboardAction` and `adminAdjustTrophiesAction` return `FEATURE_DISABLED`; `lockChallengeResults(..., { settleTrophies })` skips trophy settlement when off; unlock reversal stays unconditional. Stored trophies/rank badges remain visible.
- **Plumbing:** `app/layout.tsx` bulk-evaluates the two nav flags (`getFeatureFlags`) and passes `showPokemonNav` / `showLeaderboardNav` to `AppHeader` (optional props, default `true`); `app/challenge/[id]/page.tsx` passes `isBettingEnabled` → `ChallengeView` → `ChallengeOverviewTab`.
- **Tests (+11):** disabled guards for pull/wager/leaderboard/trophy actions; locked Pokémon + leaderboard pages; hidden betting card and nav links; `settleTrophies:false` skips trophies but still settles wagers.
- **Quality Gates:** `npm run typecheck` 0; `npm run lint` 0 errors; web Vitest **163 files / 1503 tests** green; `next build` clean (17 routes + middleware).
- **Docs:** `docs/feature-flags/README.md` §9.
- **NEXT STEP:** Create the three flags in the DevBoard as **DISABLED**, verify the locked UX, then roll out **TARGETED → GLOBAL**.

### Session 134 — 2026-10-18 (Feature Flags: Master Switch Removed — Rollout Is the Only Control)

- **Problem:** The DevBoard exposed two controls — the `isEnabled` master switch ("Environment Status") and `rolloutMode`. The evaluator checked `isEnabled` first, so selecting **Global** alone left a flag `false` (screenshot: Global + Off, "Active Global 0"). Selecting Global now enables the feature.
- **Decision (user):** Remove the master switch entirely; `rolloutMode` is the single control. `DISABLED` = off (kill switch), `TARGETED` = assigned testers, `GLOBAL` = everyone.
- **DB:** dropped `FeatureFlag.isEnabled`; index `[isDeleted, isEnabled]` → `[isDeleted, rolloutMode]` (migration `20261023000000_remove_feature_flag_master_switch`). Existing `GLOBAL`/`TARGETED` rows that were master-killed become active by design (the three system flags turn on; `challenge_wrapped_v1` stays off).
- **Code:** evaluator/type/zod no longer carry `isEnabled`; `toggleMasterSwitchTx` / `toggleMasterSwitchAction` / `toggleMasterSwitchSchema` deleted; repo create/audit/soft-delete updated; DevBoard counters/filters derive from `rolloutMode`; "Environment Status" column and the kill-switch dropdown item removed; editor form shows only Initial Rollout; unused `flag-card.tsx` deleted. Historical `TOGGLED_MASTER` audit rows still render in the audit drawer.
- **Seed:** `packages/database/prisma/seed-feature-flags.ts` (+ `run-seed-feature-flags.ts`); NEW script `npm run db:seed:flags` (also run by `prisma db seed`) upserts `pokemon_system_v1` / `betting_system_v1` / `global_leaderboard_v1` as **DISABLED** with `update: {}`, so operator rollout changes survive re-runs.
- **Quality Gates:** `npm run typecheck` 0; `npm run lint` 0 errors; web Vitest **163 files / 1500 tests** green; `next build` clean. Migration applied to local `holdmetoit3`.
- **Docs:** `docs/feature-flags/README.md` §1–§3, §5–§7, §9 rewritten to the rollout-only model.
- **NEXT STEP:** In `/devboard`, set `pokemon_system_v1` to **Global** and confirm `/pokemon` + the Pokédex nav appear immediately; repeat for betting and the global leaderboard. Then commit.

### Session 135 — 2026-10-18 (Design System Phase 0 — Doc Drift Corrected & Phase D/E Scoped)

- **Scope:** Pre-flight for the design-system Phase D/E program. No UI/token changes.
- **`docs/design-system/README.md`:** enforcement count corrected **4 → 6** (added `text-[Npx]` and tokenised size literals); migration table gained **row 7** for the Session 132 primitive kit (11 added → 29); the stale "Deferred: missing primitives …" paragraph replaced with **§6.1 Phase D adoption targets** (verified counts) and **§6.2 Phase E sweeps**.
- **`DESIGN.md` §2.4:** "Legacy alias layer (temporary)" → "Legacy aliases (removed)" — the `obsidian-*` block was deleted in slice 4.
- **`components/ui/card.tsx`:** retained (not dead code — reserved for upcoming surfaces) and marked; inventory stays **29**.
- **Branch status recorded:** `a48bd8f` is in `dev`/`origin/dev` (`dev == afnan-jr == c8f9447`); `main` trails. Header branch line refreshed.
- **Quality Gates:** `npm run typecheck:web` 0 · `npm run lint:web` 0 errors · `npm run test:web` green.
- **NEXT STEP:** Phase D — adopt `Tabs` in `devboard-view.tsx:321` first, then ship `Label` + `Skeleton`.

### Session 136 — 2026-10-18 (Design System Phase D: DevBoard Tabs + Label Adoption on `afnan-jr`)

- **Scope:** Phase D primitive adoption. Slice D1 (Tabs) + D2 (Label) shipped; no token changes.
- **D1 — Tabs:** `devboard-view.tsx` hand-rolled switcher (2 buttons + manual `role`/`aria-selected` + ternary panels) → controlled Radix `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` bound to the existing `section` state; the exact look is preserved via `rounded-2xl!`/`rounded-xl!` overrides (−23 lines). The two `role="tablist"`/`aria-selected` test assertions are unchanged.
- **D2 — Label (67 sites / 19 files):** `label.tsx` default neutralised (dropped `text-meta` + `leading-none`, kept `font-medium`/`text-text-secondary`) so adoption is visually neutral; every raw `<label>` → `<Label>`; **43** single-control `htmlFor`+`id` pairs added; **3** non-native controls wired (2 Radix `Select` triggers + 1 Popover trigger button); **16** group labels associated via `id` + `role="group" aria-labelledby` (button grids / HH:MM:SS input rows). The 5 pre-existing `htmlFor` sites are preserved.
- **Finding:** `cn` (tailwind-merge) does not recognise this project's custom `rounded-*` scale, so a primitive's radius default survives a plain override — D1 therefore needed the first `/important` utilities in the repo. Candidate follow-up: an `extendTailwindMerge` config teaching it the custom scales, which would remove the need for `!`.
- **Quality Gates:** `npm run typecheck:web` 0 · `npm run lint:web` 0 errors · `npm run test:web` **163 files / 1500 tests** green; raw `<label>` outside `components/ui` = **0**.
- **NEXT STEP:** Phase D — `Skeleton` (~20 `animate-pulse`), then `ScrollArea` (9) / `Avatar` (31) / `Separator` (3) / `Progress` (1), then per-page 9-state coverage + Phase E sweeps.
