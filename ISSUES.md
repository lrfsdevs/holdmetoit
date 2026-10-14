# ISSUES.md — Project Audit & Known Issues Tracker

> **Audited:** 2026-10-10 · **Architectural Audit Update:** 2026-10-14 · **Branch:** `afnan-jr`  
> **Method:** Full codebase inspection — config, schema, routes, features, domain, tests, security & Next.js architecture (dead code, import traps, DRY, complexity)  
> **Total Findings:** 46 (10 critical · 16 medium · 15 low · 5 feature suggestions)

---

## 🔴 Critical / Immediate Fixes (Blocks Production)

### 1. Lock Results Fails After Natural Expiry (D1) — ✅ RESOLVED (2026-10-11)

**Resolution:**

- Added `resultsLockedAt DateTime?` column to `Challenge` in `prisma/schema.prisma` and applied migration `20261011000000_add_results_locked_at_to_challenge`.
- Updated `canLockChallenge` and `assertCanLockChallenge` in `features/challenges/domain/challenge-lifecycle.ts` to accept `resultsLockedAt`, permitting lock/finalization when status is `COMPLETED` and `resultsLockedAt` is null/undefined.
- Updated `lockChallengeResults` in `challenge-admin.repository.ts` to pass `challenge.resultsLockedAt`, persist `resultsLockedAt = now` inside the transaction, and record audit details.
- Updated `challenge-manage-tab.tsx` to conditionally display the "Lock Final Results" button whenever `canLockChallenge(challenge.status, challenge.resultsLockedAt)` is true, and display a "Results Locked" indicator once finalized.
- Verified with unit tests (`challenge-lifecycle.test.ts`, `challenge-admin.repository.test.ts`), full typecheck, 833 green tests, and production build.

---

### 2. Dual-Failure Runs on Hours Only — Law L6 Partial Violation (D4) — ✅ RESOLVED (2026-10-11)

`lockChallengeResults` passed an empty `[]` for goals, so the old Dual-Failure Invariant (`FEAT-PUN-01`) evaluated hours only. Weekly goals were dropped in migration `20261004030000`.

**Resolution (Decision 2026-10-11):** challenge-scoped goals returned as **challenge-linked tasks** (`Task.challengeId`; new tasks are stamped to the user's current challenge by default, with a one-time backfill for existing tasks). Law L6 was redefined as the **Three-Condition Accountability Invariant**: saved only when (1) all challenge-linked weekly tasks are completed, (2) target hours are met, and (3) the participant is in a winning team — ties never punish. `lockChallengeResults` now evaluates all three conditions (soft-deleted weekly tasks still count), and `PunishmentRecord` rows are created only for punished members while pardons are preserved.

---

### 3. Five P0 Feature UIs Were Deleted, Backend Still Exists (D3)

These features have working backend code but **zero UI** — deleted in commits `88779bd` and `364c7a1`:

| Feature                                 | Backend                              | UI Status                                                           |
| --------------------------------------- | ------------------------------------ | ------------------------------------------------------------------- |
| Punishment Wall (`FEAT-PUN-02`)         | `punishment.ts` domain logic         | ❌ `punishment-wall.tsx` deleted                                    |
| Punishment PFP Download (`FEAT-PUN-03`) | PFP upload to Supabase works         | ✅ Live in Overview tab Forfeit Avatar & Accountability card        |
| Host Pardon Modal (`FEAT-PUN-04`)       | `adminPardonAction` exists           | ❌ `admin-goals-pardons.tsx` deleted                                |
| Discord Summary Copy (`FEAT-DISC-01`)   | Superseded by Summary tab & Wrapped  | ✅ Removed from scope & codebase (Session 104)                      |
| Host Goal/Target Edit (`FEAT-DECL-04`)  | `adminUpdateParticipantTargetAction` | ✅ Wired to `AdminTargetOverrideModal` (Manage, Leaderboard, Stats) |

---

### 4. Schema Drift — No Migration Files for Production Tables (D5)

The `feedbacks` table, `categories`, `tasks`, and related `sort_order` columns were applied via `prisma db push` and have **no migration files**. Running `prisma migrate deploy` on a fresh database produces an incomplete schema.

**Fix:** Run `prisma migrate diff` to generate catch-up migrations and `prisma migrate resolve` on existing databases.

**Progress (2026-10-10, Session 79):** This drift class caused the PR #67 production incident — `isLeave` was declared in `schema.prisma` but the push-managed DB never received it, so every Prisma query selecting/including it threw `P2022` at runtime. Resolution: idempotent migration `20261010120000_add_is_leave_to_study_logs` applied (verified by re-introspection), and `scripts/check-schema-migration.sh` + `.github/workflows/ci.yml` now block any PR that changes `prisma/schema.prisma` without a `prisma/migrations` change. Remaining drift to reconcile: `feedbacks`, `sort_order` columns.

---

### 5. ✅ Resolved (Session 81) — npm Audit: Security Vulnerabilities

`npm audit` reports **multiple high-severity** CVEs:

| Package                              | Severity    | Issue                                                                     |
| ------------------------------------ | ----------- | ------------------------------------------------------------------------- |
| `brace-expansion` (via ESLint, glob) | 🔴 High     | DoS via uncontrolled recursion (GHSA-q2hr-2g5m-vwhr, GHSA-qhr7-859c-m2p7) |
| `braces` (via tailwindcss/chokidar)  | 🔴 High     | Stack exhaustion via nested patterns (GHSA-vfj7-8cjw-p6xm)                |
| `@vitest/mocker`                     | 🟠 Moderate | Path traversal / arbitrary file read (GHSA-82fw-gwwq-j7x9)                |

**Resolved (Session 81):** `brace-expansion` re-resolved to the patched `1.1.21` / `2.1.7` / `5.0.12`; `braces` (via `chokidar`) removed by the Tailwind v4 migration; `@vitest/mocker` patched by the Vitest v5 bump. `npm audit` dropped from 20 → 8 advisories. The remaining 8 are **out of scope** here — they require Next.js 16 / `eslint-config-next` 16 majors (Next RSC/Image DoS + cache-poisoning advisories, `glob` CLI injection via `@next/eslint-plugin-next`, and the `postcss` copy nested inside Next 14).

---

## 🟠 Medium Priority — Functional Issues & Law Violations

### 6. Hardcoded Seed Challenge ID Fallback

`app/page.tsx` L83:

```tsx
challengeId={cockpit?.challengeId ?? upcomingChallenge?.id ?? "seed-honey-bees-vs-lavender-butterflies"}
```

If a user has no active challenge and no upcoming challenge, the cockpit falls back to a seed data ID. In production, this seed challenge won't exist → the component will try to render data for a non-existent challenge.

**Fix:** Pass `null` and handle the no-challenge state in `HomeCockpitView`.

---

### 7. ✅ Resolved (Session 80) — Fire-and-Forget DB Write in Auth Session Callback

`core/auth/index.ts` L64-L69:

```ts
prisma.user
   .update({ where: { id: user.id }, data: { role: "DEV" } })
   .catch(() => {});
```

This silently swallows all errors. If the DB write fails, the session says `DEV` but the database still says `PARTICIPANT`. On next page load without cache, role could revert. Use `await` or log the error.

**Resolved:** the `.catch` now reports the failure through the structured logger as `auth.role_sync_failed` with the user id.

---

### 8. ✅ Resolved (Session 101) — Manual Leaderboard Uses `Decimal` Hours (D7)

Removed the legacy manual leaderboard (`/challenge/[id]/manual`) and dropped `leaderboard_entries`. All hour adjustments and overrides now use the canonical `DailyStudyLog` model via `AdminHoursOverrideModal` in second-level integer duration precision, bringing the codebase into 100% compliance with **Law L8**.

---

### 9. ✅ Resolved (Session 105) — `leaveDays` Collected Then Discarded (D6)

The enrollment modal previously collected a `leaveDays` input from participants, but the value had no database column and was silently thrown away.

**Resolution (Session 105):**

- Added `plannedLeaveDays` and `usedLeaveDays` columns to `ChallengeParticipant` in migration `20261014020000_unify_study_logs_and_add_leave_budget`.
- Persisted on challenge enrollment via `enrollInChallengeAction` and `enrollParticipantInChallenge`.
- Implemented pure domain leave validation (`leave-allowance.ts`) and unit tests (`leave-allowance.test.ts`).
- Enforced leave quotas transactionally in `upsertDailyStudyLog` and server action `logStudyTimeAction`: when `usedLeaveDays >= plannedLeaveDays`, returns exact error: `"Maximum leaves taken for the challenge"`.
- Supports idempotent re-saving of existing leave days without quota penalty, and decrements `usedLeaveDays` when unmarking leaves.
- Displayed real-time leave counter (`🌴 Leaves: {usedLeaveDays}/{plannedLeaveDays}`) and quota feedback in `DailyHoursModal`.
- Concurrently dropped legacy V1 `DailyStudyLog` table, promoted `DailyStudyLogV2` to canonical `DailyStudyLog`, and removed all V2 model/relation references across the codebase.

---

### 10. ✅ Resolved (Session 99) — Missing `not-found.tsx` and `error.tsx` Files — Law L9 Gaps

| Route                                             | `loading.tsx` | `error.tsx` | `not-found.tsx` |
| ------------------------------------------------- | ------------- | ----------- | --------------- |
| `app/` (root)                                     | ✅            | ✅          | ✅              |
| `app/admin/`                                      | ✅            | ✅          | ✅              |
| `app/admin/challenges/new/`                       | ✅            | ✅          | ✅              |
| `app/challenge/[id]/`                             | ✅            | ✅          | ✅              |
| `app/challenge/[id]/participant/[participantId]/` | ✅            | ✅          | ✅              |
| `app/challenges/`                                 | ✅            | ✅          | ✅              |

**Resolution (Session 99):** Implemented comprehensive localized error and not-found boundaries across all Next.js App Router route segments. Added contextual `error.tsx` with error logging and retry actions, dynamic `not-found.tsx` boundaries for non-existent entities, missing skeletons (`loading.tsx`), and a hardened root `global-error.tsx`. Verified with 14 unit tests in `components/state/route-boundaries.test.tsx`.

---

### 11. ✅ Resolved (Session 81) — Duplicate Lockfiles (D10)

Both `bun.lock` and `package-lock.json` exist. This creates install-time ambiguity and potential version drift between `bun install` and `npm install`.

**Resolved (Session 81):** npm is the canonical manager (CI runs `npm ci`). `bun.lock` was deleted and `"packageManager": "npm@12.2.0"` added to `package.json`.

---

### 12. Missing Prisma Foreign Key Indexes (Performance)

Several foreign key columns lack database indexes, causing **sequential scans** on joins and cascading deletes:

| Model              | Column                               | Missing Index                                                         |
| ------------------ | ------------------------------------ | --------------------------------------------------------------------- |
| `DailyStudyLog`    | `overrideById`                       | No `@@index([overrideById])`                                          |
| `PunishmentRecord` | `pardonedById`                       | No `@@index([pardonedById])`                                          |
| `Challenge`        | `startAt`, `endAt`                   | No composite index for status/date filtering in `/challenges` catalog |
| `AuditLog`         | `targetEntityType`, `targetEntityId` | No index for entity-specific audit lookups                            |

---

### 13. ✅ Resolved (Session 81) — Tailwind Content Purge Missing `core/` and `lib/`

`tailwind.config.ts` scans `./app/`, `./components/`, and `./features/` but **not** `./core/` or `./lib/`. Files like `core/observability/logrocket-provider.tsx` that use Tailwind classes will have them purged in production builds.

**Resolved (Session 81):** both `"./core/**/*.{ts,tsx}"` and `"./lib/**/*.{ts,tsx}"` were added to the `tailwind.config.ts` `content` array during the Tailwind v4 migration.

---

### 14. `db:validate` Script Fails on Windows

`package.json` L14:

```json
"db:validate": "DATABASE_URL=postgresql://localhost:5432/holdmetoit prisma validate"
```

Uses POSIX inline variable syntax (`VAR=val cmd`) which fails on PowerShell/CMD. Use `cross-env` or just rely on Prisma's native `.env` loading.

---

### 15. ✅ Resolved (Session 101) — Dual Team-Membership Modeling (Consolidated)

Removed the legacy `TeamMember(teamId, userId)` table along with the manual leaderboard removal. `ChallengeParticipant.teamId` is now the single, authoritative representation of team membership across the entire platform.

---

## 🟡 Low Priority — Quality of Life & Hardening

### 16. ✅ Resolved (Session 80) — `console.warn`/`console.error` in Production Code

| File                          | Line | Statement                                                      |
| ----------------------------- | ---- | -------------------------------------------------------------- |
| `app/api/feedback/route.ts`   | 72   | `console.warn("[Feedback] Discord dispatch failed...")`        |
| `app/api/feedback/route.ts`   | 94   | `console.error("[Feedback API Error]:", error)`                |
| `app/challenge/[id]/page.tsx` | 67   | `console.error("Failed to load challenge scoreboard:", error)` |

**Fix:** Replace with `captureLogRocketException` or a proper server-side logger. Console statements in prod create noise in serverless logs.

**Resolved:** all app-runtime `console.*` now route through the unified structured logger (`core/observability/logger.ts`), which emits severity-filtered JSON on the server and forwards to LogRocket on the client. Only the logger transport itself and `prisma/seed.ts` still call `console` directly.

---

### 17. ✅ Resolved (Session 80) — Hardcoded LogRocket App ID

`core/observability/logrocket.ts` L6:

```ts
export const LOGROCKET_APP_ID = "q9morb/holdmeintoit";
```

This should be an env variable (`NEXT_PUBLIC_LOGROCKET_APP_ID`) and listed in `.env.example`. If the LogRocket project changes, you'd need a code deploy to update it.

**Resolved:** the app id now reads `process.env.NEXT_PUBLIC_LOGROCKET_APP_ID` with the previous literal as a safe fallback; the release label is likewise env-driven (`NEXT_PUBLIC_APP_RELEASE`).

---

### 18. ✅ Resolved (Session 80) — Missing `NEXT_PUBLIC_LOGROCKET_APP_ID` in `.env.example`

`.env.example` documents all Discord/Supabase env vars but is missing the LogRocket app ID and the `AUTH_URL` variable that's needed for production deploys.

**Resolved:** `.env.example` now documents `LOG_LEVEL`, `NEXT_PUBLIC_LOG_LEVEL`, `NEXT_PUBLIC_LOGROCKET_APP_ID`, and `NEXT_PUBLIC_APP_RELEASE`. (`AUTH_URL` is present already.)

---

### 19. Missing Test for `preview-mode.ts` Domain Logic

`features/auth/domain/preview-mode.ts` contains `getEffectiveAdminState()` — core business logic that determines admin/participant view rendering across the entire app. No test file exists. Every other domain file has tests.

---

### 20. `next.config.mjs` Missing Security Headers

No security headers are configured. Before production deployment, add:

- `X-Frame-Options: DENY` (clickjacking prevention)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy` (basic CSP)

---

### 21. No `global-error.tsx` at App Root

Next.js App Router requires `app/global-error.tsx` to catch errors that occur in the **root layout** itself. The existing `error.tsx` only catches errors in page components. If the root layout throws, users see a blank white page.

---

### 22. `force-dynamic` on Home Page May Hurt Performance

`app/page.tsx` L13:

```ts
export const dynamic = "force-dynamic";
```

Every visit to `/` skips all caching and hits the DB fresh. Consider using `revalidate` with a short TTL or ISR for spectators, while keeping dynamic rendering for authenticated users.

---

### 23. TSConfig Missing Critical Cross-Platform & Safety Flags

`tsconfig.json` is missing several important settings:

- **`forceConsistentCasingInFileNames: true`** — Windows is case-insensitive but Vercel (Linux) isn't. An import with wrong casing compiles on Windows, breaks in prod.
- **`noUncheckedIndexedAccess: true`** — Array/dict lookups (roster splits, deficit maps, `days[i]`) currently assume non-null without checks.
- **`target: "ES2022"`** — Missing explicit target; defaults can produce unexpected behavior.
- **`noFallthroughCasesInSwitch: true`** — Guards status-machine switch statements.
- Stale `"prototype"` in `exclude` array — directory doesn't exist.

---

### 24. ESLint Config is Extremely Loose

`.eslintrc.json` only extends `next/core-web-vitals` and `prettier`. Missing:

- `@typescript-eslint/no-floating-promises` — would catch the fire-and-forget DB write in auth (#7)
- `no-restricted-imports` rules to enforce Law L7 domain purity automatically
- `@typescript-eslint/no-unused-vars`
- `@typescript-eslint/consistent-type-imports`
- ESLint 8 itself is **EOL** (October 2024); should upgrade to ESLint 9 + flat config

---

### 25. Missing Vitest Coverage Tooling

`ROADMAP.md` Milestone Gate 1 requires **100% test coverage on domain calculation formulas**. But:

- No `@vitest/coverage-v8` installed
- No `test.coverage` block in `vitest.config.ts`
- No `npm run test:coverage` script in `package.json`

---

### 26. `components.json` Hooks Alias Points to Non-Existent Directory

`components.json` sets `aliases.hooks` to `"@/hooks"`, but no top-level `hooks/` directory exists. Running `npx shadcn-ui add` for components with hooks will create an unexpected root directory.

---

### 27. Schema ID Generator Inconsistency

Most models use `@default(cuid())` but `Category` and `Task` use `@default(uuid())`. This is a minor inconsistency that could confuse contributors — pick one strategy and standardize.

---

## 🏗️ Architectural Audit (2026-10-14) — Dead Code, Layer Inversions, DRY & Complexity

### 33. The 5,302-Line Mega "God Component" (`CockpitTasksSection`) — 🔴 Critical / High

`features/study-logs/presentation/cockpit/cockpit-tasks-section.tsx` contains 5,302 lines of code (237 KB) managing 21 separate `useState` hooks.

**Problems:**

- **Too Many Responsibilities:** Concurrently manages HTML5 drag-and-drop category/task reordering, context menu positioning, 4 inline modals (add task, edit task, edit category, delete category), IndexedDB local mutation queuing (`task-idb.ts`), background sync scheduling (`task-sync.service.ts`), server action dispatching, date calculation, and full task rendering for both Daily and Weekly boards in a single JSX return.
- **Wrong Architectural Slice:** Located in `features/study-logs/presentation/cockpit/` rather than `features/tasks/presentation/`, violating feature-first vertical slicing (`features/tasks/` has zero presentation components).
- **Render Performance Thrashing:** Every local keystroke or drag-over state change forces virtual DOM re-evaluation of all 5,300 lines of component tree.

**Fix:** Relocate to `features/tasks/presentation/` and decompose into modular components: `useTaskDragAndDrop()` hook, `useTaskSyncState()` hook, `<DailyTaskBoard />`, `<WeeklyTaskBoard />`, and `<TaskModals />`.

---

### 34. Dead Computation & Serialization of `punishmentWall` — 🔴 Critical / High

`features/leaderboard/data/leaderboard-data.ts` lines 102–136, 535–563, and 612–616.

**Problem:** The `punishment-wall.tsx` UI was deleted in commit `88779bd`. However, `buildScoreboardViewModel` continues to run an $O(N)$ loop over every participant in the challenge to construct `flaggedMembers`, sorts by deficit, and embeds `punishmentWall` inside `ChallengeScoreboardViewModel`.
Zero UI components render `scoreboard.punishmentWall`. It executes unused CPU loops on every page load and transfers dead serialized JSON payload across the Server-to-Client component boundary on `/challenge/[id]`.

**Fix:** Remove `punishmentWall` from `ChallengeScoreboardViewModel` and eliminate the `flaggedMembers` loop from `buildScoreboardViewModel`.

---

### 35. Clean Architecture Layer Inversion: Domain Modules Importing from Data Repositories — 🔴 Critical / High

`features/wrapped/domain/wrapped.ts` L10–13, `features/participant-stats/domain/participant-stats.ts` L1, and `features/participant-stats/domain/participant-stats.types.ts` L1.

**Problem:** Pure domain files violate **Law L7: Pure Domain Isolation (Inward Dependency Rule)** by importing view model types (`ChallengeScoreboardViewModel`, `ScoreboardStandingEntry`) directly from `features/leaderboard/data/leaderboard-data.ts`.
`leaderboard-data.ts` imports `@/core/db` (Prisma) and `next/cache`. When pure domain calculation modules depend on data repositories, they invert Clean Architecture inward dependencies and risk dragging Node.js database modules into browser/test execution contexts.

**Fix:** Extract `ScoreboardStandingEntry`, `ChallengeScoreboardViewModel`, and `ScoreboardTeam` into `features/leaderboard/domain/leaderboard.types.ts`. Both repositories and domain modules should import inwards to `domain/`.

---

### 36. Monolithic Client Chunk on `/challenge/[id]` (No Dynamic Code Splitting) — 🔴 Critical / High

`features/challenges/presentation/challenge-view.tsx` L10–16.

**Problem:** `ChallengeView` statically imports all 5 tabs and modals: `ChallengeManageTab` (1,407 lines), `ChallengeLeaderboardTab` (1,391 lines), `EventAuditTab` (576 lines), and `ChallengeWrappedModal` (1,487 lines).
When an unauthenticated guest spectator visits `/challenge/:id`, the browser downloads, parses, and compiles over 4,000 lines of admin roster management and wrapped story code in the primary client chunk, hurting mobile Core Web Vitals (LCP/INP).

**Fix:** Code-split `ChallengeManageTab`, `EventAuditTab`, and `ChallengeWrappedModal` using Next.js `dynamic()` with skeleton fallbacks so spectators only load the Overview and Leaderboard code.

---

### 37. Sequential Waterfall Data Fetching on Root Homepage (`app/page.tsx`) — 🔴 Critical / High

`app/page.tsx` L40–86.

**Problem:** The home page executes 4 separate, sequential `await` queries during Server Component rendering:

1. `getParticipantCockpit`
2. `getUserCategorizedTasks`
3. `findLatestAvailableChallenge`
4. `findLatestCompletedChallengeForWrapped` + `getChallengeScoreboard`

Each query waits for the preceding database roundtrip to complete, multiplying database latency and delaying Time To First Byte (TTFB) on the primary entry route.

**Fix:** Batch independent queries concurrently using `Promise.all`:

```typescript
const [cockpit, userTasks, upcomingChallenge, eligibleWrapped] =
   await Promise.all([
      userId
         ? getParticipantCockpit(userId, searchParams?.challenge)
         : Promise.resolve(null),
      userId ? getUserCategorizedTasks(userId) : Promise.resolve(null),
      userId
         ? findLatestAvailableChallenge().catch(() => null)
         : Promise.resolve(null),
      userId
         ? findLatestCompletedChallengeForWrapped(userId).catch(() => null)
         : Promise.resolve(null),
   ]);
```

---

### 38. Hand-Rolled Non-Accessible Modal Dialogs Duplicated Across 6+ Components — 🟠 Medium

Found in `admin-hours-override-modal.tsx`, `admin-target-override-modal.tsx`, `daily-hours-modal.tsx`, `enrollment-modal.tsx`, `feedback-dialog.tsx`, and `challenge-feedback-dialog.tsx`.

**Problem:** Every dialog reimplements hand-rolled `fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm ...` styling.

- Zero portal rendering: modals placed inside containers with CSS transforms or overflow clip break fixed positioning.
- Missing accessibility: no `role="dialog"`, `aria-modal="true"`, focus trapping, or body scroll locking.
- Duplicated feedback alert banners: `<div className="... bg-[#22c55e]/10 ...">` copy-pasted across 4+ dialogs.

**Fix:** Implement a shared accessible Obsidian `<Modal>` component in `components/ui/modal.tsx` wrapping Radix Dialog with portal rendering, focus lock, and escape handling.

---

### 39. Inverted Architectural Coupling: `core/` Depending on Feature Slice — 🟠 Medium

`core/storage/supabase-storage.ts` L3–10 imports from `features/challenges/domain/punishment-pfp.ts`.

**Problem:** Infrastructure code (`core/`) imports business domain logic (`buildChallengeImageObjectPath`, `extractManagedObjectPath`, `isChallengeImagePurpose`, `ChallengeImagePurpose`, `PunishmentPfpExt`) from a specific feature slice (`features/challenges`). Concurrently, `features/challenges/api/challenge-admin.actions.ts` imports `getStorageUrlConfig` from `core/storage`.
This creates circular cross-layer coupling and prevents `core/storage` from remaining generic infrastructure.

**Fix:** Keep `core/storage/supabase-storage.ts` purely generic (accepting `bucket`, `path`, and buffer), and relocate challenge image URL and path validation into `features/challenges/data/challenge-storage.ts`.

---

### 40. Client Components Importing Directly from Server Data Repositories — 🟠 Medium

Found in `challenge-manage-tab.tsx`, `challenge-overview-tab.tsx`, `challenge-view.tsx`, `challenges-list-view.tsx`, `challenge-leaderboard-tab.tsx`, and `home-cockpit-view.tsx`.

**Problem:** Client Components (`"use client"`) import TypeScript view model types directly from repository files (`data/leaderboard-data.ts`, `data/cockpit-data.ts`, `data/challenge.repository.ts`).
Because view model types are co-located in server data files containing Prisma queries and `next/cache`, any accidental value import leaks server modules or triggers bundling errors.

**Fix:** Relocate view model contracts into `domain/*.types.ts` so presentation files only import types from safe, pure domain boundaries.

---

### 41. Dynamic `await import()` in Client Event Handlers as a Bundling Band-Aid — 🟠 Medium

`features/study-logs/presentation/admin-hours-override-modal.tsx` L305, L371 and `features/challenges/presentation/admin-target-override-modal.tsx` L150.

**Problem:** Form submission handlers invoke inline `await import("@/features/study-logs/api/admin-override.actions")` and `await import("@/features/challenges/api/challenge-admin.actions")`. Dynamic imports inside event handlers indicate bundler resolution cycles and introduce network failure points during user actions.

**Fix:** Statically import Server Actions at module top level, ensuring Server Action files do not import client presentation code.

---

### 42. Fractured Action Result Contracts Across Slices — 🟠 Medium

Found in `challenge-admin.actions.ts` (`AdminActionResult<T>`), `enroll-participant.actions.ts` (`EnrollActionResult`), `log-study-time.actions.ts` (`ActionResult`), `task.actions.ts` (`TaskActionResult<T>`), and `wrapped.actions.ts` (`WrappedActionResult`).

**Problem:** Server action response shapes are inconsistent: most return `{ ok: true, data } | { ok: false, code, message }`, but `task.actions.ts` returns `{ success: boolean, data, error }`. This forces client components to check `result.ok` in some forms and `result.success` in others, preventing shared toast or error alert handling.

**Fix:** Standardize on a single discriminated union contract in `core/types/action-result.ts` (`ActionResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string }`).

---

### 43. Duplicated Discord Dispatch Services & Typings — 🟠 Medium

`features/feedback/data/discord-feedback.service.ts` L19–37 and `features/wrapped/data/challenge-feedback.service.ts` L12–21.

**Problem:** `DiscordEmbed`, `DiscordEmbedField`, and `DiscordSendResult` are declared identically in both services. Both implement duplicate fetch calls to `https://discord.com/api/v10/channels/:id/messages` with bot token authorization and response parsing.

**Fix:** Consolidate Discord REST dispatch and embed types into `core/discord/discord-client.ts`.

---

### 44. 17 Phantom `revalidatePath("/dashboard")` Calls — 🟡 Low

Found in `challenge-admin.actions.ts` (5 calls), `task.actions.ts` (7 calls), `admin-override.actions.ts` (2 calls), `log-study-time.actions.ts` (1 call), and `enroll-participant.actions.ts` (1 call).

**Problem:** The `/dashboard` route was migrated to `/` (`app/page.tsx`). Calling `revalidatePath("/dashboard")` does nothing, providing a false impression of cache invalidation while failing to revalidate the home page.

**Fix:** Replace all instances of `revalidatePath("/dashboard")` with `revalidatePath("/")` or cache-tag invalidation (`invalidateTags`).

---

### 45. Duplicate Search & Clear Input Pattern — 🟡 Low

Found in `challenges-list-view.tsx` L317–341, `challenge-overview-tab.tsx` L317–341, `challenge-manage-tab.tsx` L885–905, and `event-audit-tab.tsx` L210–230.

**Problem:** An identical 25-line JSX block rendering an Obsidian search input with absolute-positioned magnifying glass and clear button is copy-pasted across 4 tab components.

**Fix:** Extract into reusable `<SearchInput>` component in `components/ui/search-input.tsx`.

---

### 46. Universal Time & Clock Formatting Housed Inside Feature Slice — 🟡 Low

`features/study-logs/domain/duration.ts`.

**Problem:** Duration math (`formatSecondsToClock`, `parseDurationToSeconds`) is imported by `features/challenges`, `features/leaderboard`, `features/participant-stats`, and `features/wrapped`. Housing a core domain utility in `features/study-logs` creates cross-feature coupling across all slices.

**Fix:** Promote `duration.ts` to `core/domain/duration.ts` or `core/time/duration.ts`.

---

## 💡 Feature / QoL Improvement Suggestions

### 28. Challenge Status Badge Everywhere

Add a visual `UPCOMING` / `ACTIVE` / `COMPLETED` status badge to challenge cards in `/challenges` and the cockpit, with color coding matching the Obsidian theme.

### 29. Participant Self-Removal from Challenge

Currently, once enrolled, participants cannot leave a challenge. Consider adding a "Leave Challenge" action (only during `UPCOMING` phase).

### 30. Challenge Duration Display

Show "X days left" or "Ended X days ago" on challenge cards and headers. The `calculateChallengeStatus` function already has the timestamps — surface them in the UI.

### 31. Bulk Import Participants

Admin currently adds participants one by one. A bulk import (paste Discord IDs or @usernames) would save significant setup time for larger challenges.

### 32. Data Export

Add CSV/JSON export for challenge results. This complements Law L2 (Spreadsheet Exorcism) — the platform does the math, but hosts may still want raw data for announcements or record-keeping.

---

## 📊 Summary Scorecard

| Category                        | Count  |
| ------------------------------- | ------ |
| 🔴 Critical (blocks production) | 7      |
| 🟠 Medium (functional issues)   | 10     |
| 🟡 Low (hardening / QoL)        | 11     |
| 💡 Feature suggestions          | 5      |
| **Total open findings**         | **33** |

> Closed since the audit: Session 80 — #7, #16, #17, #18; Session 81 — #5, #11, #13; Session 83 — #2 (Three-Condition Invariant); Session 99 — #10 (Route boundaries coverage); Session 101 — #8 (Decimal hours eliminated), #15 (Dual team modeling consolidated); Session 104 — #3 (Discord Summary copy removed); Session 105 — #9 (`leaveDays` budget implemented & D6 resolved).

### Recommended Fix Order

1. **#1** — Lock Results bug (challenge finalization + `resultsLockedAt` column) ✅ done
2. **#37** — Parallelize `app/page.tsx` home page queries via `Promise.all` ✅ done in `96c0081`
3. **#35** — Fix Clean Architecture layer inversion: move `ChallengeScoreboardViewModel` into domain types ✅ done in `7ea8010`
4. **#34** — Prune `punishmentWall` dead calculation loop and payload from scoreboard serializer
5. **#36** — Code-split `/challenge/[id]` admin/audit/wrapped tabs using `next/dynamic`
6. **#12** — Add missing Prisma foreign key indexes
7. **#33** — Decompose 5,302-line `CockpitTasksSection` and relocate to `features/tasks/presentation/`
8. **#4** — Schema drift (generate catch-up migration files)
9. **#3** — Restore deleted P0 UIs (Punishment Wall, Pardon Modal)
10.   **#6** — Remove hardcoded seed challenge ID fallback
11.   **#38** — Implement shared accessible Obsidian `<Modal>` primitive in `components/ui/`
12.   **#44** — Clean up 17 phantom `revalidatePath("/dashboard")` calls
13.   **#23** — Add missing TSConfig flags (`forceConsistentCasingInFileNames`)
14.   Everything else in priority order

---

## 🚨 Incident Log

### 2026-10-10 — PR #67 production regression (schema drift, D5 class)

- **What:** Merging `dev` into `main` (PR #67) shipped `isLeave` in `schema.prisma` with no migration; the push-managed database never received the column (`study_logs_v2` confirmed missing via introspection). Every Prisma query selecting/including it threw `P2022` at request time while typecheck/tests/build stayed green.
- **Symptoms:** enrolled users saw the unenrolled cockpit ENROLL banner (`app/page.tsx` silently caught the error into `cockpit = null`); participant profile pages opened from the leaderboard errored (unguarded `getChallengeParticipantStats`). Logging hours, the admin Manage tab, and Lock Final Results were broken by the same drift.
- **Response:** PR #68 reverted the merge (verified byte-clean against pre-PR `main`).
- **Resolution:** migration `20261010120000_add_is_leave_to_study_logs` applied + verified; PR #67 re-landed via revert-of-revert (`62fd70a`) — a plain `dev → main` merge would NOT have restored the features since `4cbcfb9` is already in main's history; error masking removed (Law L9); CI schema guard added. Session log: `HANDOFF.md` §7 Session 79.
