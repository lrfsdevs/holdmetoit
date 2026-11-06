# Tasks — Offline Sync & Conflict Semantics

> **Authority:** `AGENTS.md` Law L6/L7/L9, `docs/accountability/README.md`
> **Owner slice:** `features/tasks` (`data/`, `domain/`, `api/`), `features/study-logs/presentation/cockpit/`
> **Migrations:** `20261031000000_category_active_name_ci_unique`, `20261031010000_task_category_revision`

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
- Revision tokens and conditional writes (`baseRevision`).
- Queue ownership, cross-tab locking, and dead-letter handling.

### Non-goals

- A conflict toast; the client rebases the user's fields and only logs when the rebase
  cap is reached.

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

| Status     | When                                                                                                                                      | Client action                                                                                                                                                                                                                                   |
| :--------- | :---------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `applied`  | The mutation applied, was an idempotent no-op, or a locked field was dropped.                                                             | Remove from the queue.                                                                                                                                                                                                                          |
| `conflict` | Zero rows matched, a name belongs to another id, or the row belongs to another user. Carries `currentTask`/`currentCategory` (or `null`). | Task/category `UPDATE`/`TOGGLE`/`MOVE`: rebase the mutation's fields onto the current row and re-enqueue. Other conflicts: remove from the queue, apply the current row, delete the local row when `null`, remap a category id when it differs. |
| `error`    | Unexpected/transient failure.                                                                                                             | Keep in the queue and retry.                                                                                                                                                                                                                    |

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

The Tasker bot is still a direct writer; it increments the same revision token on its writes
(see §2.5).

### 2.5 Revision (optimistic concurrency)

`Task` and `Category` carry `revision Int @default(0)`. Every non-create write increments it.
The client stores the revision from the snapshot on the local record, and `syncNow` attaches a
top-level `baseRevision` to each queued mutation.

The server applies an update only when the row is still at the client's base:

```sql
UPDATE "Task"
SET ..., revision = revision + 1
WHERE id = $1 AND "userId" = $2 AND revision = $3 AND "isDeleted" = false;
```

- One row updated → `applied`; the next snapshot carries the new revision.
- Zero rows → `conflict` / `zero_rows` with `currentTask` / `currentCategory` (or `null`).
- Deletes are idempotent and unconditional but still increment.
- `REORDER` and `ROLLOVER` are bulk and do not carry per-row bases; they increment every
  affected row. A pending content edit will conflict and rebase.
- Legacy queue entries without `baseRevision` apply unconditionally once; the snapshot then
  supplies the revision.

Conflict policy: the client maps the current server row, re-applies the mutation's own fields
on top, sets the local record to `pending`, and enqueues a new mutation with
`retryCount + 1` and `baseRevision = current.revision`. After two attempts it accepts the
server row. A deleted row (`currentTask: null`) deletes the local row. A
`challenge_locked` conflict adopts the server row without rebasing.

The cockpit is unchanged at its enqueue sites: the base is computed centrally in `syncNow`
from the local record, and `putLocalTask` / `putLocalCategory` merge-preserve the revision
when a handler constructs a record from scratch. The wall-clock `updatedAt` reconciliation
guard is gone; pending entities are identified by their queued mutation.

Every writer must increment the token. The Tasker bot increments on its direct writes (it does
not send a base because it reads immediately before writing). A missed writer breaks the
contract.

### 2.6 Queue hygiene (client)

The offline queue is partitioned, cross-tab coordinated, atomic, bounded, and refreshed while
idle.

- **Ownership.** Each `QueuedMutation` carries `userId`. `getQueuedMutationsForUser(userId)`
  returns only the active user's queue and claims legacy unowned entries once. `syncNow` reads
  only that partition, so a second account cannot send the first account's edits.
- **One leader.** `syncNow` acquires `navigator.locks` (`holdmetoit-task-sync`) with
  `ifAvailable` around the whole read → POST → apply → remove cycle. A tab that loses the lock
  skips; the leader drains the shared IndexedDB queue. The local `isSyncing` flag remains only
  as a same-tab fast guard.
- **Atomic local commit.** `commitTaskMutation`, `commitTaskBatch`, `commitCategoryMutation`,
  and `commitLocalBatch` write the local records and the mutation in one IndexedDB transaction.
  The cockpit no longer calls `putLocal*` + `enqueueMutation` as separate writes. `putLocal*`
  remains for snapshot/hydration writes that have no mutation.
- **Bounded retries.** A per-mutation `error` increments `retryCount`. At 5 the mutation moves
  to `dead_letter_mutations`; the cockpit banner offers **Retry** (reset to 0 and re-enqueue)
  or **Discard**. Network/HTTP failures do not increment; the whole batch retries.
- **Freshness.** A jittered 30s visible-tab pull, plus the existing visibility/online triggers,
  refreshes an idle tab. After a successful sync the leader posts a `tasks-synced` message on a
  `BroadcastChannel`; other tabs re-hydrate from the shared IndexedDB. The 15s pending-mutation
  ticker remains.

IndexedDB (`holdmetoit_db`) is now version 2:

| Store                   | Key  | Indexes                                         |
| :---------------------- | :--- | :---------------------------------------------- |
| `tasks`                 | `id` | `userId`, `categoryId`, `taskType`, `syncState` |
| `categories`            | `id` | `userId`, `taskType`, `syncState`               |
| `queued_mutations`      | `id` | `createdAt`, `entityType`, `userId`             |
| `dead_letter_mutations` | `id` | `userId`, `failedAt`, `createdAt`               |

The upgrade only adds the new index/store; existing rows are preserved.

### 2.7 Challenge links and task/category columns

- `challengeId` is only valid on `taskType = "WEEKLY"`. Daily tasks never auto-link to the
  current challenge; an explicit daily `challengeId` is ignored (and logged), and a legacy
  daily link can be cleared with a `null` challengeId.
- A task’s `taskType` is its own board column. A category may contain tasks of either type
  (a weekly parent can hold daily tasks); task type is immutable on update/move, and a
  category type change does not rewrite child task types.
- `getUserCategorizedTasksFromDatabase` groups tasks by their own `taskType`: a task is always
  visible in its own column, and a category appears in the columns where it has tasks. Empty
  categories stay in their own column.
- The results-lock guard applies only to weekly tasks. Legacy daily tasks with a challenge
  link remain editable; the repair script unlinks them.
- Historical task data repairs were performed via `repair-task-invariants.ts` (archived in git history). Routine operations preserve invariant guarantees via standard Prisma repositories and transactions.

### 2.8 Cockpit visibility

The daily board shows every daily task, including `COMPLETED` and `CROSSED_OUT` rows.

The weekly board hides a task only when it is linked to a challenge whose results are
finalized (`Challenge.resultsLockedAt != null`). Everything else stays visible and
editable, including completed/crossed-out weekly tasks that are unlinked or belong to an
active/upcoming challenge. `completedChallengeIds` is computed server-side from the task's
challenge relation and passed to the cockpit; the client never infers it from task status.

Hiding is presentation-only. Hidden tasks remain in IndexedDB and PostgreSQL so progress
counts, scoring, and finalized results are unchanged. The filter never queues a delete or
rewrites a challenge result; weekly write protection remains the server-side
`resultsLockedAt` guard.

---

## 3. Persistence

- `Category` no longer declares an exact-case `@@unique`. Active names are unique via
  `Category_userId_lower_name_taskType_active_key`
  (`("userId", LOWER("name"), "taskType") WHERE "isDeleted" = false`).
- `Task` and `Category` carry `revision Int @default(0)` (migration
  `20261031010000_task_category_revision`). Creates start at 0; every non-create writer
  increments.
- IndexedDB is version 2 with `queued_mutations.userId` and the `dead_letter_mutations` store
  (§2.6). No Prisma migration is needed for queue hygiene.
- The operator pre-check is in the migration file. Resolve any duplicates before applying it if duplicates exist (see the deterministic cleanup procedure in §4 Operator runbook).

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
- Do not call `enqueueMutation` directly from a handler; use the atomic commit helpers in
  `task-idb.ts` so the local write and the mutation share one transaction.
- Every queued mutation carries the owner's `userId`; `syncNow` only reads the current user's
  partition.
- Increment `revision` on every non-create write. A missed writer makes the token lie.
- Category name comparisons are case-insensitive (`mode: "insensitive"`).

### Operator runbook

Before applying migration `20261031020000_category_lower_name_active_unique`:

```bash
# 1. Pre-check for active duplicate category names (read-only)
psql "$DATABASE_URL" -c 'SELECT "userId", LOWER("name"), "taskType", COUNT(*) FROM "Category" WHERE "isDeleted" = false GROUP BY 1,2,3 HAVING COUNT(*) > 1;'
```

> [!WARNING]
> **STOP:** If the pre-check returns any rows, **do not run `npm run db:migrate`**.
> Applying the migration while active duplicates exist will fail on the unique partial index `Category_userId_lower_name_taskType_active_key`.
> Resolve duplicates first using the deterministic cleanup below.

```sql
-- 2. Deterministic Cleanup (run inside psql if duplicates were found)
BEGIN;

-- For each duplicate group, reassign tasks to the oldest created category:
UPDATE "Task" t
SET "categoryId" = keeper.id,
    "revision" = t."revision" + 1
FROM (
  SELECT DISTINCT ON ("userId", LOWER("name"), "taskType")
    id, "userId", LOWER("name") AS lower_name, "taskType"
  FROM "Category"
  WHERE "isDeleted" = false
  ORDER BY "userId", LOWER("name"), "taskType", "createdAt" ASC, id ASC
) keeper
JOIN "Category" duplicate
  ON duplicate."userId" = keeper."userId"
 AND LOWER(duplicate."name") = keeper.lower_name
 AND duplicate."taskType" = keeper."taskType"
 AND duplicate.id <> keeper.id
 AND duplicate."isDeleted" = false
WHERE t."categoryId" = duplicate.id;

-- Soft-delete duplicate categories with unique tombstone names:
UPDATE "Category" duplicate
SET "isDeleted" = true,
    "deletionTime" = NOW(),
    "name" = duplicate."name" || ' [deleted ' || duplicate.id || ']',
    "revision" = duplicate."revision" + 1
FROM (
  SELECT DISTINCT ON ("userId", LOWER("name"), "taskType")
    id, "userId", LOWER("name") AS lower_name, "taskType"
  FROM "Category"
  WHERE "isDeleted" = false
  ORDER BY "userId", LOWER("name"), "taskType", "createdAt" ASC, id ASC
) keeper
WHERE duplicate."userId" = keeper."userId"
  AND LOWER(duplicate."name") = keeper.lower_name
  AND duplicate."taskType" = keeper."taskType"
  AND duplicate.id <> keeper.id
  AND duplicate."isDeleted" = false;

COMMIT;
```

```bash
# 3. Verify clean state (must return 0 rows before continuing)
psql "$DATABASE_URL" -c 'SELECT "userId", LOWER("name"), "taskType", COUNT(*) FROM "Category" WHERE "isDeleted" = false GROUP BY 1,2,3 HAVING COUNT(*) > 1;'

# 4. Apply migrations
npm run db:migrate
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
- Follow-ups: conflict UI, default-category naming alignment (`General` vs `Default`),
  and extending the `FOR SHARE` guard to the remaining admin writers.
