# YPT Analytics Checker

A Node.js service for ingesting YPT (Yeolpumta) study group analytics into HoldMeToIt without running a timer.

## Features

- **Single Entry Point**: `npm start` runs the health endpoint, the study-log ingestion loop, and the nightly database backup scheduler.
- **Unified Single-Grid Member Leaderboard**: Automatically consolidates all members across the configured groups/channels into a single unified grid, deduplicating members who belong to multiple groups while preserving their highest study times, live status, and group memberships.
- **Automatic Database Backups**: Nightly PostgreSQL dump at 00:00 UTC with boot-time catch-up.

---

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure the Environment

Set the following in `apps/ypt-bot/.env` (or the deployment environment):

```text
YPT_EMAIL=your-dummy-account@example.com
YPT_PASSWORD=yourpassword
YPT_GROUP_IDS=6814572,7393477
```

Startup fails fast when any of these are missing.

### 3. Run the Server

```bash
npm start
```

This starts ingestion immediately, then repeats every `POLL_INTERVAL_IDLE_SEC` seconds (default `30`), and schedules the nightly backup.

---

## Health Endpoint

The service exposes a single HTTP route for hosting-platform liveness checks. It returns no account, group, or member data.

```bash
curl http://localhost:3000/health
# {"status":"ok","service":"ypt-bot","uptimeSeconds":42}
```

Any other path or method returns `404 {"error":"Not found"}`.
