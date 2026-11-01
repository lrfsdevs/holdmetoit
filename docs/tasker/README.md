# Tasker (`apps/tasker`)

## 1. Executive Summary & Scope

`@holdmetoit/tasker` is the Discord task/category bot migrated from the standalone
`~/Projects/tasker` repo. It provides:

| Command                                  | Purpose                                  | Requires a web account |
| :--------------------------------------- | :--------------------------------------- | :--------------------- |
| `/ping`                                  | Liveness check                           | No                     |
| `/help`                                  | Categorised help embeds + select menu    | No                     |
| `/category create\|list\|delete\|rename` | Personal task categories                 | Yes                    |
| `/task add\|list\|done\|remove\|rename`  | Personal daily tasks                     | Yes                    |
| `/yapperize`                             | Gemini summary of recent channel chatter | No                     |

Legacy prefix commands are still supported (`DISCORD_PREFIX`, default `'`) and can be
disabled with `DISCORD_ENABLE_PREFIX_COMMANDS=false`.

**Architectural guardrails**

- All Discord connectivity lives in `@holdmetoit/discord`; this app contains no raw
  `discord.com/api` calls and no `discord.js` client construction.
- Tasks and categories are the monorepo's canonical `Task` / `Category` tables, so a task
  created from Discord appears in the web cockpit and vice versa.
- No new schema, no parallel tables, no per-bot database.
- Out of scope: the P1 `@HoldMeToItBot` commands (`/stats`, `/standings`, `/deficit`) and
  scheduled broadcasts.

## 2. Domain State Machine & Decisions

### 2.1 Identity resolution (no auto-provisioning)

`/task` and `/category` resolve the Discord author through `User.discordId`:

```text
Discord user runs /task
        │
        ├─ User row exists (they have signed in on the web) ──► operate on User.id
        │
        └─ no row ──► ephemeral "Sign in with Discord at WEB_APP_URL first"
```

The bot **never creates `User` rows**. Auth.js creates the row on first OAuth sign-in and
`events.signIn` then writes `discordId`; a pre-created stub would collide with the
`User.discordId @unique` index and break login. Relaxing this requires adding merge logic
to `core/auth` first.

### 2.2 Task visibility

`getTasks(userId)` mirrors the original bot's daily query (today's tasks + unfinished older
ones) and adds `challengeId: null`. Bot CRUD therefore never mutates challenge-linked weekly
goals, which are inputs to the Law L6 three-condition accountability evaluation.

Write paths are guarded, not read-then-write: `updateTaskStatus`, `updateTaskContent` and
`deleteTask` use `updateMany({ where: { id, userId, isDeleted: false } })` and treat
`count === 0` as "task not found". A concurrent web soft-delete therefore cannot be
overwritten by the bot.

### 2.3 Category deletion

The shared schema requires `Task.categoryId`, so categories are soft-deleted and their
active tasks are reassigned to the user's `Default` category inside one transaction.
The category name is rewritten with `buildCategoryTombstoneName` (shared with the web app)
so the original name is immediately reusable. Deleting `Default` is refused
(`DefaultCategoryDeletionError`) because there is nothing to reassign to.

### 2.4 Category uniqueness

Active category names are case-insensitively unique per `(userId, taskType)` via the partial
index `Category_userId_lower_name_taskType_active_key`
(`20261031000000_category_active_name_ci_unique`). Soft-deleted rows do not block a name.
Creating a category therefore:

1. looks up a **live** row case-insensitively; if found, throws `DuplicateCategoryError`,
2. otherwise revives a soft-deleted row with the same name,
3. otherwise inserts, and maps a `P2002` race to `DuplicateCategoryError`.

### 2.5 Prefix commands

Prefix dispatch requires the privileged `MessageContent` gateway intent. It is on by
default for parity, but can be disabled without touching code. Slash commands are always
registered explicitly with `npm run deploy:tasker-commands`; on-ready registration is off
by default (`DISCORD_REGISTER_COMMANDS_ON_READY=false`) to avoid the old guild+global
double registration.

## 3. Database Persistence Models

No schema changes were introduced. Tasker uses:

| Model      | Fields used                                                                                                                                            |
| :--------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `User`     | `id`, `discordId` (identity resolution only)                                                                                                           |
| `Category` | `id`, `userId`, `name`, `taskType` (`DAILY`), `isDeleted`, `deletionTime`                                                                              |
| `Task`     | `id`, `userId`, `categoryId` (required), `challengeId = null`, `title`, `taskType`, `status`, `isComplete`, `completedAt`, `isDeleted`, `deletionTime` |

All queries go through `apps/tasker/src/db.ts`, which re-exports the shared client:

```ts
import "../config/env.js";
export { prisma } from "@holdmetoit/database";
```

### 3.1 One-off backfill

`src/scripts/backfill-tasker-data.ts` imports legacy rows from `TASKER_SOURCE_DATABASE_URL`:

- maps each legacy `userId` snowflake → `User.id` (`User.discordId`),
- upserts categories by `(userId, name, taskType)` and revives soft-deleted ones,
- inserts tasks with `challengeId = null`, falling back to the user's `Default` category,
- skips rows for users who have never signed in and rows already present,
- is dry-run by default (`--apply` writes).

Run it only after confirming the legacy tables live in a separate database from the shared
schema; never run `prisma db push` from the old repo against the shared database.

## 4. Developer & Operator Usage Guide

### 4.1 Commands

```bash
npm run dev:tasker                    # build db + discord, then tsx watch
npm run build:tasker                  # no-op (TS runs through tsx)
npm run typecheck:tasker
npm run test:tasker                   # vitest
npm run deploy:tasker-commands -- --guild <guild-id>
npm run deploy:tasker-commands -- --global
npm run deploy:tasker-commands -- --guild <guild-id> --clear
npm run backfill -w @holdmetoit/tasker -- --apply
```

### 4.2 Environment (`apps/tasker/.env.example`)

| Variable                                     | Required | Notes                                                                                                   |
| :------------------------------------------- | :------- | :------------------------------------------------------------------------------------------------------ |
| `DISCORD_BOT_TOKEN`                          | Yes      | Same token as the web app (REST dispatch + gateway). Legacy `DISCORD_TOKEN` is accepted with a warning. |
| `DISCORD_GUILD_ID`                           | No       | Dev guild for guild-scoped command registration. Legacy `GUILD_ID` accepted with a warning.             |
| `DISCORD_PREFIX`                             | No       | Default `'`.                                                                                            |
| `DISCORD_ENABLE_PREFIX_COMMANDS`             | No       | Default `true`.                                                                                         |
| `DISCORD_REGISTER_COMMANDS_ON_READY`         | No       | Default `false`.                                                                                        |
| `DATABASE_URL`, `DIRECT_URL`                 | Yes      | Consumed by `@holdmetoit/database`.                                                                     |
| `GEMINI_API_KEY`, `_2`, `_3`, `GEMINI_MODEL` | No       | `/yapperize` only; keys rotate on 429, models on 503.                                                   |
| `WEB_APP_URL`                                | No       | Sign-in link; default `https://holdmetoit.com`.                                                         |
| `PORT`                                       | No       | Health server, default `3001`.                                                                          |
| `TASKER_SOURCE_DATABASE_URL`                 | No       | Backfill source only.                                                                                   |

`src/config/env.ts` is the single point of contact: it loads the repo-root `.env` then the
app `.env`, validates with zod, and is the only file that reads configuration. A missing
`DISCORD_BOT_TOKEN` or `DATABASE_URL` fails fast at startup.

### 4.3 Entrypoint

`src/index.ts` builds the client, loads `src/commands` and `src/events` from disk, installs
the shared interaction/prefix handlers, starts `GET /health`, and registers graceful
shutdown (health server → Prisma → Discord client). `src/events/ready.ts` connects Prisma
and optionally deploys slash commands.

### 4.4 Deployment

Render (Docker, build context = repository root):

- Dockerfile: `apps/tasker/Dockerfile`
- Start command: `npm start -w @holdmetoit/tasker`
- Health check: `GET /health`
- Docker build runs `npm ci`, `db:generate`, and builds `@holdmetoit/database` +
  `@holdmetoit/discord`; the app itself has no emit step.

## 5. Security & Authorization Rules

- The bot token is server-only; it is never exposed to the client bundle.
- Task/category mutations are scoped by the resolved internal `User.id`; model helpers take
  `userId` for reads, updates and deletes so a crafted task id cannot cross accounts.
- Autocomplete for users without a web account returns an empty list rather than leaking
  category/task names.
- No `User` row is created or elevated by bot commands. Role checks remain in
  `apps/web/core/auth` and `features/auth/data/discord-guild.service.ts`.
- `MessageContent` is a privileged intent: enable it in the Discord developer portal only
  if prefix commands are needed.
- Never commit `apps/tasker/.env`. The legacy repo's committed secrets should be rotated.

## 6. Feature Lifecycle & Decommissioning

1. **Dormant deploy** — code merged, commands not registered, `DISCORD_ENABLE_PREFIX_COMMANDS=false`.
2. **Dev guild** — `DISCORD_GUILD_ID` set, deploy commands with `--guild`, `DISCORD_REGISTER_COMMANDS_ON_READY=true` allowed locally.
3. **Global GA** — deploy commands with `--global`, register once per environment, keep on-ready registration off.
4. **Decommission** — clear commands with `--global --clear`, disable the Render service, revoke the bot token. Archive `~/Projects/tasker` permanently only after parity is verified; it must never be edited again.
