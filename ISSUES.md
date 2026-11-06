# ISSUES.md — Consolidated Open Issues Tracker

> **Generated:** 2026-11-04
> **Sources merged:** `SECURITY.md`, `ISSUES.md` (previous audit), `solo-blockers.md`
> **Scope:** Open findings only. Every item marked ✅ RESOLVED in the source documents is intentionally omitted.
> **Branch/context:** `chore/nextjs-16-upgrade` (the previous `ISSUES.md` audit was on `afnan-jr`; statuses were reconciled against the current tree).
> **Severity legend:** 🔴 Critical/High · 🟠 Medium · 🟡 Low / hardening · 💡 Feature suggestion · 🔧 Operational check

---

## Summary

| Severity                |  Count |
| :---------------------- | -----: |
| 🔴 Critical / High      |      5 |
| 🟠 Medium               |     14 |
| 🟡 Low / hardening      |     18 |
| 💡 Feature suggestions  |      3 |
| **Total open findings** | **40** |

Plus 4 deployment-time operational checks that are not code defects.

### Source reconciliation

- `SEC-10` absorbs the duplicate `ISS-20` (missing security headers).
- `DEP-01` (Prisma-family advisories) was resolved: Prisma was upgraded to 7.10.1 and `deepmerge-ts` to 8.0.2; `npm audit --omit=dev` reports 0 vulnerabilities.
- `ISS-04` keeps only the schema drift that remains after the `isLeave` fix.
- `ISS-44` was re-counted against the current tree: **2** phantom `/dashboard` revalidations remain (the old doc listed 17).
- `ISS-33` was re-measured: `cockpit-tasks-section.tsx` is now **7,380 lines** (the old doc listed 5,302).
- `ISS-06` (seed challenge fallback) is omitted — the current home page uses `""`, not a seed ID.
- `ISS-28` (status badges) and `ISS-29` (participant withdrawal) are omitted — both are implemented.
- `ISS-34` (dead punishment-wall computation) is omitted — the Punishment Wall was restored and now consumes that data.
- `ISS-43` (duplicated Discord dispatch) is omitted — the shared `@holdmetoit/discord` package replaced the duplicates.
- Solo blockers #1–#6 are omitted — all were resolved (see `solo-blockers.md`); only the pre-kickoff operational checklist remains.

---

## 🔴 Critical / High

### SEC-01 — YPT ingest endpoint is fail-open when `YPT_INGEST_API_KEY` is unset

- **Severity:** High
- **Area:** Web / ingest
- **Location:** `apps/web/app/api/v1/ingest/ypt/route.ts`
- **Problem:** The bearer check is wrapped in `if (expectedApiKey) { ... }`. A missing/empty key accepts unauthenticated requests. The comparison is `token !== expectedApiKey` (not constant-time).
- **Impact:** Anyone who can reach the route can write arbitrary study durations for any user identified by `discordId`/`yptId`, corrupting standings, Law L6 outcomes, and coin rewards; the response also enables user enumeration.
- **Fix:** Fail closed (500/503 + error log) when the key is unset; compare via `crypto.timingSafeEqual` on SHA-256 digests; add rate limiting and an audit entry; consider removing the route if `apps/ypt-bot` writes directly to the DB.
- **Source:** `SECURITY.md` SEC-01.

### SEC-03 — External/platform rate limiter is still pending

- **Severity:** High (mitigated)
- **Area:** Web / infra
- **Location:** In-memory limiter removed; affects `POST /api/feedback`, feedback attachment signed uploads, and the YPT roster/claim actions.
- **Problem:** The process-local limiter was removed because it was per-instance and cold-start-resettable. No replacement is live yet.
- **Impact:** Until an external limiter is configured, the unauthenticated feedback route and signed uploads have no application-level throttle. Feedback fans out to Postgres, Discord, GitHub, and Jira.
- **Fix:** Enforce limits at the platform layer (Vercel WAF/Firewall, Upstash Ratelimit, or a gateway); derive the IP from the platform-trusted source; add per-authenticated-user quotas and a daily cap on outbound GitHub/Jira creations.
- **Source:** `SECURITY.md` SEC-03.

### ISS-04 — Schema drift: `feedbacks` and `sort_order` still lack migrations

- **Severity:** High
- **Area:** Database / release
- **Location:** `packages/database/prisma/`
- **Problem:** The `feedbacks` table and `sort_order` columns were originally applied via `prisma db push` and still lack migration files. The earlier `isLeave` drift is fixed and CI now blocks schema changes without a migration, but a fresh `prisma migrate deploy` can still produce an incomplete schema.
- **Impact:** Fresh/staging environments can miss columns and fail at runtime with `P2022`.
- **Fix:** Generate catch-up migrations with `prisma migrate diff`; reconcile existing databases with `prisma migrate resolve`; verify `prisma migrate deploy` on a clean DB.
- **Source:** `ISSUES.md` #4.

### ISS-33 — `CockpitTasksSection` is a 7,380-line mega component

- **Severity:** High
- **Area:** Architecture / performance
- **Location:** `apps/web/features/study-logs/presentation/cockpit/cockpit-tasks-section.tsx`
- **Problem:** One component owns drag-and-drop reordering, context-menu positioning, four inline modals, IndexedDB mutation queuing, background sync, date math, and the full Daily/Weekly board rendering. It is in the wrong feature slice (`study-logs` instead of `tasks`) and rerenders a huge tree on every local interaction.
- **Impact:** High maintenance cost, render thrashing, difficult testing, and cross-feature coupling.
- **Fix:** Relocate to `features/tasks/presentation/`, decompose into `useTaskDragAndDrop`, `useTaskSyncState`, `<DailyTaskBoard>`, `<WeeklyTaskBoard>`, and `<TaskModals>`.
- **Source:** `ISSUES.md` #33 (size updated to 7,380 lines).

### ISS-36 — `/challenge/[id]` ships an admin/wrapped mega-chunk to spectators

- **Severity:** High
- **Area:** Performance / bundle
- **Location:** `apps/web/features/challenges/presentation/challenge-view.tsx`
- **Problem:** `ChallengeView` statically imports `ChallengeManageTab`, `ChallengeLeaderboardTab`, `EventAuditTab`, and `ChallengeWrappedModal`. A guest visiting the scoreboard downloads admin roster management and wrapped-story code.
- **Impact:** Larger LCP/INP payloads, especially on mobile; unnecessary code for spectators.
- **Fix:** Code-split `ChallengeManageTab`, `EventAuditTab`, and `ChallengeWrappedModal` with `next/dynamic` and skeleton fallbacks; consider loading the leaderboard tab lazily too.
- **Source:** `ISSUES.md` #36.

---

## 🟠 Medium

### SEC-04 — Server Actions expose data without authentication/ownership checks

- **Severity:** Medium
- **Area:** Security / authz
- **Location:** `features/trophies/api/trophy.actions.ts` (`getUserCompetitiveStatsAction`, `getUserTrophyHistoryAction`), `features/wagers/api/wager.actions.ts` (`getChallengeWagersAction`)
- **Problem:** These exported server actions accept arbitrary `userId`/`challengeId` and perform no session or ownership check (or only require a session when the ID is omitted).
- **Impact:** Disclosure of other users' competitive stats, trophy history, and all wagers in a challenge.
- **Fix:** Require a session and enforce `userId === session.user.id` or the existing privacy/admin checks; require enrollment/admin for wagers or return aggregates; add a convention/lint rule for server actions.
- **Source:** `SECURITY.md` SEC-04.

### SEC-05 — Role model: stale privileges and conflicting sources of truth

- **Severity:** Medium
- **Area:** Security / authz
- **Location:** `core/auth/index.ts`, `features/auth/data/user.repository.ts`, `features/admin/api/user-directory.actions.ts`, `features/auth/api/require-admin.ts`
- **Problem:** Roles sync from Discord only at sign-in, so revoked admins keep DB authority for the session lifetime (30 days by default). The manual role editor conflicts with Discord-derived roles, any admin can promote/demote peers (including overwriting a DEV DB role), and the session callback performs a fire-and-forget role update.
- **Impact:** Privilege persistence after revocation, confused-deputy risk, inconsistent authorization.
- **Fix:** Revalidate Discord roles on a schedule or on sensitive actions; reduce privileged session lifetime; choose one source of truth; block non-DEV changes to DEV; move role fix-ups to sign-in only.
- **Source:** `SECURITY.md` SEC-05.

### SEC-06 — Plaintext Discord OAuth tokens and unencrypted backups

- **Severity:** Medium
- **Area:** Security / data
- **Location:** `packages/database/prisma/schema.prisma` (`Account`), `core/auth/index.ts`, `features/auth/data/discord-avatar.service.ts`, `apps/ypt-bot/src/backup/runner.js`
- **Problem:** Discord `access_token`/`refresh_token`/`id_token` are stored unencrypted. The backup bot `pg_dump`s the full public schema (including sessions and tokens) and uploads it unencrypted to Supabase using the service-role key.
- **Impact:** A DB/backup leak exposes live Discord credentials and session tokens.
- **Fix:** Stop persisting tokens that are not needed (or encrypt with KMS); encrypt backups and exclude `Session`/`Account`; assert the bucket is private; use least-privilege storage and read-only DB credentials.
- **Source:** `SECURITY.md` SEC-06.

### SEC-07 — Feedback attachments: unauthenticated uploads, client MIME, public bucket

- **Severity:** Medium
- **Area:** Security / uploads
- **Location:** `features/feedback/api/feedback-attachments.actions.ts`, `core/storage/supabase-storage.ts`, `features/feedback/data/feedback-attachment.storage.ts`
- **Problem:** Signed upload URLs are issued without a session; the browser uploads directly to Supabase with a client-controlled `Content-Type`; verification sniffs only 32 bytes; abandoned uploads are only cleaned up if the client calls discard.
- **Impact:** Polyglot files can be hosted on the Supabase domain, storage can be filled anonymously, and staff may open untrusted attachments.
- **Fix:** Require login or CAPTCHA, apply per-user quotas, set bucket-level MIME/size limits, re-check stored metadata after upload, add a cleanup job, and serve `X-Content-Type-Options: nosniff`.
- **Source:** `SECURITY.md` SEC-07.

### SEC-08 — Feedback fields injected into Discord/GitHub/Jira without validation

- **Severity:** Medium
- **Area:** Security / content injection
- **Location:** `features/feedback/domain/feedback.schema.ts`, `features/feedback/data/discord-feedback.service.ts`, `features/feedback/domain/github-issue.ts`, `features/feedback/domain/jira-issue.ts`
- **Problem:** `url` and `logrocketSessionId` are free-form strings; `logrocketSessionId` becomes a clickable Discord link, and `title`/`description` are pushed verbatim into GitHub Markdown (mentions/cross-links).
- **Impact:** Phishing/malware links in staff channels and issue trackers, notification spam, markdown injection.
- **Fix:** Validate `logrocketSessionId` against the expected LogRocket URL/ID format and `url` as a same-origin/path URL; neutralize mentions/auto-links; use `allowed_mentions: { parse: [] }`.
- **Source:** `SECURITY.md` SEC-08.

### SEC-09 — Raw error messages returned to clients

- **Severity:** Medium
- **Area:** Security / information disclosure
- **Location:** Pervasive, e.g. `app/api/feedback/route.ts`, `features/wagers/api/wager.actions.ts`, `features/trophies/api/trophy.actions.ts`, `features/economy/api/wallet.actions.ts`, `features/challenges/api/enroll-participant.actions.ts`, `features/admin/api/user-directory.actions.ts`, `features/ypt/api/ypt-claim.actions.ts`, `apps/tasker/src/commands/yapperize.ts`
- **Problem:** Catch blocks return `error.message`, which can expose Prisma schema details, internal hostnames, config state, or upstream response bodies.
- **Impact:** Information disclosure that aids further attacks.
- **Fix:** Return stable codes + generic messages; log the real error with a correlation ID; only pass through messages from whitelisted domain error classes.
- **Source:** `SECURITY.md` SEC-09.

### SEC-10 — No security response headers

- **Severity:** Medium
- **Area:** Security / HTTP
- **Location:** `apps/web/next.config.mjs` (no `headers()`); `proxy.ts` sets none.
- **Problem:** No CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, or `Permissions-Policy`. The app loads LogRocket and one inline script.
- **Impact:** Clickjacking of admin actions, no XSS defense-in-depth, MIME sniffing.
- **Fix:** Add `headers()` with `X-Frame-Options: DENY`/`frame-ancestors 'none'`, HSTS (production), `nosniff`, `strict-origin-when-cross-origin`, a restrictive `Permissions-Policy`, and a nonce-based CSP allowing Supabase/Discord images and LogRocket.
- **Source:** `SECURITY.md` SEC-10 + `ISSUES.md` #20 (merged).

### SEC-11 — Tasker `/yapperize` permission and abuse gaps

- **Severity:** Medium
- **Area:** Tasker bot
- **Location:** `apps/tasker/src/commands/yapperize.ts`, `src/lib/message-fetcher.ts`, `src/lib/summarizer.ts`, `src/index.ts`
- **Problem:** Fail-open permission check (`if (userPerms && ...)`), only `ViewChannel` required, public output, no cooldown/quota, prompt injection, unbounded `.txt` attachment fetch, Gemini data egress, raw errors.
- **Impact:** Unauthorized channel summaries, quota exhaustion/cost, memory/DoS, content leakage.
- **Fix:** Fail closed and require `ViewChannel` + `ReadMessageHistory`; add per-user/per-guild cooldowns; make replies ephemeral; cap attachment size/time; set `allowedMentions: { parse: [] }`; document Gemini egress and exclude private channels.
- **Source:** `SECURITY.md` SEC-11.

### ISS-12 — Missing Prisma foreign-key indexes

- **Severity:** Medium
- **Area:** Database / performance
- **Location:** `packages/database/prisma/schema.prisma`
- **Problem:** `DailyStudyLog.overrideById` and `PunishmentRecord.pardonedById` have no indexes; `AuditLog` has `actorId`/`actionType` indexes but nothing for `(targetEntityType, targetEntityId)`; `Challenge` has `[isDeleted, startAt]` but no index covering `endAt`.
- **Impact:** Sequential scans on joins, audit lookups, and date filtering.
- **Fix:** Add `@@index([overrideById])`, `@@index([pardonedById])`, `@@index([targetEntityType, targetEntityId])`, and evaluate an `endAt` index for challenge date filtering; ship with a migration.
- **Source:** `ISSUES.md` #12.

### ISS-38 — Hand-rolled, inaccessible modal dialogs duplicated across 6+ components

- **Severity:** Medium
- **Area:** UI / accessibility
- **Location:** `admin-hours-override-modal.tsx`, `admin-target-override-modal.tsx`, `daily-hours-modal.tsx`, `enrollment-modal.tsx`, `feedback-dialog.tsx`, `challenge-feedback-dialog.tsx`
- **Problem:** Each dialog reimplements the fixed overlay, has no portal/focus trap/body scroll lock, often lacks `role="dialog"`/`aria-modal`, and duplicates feedback banners.
- **Impact:** Broken positioning inside transformed/clipped containers, keyboard/screen-reader gaps, inconsistent UX.
- **Fix:** Build a shared accessible `<Modal>` around Radix Dialog (portal, focus lock, escape, scroll lock) and migrate the dialogs.
- **Source:** `ISSUES.md` #38.

### ISS-39 — `core/storage` depends on the challenges feature slice

- **Severity:** Medium
- **Area:** Architecture
- **Location:** `core/storage/supabase-storage.ts` imports from `features/challenges/domain/punishment-pfp.ts`
- **Problem:** Generic infrastructure imports challenge-specific path/validation helpers, creating circular cross-layer coupling.
- **Impact:** `core/storage` cannot stay generic; harder to reuse and test.
- **Fix:** Keep `core/storage` generic (bucket/path/buffer); move challenge image path/URL validation into `features/challenges/data/challenge-storage.ts`.
- **Source:** `ISSUES.md` #39.

### ISS-40 — Client components import types from server data repositories

- **Severity:** Medium
- **Area:** Architecture / bundling
- **Location:** `challenge-manage-tab.tsx`, `challenge-overview-tab.tsx`, `challenge-view.tsx`, `challenges-list-view.tsx`, `challenge-leaderboard-tab.tsx`, `home-cockpit-view.tsx`
- **Problem:** `"use client"` components import view-model types from files that also import Prisma/`next/cache`. An accidental value import can leak server modules or break bundling.
- **Impact:** Coupling, risk of server-only modules entering client graphs.
- **Fix:** Move view-model contracts into `features/*/domain/*.types.ts` and import only from those pure boundaries.
- **Source:** `ISSUES.md` #40.

### ISS-41 — Dynamic `await import()` inside client event handlers

- **Severity:** Medium
- **Area:** Architecture / bundling
- **Location:** `features/study-logs/presentation/admin-hours-override-modal.tsx`, `features/challenges/presentation/admin-target-override-modal.tsx`
- **Problem:** Submit handlers dynamically import server action modules, indicating a bundler resolution cycle and adding a network failure point during user actions.
- **Impact:** Fragile interactions and hidden coupling.
- **Fix:** Statically import the server actions at module top level; ensure action files do not import client presentation code.
- **Source:** `ISSUES.md` #41.

### ISS-42 — Fractured action-result contracts across slices

- **Severity:** Medium
- **Area:** API consistency
- **Location:** `challenge-admin.actions.ts` (`AdminActionResult`), `enroll-participant.actions.ts` (`EnrollActionResult`), `log-study-time.actions.ts` (`ActionResult`), `feature-flags.actions.ts`, `pokemon.actions.ts`, `acquisition.actions.ts`, `wrapped.actions.ts` (`WrappedActionResult`)
- **Problem:** Each slice defines its own result union; some use `{ ok }`, others `{ success }`, with different code fields. Clients need per-feature branching.
- **Impact:** Inconsistent error handling, harder shared UI/toast handling.
- **Fix:** Standardize on `ActionResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string }` in `core/types/action-result.ts`; migrate slices incrementally.
- **Source:** `ISSUES.md` #42 (re-verified against current tree; the old `task.actions.ts` path no longer exists, but the other contracts remain).

---

## 🟡 Low / Hardening

### SEC-12 — `/api/users/sync-avatar` lacks authorization on the target user

- **Severity:** Low
- **Area:** Security / authz
- **Location:** `app/api/users/sync-avatar/route.ts`, `features/auth/data/discord-avatar.service.ts`
- **Problem:** Any authenticated user can pass any `userId`/`discordId`; the bot path writes the target's `image` and the response reveals whether an account exists.
- **Impact:** Discord REST amplification/rate-limit exhaustion and user enumeration.
- **Fix:** Restrict targets to self unless admin; add per-user rate limiting; return a generic not-found for non-admins.
- **Source:** `SECURITY.md` SEC-12.

### SEC-13 — `referenceUrl` accepts any URL scheme (verify)

- **Severity:** Low
- **Area:** Security / input validation
- **Location:** `features/pokemon/domain/pokemon.schema.ts`, `features/pokemon/presentation/pokemon-detail-modal.tsx`
- **Problem:** `z.string().url()` does not restrict the scheme; a `javascript:`/`data:` URL could be rendered as a link (admin-only writer).
- **Impact:** Potential XSS/phishing if a malicious admin or seed source writes such a value.
- **Fix:** Use `z.url({ protocol: /^https?$/ })` or refine `new URL(v).protocol`; re-validate at render.
- **Source:** `SECURITY.md` SEC-13.

### SEC-14 — Dev bypass for `/admin` and `/devboard` is tied to `NODE_ENV`

- **Severity:** Low
- **Area:** Security / authz
- **Location:** `proxy.ts`, `app/admin/layout.tsx`, `app/devboard/layout.tsx`
- **Problem:** `NODE_ENV === "development"` plus (`ALLOW_DEV_BYPASS=true` or a missing `AUTH_DISCORD_ID`) renders admin/devboard shells without a session.
- **Impact:** Accidental staging/dev deployments could expose read-only admin pages; server actions remain protected.
- **Fix:** Remove the bypass or require an explicit opt-in that is rejected when `VERCEL_ENV`/`CI`/a public hostname is detected; never infer the bypass from a missing env var.
- **Source:** `SECURITY.md` SEC-14.

### SEC-15 — `docker-compose.yml` Postgres uses default credentials and binds all interfaces

- **Severity:** Low
- **Area:** Infra / dev
- **Location:** `docker-compose.yml`
- **Problem:** `postgres/postgres` and `"5433:5432"` bind to `0.0.0.0`.
- **Impact:** Shared-network/dev-VM exposure with a well-known password.
- **Fix:** Bind `127.0.0.1:5433:5432`, read the password from an untracked `.env`, and mark the file development-only.
- **Source:** `SECURITY.md` SEC-15.

### SEC-16 — Container hardening gaps

- **Severity:** Low
- **Area:** Infra / containers
- **Location:** `apps/ypt-bot/Dockerfile`, `apps/tasker/Dockerfile`, `.dockerignore`, health servers
- **Problem:** Containers run as root; `COPY . .` includes too much; `.dockerignore` misses `.env.production`/`.env.staging`; the PostgreSQL apt key is fetched over HTTP/unpinned; devDependencies are installed in production; health servers bind `0.0.0.0`.
- **Impact:** Larger attack surface and image size, risk of leaking env files.
- **Fix:** Non-root `USER node`; `.env*` ignore with `.env.example` exception; HTTPS/pinned key; multi-stage `npm ci --omit=dev`; bind health checks internally.
- **Source:** `SECURITY.md` SEC-16.

### SEC-17 — Failed backups leave plaintext dumps on disk

- **Severity:** Low
- **Area:** Security / backups
- **Location:** `apps/ypt-bot/src/backup/runner.js`
- **Problem:** On failure before upload, the temp directory is retained indefinitely.
- **Impact:** Sensitive dumps accumulate in `os.tmpdir()`.
- **Fix:** Always delete the temp directory, or retain only the latest failure with `0600` and a TTL.
- **Source:** `SECURITY.md` SEC-17.

### SEC-18 — LogRocket session replay privacy defaults

- **Severity:** Low
- **Area:** Privacy / observability
- **Location:** `core/observability/logrocket.ts`, `logrocket-config.ts`
- **Problem:** No input/network sanitizers; identifies with `discordId`; captures feedback, study logs, admin override reasons, and Server Action payloads.
- **Impact:** Sensitive data in replays; PII exposure.
- **Fix:** Enable `inputSanitizer`, add request/response sanitizers for `/api/*` and Server Actions, block admin/devboard routes, use opaque IDs, and disclose recording in the privacy notice.
- **Source:** `SECURITY.md` SEC-18.

### SEC-19 — CI / supply-chain hygiene gaps

- **Severity:** Low
- **Area:** CI / supply chain
- **Location:** `.github/workflows/ci.yml`, `.github/CODEOWNERS`
- **Problem:** No `npm audit`, secret scanning, CodeQL/SAST, or dependency review; actions pinned by mutable tags; no `permissions:`; single CODEOWNER; Husky `prepare` uses `|| true`.
- **Impact:** Dependency/security regressions can merge unnoticed; supply-chain risk.
- **Fix:** Add `permissions: contents: read`, pin actions by SHA, enable Dependabot/Renovate, run `npm audit --omit=dev --audit-level=high`, add CodeQL/secret scanning, expand CODEOWNERS, and require reviews for auth/DB/CI paths.
- **Source:** `SECURITY.md` SEC-19.

### SEC-20 — Auth.js host trust / cookie configuration is implicit (verify)

- **Severity:** Low
- **Area:** Security / auth
- **Location:** `core/auth/index.ts`
- **Problem:** No `trustHost`, explicit cookies, or session `maxAge`; the default 30-day session amplifies SEC-05.
- **Impact:** Host-header trust ambiguity on non-Vercel hosts; long-lived privileged sessions.
- **Fix:** Pin `AUTH_URL` in production, avoid blanket `AUTH_TRUST_HOST`, and set shorter `session.maxAge`/`updateAge`.
- **Source:** `SECURITY.md` SEC-20.

### ISS-22 — `force-dynamic` on `/` and other pages skips all caching

- **Severity:** Low (performance)
- **Area:** Performance / caching
- **Location:** `app/page.tsx`, `app/wallet/page.tsx`, `app/profile/page.tsx`, `app/profile/[userId]/page.tsx`, `app/pokemon/page.tsx`, `app/leaderboard/page.tsx`, `app/devboard/page.tsx`, `app/admin/page.tsx`, `app/admin/users/page.tsx`, `app/challenges/page.tsx`
- **Problem:** Ten routes force dynamic rendering; `/` and public pages hit the DB on every visit. This overlaps with the planned Cache Components/`use cache` work.
- **Impact:** Higher TTFB and DB load for spectator traffic.
- **Fix:** Adopt the caching plan: enable `cacheComponents`, cache public data with `use cache`, and keep only genuinely personalized segments dynamic.
- **Source:** `ISSUES.md` #22.

### ISS-23 — TSConfig is missing cross-platform and safety flags

- **Severity:** Low
- **Area:** Type safety
- **Location:** `apps/web/tsconfig.json`
- **Problem:** Missing `forceConsistentCasingInFileNames`, `noUncheckedIndexedAccess`, and `noFallthroughCasesInSwitch`; `target` is `ES2017`; `exclude` still references the nonexistent `prototype` directory.
- **Impact:** Case-sensitivity bugs can pass on Windows and fail on Vercel; unchecked array/index access; weaker switch exhaustiveness.
- **Fix:** Add the flags, set `target: "ES2022"`, and remove `prototype`.
- **Source:** `ISSUES.md` #23 (re-verified against the current tsconfig).

### ISS-24 — ESLint still lacks type-aware and architecture rules

- **Severity:** Low
- **Area:** Lint / quality
- **Location:** `apps/web/eslint.config.mjs`
- **Problem:** The move to ESLint 9 + flat config is done, but the config still omits `@typescript-eslint/no-floating-promises`, `no-unused-vars`, `consistent-type-imports`, and `no-restricted-imports` rules that would enforce Law L7 domain purity.
- **Impact:** Fire-and-forget promises, unused code, and layer violations are not caught by lint.
- **Fix:** Add `eslint-config-next/typescript` / typescript-eslint rules in a dedicated hardening PR, after measuring the backlog; do not bundle with the Next migration.
- **Source:** `ISSUES.md` #24 (remaining part; ESLint 8/EOL part is done).

### ISS-25 — No Vitest coverage tooling

- **Severity:** Low
- **Area:** Testing
- **Location:** `apps/web/vitest.config.ts`, `apps/web/package.json`
- **Problem:** No `@vitest/coverage-v8`, no `test.coverage` block, and no `test:coverage` script, while `ROADMAP.md` requires 100% coverage of domain formulas.
- **Impact:** The coverage gate cannot be measured or enforced in CI.
- **Fix:** Add the coverage provider, configure `coverage.include` for `domain/`, add `test:coverage`, and enforce a threshold for domain modules.
- **Source:** `ISSUES.md` #25.

### ISS-26 — `components.json` hooks alias points to a nonexistent directory

- **Severity:** Low
- **Area:** Tooling
- **Location:** `apps/web/components.json`
- **Problem:** `aliases.hooks` is `"@/hooks"` but `apps/web/hooks/` does not exist; shadcn adds may create an unexpected root directory.
- **Impact:** Confusing generator output and import paths.
- **Fix:** Create `apps/web/hooks/` with an index, or remove/repoint the alias.
- **Source:** `ISSUES.md` #26 (verified: no `hooks/` directory).

### ISS-27 — Inconsistent Prisma ID generators

- **Severity:** Low
- **Area:** Database / consistency
- **Location:** `packages/database/prisma/schema.prisma`
- **Problem:** Most models use `@default(cuid())`, but `Category` and `Task` use `@default(uuid())`.
- **Impact:** Minor contributor confusion and inconsistent ID formats.
- **Fix:** Standardize on one generator; migrate if the compatibility cost is acceptable.
- **Source:** `ISSUES.md` #27.

### ISS-44 — Phantom `revalidatePath("/dashboard")` calls

- **Severity:** Low
- **Area:** Cache invalidation
- **Location:** `features/ypt/api/ypt-ingest.service.ts:206`, `features/ypt/api/ypt-connection.actions.ts:43`
- **Problem:** `/dashboard` was replaced by `/`; these calls do nothing and create a false sense of invalidation. (Two remain; the old audit listed 17.)
- **Impact:** Stale `/` UI after YPT ingest/connection changes.
- **Fix:** Replace with `revalidatePath("/")` or the appropriate `invalidateTags(...)` call.
- **Source:** `ISSUES.md` #44 (re-counted: 2 occurrences).

### ISS-45 — Duplicate search-and-clear input markup

- **Severity:** Low
- **Area:** UI / DRY
- **Location:** `challenges-list-view.tsx`, `challenge-overview-tab.tsx`, `challenge-manage-tab.tsx`, `event-audit-tab.tsx`
- **Problem:** The same ~25-line Obsidian search input with magnifier and clear button is copy-pasted across four tabs.
- **Impact:** Inconsistent behavior and harder maintenance.
- **Fix:** Extract `components/ui/search-input.tsx` and reuse it.
- **Source:** `ISSUES.md` #45.

### ISS-46 — Duration/clock utilities live inside the study-logs feature slice

- **Severity:** Low
- **Area:** Architecture / DRY
- **Location:** `features/study-logs/domain/duration.ts`
- **Problem:** `formatSecondsToClock`, `parseDurationToSeconds`, and `DurationRangeError` are imported by challenges, leaderboard, participant-stats, accountability, and wrapped.
- **Impact:** Cross-feature coupling; the utility is really core domain.
- **Fix:** Promote to `core/domain/duration.ts` (or `core/time/duration.ts`) and update imports.
- **Source:** `ISSUES.md` #46 (verified imports across multiple slices).

---

## 💡 Feature Suggestions

### FEAT-01 — Show relative duration/status on challenge directory cards

- **Severity:** Suggestion
- **Area:** UX
- **Location:** `features/challenges/presentation/challenges-list-view.tsx`
- **Context:** The challenge hero already shows `daysRemaining` ("X Days Left" / "Starts Today"), and cards already show a status label. The directory cards still show raw dates rather than a relative duration/“Ended X days ago”.
- **Fix:** Surface the existing `daysRemaining`/`calculateChallengeStatus` values on the directory cards; no new domain math needed.
- **Source:** `ISSUES.md` #30 (re-scoped; hero/status work is done).

### FEAT-02 — Bulk import participants

- **Severity:** Suggestion
- **Area:** Admin UX
- **Location:** Admin roster editor
- **Context:** Admins add participants one at a time; bulk import (paste Discord IDs/usernames) would reduce setup time for large challenges.
- **Fix:** Add a paste/CSV import with validation and a preview before applying.
- **Source:** `ISSUES.md` #31.

### FEAT-03 — Challenge data export

- **Severity:** Suggestion
- **Area:** Admin UX / reporting
- **Location:** Challenge results/manage views
- **Context:** Hosts may want raw data for announcements or records even though the platform computes totals (Law L2).
- **Fix:** Add CSV/JSON export for final results and participant standings.
- **Source:** `ISSUES.md` #32.

---

## 🔧 Operational / Deployment Checks

These are not code defects. They are environment or kickoff checks from `solo-blockers.md` Tier 3. The original Solo event date (2026-10-18) is past; re-run these before the next event.

### OPS-01 — Supabase storage configuration

- Verify `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set.
- Exercise the challenge wizard's **Event Header Banner** and **Punishment PFP** uploads (up to 3 MB each) with test images.

### OPS-02 — Discord OAuth and redirect URI

- Verify `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, and `AUTH_SECRET`.
- Confirm the Discord redirect URI matches the deployment domain.

### OPS-03 — Database migration status

- Run `npx prisma migrate status` (or `npm run db:migrate:status`) against each environment; resolve drift before `migrate deploy` (see ISS-04).

### OPS-04 — Kickoff transition

- Creating a challenge leaves it `UPCOMING`.
- The host must click **Start Event Now** in the Manage tab to transition to `ACTIVE` and lock target hours.

---

## Recommended Fix Order

1. **SEC-01** — fail-closed YPT ingest key.
2. **ISS-04** — generate the remaining catch-up migrations and verify a clean deploy.
3. **SEC-03** — put the external/platform rate limiter in place.
4. **SEC-04** — auth/ownership checks on exposed read actions.
5. **SEC-10** — security response headers.
6. **ISS-36** — code-split the challenge tabs.
7. **ISS-33** — decompose/relocate `CockpitTasksSection`.
8. **SEC-05 / SEC-06 / SEC-07 / SEC-08 / SEC-09** — authz, token/backup protection, feedback hardening, error sanitization.
9. **SEC-11** — Tasker `/yapperize` hardening.
10.   **ISS-12** — add the missing indexes.
11.   **ISS-38 / ISS-39 / ISS-40 / ISS-41 / ISS-42** — architecture cleanup.
12.   **ISS-22 / ISS-23 / ISS-24 / ISS-25 / ISS-26 / ISS-27 / ISS-44 / ISS-45 / ISS-46** — hardening and DRY.
13.   **SEC-12 – SEC-20** — remaining hardening.
14.   **FEAT-01 – FEAT-03** — product suggestions.

---

## Preserve (do not regress)

These positive controls were called out in the security audit and should be kept:

- Secrets are git-ignored; `.env.example` uses placeholders.
- Mutating admin/dev actions call server-side `requireAdminUser()`/`requireDevUser()`; ownership is enforced with `requireOwnedParticipant` and `userId`-scoped queries.
- Economy flows use `Serializable` transactions, idempotency keys, and an append-only ledger.
- Only tagged-template `$queryRaw` with parameter binding is used; no `$queryRawUnsafe`.
- Uploads are magic-byte validated and stored under random UUID paths; cleanup is restricted to managed paths.
- No user-controlled `dangerouslySetInnerHTML`; challenge links are constrained to `http(s)://`/relative URLs.
- Admin overrides write audit events with actor/override IDs; self-demotion is blocked.
- `next/image` remote patterns are limited to specific hosts.
