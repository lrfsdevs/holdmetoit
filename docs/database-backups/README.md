# Database Backups

## 1. Executive Summary & Scope

HoldMeToIt keeps a **self-hosted, nightly logical backup** of the Supabase PostgreSQL
database. The backup runs inside the always-on `@holdmetoit/ypt-bot` service at
**00:00 UTC**, writes a compressed custom-format dump to a **private Supabase Storage
bucket**, and prunes dumps older than **30 days** (configurable, with a minimum
retention of **1 day**).

This complements (does not replace) Supabase provider backups/PITR. Provider recovery is
still the first option for infrastructure-level incidents; this feature guarantees an
application-level dump that lives in our own bucket and can be restored with `pg_restore`.

Scope guardrails:

- One dump per UTC day, produced by one always-on bot instance.
- `public` schema by default (configurable), no owners/ACLs.
- No restore automation, UI, or scheduling service outside the bot.
- No dumps in the repository; `.env` and `/backups/` stay gitignored.

Files:

| Path                                        | Purpose                                        |
| :------------------------------------------ | :--------------------------------------------- |
| `apps/ypt-bot/src/backup/databaseBackup.js` | Runner, scheduler, pure date/retention helpers |
| `apps/ypt-bot/src/config/env.js`            | Backup environment configuration (SPOC)        |
| `apps/ypt-bot/src/server.js`                | Starts the scheduler after `app.listen`        |
| `apps/ypt-bot/Dockerfile`                   | Node 22 + `postgresql-client-17`               |
| `apps/ypt-bot/test/database-backup.test.js` | Offline unit tests (fake exec + fake bucket)   |

## 2. Domain State Machine & Decisions

### 2.1 Schedule

```
startDailyBackupScheduler()
  ├─ disabled? → log backup_scheduler_disabled, return null
  ├─ schedule next 00:00 UTC (setTimeout, unref)
  │    └─ fire → run → recompute next 00:00 UTC (no setInterval drift)
  └─ optional startup catch-up (default on)
       └─ newest object older than 24h? → run once after 60s
```

Decisions:

- **In-process, not a separate cron service.** The bot already runs scheduled work and is
  deployed as a single always-on service.
- **Self-rescheduling `setTimeout`.** A missed tick or long dump cannot accumulate drift.
- **One run at a time.** An `inFlight` guard prevents overlapping dumps.
- **Day-scoped object names** (`holdmetoit-YYYY-MM-DD.dump`). A restart or a second
  instance cannot create a duplicate object; a `409`/duplicate upload is treated as success.
- **Catch-up on boot.** If the process was down at midnight, the next start checks the
  newest object and runs when it is 24h or older.
- **Failures never crash the service.** Every run is caught and logged; the Express API and
  YPT ingest keep running.

### 2.2 Run state machine

```
preflight → already present? ──yes──→ skip
    │ no
    ▼
pg_dump → size > 0 → pg_restore --list → upload → prune → cleanup
    │            │              │            │
    └ any failure ──────────────┴────────────┘
                       log backup_failed, retain temp dir, no prune
```

Prune runs **only after** a successful (or duplicate) upload. Prune failures are logged but
do not mark the run as failed.

### 2.3 Version invariant

`pg_dump` cannot dump a server whose major version is newer than the client. Before every
run the service checks:

1. `pg_dump --version` and `pg_restore --version`
2. `psql ... -tAc "SHOW server_version_num;"`

A client major lower than the server major aborts the run with an actionable message. The
Docker image pins `postgresql-client-17`; change it if the Supabase project reports another
major.

## 3. Database Persistence Models

No Prisma schema changes. Backups are stored as Storage objects:

| Property       | Value                                                            |
| :------------- | :--------------------------------------------------------------- |
| Bucket         | `holdmetoit-backups` (private)                                   |
| Prefix         | `backups/` (`DATABASE_BACKUP_PREFIX`)                            |
| Scheduled name | `holdmetoit-YYYY-MM-DD.dump`                                     |
| Manual name    | `holdmetoit-YYYY-MM-DDTHH-mm-ssZ.dump`                           |
| Format         | PostgreSQL custom format (`pg_dump --format=custom`), compressed |
| Content type   | `application/octet-stream`                                       |
| Metadata       | Filename date is authoritative for retention                     |

The dump contains the `public` schema (Prisma tables, `_prisma_migrations`, app data).
`--no-owner --no-privileges` keeps restores portable across projects. Add schemas with
`DATABASE_BACKUP_SCHEMAS=public,other`.

## 4. Developer & Operator Usage Guide

### 4.1 Environment variables

| Variable                         | Default      | Notes                                               |
| :------------------------------- | :----------- | :-------------------------------------------------- |
| `DATABASE_BACKUP_ENABLED`        | `false`      | Must be `true` for the in-process scheduler         |
| `DATABASE_BACKUP_CATCH_UP`       | `true`       | Run on boot if the newest dump is ≥24h old          |
| `DATABASE_BACKUP_RETENTION_DAYS` | `30`         | Objects older than this are pruned; minimum `1`     |
| `DATABASE_BACKUP_PREFIX`         | `backups`    | Storage folder                                      |
| `DATABASE_BACKUP_SCHEMAS`        | `public`     | Comma-separated `pg_dump --schema` list             |
| `DIRECT_URL`                     | —            | **Required.** Direct/session connection (port 5432) |
| `SUPABASE_URL`                   | —            | **Required.** Project URL                           |
| `SUPABASE_SERVICE_ROLE_KEY`      | —            | **Required.** Server-only key                       |
| `SUPABASE_BACKUP_BUCKET`         | —            | **Required.** Private bucket name                   |
| `PG_DUMP_BIN`                    | `pg_dump`    | Binary override                                     |
| `PG_RESTORE_BIN`                 | `pg_restore` | Binary override                                     |
| `PG_PSQL_BIN`                    | `psql`       | Binary override for the version preflight           |

`DIRECT_URL` must **not** be the transaction pooler (`:6543` or `pgbouncer=true`). The
service rejects it.

**Retention minimum:** retention is measured in days from the run's UTC clock.
`DATABASE_BACKUP_RETENTION_DAYS=0` (or any value below `1`) is clamped to **1 day**, so
the last 24 hours of dumps are always kept and the run never prunes the backup it just
created.

### 4.2 Manual run

```bash
# From the repo root
npm run backup:db

# Or directly
DATABASE_BACKUP_ENABLED=true npm run backup -w @holdmetoit/ypt-bot
```

A manual run ignores `DATABASE_BACKUP_ENABLED` and always uses a timestamped object name.
Exit code `0` means the dump was verified and uploaded; `1` means nothing was stored.

Expected log sequence (`backup_started` → `backup_dump_completed` → `backup_verified` →
`backup_uploaded` → `backup_pruned` → `backup_run_finished`).

### 4.3 Service integration

`apps/ypt-bot/src/server.js` calls `startDailyBackupScheduler()` inside the `app.listen`
callback. The scheduler exports `{ stop }` for tests/shutdown. It is intentionally **not**
started from `ingestStudyLogs.js`, so running both entrypoints cannot schedule two jobs.

### 4.4 Restore

```bash
# Download the object from the private bucket, then:
pg_restore \
  --dbname="$DIRECT_URL" \
  --clean --if-exists \
  --no-owner --no-privileges \
  --verbose \
  holdmetoit-YYYY-MM-DD.dump
```

Restore into an empty/disposable database first; `--clean` drops matching objects.

## 5. Security & Authorization Rules

- The bucket is **private**. No public read policy, no signed URLs retained.
- `SUPABASE_SERVICE_ROLE_KEY` is server-side only and never logged.
- The database password travels via `PGPASSWORD` in the child process environment, never as
  a CLI argument.
- Logs never include `DIRECT_URL`, the password, or the service-role key.
- Temp files live under `os.tmpdir()` (0700 directory); successful runs delete them.
- Dumps are never written to the repository; `/backups/` remains gitignored.
- Manual runs are operator-only (CLI access to the host/repo), not exposed over HTTP.

## 6. Feature Lifecycle & Decommissioning

1. **Dormant deploy** — code ships with `DATABASE_BACKUP_ENABLED=false`.
2. **Targeted verification** — create the private bucket, set the env vars, run
   `npm run backup:db` once, confirm the object and a restore into a scratch database.
3. **GA** — set `DATABASE_BACKUP_ENABLED=true` on the Render service and redeploy. Verify
   `backup_scheduled` with the next 00:00 UTC timestamp.
4. **Monitoring** — alert on `backup_failed` / `backup_catch_up_failed`. A healthy day has
   exactly one `backup_run_finished` with `skipped:false` (or `skipped:true` after a restart).
5. **Decommission** — set `DATABASE_BACKUP_ENABLED=false`, delete the scheduler call and
   `src/backup/`, remove the bucket/env vars after exporting the remaining dumps.

### Known limits

- One always-on instance is assumed. Multiple instances are safe for uploads (day-scoped
  names) but would duplicate `pg_dump` work.
- Standard Supabase uploads are limited to 50 MiB. Larger dumps fail with a clear message
  and require a resumable/TUS upload follow-up.
- Render free instances spin down; catch-up covers restarts, not long idle periods.
