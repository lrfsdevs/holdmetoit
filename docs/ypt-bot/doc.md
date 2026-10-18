# YPT Analytics & Challenge Synchronization Platform Documentation

This document provides a comprehensive guide to the **YPT Analytics Checker & Challenge Synchronization** service. It describes each feature, architecture components, configuration, database models, synchronization workflows, and operational commands.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture & Technology Stack](#architecture--technology-stack)
3. [Environment Configuration (SPOC)](#environment-configuration-spoc)
4. [Database & Prisma Models](#database--prisma-models)
5. [Core Features & CLI Tools](#core-features--cli-tools)
   - [A. Challenge Sync (`challenge_sync`)](#a-challenge-sync-challenge_sync)
   - [B. Live Study Log Ingestion (`ingest`)](#b-live-study-log-ingestion-ingest)
   - [C. Unified Member Leaderboard & Aggregation](#c-unified-member-leaderboard--aggregation)
   - [D. REST API Server](#d-rest-api-server)
6. [Strict UTC Time Guarantee](#strict-utc-time-guarantee)
7. [Admin Override Protection (Law L5)](#admin-override-protection-law-l5)
8. [Testing & Verification](#testing--verification)

---

## 1. Overview

The service acts as the synchronization bridge between the **Yeolpumta (YPT)** mobile study tracking platform and the **HoldMeToIt** PostgreSQL database.

It solves three primary challenges:

1. **Real-time Live Telemetry**: Extracting active study states, paused states, subjects, and study duration seconds from private/public YPT groups without requiring a continuous active user timer.
2. **Dynamic Challenge Ingestion**: Associating live YPT telemetry with active database challenges (`Challenge`) and participants (`ChallengeParticipant`) using strict **UTC day buckets**.
3. **Historical Backfill & Multi-Day Synchronization**: Synchronizing study hours from the start of the challenge (Monday) to the present day into `DailyStudyLogV2` (`study_logs_v2`), preserving historical integrity and manual admin overrides.

---

## 2. Architecture & Technology Stack

- **Runtime**: Node.js (ES Modules, Node >= 20)
- **Web Framework**: Express 5
- **ORM / Database**: Prisma 6.8.2 connecting to Supabase PostgreSQL (via Session Pooler and Direct Connection)
- **Test Runner**: Node.js native test runner (`node --test`)
- **Directory Structure**:
   ```text
   ├── prisma/
   │   └── schema.prisma         # Prisma data models (DailyStudyLogV2, Challenge, User, etc.)
   ├── src/
   │   ├── config/
   │   │   └── env.js            # Single Point of Contact (SPOC) for environment variables
   │   ├── db.js                 # PrismaClient singleton with connection pooling
   │   ├── db/
   │   │   └── challengeService.js # UTC active challenge and participant map queries
   │   ├── sync/
   │   │   ├── ingestStudyLogs.js  # Live YPT telemetry ingestion into DailyStudyLog
   │   │   └── challenge_sync.js   # Monday-to-today ingestion & historical sync pipeline
   │   ├── server.js             # Express REST API & scheduled background sync
   │   └── yptService.js         # YPT API client (auth, group telemetry, multi-group aggregation)
   ├── test/
   │   ├── challenge-sync.test.js # Unit/integration tests for challenge_sync
   │   ├── ingest-utc.test.js    # Tests for UTC date normalization and participant resolution
   │   └── yptService.test.js    # Tests for multi-group deduplication and fault tolerance
   └── package.json
   ```

---

## 3. Environment Configuration (SPOC)

All environment variables are validated and exported through a single module: [`src/config/env.js`](file:///home/afnan/Projects/YPT/src/config/env.js). No other file should directly call `process.env`.

| Variable              | Description                                                                | Example / Default                                                      |
| :-------------------- | :------------------------------------------------------------------------- | :--------------------------------------------------------------------- |
| `DATABASE_URL`        | PostgreSQL connection pooler URI (Port 6543, `pgbouncer=true`)             | `postgresql://...@...pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `DIRECT_URL`          | Direct PostgreSQL connection for migrations (Port 5432)                    | `postgresql://...@...pooler.supabase.com:5432/postgres`                |
| `YPT_EMAIL`           | Account email for YPT API authentication                                   | `bot@example.com`                                                      |
| `YPT_PASSWORD`        | Account password for YPT API authentication                                | `••••••••`                                                             |
| `YPT_GROUP_IDS`       | Comma-separated list of YPT group IDs to scrape                            | `6814572,6487271`                                                      |
| `ACTIVE_CHALLENGE_ID` | Optional override challenge ID (if omitted, dynamically queries DB in UTC) | `cmuub6ijq0003sb4eytzy2262`                                            |
| `PORT`                | Express server HTTP port                                                   | `3000`                                                                 |

---

## 4. Database & Prisma Models

The target table for study hours is `DailyStudyLogV2`, mapped to PostgreSQL table `study_logs_v2`:

```prisma
model DailyStudyLogV2 {
  id              String   @id @default(cuid())
  participantId   String
  logDate         DateTime @db.Date
  durationSeconds Int      @default(0)
  status          String?

  isOverride     Boolean @default(false)
  overrideById   String?
  overrideReason String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  participant ChallengeParticipant @relation(fields: [participantId], references: [id], onDelete: Cascade)
  overrideBy  User?                @relation("LogOverrideAdminV2", fields: [overrideById], references: [id], onDelete: SetNull)

  @@unique([participantId, logDate])
  @@index([participantId])
  @@index([logDate])
  @@map("study_logs_v2")
}
```

### Participant Mapping

- YPT member ID (`userId` or `ud`) is matched against `User.yptId`.
- The participant is resolved via `ChallengeParticipant` where `challengeId = activeChallenge.id` and `userId = User.id`.

---

## 5. Core Features & CLI Tools

### A. Challenge Sync (`challenge_sync`)

Ingests and updates all study hours in `DailyStudyLogV2` from **Monday** of the active challenge up to today.

```bash
npm run challenge_sync
```

#### Workflow:

1. **Dynamic Challenge Detection**: Queries PostgreSQL for the ongoing challenge in UTC (`startAt <= nowUtc AND endAt >= nowUtc`).
2. **Phase 1: Historical Days Backfill (Monday to Yesterday)**:
   - Queries historical study records from `DailyStudyLog` (V1).
   - Upserts entries for Monday through yesterday into `DailyStudyLogV2`.
   - Sets status to `"OFFLINE"`.
   - Preserves `durationSeconds` and admin override details (`isOverride`, `overrideById`, `overrideReason`).
   - If an existing record in `DailyStudyLogV2` already has `isOverride: true`, it is protected and skipped.
3. **Phase 2: Today's Live YPT Telemetry**:
   - Scrapes live telemetry from YPT groups in `env.YPT_GROUP_IDS`.
   - Maps active members to `ChallengeParticipant` records.
   - Upserts real-time `durationSeconds` and status:
      - `"STUDYING"`: Member has an active study session (`member.isStudying === true`, whether running or paused).
      - `"OFFLINE"`: Member has no active study session (`member.isStudying === false`).
4. **Console Breakdown**: Displays a structured table summarizing each day from Monday to today.

---

### B. Live Study Log Ingestion (`ingest`)

Performs a live scrape of study telemetry and writes directly to the daily study log table
`DailyStudyLog`:

```bash
npm run ingest
```

The cron is **challenge-window independent**: it no longer skips when the challenge is
locked, ended, or outside its active window. It keeps scraping and logging study telemetry
into the table, and only needs a resolvable challenge to anchor participants (an ended/locked
challenge is resolved via fallback). If **no** challenge exists at all, it fails loudly
(there is no `ChallengeParticipant` to key rows to). The challenge validity "checks" — what
counts for a challenge — belong to the server on the read side.

Also exposed via REST API endpoint:

```bash
curl -X POST http://localhost:3000/sync
```

---

### C. Unified Member Leaderboard & Aggregation

When an account belongs to multiple groups/channels, `getAggregatedMembers` consolidates members into a single grid:

- Deduplicates members appearing across multiple groups.
- Selects the **highest study duration** recorded across groups.
- Prioritizes active study states (`isStudying: true`, unpaused).
- Combines group memberships into `groupIds` and `groupNames`.

---

### D. REST API Server

Start the Express server:

```bash
npm start
```

| Method | Endpoint                   | Description                                                                       |
| :----- | :------------------------- | :-------------------------------------------------------------------------------- |
| `GET`  | `/health`                  | Server status and authenticated account info.                                     |
| `GET`  | `/members`                 | Unified and deduplicated members across all joined groups.                        |
| `GET`  | `/groups`                  | List all joined groups. Supports `?q=<keyword>` and `?refresh=true`.              |
| `GET`  | `/groups/:groupId/members` | Live telemetry for members of a specific group.                                   |
| `POST` | `/sync`                    | Trigger an immediate live YPT scrape and database ingestion into `DailyStudyLog`. |

---

## 6. Strict UTC Time Guarantee & Challenge Lifecycle

To prevent timezone drift and misalignment across international participants:

- All challenge queries evaluate in strict UTC time using `getChallengeLifecycle(challenge, nowUtc)`.
- **Challenge Lifecycle States** (no longer gate ingestion — the cron always logs; state only affects day bucketing):
   - `LOCKED`: `resultsLockedAt` is set on the `Challenge` and has passed.
   - `UPCOMING`: Before `startAt`.
   - `ACTIVE`: During `[startAt, endAt]` while not locked.
   - `DAY7_GRACE`: A 6-hour grace window spanning `(endAt, endAt + 6h]` following Day 7 completion (unless locked earlier):
      - Target bucket is locked to **Day 7** (`computeChallengeDayLogDate(day7End - 1000, challenge.startAt)`).
      - **Old Sessions Allowed**: In-progress sessions that began before Day 7 completion (`sessionStartMs < day7End`) continue to accumulate and finalize upon going offline.
      - **New Sessions Rejected**: Any session started on or after Day 7 completion (`sessionStartMs >= day7End`) is ignored and will not increase Day 7 study duration (status marked `OFFLINE`).
   - `EXPIRED`: Past `endAt + 6h`.
- `ingestGroupMembersToDailyStudyLogs` no longer bails on a non-ingestable state: it always writes day telemetry to `DailyStudyLog`, resolving ended/locked challenges via `getActiveChallenge(nowUtc, { allowFallback: true })`, and throws when no challenge exists at all.
- **Automatic Challenge Locking & Audit Log**:
   - `lockExpiredChallengesAfterGrace(nowUtc, log)` runs automatically at the beginning of ingestion cycles (`runIngest`, `ingestGroupMembersToDailyStudyLogs`, and `getActiveChallenge`).
   - Any challenge past `endAt + 6h` with `resultsLockedAt == null` is atomically locked (`resultsLockedAt = nowUtc`).
   - An immutable system `AuditLog` is created:
      - `actionType`: `'CHALLENGE_LOCKED'`
      - `auditReason`: `'challenge locked after 6 hr grace hours'`
      - `targetEntityType`: `'CHALLENGE'`
      - `newValue`: `{ resultsLockedAt, title: 'challenge locked after 6 hr grace hours', autoLocked: true }`
      - `actorUsername`: `'system'`, `actorDisplayName`: `'YPT Auto-Lock'`
   - Atomic conditional updates ensure idempotency across concurrent sync executions.
- Day buckets are **challenge-anchored**: a challenge day is derived from `Challenge.startAt` in UTC.
  Day _N_ spans `[startAt + N·24h, startAt + (N+1)·24h)`, and `logDate` is the UTC midnight of that
  day's start (the `DailyStudyLog.logDate` column is `@db.Date`):
   ```js
   // computeChallengeDayLogDate(nowUtc, challenge.startAt)
   const dayIndex = Math.max(
      0,
      Math.floor((nowUtc - startAt) / (24 * 60 * 60 * 1000))
   );
   const bucketStart = new Date(startAt + dayIndex * 24 * 60 * 60 * 1000);
   return new Date(
      Date.UTC(
         bucketStart.getUTCFullYear(),
         bucketStart.getUTCMonth(),
         bucketStart.getUTCDate(),
         0,
         0,
         0,
         0
      )
   );
   ```
   For a challenge starting at UTC midnight this equals the plain UTC calendar date; for a
   non-midnight start the bucket follows the challenge start instant rather than the wall clock.
- No local timezone offsets are applied to date bucket boundaries. YPT's own day boundary is ignored.

---

## 7. Admin Override Protection (Law L5)

Platform administrators may manually adjust study hours or grant leaves through the frontend dashboard:

- When `isOverride: true` is set on a `DailyStudyLog` record, automated YPT syncs and historical backfills **will never overwrite** `durationSeconds`.
- For live records, live status (e.g. `"STUDYING"`) continues to update so dashboards show real-time activity while preserving the adjusted study duration.

---

## 8. Testing & Verification

Run the full automated test suite:

```bash
npm test
```

All 57 tests across 18 test suites validate:

- Multi-group member aggregation and duplicate removal.
- Fault tolerance when individual groups return errors.
- Strict UTC date normalization and rollover safety.
- Status derivation (`STUDYING` when studying/paused, `OFFLINE` when inactive).
- Challenge lifecycle transitions (`UPCOMING`, `ACTIVE`, `DAY7_GRACE`, `EXPIRED`, `LOCKED`).
- Day 7 grace period session filtering (old sessions accumulate, finalized on offline, new sessions rejected).
- Automatic challenge locking after 6-hour grace window and system `AuditLog` creation.
- Dynamic UTC challenge and participant resolution.
- Historical Monday backfill, override preservation, and idempotency.

---

## 9. Deployment on Render

The repository is configured for turnkey deployment on [Render](https://render.com).

### Option 1: 1-Click Blueprint (`render.yaml`)

1. In your Render Dashboard, click **New +** $\rightarrow$ **Blueprint**.
2. Connect your Git repository. Render will automatically detect [`render.yaml`](file:///home/afnan/Projects/YPT/render.yaml).
3. Populate the required environment secrets when prompted:
   - `DATABASE_URL`: PostgreSQL pooler connection URI.
   - `DIRECT_URL`: PostgreSQL direct session connection URI.
   - `YPT_EMAIL`: Bot YPT login email.
   - `YPT_PASSWORD`: Bot YPT password.
4. Click **Apply**. Render will automatically build the service and start the web server with 5-minute background synchronization.

### Option 2: Manual Web Service Setup

1. In the Render Dashboard, click **New +** $\rightarrow$ **Web Service**.
2. Connect your repository and configure:
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build` _(or `npm install && npx prisma generate`)_
   - **Start Command**: `npm start`
   - **Health Check Path**: `/health`
3. Under **Environment Variables**, add:
   - `DATABASE_URL`: Your Supabase pooler URL
   - `DIRECT_URL`: Your Supabase direct URL
   - `YPT_EMAIL`: Your YPT account email
   - `YPT_PASSWORD`: Your YPT account password
   - `YPT_GROUP_IDS`: `6814572,7393477`
   - `REFRESH_INTERVAL_MINUTES`: `5` (runs ingestion every 5 minutes)
   - `POLL_INTERVAL_IDLE_SEC`: `30` (ingest daemon poll interval, in seconds)
   - `NODE_ENV`: `production`

### Option 3: Headless Background Worker or Cron Job

- **Background Worker**: Set Start Command to `npm run ingest`. It runs continuously and
  polls at the interval configured by `POLL_INTERVAL_IDLE_SEC` (seconds, default `30`).
