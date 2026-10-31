# Tasks — Offline Sync & Conflict Semantics

> **Authority:** `AGENTS.md` Law L6/L7/L9, `docs/accountability/README.md`
> **Owner slice:** `features/tasks` (`data/`, `domain/`, `api/`), `features/study-logs/presentation/cockpit/`
> **Migration:** `20261031000000_category_active_name_ci_unique`

---

## 1. Executive Summary & Scope

Tasks are offline-first. The browser writes to IndexedDB, enqueues a mutation, and flushes a
batch to `POST /api/tasks/sync`. This document defines what a mutation carries, how the
server reports the outcome, and how the client reconciles without silently losing an edit.

### In scope

- Field-scoped edit payloads (`buildTaskEditPatch`).
- Per-mutation results: `applied | conflict | error`.
- Client conflict handling and category-id remapping.
- Category identity: live/revive/create and the partial case-insensitive index.

### Non-goals

- Revision tokens and conditional writes (a later slice).
- Queue ownership, cross-tab locking, dead-letter UI.
- A conflict toast; the client applies the server row and logs the conflict.

---

## 2. Domain Decisions

### 2.1 Mutations carry intent, not state

An edit sends only fields the user changed. The cockpit builds the patch with the pure
`buildTaskEditPatch(current, next, taskType)` helper:

- `title` only when the trimmed text differs;
- `status` + `isComplete` together, and only when either differs;
- `dueDate` only for daily tasks and only when the date key differs;
- `challengeId` only for weekly tasks and only when the scope differs;
- an empty patch means "no write": no queue entry and no server action.

Toggles already send only `{ taskId, isComplete, status }`; moves and rollovers send only
`{ taskId, dueDate }`; scope changes send only `{ taskId, challengeId }`.

### 2.2 Per-mutation result

`processBatchSync` returns `mutationResults: MutationResult[]` alongside the legacy
`processedMutationIds`.

| Status     | When                                                                                                                                      | Client action                                                                                                        |
| :--------- | :---------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------- |
| `applied`  | The mutation applied, was an idempotent no-op, or a locked field was dropped.                                                             | Remove from the queue.                                                                                               |
| `conflict` | Zero rows matched, a name belongs to another id, or the row belongs to another user. Carries `currentTask`/`currentCategory` (or `null`). | Remove from the queue; apply the current row; delete the local row when `null`; remap a category id when it differs. |
| `error`    | Unexpected/transient failure.                                                                                                             | Keep in the queue and retry.                                                                                         |

`error` is never used for a known permanent condition. A zero-row update, a missing target
category, a name collision, and a foreign row are all `conflict`.

### 2.3 Category identity

1. **Live wins.** A live row with the same `(userId, taskType, LOWER(name))` wins. A create
   for a different id returns a conflict; the client remaps its local category id and every
   queued mutation that references it.
2. **Revive before create.** If no live row exists but a soft-deleted row has the name,
   revive it.
3. **Create last.** A `P2002` means another writer won; re-fetch and return a conflict.

The tombstone name is produced by `buildCategoryTombstoneName` from
`@holdmetoit/database`, shared with the Tasker bot.

### 2.4 One web writer

`POST /api/tasks/sync` is the only web writer for tasks and categories. The cockpit writes
the local row and enqueues a mutation; there is no parallel server-action write.

- Edit, move, and scope change: one queued `UPDATE` with only the changed fields.
- Rollover: one queued `ROLLOVER` with `{ taskIds, targetDateKey }`. The server applies the
  incomplete-only guard in a single `updateMany`; there are no per-task `UPDATE`s.
- Create, toggle, and delete: queued mutations (unchanged).
- Payloads are validated by the per-action zod schemas in `task-sync.schema.ts`. An invalid
  payload is a `conflict` (`invalid_payload`), never a retry loop.
- The sync route invalidates the user-task cache tag and calls `revalidatePath("/")` after a
  successful flush. The former task server actions no longer exist.

The Tasker bot is still a direct writer; the revision step brings it under the same
versioning contract.

---

## 3. Persistence

- `Category` no longer declares an exact-case `@@unique`. Active names are unique via
  `Category_userId_lower_name_taskType_active_key`
  (`("userId", LOWER("name"), "taskType") WHERE "isDeleted" = false`).
- `Task` is unchanged.
- The operator pre-check is in the migration file. Use `apps/web/scripts/dedupe-categories.ts`
  (dry-run by default) before applying it if duplicates exist.

---

## 4. Developer & Operator Usage Guide

### Reading the response

```ts
const results: MutationResult[] =
   data.mutationResults ??
   data.processedMutationIds.map((id) => ({ id, status: "applied" as const }));

const acknowledged = results.filter((r) => r.status !== "error");
await removeQueuedMutations(acknowledged.map((r) => r.id));
```

A conflict with `currentTask: null` means the entity is gone; delete the local row. A
conflict with `currentCategory.id !== requestedId` means a concurrent create won; call
`remapLocalCategoryId(requestedId, currentCategory.id)` before writing the server row.

### Adding a mutation

- Send only the fields the action changes.
- Validate the payload with a schema in `task-sync.schema.ts`; an invalid payload is a
  `conflict` (`invalid_payload`), not an `error`.
- Return an `Outcome` from the repository handler: `applied`, `conflict` (with the current
  entity or `null`), or `error`.
- Do not throw for a permanent condition; throw only for unexpected failures.
- Do not add a second writer (server action) for the same intent.
- Category name comparisons are case-insensitive (`mode: "insensitive"`).

### Operator runbook

```bash
# 1. pre-check (read-only)
psql "$DATABASE_URL" -c 'SELECT "userId", LOWER("name"), "taskType", COUNT(*) FROM "Category" WHERE "isDeleted" = false GROUP BY 1,2,3 HAVING COUNT(*) > 1;'

# 2. dry run, then apply on a local copy
npx tsx --env-file=.env apps/web/scripts/dedupe-categories.ts
npx tsx --env-file=.env apps/web/scripts/dedupe-categories.ts --apply

# 3. apply the migration and regenerate the client
```

---

## 5. Security & Authorization

- Every mutation is scoped by the authenticated `userId`; task updates use
  `updateMany({ id, userId, isDeleted: false })`.
- A task create that collides with another user's id returns `conflict` (`foreign_row`) and
  performs no write.
- Category mutations are scoped by `userId`; a foreign category id is a conflict.
- The sync route does not accept a user id from the body.

---

## 6. Feature Lifecycle & Decommissioning

- No feature flag. The new response field is additive; old clients keep using
  `processedMutationIds`.
- The task mutation server actions were deleted; every new task/category mutation goes
  through the sync repository. The partial category index is the database backstop. If the
  category model is replaced, remove the index together with the create/revive logic.
- Follow-ups: revision tokens (Step 4), queue ownership/cross-tab locking (Step 5), conflict
  UI, default-category naming alignment (`General` vs `Default`).
