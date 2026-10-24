# YPT Analytics Checker

A Node.js service for ingesting YPT (Yeolpumta) study group analytics into HoldMeToIt without running a timer.

## Features

- **CLI Interactive Authentication**: Prompts for your YPT account email and password when started.
- **Joined Groups Discovery**: Fetches all groups the account belongs to (`/group/groups/v2`) and displays them in a structured table.
- **Unified Single-Grid Member Leaderboard**: Automatically consolidates all members across all joined groups/channels into a single unified grid, deduplicating members who belong to multiple groups while preserving their highest study times, live status, and group memberships.

---

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Run the Server

```bash
npm start
```

When prompted in the terminal, enter your YPT dummy account credentials:

```text
=============================================
       YPT Analytics Server Login Setup
=============================================

Enter YPT Email: your-dummy-account@example.com
Enter YPT Password: yourpassword
```

_(Optional: You can also pass `YPT_EMAIL` and `YPT_PASSWORD` as environment variables for headless/containerized execution)._

---

## Health Endpoint

The service exposes a single HTTP route for hosting-platform liveness checks. It returns no account, group, or member data.

```bash
curl http://localhost:3000/health
# {"status":"ok","service":"ypt-bot","uptimeSeconds":42}
```

Any other path or method returns `404 {"error":"Not found"}`.
