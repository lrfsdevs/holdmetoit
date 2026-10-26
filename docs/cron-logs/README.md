# Cron Logs

## 1. Executive Summary & Scope

`CronLog` records every ypt-bot job execution: what ran, when, how long it took,
whether it succeeded, and a compact result summary. There is no per-member
change history and no undo.

Scope:

- Jobs logged: `YPT_INGEST` (every loop cycle) and `DB_BACKUP` (nightly +
  boot catch-up).
- One row per completed run; nothing is recorded per participant.
- Read-only surface in the DevBoard **Cron Logs** tab.

Guardrails:

- Monitoring never breaks the monitored job — every log write is wrapped, and a
  failed log write only emits a warning.
- Rows are finalized on completion; boot recovery closes any leftover `RUNNING`
  rows.

## 2. Domain State Machine

### 2.1 Run status

| Status    | Meaning                                                                                  |
| :-------- | :--------------------------------------------------------------------------------------- |
| `RUNNING` | Row inserted at job start; replaced on completion.                                       |
| `SUCCESS` | Job completed.                                                                           |
| `FAILED`  | Job threw; `errorCode`/`errorMessage` populated.                                         |
| `SKIPPED` | No work performed: overlapping ingest tick, existing backup object, or catch-up not due. |

Boot recovery: `recoverInterruptedRuns()` marks any leftover `RUNNING` row as
`FAILED / INTERRUPTED`. This assumes a single bot process.

### 2.2 Triggers

| Trigger     | Source                                                    |
| :---------- | :-------------------------------------------------------- |
| `startup`   | First ingest tick after boot                              |
| `interval`  | Scheduled ingest tick                                     |
| `overlap`   | Tick skipped because the previous run was still in flight |
| `scheduled` | 00:00 UTC backup timer                                    |
| `catch-up`  | Backup catch-up on boot                                   |

### 2.3 Retention

| Table     | Default | Env                       |
| :-------- | :------ | :------------------------ |
| `CronLog` | 30 days | `CRON_LOG_RETENTION_DAYS` |

Pruned by the bot at boot and every 24h.

## 3. Database Persistence

```prisma
enum CronJobStatus { RUNNING SUCCESS FAILED SKIPPED }

model CronLog {
  id, jobName, runId @unique, trigger, status, challengeId,
  startedAt, finishedAt?, durationMs?, summary? (Json),
  errorCode?, errorMessage?, createdAt
}
```

Indexes: `(jobName, startedAt desc)`, `(status, startedAt desc)`,
`(challengeId, startedAt desc)`, `startedAt`, plus `runId` unique.

`challengeId` is denormalized (no FK) so logs survive challenge deletion.

## 4. Developer & Operator Usage

### 4.1 Writing runs (bot)

```js
await withCronLog(
   { jobName: CRON_JOBS.YPT_INGEST, trigger: "interval" },
   ({ runId }) => runIngest({ runId })
);
```

`withCronLog` creates the `RUNNING` row, runs the job, and finalizes it. It
returns the job result and rethrows failures after recording them.

### 4.2 Reading runs (web)

```ts
const { items, hasMore } = await listCronRuns({
   jobName: "YPT_INGEST",
   limit: 25,
});
const run = await getCronRunDetail(runId);
```

### 4.3 Cron Logs UI (DevBoard)

DEV-only surface at `/devboard` → **Cron Logs** tab:

- **Overview cards** — last ingest, last backup, and last-24h
  success/failed/skipped counts.
- **Filters** — job (`YPT_INGEST` / `DB_BACKUP`) and status
  (`RUNNING` / `SUCCESS` / `FAILED` / `SKIPPED`), 25 runs per page with
  “Load more”.
- **Run list / mobile cards** — status, job, trigger, relative start time,
  duration, and a truncated error.
- **Detail Sheet** — run metadata, summary JSON, and the error message.

Read actions are DEV-guarded: `listCronRunsAction`,
`getCronRunDetailAction`, `getCronOverviewAction`.

The active DevBoard section is stored in the URL, so refresh and shared links
keep it: `/devboard?tab=cron-logs` opens the Cron Logs tab directly. Switching
back to Feature Flags removes the `tab` param.

### 4.4 Query examples

```sql
SELECT "jobName","trigger","status","durationMs","startedAt"
FROM "CronLog"
ORDER BY "startedAt" DESC
LIMIT 20;

SELECT pg_size_pretty(pg_total_relation_size('"CronLog"')) AS total_size;
```

## 5. Security & Authorization Rules

- Read actions call `requireDevUser()`; the DevBoard is DEV-only.
- The bot writes logs with its own database credentials; no HTTP endpoint
  exposes them.
- No mutation/undo actions exist.

## 6. Feature Lifecycle & Decommissioning

1. **Dormant deploy** — schema + bot logging can ship before the UI.
2. **Verification** — run the bot, confirm one `CronLog` row per cycle and per
   backup.
3. **GA** — Cron Logs tab reads the runs.
4. **Decommission** — stop calling `withCronLog`, remove the read actions/UI,
   then drop `CronLog` after exporting any needed history.
