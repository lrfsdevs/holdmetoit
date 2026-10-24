# HANDOFF

## 2026-10-24 — `npm start` is the single runtime entry point

### Context

The bot had three competing runtime entry points (`ingest`, `challenge_sync`,
`backup`) that duplicated the server's ingestion loop, auth handling, and health
server. Requested change: make `npm start` the single source of truth.

### What changed

- **`src/server.js`**: now owns env validation, the health endpoint, the ingestion
  loop, and the backup scheduler. It calls `runIngest()` every
  `POLL_INTERVAL_IDLE_SEC` (default 30s) with an in-flight guard; it no longer
  prompts for credentials, scrapes all joined groups, or runs its own 5-minute
  loop.
- **Removed entry points**: `npm run ingest`, `npm run challenge_sync`,
  `npm run backup`, and the `backup:db` root script. Modules no longer have
  `isDirectExecution` CLI blocks.
- **`src/sync/challenge_sync.js` deleted** (plus `test/challenge-sync.test.js`):
  its historical phase re-upserted the same `DailyStudyLog` rows and its live
  phase duplicated `runIngest()`.
- **`src/yptService.js`**: removed `getJoinedGroups` (only the old server used it).
- **Behavior**: credentials must come from env; ingestion cadence is
  `POLL_INTERVAL_IDLE_SEC`; only `YPT_GROUP_IDS` groups are scraped; missed
  backups recover via the existing boot catch-up.

### Verification

- `npm run test -w @holdmetoit/ypt-bot` → green.
- `node --check` on the changed modules.
- No `isDirectExecution`, `challenge_sync`, `npm run ingest`, or
  `REFRESH_INTERVAL_MINUTES` references remain outside historical handoff notes.

---

## 2026-10-24 — Express removed; single `node:http` health route

### Context

The bot exposed an unauthenticated Express API that leaked the YPT service account
(`/health` returned its email) plus group rosters and live member telemetry
(`/groups`, `/members`, `/groups/:groupId/members`) and an ingestion trigger
(`POST /sync`). Nothing consumed these routes — `apps/web` never called the bot's
HTTP API, and no test imported `server.js`.

### What changed

- **`src/server.js`**: deleted every Express route except liveness. Replaced the
  Express app with `createServer` from `node:http`; `GET /health` returns
  `{ status: "ok", service: "ypt-bot", uptimeSeconds }`. All other paths/methods
  return `404 {"error":"Not found"}`. Removed `express.json()` and the HTTP
  access-log middleware.
- **Dead code**: removed `displayGroupMembers()` (only the deleted route used it)
  and the `searchJoinedGroups()` export in `src/yptService.js`.
- **Dependency**: dropped `express` from `apps/ypt-bot/package.json`; lockfile
  regenerated (124 packages pruned).
- **Unchanged**: CLI login, joined-group discovery/console tables, initial ingest,
  the 5-minute ingest scheduler, and `startDailyBackupScheduler()`.

### Verification

- `npm run test -w @holdmetoit/ypt-bot` → green.
- `npm ls express -w @holdmetoit/ypt-bot` → `(empty)`.
- `grep -rn "express" apps/ypt-bot/src apps/ypt-bot/package.json` → no matches.

---

## 2026-10-15 — Challenge-independent ingest: always log telemetry to `DailyStudyLog`

### Context

The ingest cron used to gate on the challenge lifecycle: when the challenge was locked,
ended, or upcoming it did **not** write study rows (`NO_ACTIVE_CHALLENGE` /
`CHALLENGE_<state>` early returns). Requested change: keep logging study telemetry into the
daily study log table even when the challenge is locked/ended — the challenge validity
"checks" move to the server (read side). Target table also moves from `DailyStudyLogV2`
(`study_logs_v2`) to `DailyStudyLog`.

### Entry point → call-chain (production path)

- `npm run ingest` → `src/sync/ingestStudyLogs.js` → `runIngest()` → `getAggregatedMembers()` (always scrape) → `ingestGroupMembersToDailyStudyLogs()` → `DailyStudyLog` upserts.
- `POST /sync` (`src/server.js`) → same `ingestGroupMembersToDailyStudyLogs()`.

### What changed

- **`src/sync/ingestStudyLogs.js`**:
   - `runIngest()`: removed the early `getActiveChallenge()` gate (no more `NO_ACTIVE_CHALLENGE` / `CHALLENGE_<state>` short-circuit); always scrapes and ingests.
   - `ingestGroupMembersToDailyStudyLogs()`: resolves the anchor challenge with
     `getActiveChallenge(nowUtc, { allowFallback: true })` so ended/locked challenges still
     anchor telemetry; **throws `No challenge available to anchor study telemetry`** when no
     challenge exists at all; removed the `!lifecycle.canIngest` gate (always logs). Day-7
     grace + rollover/zero-drop/override logic unchanged.
   - Write target switched `prisma.dailyStudyLogV2` → `prisma.dailyStudyLog` (prefetch
     `findMany`, `upsert`, override `update`).
- **`prisma/schema.prisma`**: added `status String? @db.VarChar(32)` to `model DailyStudyLog`
  (carried over from `DailyStudyLogV2`, which the ingest reads/writes and the Day-7 grace
  logic depends on).
- **`test/challenge-lifecycle.test.js`**: replaced "skips ingestion when locked" with
  "still logs study telemetry when the challenge is locked"; replaced the runIngest
  early-exit test with a scrape + fail-loudly test; swapped `dailyStudyLogV2` mocks →
  `dailyStudyLog`.
- **`test/ingest-guards.test.js`**: swapped `dailyStudyLogV2` mocks → `dailyStudyLog`.
- **`doc.md`**: updated ingest section + lifecycle section (states no longer gate ingestion)
  and the override/day-bucket references to `DailyStudyLog`.

### Behavior change (intended)

- The cron no longer stops logging when a challenge is locked/ended/upcoming — it keeps
  writing day telemetry to `DailyStudyLog`. A genuinely absent challenge now throws (loud)
  instead of silently skipping.

### DB apply step

- New migration `prisma/migrations/20261015090000_add_status_to_daily_study_log/migration.sql`:
  `ALTER TABLE "DailyStudyLog" ADD COLUMN IF NOT EXISTS "status" VARCHAR(32);` (idempotent).
- Apply with `prisma migrate deploy` (or the raw SQL where the column is missing). Nothing in
  the build pipeline syncs the schema — apply manually.

### Verification

- `CI_SKIP_DB=true npm test` → 56 pass / 1 fail; the only failure is the pre-existing,
  untouched WIP `test/bot-logs.test.js` (out of scope). The two `(DB)` subtests in
  `challenge-lifecycle` require a live Postgres and are unrelated.
- `CI_SKIP_DB=true node --test test/challenge-lifecycle.test.js test/ingest-guards.test.js test/ingest-utc.test.js` → 34 pass / 0 fail.
- `npx prisma generate` succeeds with the new `status` column.

### Open items / follow-ups

- Server read endpoints (`GET /logs/*`) and the challenge validity "checks on the server"
  are still pending.
- The `YptBotLog` telemetry WIP (`src/db/botLogService.js`, `test/bot-logs.test.js`, the
  `ypt_bot_logs` migration) is untouched and still has no `YptBotLog` model in
  `prisma/schema.prisma`.
- `src/sync/challenge_sync.js` still writes `DailyStudyLogV2`; folding it into the
  V2→DailyStudyLog move is a separate step.

---

## 2026-10-15 — Ingest daemon polls from `POLL_INTERVAL_IDLE_SEC` (30s), flags removed

### Context

The `ingestStudyLogs.js` CLI had a hardcoded 5-**minute** loop driven by `--loop`/`--interval`
flags, and the env var `POLL_INTERVAL_IDLE_SEC` was declared but read nowhere. Requested change:
make the ingest command take its idle poll interval from env, and set that idle value to **30s**.

### Entry point → call-chain (production path)

- `npm run ingest` → `node src/sync/ingestStudyLogs.js` → CLI block → `setInterval(env.POLL_INTERVAL_IDLE_SEC * 1000)` → `runIngest()` → `ingestGroupMembersToDailyStudyLogs()`.
- Also documented as the Render background-worker start command (`doc.md` Option 3).
- `runIngest()` remains exported and unchanged for the Express path (`server.js`).

### What changed

- **`src/config/env.js`**: `POLL_INTERVAL_IDLE_SEC` fallback `300` → `30`.
- **`.env`**: `POLL_INTERVAL_IDLE_SEC=300` → `30` (comment already said "seconds").
- **`src/sync/ingestStudyLogs.js`**: removed `--loop`/`--interval` parsing and the
  `intervalMinutes > 0` branch. The CLI block now always runs as a daemon at
  `env.POLL_INTERVAL_IDLE_SEC`, logging `intervalSeconds` and exposing it on the
  Render health JSON (`{ service: 'ingest-watch', intervalSeconds }`).
- **`package.json`**: deleted the `ingest:watch` script; `ingest` is the single, flagless
  command and now runs the env-driven daemon.
- **`doc.md`**: Option 3 background worker start command is `npm run ingest` polling at
  `POLL_INTERVAL_IDLE_SEC` (default 30s); added the var to the env list; removed the
  `*/5 * * * *` one-shot cron line.

### Behavior change (intended)

The flagless one-shot mode (`npm run ingest` running once and exiting) is gone — the
command is now always the daemon. Chosen deliberately per review ("no flag ... getting
the time from env").

### DB apply step

- **No `prisma/schema.prisma` change → no migration needed.**

### Verification

- `CI_SKIP_DB=true npm test` → 56 pass / 1 fail; the only failure is the pre-existing,
  untouched WIP `test/bot-logs.test.js` (imports a not-yet-existing `ingestOffSeasonTelemetry`
  export). Locally the two DB suites (`getActiveChallenge Resolution & Fallback Behavior (DB)`,
  `syncChallengeFromMonday`) also fail without a running Postgres — both pre-existing and
  unrelated to this change. This change touches no exported function those suites use.
- `grep -n -- '--interval\|--loop' src/sync/ingestStudyLogs.js` → no matches.
- `grep -rn 'ingest:watch' src package.json doc.md` → no live references (only this
  HANDOFF history and taste notes mention the removed script).
- `env.POLL_INTERVAL_IDLE_SEC` resolves to `30` from both `.env` and the `env.js` fallback.

### Open items / follow-ups (unused "lying" env vars — NOT changed)

Declared but read nowhere in `src/`:

- `POLL_INTERVAL_ACTIVE_SEC` (`.env:17` only) — unused; note it inverts the usual
  "poll less when idle" intent vs the new 30s idle value.
- `STALE_STUDY_TIMEOUT_MINUTES` (`.env`, `env.js`) — unused.
- `TIMEZONE` (`.env`, `env.js`) — unused.
- `DAY_ROLLOVER_HOUR` (`.env`, `env.js`) — unused.
- `DISCORD_WEBHOOK_URL` (`.env` only) — unused.
- `ALERT_FAILURE_THRESHOLD` (`.env` only) — unused.
- `API_SECRET` (`.env` only) — unused (no auth middleware consumes it).
- SPOC bypass: `src/server.js:365` reads `process.env.REFRESH_INTERVAL_MINUTES` directly,
  and that var is defined nowhere in `.env`/`env.js`. Not moved into `env.js` yet.

---

## 2026-10-12 — Challenge Lifecycle, Day 7 Grace Window, 6hr Auto-Locking, and Zero-Drop/Rollover Glitch Protection

### Context & Incident Resolution

1. **Incident Resolution (`INC-20261012-01`)**:
   - Resolved flapping study durations where active participants had accumulated hours wiped to `00:00:00` due to YPT regional groups rolling over ahead of UTC midnight and cold/flapping auth sessions.
   - Diagnosed root causes: YPT `dl.dt` date advancement vs UTC challenge day bucket mismatch, asymmetric multi-group rollovers, unconditional DB upserts, and auth session churn across load-balanced API replicas.
2. **Challenge Lifecycle & Day 7 Grace Rules**:
   - Prevented logging to ended challenges by making fallback strictly opt-in (`allowFallback: false`).
   - Implemented Day 7 6-hour grace window rules: only in-progress old sessions started before Day 7 completion continue to accumulate and finalize on offline; new sessions started after Day 7 completion are rejected.
   - Added automatic challenge locking after the 6-hour grace window with system `AuditLog` creation (`CHALLENGE_LOCKED`, reason: `"challenge locked after 6 hr grace hours"`).

### What changed

- **`src/yptService.js`**:
   - `getGroupMembers`: extracts `studyDate` (`dl.dt || dl.dd || null`) and `lastActiveDate` (`dl.dd || null`) and includes them in returned member objects.
   - `getAggregatedMembers`: propagates and preserves `studyDate` and `lastActiveDate` when consolidating members across multiple groups, ensuring the group with active study hours takes precedence.
- **`src/db/challengeService.js`**:
   - Added `CHALLENGE_GRACE_WINDOW_MS = 6 * 60 * 60 * 1000` (6 hours).
   - Added `getChallengeLifecycle(challenge, nowUtc)` returning lifecycle states:
      - `LOCKED`: `challenge.resultsLockedAt <= now` (logging prohibited).
      - `UPCOMING`: `now < challenge.startAt` (logging prohibited).
      - `ACTIVE`: `startAt <= now <= endAt` and not locked (normal logging).
      - `DAY7_GRACE`: `endAt < now <= endAt + 6h` and not locked (Day 7 grace window).
      - `EXPIRED`: `now > endAt + 6h` (logging prohibited).
   - Added `lockExpiredChallengesAfterGrace(nowUtc, log)`:
      - Automatically finds challenges where `endAt <= now - 6h` and `resultsLockedAt == null`.
      - Atomically updates `resultsLockedAt = nowUtc`.
      - Creates an immutable system `AuditLog` entry with `actionType: 'CHALLENGE_LOCKED'`, `auditReason: 'challenge locked after 6 hr grace hours'`, and `newValue: { resultsLockedAt: now.toISOString(), title: 'challenge locked after 6 hr grace hours', autoLocked: true }`.
   - Made fallback to ended challenge opt-in via `{ allowFallback = false }`. Default query only returns active/grace challenges where `resultsLockedAt` is null or in the future and within the 6h grace window.
- **`src/sync/ingestStudyLogs.js`**:
   - Automatically calls `lockExpiredChallengesAfterGrace()` at the beginning of `runIngest()` and `ingestGroupMembersToDailyStudyLogs()`.
   - `runIngest()` checks active challenge early; if no challenge is active/ingestable, skips YPT login and scraping.
   - Session token reuse & caching: introduced `cachedToken`, `getOrRefreshAuthToken()`, and `invalidateAuthToken()` to prevent session churn across 5-minute ticks and auto-refresh on 401/session error.
   - `ingestGroupMembersToDailyStudyLogs()`:
      - If in `DAY7_GRACE`, target day bucket is locked to **Day 7** (`day7End - 1000ms`).
      - Session filtering during Day 7 grace:
         - **Old sessions** (`member.isStudying && member.sessionStartMs < day7End`): continue accumulating time and update Day 7 duration.
         - **Completed old sessions** (`wasStudyingOldSession && !member.isStudying`): finalized to Day 7 and marked `OFFLINE`.
         - **New sessions** (`member.sessionStartMs >= day7End`): ignored, Day 7 duration is kept unchanged, status set to `OFFLINE`.
      - **Rollover Guard**: if `!lifecycle.isGracePeriod && member.studyDate > targetLogDateStr`, incoming telemetry belongs to tomorrow; preserves `existing.durationSeconds` and increments `protectedRollovers`.
      - **Zero-Drop Guard**: if incoming `durationSeconds === 0` while `existing.durationSeconds > 0`, preserves `existing.durationSeconds` and increments `protectedZeroDrops`.
      - Structured metrics include `protectedRollovers` and `protectedZeroDrops`.
- **`src/sync/challenge_sync.js`**:
   - Added `allowFallback = false` option and `--fallback` CLI argument.
   - Phase 2 live ingestion selects `durationSeconds: true` and applies matching rollover and zero-drop protection before upserting into `DailyStudyLogV2`.
- **`test/ingest-guards.test.js`**:
   - Added 6 automated tests covering: `studyDate` extraction, multi-group `studyDate` preservation, rollover date protection, zero-drop protection, normal same-day progress updates, and session token caching/invalidation.
- **`test/challenge-lifecycle.test.js`**:
   - Added 22 unit, integration, and E2E simulation tests covering:
      - Lifecycle state transitions and boundaries (`UPCOMING`, `ACTIVE`, `DAY7_GRACE`, `EXPIRED`, `LOCKED`).
      - Day 7 grace period session filtering (accumulating old sessions, finalizing offline transitions, rejecting new sessions).
      - Dynamic DB active query resolution and opt-in fallback behavior.
      - End-to-end ingestion simulation with mocked DB state.
      - `lockExpiredChallengesAfterGrace()` execution, system `AuditLog` creation, and idempotency.
- **`package.json`**:
   - Added `"postinstall": "prisma generate"` to ensure Prisma Client is automatically regenerated on every deployment (e.g. Render, CI, or local install), preventing missing field validation errors like `Unknown argument resultsLockedAt`.
- **`doc.md`**:
   - Updated §6 with Challenge Lifecycle States, Day 7 grace rules, and auto-locking + AuditLog behavior.
   - Updated §8 with new test counts and coverage areas.

### DB apply step

- Missing migrations and schema updates were provided and verified via `scripts/check-schema-migration.sh dev`. `resultsLockedAt` column already exists in PostgreSQL database.
- Audit logs use existing `AuditLog` table (`audit_logs`) and conform strictly to schema constraints.

### Verification

- `npm test` → **63 pass / 0 fail** across 21 test suites.
- `CI_SKIP_DB=true DATABASE_URL=... npm test` → **56 pass / 0 fail** (DB suites skipped in CI mode).
- `scripts/check-schema-migration.sh dev` → **OK: schema/migration guard passed**.

---

## 2026-10-11 — CI schema-migration guard + quality gates

### What changed

- **New `scripts/check-schema-migration.sh [base]`** (default `origin/master`): fails if
  `prisma/schema.prisma` changed vs the base ref and nothing under `prisma/migrations/` changed.
  Message tells you to add `prisma/migrations/<timestamp>_<name>/migration.sql` and record the DB
  apply step in HANDOFF.md.
- **New `.github/workflows/ci.yml`**: on push/PR to `master` + `dev` (Node 22, `fetch-depth: 0`),
  runs schema guard → `npm test` → `npm run build`.
- **DB-backed suites skip in CI** via `{ skip: process.env.CI_SKIP_DB === 'true' }`
  (`test/ingest-utc.test.js` "Database …" block, `test/challenge-sync.test.js`). The workflow sets
  placeholder `DATABASE_URL`/`DIRECT_URL` so `PrismaClient` can still be imported; no connection is made.
- **`AGENTS.md`**: added the rule that `prisma/schema.prisma` changes must ship with a migration.
- **New migration** `prisma/migrations/20261011000000_add_is_leave_to_study_logs_v2/migration.sql`:
  `ALTER TABLE "study_logs_v2" ADD COLUMN IF NOT EXISTS "isLeave" boolean NOT NULL DEFAULT false;`

### DB apply step

- The `isLeave` migration is a **no-op in production** (the column already exists; `IF NOT EXISTS`).
  Apply via `prisma migrate deploy` or the raw SQL where a DB lacks it. Nothing in the build pipeline
  syncs the schema — apply manually.

### Verification

- Guard paths verified in a throwaway repo: pass (no schema change), fail (schema change w/o
  migration), pass (with migration), and a clear error for a missing base ref.
- The guard currently **fails on `dev`** because commit `303bbbf` changed `prisma/schema.prisma`
  with no migration — expected; it passes once this migration commit lands in the branch range.
- `CI_SKIP_DB=true DATABASE_URL=… npm test` → 32 pass / 0 fail, DB suites `SKIP`.
- `npm run build` → exit 0 with the placeholder env.

### Open / follow-ups

- Live drift detection (`prisma/schema.prisma` vs the actual DB) is **not** implemented — would need a
  DB secret in Actions.
- Commit `303bbbf` (winston logging + day buckets) is on `dev` ahead of `master`; open a PR to `master`
  when ready (the guard will require this migration to be included).

---

## 2026-10-11 — Centralized winston logging (for incident diagnosis)

### What changed

- **New `src/logger.js`** — single centralized logger. `createLogger()` factory (injectable
  transports/format for tests) + shared `logger` instance. JSON on stdout in production, colorized
  pretty in development; errors go to stderr; `logger.child({...})` attaches per-run context.
- **`src/config/env.js`** — added `LOG_LEVEL` (default `info`) and `LOG_SILENT` (default false) per
  the SPOC rule (no `process.env` outside this file).
- **Wired all 53 `console.*` sites** in `server.js`, `sync/ingestStudyLogs.js`,
  `sync/challenge_sync.js`, `db/challengeService.js`, `yptService.js` to the logger.
   - `server.js`: request middleware now emits a structured `http` line on response `finish`
     (`{ method, url, status, durationMs }`); startup/periodic/error paths logged with a per-run
     `runId`. Kept `console.table`, the login prompt, and the endpoint banner (UI).
   - `ingestStudyLogs.js`: `runIngest()` and `ingestGroupMembersToDailyStudyLogs` use a child logger
     with `runId`; the ingest summary is structured (`challengeId, logDate, matchedCount,
upsertedCount, skippedOverrides, cappedCount, sessionCappedCount, unlinkedCount, durationMs`).
   - `challenge_sync.js`: child logger `{ runId, challengeId }`; `log()` keeps the `verbose` gate; kept
     the summary `console.table`. Errors pass the `Error` (stack captured).
   - `yptService.js`: per-group scrape failures logged with `{ groupId, reason }`.
- **`package.json`** — added `winston` (^3.19.0); `test` script now `LOG_SILENT=true node --test`.
- **`test/logger.test.js`** — 4 tests (default/call meta, child context merge, silent, error stack).

### Verification

- `npm test` = **35 pass / 0 fail**.
- Dev output = colorized pretty with JSON meta; `NODE_ENV=production` output = single-line JSON with
  `service`, `timestamp`, `runId`, `challengeId`, and `stack` on errors.
- `node --check` passes on all six modified files; `grep console.` shows only UI/table/prompt sites.
- Not exercised live: the HTTP access line was verified via format checks, not by booting the server
  (starting it triggers a real YPT ingest/DB write).

---

## 2026-10-11 — Challenge-anchored day bucket (align bot with product day boundary)

### Context

Incident: Saturday (2026-10-10) `study_logs_v2` rows for ~28 participants were reset to 0 after the
day ended. Root cause: the bot overwrote `durationSeconds` with YPT's instantaneous daily counter,
which reads 0 around day boundaries; the bot also bucketed by plain UTC calendar date while the
product keys days off the challenge start. Full analysis in
`INCIDENT_REPORT_2026-10-11_saturday_logs.md`.

Requested follow-up (this change): **ignore the YPT day; use the product's day bucket, derived from
`Challenge.startAt` in UTC.** The zero-overwrite guard was explicitly **out of scope**.

### What changed

- `src/sync/ingestStudyLogs.js`
   - Added `CHALLENGE_DAY_MS` and exported `computeChallengeDayLogDate(nowUtc, challengeStartAt)`:
     `N = max(0, floor((now − startAt) / 24h))`; returns UTC midnight of `startAt + N·24h`
     (matches the `@db.Date` column).
   - `ingestGroupMembersToDailyStudyLogs`: `logDate` is now computed **after** the challenge resolves,
     from `challenge.startAt` (was `computeUtcLogDate(nowUtc)` before resolution).
   - Kept `computeUtcLogDate` (still used for V1 row normalization and start/end date labels).
- `src/sync/challenge_sync.js`
   - Imported the new helper; `todayUtc` now uses `computeChallengeDayLogDate(nowUtc, challenge.startAt)`
     (moved after challenge resolution). Phase 1 range bounds and Phase 2 live upserts are aligned.
     `challengeStartUtc` / `challengeEndUtc` and Phase 1 `rowLogDate` remain `computeUtcLogDate(...)`.
- `doc.md` — §6 "Strict UTC Time Guarantee" now documents the challenge-anchored bucket and that
  YPT's day boundary is ignored.
- `test/ingest-utc.test.js` — added 5 `computeChallengeDayLogDate` cases (midnight parity,
  non-midnight anchor, exact `startAt + N·24h` rollover, 24h-window stability, pre-start clamp).
- `test/challenge-sync.test.js` — removed an unused `computeUtcLogDate` import.

### Entry points affected (all live writes funnel here)

- `npm start` → `src/server.js` initial + 5-min interval → `ingestGroupMembersToDailyStudyLogs`
- `POST /sync` → `ingestGroupMembersToDailyStudyLogs`
- `npm run ingest` / `ingest:watch` → `runIngest()` → `ingestGroupMembersToDailyStudyLogs`
- `npm run challenge_sync` → `syncChallengeFromMonday()` (Phase 1 + Phase 2)

### Verification

- `npm test` = **31 pass / 0 fail** (new bucket suite + the two fixes below).
- Parity check: for the active challenge (`startAt = 2026-10-05T00:00:00Z`) the new bucket equals the
  previous UTC calendar date for all sampled instants → **no data migration/backfill needed**.

### Open items / next steps

- **Rejected (2026-10-11):** monotonic/zero-overwrite guard. A `max(existing, incoming)` write would
  also block legitimate downward corrections (e.g. a user removing hours in YPT). Do not re-add it
  unless real decreases can be distinguished from glitchy `0` samples.
- Minor data inconsistency (flagged, not fixed): 3 rows in `study_logs_v2` still have
  `status='Offline'` (wrong casing; 2026-10-09). Normalize to `'OFFLINE'` if desired.
- **Done (2026-10-11):** fixed the flaky `test/session-cap.test.js` exact-ms assertion — the "~2h"
  check is now tolerance-based (`Math.abs(liveStudyMs - 7200000) < 2000`), matching the other
  time-window assertions.
- **Done (2026-10-11):** normalized the 17 `study_logs_v2` rows with `status IS NULL` (all
  `isOverride=true`, dates 2026-10-05..09) to `status='OFFLINE'` via a targeted
  `updateMany({ where: { status: null } })`. `challenge-sync.test.js` "Monday logs are OFFLINE"
  assertion now holds.
- **Done:** added the live-DB `isLeave Boolean @default(false)` column to `DailyStudyLogV2` in
  `prisma/schema.prisma` so it matches the deployed `study_logs_v2` table (previously a
  `prisma db push` from the repo schema would have tried to drop it). `npx prisma validate` passes.
