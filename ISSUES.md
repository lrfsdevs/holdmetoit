# ISSUES.md — Project Audit & Known Issues Tracker

> **Audited:** 2026-10-10 · **Branch:** `krish` (commit `a32220b`)  
> **Method:** Full codebase inspection — config, schema, routes, features, domain, tests, security  
> **Total Findings:** 32 (5 critical · 10 medium · 12 low · 5 feature suggestions)

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
| Punishment PFP Download (`FEAT-PUN-03`) | PFP upload to Supabase works         | ❌ No download button anywhere                                      |
| Host Pardon Modal (`FEAT-PUN-04`)       | `adminPardonAction` exists           | ❌ `admin-goals-pardons.tsx` deleted                                |
| Discord Summary Copy (`FEAT-DISC-01`)   | Superseded by Summary tab & Wrapped  | ❌ Removed from scope                                               |
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

Removed the legacy manual leaderboard (`/challenge/[id]/manual`) and dropped `leaderboard_entries`. All hour adjustments and overrides now use the canonical `DailyStudyLogV2` model via `AdminHoursOverrideModal` in second-level integer duration precision, bringing the codebase into 100% compliance with **Law L8**.

---

### 9. `leaveDays` Collected Then Discarded (D6)

The enrollment modal collects a `leaveDays` input from participants, but the value has no database column and is silently thrown away. This creates confusion.

**Fix:** Either persist it and incorporate into the deficit/target math (carefully — Law L3 forbids grace passes), or remove it from the enrollment UI entirely.

---

### 10. Missing `not-found.tsx` and `error.tsx` Files — Law L9 Gaps

| Route                                             | `loading.tsx` | `error.tsx` | `not-found.tsx` |
| ------------------------------------------------- | ------------- | ----------- | --------------- |
| `app/` (root)                                     | ✅            | ✅          | ❌ **Missing**  |
| `app/admin/`                                      | ✅            | ❌          | ❌              |
| `app/admin/challenges/new/`                       | ❌            | ❌          | ❌              |
| `app/challenge/[id]/`                             | ✅            | ❌          | ❌              |
| `app/challenge/[id]/participant/[participantId]/` | ✅            | ✅          | ❌              |
| `app/challenges/`                                 | ✅            | ❌          | ❌              |

Law L9 requires **Loading, Empty, and Error** states for every view. The root `error.tsx` catches unhandled errors globally, but route-specific `error.tsx` boundaries would prevent full-page crashes and give better UX. `not-found.tsx` files are needed for dynamic `[id]` routes especially.

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
| 🔴 Critical (blocks production) | 4      |
| 🟠 Medium (functional issues)   | 7      |
| 🟡 Low (hardening / QoL)        | 9      |
| 💡 Feature suggestions          | 5      |
| **Total findings**              | **25** |

> Closed since the audit: Session 80 — #7, #16, #17, #18; Session 81 — #5, #11, #13; Session 83 — #2 (Law L6 amended to the Three-Condition Invariant with challenge-linked tasks).

### Recommended Fix Order

1. **#1** — Lock Results bug (challenge finalization + `resultsLockedAt` column)
2. **#4** — Schema drift (generate catch-up migration files)
3. ~~**#5** — `npm audit fix` for high-severity CVEs~~ ✅ done (Session 81)
4. **#12** — Add missing Prisma foreign key indexes
5. **#3** — Restore deleted P0 UIs (Punishment Wall, PFP download, Pardon)
6. **#6** — Remove hardcoded seed challenge ID
7. **#7** — Fix fire-and-forget DB write in auth callback
8. **#10** — Add missing `error.tsx` / `not-found.tsx` route files
9. **#13** — Fix Tailwind content purge paths
10.   **#15** — Consolidate dual team-membership modeling
11.   **#23** — Add missing TSConfig flags (`forceConsistentCasingInFileNames`)
12.   Everything else in priority order

---

## 🚨 Incident Log

### 2026-10-10 — PR #67 production regression (schema drift, D5 class)

- **What:** Merging `dev` into `main` (PR #67) shipped `isLeave` in `schema.prisma` with no migration; the push-managed database never received the column (`study_logs_v2` confirmed missing via introspection). Every Prisma query selecting/including it threw `P2022` at request time while typecheck/tests/build stayed green.
- **Symptoms:** enrolled users saw the unenrolled cockpit ENROLL banner (`app/page.tsx` silently caught the error into `cockpit = null`); participant profile pages opened from the leaderboard errored (unguarded `getChallengeParticipantStats`). Logging hours, the admin Manage tab, and Lock Final Results were broken by the same drift.
- **Response:** PR #68 reverted the merge (verified byte-clean against pre-PR `main`).
- **Resolution:** migration `20261010120000_add_is_leave_to_study_logs` applied + verified; PR #67 re-landed via revert-of-revert (`62fd70a`) — a plain `dev → main` merge would NOT have restored the features since `4cbcfb9` is already in main's history; error masking removed (Law L9); CI schema guard added. Session log: `HANDOFF.md` §7 Session 79.
