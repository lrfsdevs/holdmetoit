# Feature Flags System — Architecture, Developer & Operator Guide

> **Project:** HoldMeToIt  
> **Status:** Ratified Implementation Architecture  
> **Storage:** Supabase PostgreSQL (via Prisma ORM 6.x)  
> **Hosting & Runtime:** Next.js 14 App Router (Server-Only Evaluation)  
> **Last Updated:** 2026-10-14

---

## 1. Executive Summary & Design Principles

The HoldMeToIt Feature Flag system is a lightweight, zero-dependency, self-hosted release management module. It allows administrators and core developers to control feature rollouts, assign alpha/beta testers from the Discord community, and immediately kill malfunctioning features—without requiring redeployments or external services.

### Core Tenets

1. **Zero External Overhead:** No LaunchDarkly, Statsig, Redis, or Supabase Realtime daemons. All state lives in Postgres.
2. **Deterministic 3-State Model:** Rollout is strictly partitioned into `DISABLED`, `TARGETED`, and `GLOBAL`.
3. **Master Kill Switch:** Immediate emergency circuit breaker that overrides all rollout modes.
4. **Law L7 Pure Domain Isolation:** Evaluation math and decision logic are pure functions with zero framework or ORM imports, fully testable in Vitest.
5. **Atomic Audit Integrity:** Every configuration change, rollout switch, and tester assignment is recorded in an immutable audit trail inside the same Postgres transaction.
6. **Ephemeral Lifecycle:** Feature flags are temporary release conduits, not permanent configuration stores. Once a feature is stabilized, its flag is decommissioned.

---

## 2. State Machine & Evaluation Flow

Every flag is defined by its master switch (`isEnabled`) and its `rolloutMode`.

### 2.1 The Two-Dimensional Control Grid

| Master Switch (`isEnabled`) | Rollout Mode (`rolloutMode`) | Target Assignment Match | Effective Result | Behavior                                                          |
| :-------------------------: | :--------------------------: | :---------------------: | :--------------: | :---------------------------------------------------------------- |
|      **`false`** (Off)      |          _Any mode_          |       Irrelevant        |   **`false`**    | Emergency kill switch active; completely disabled for all users.  |
|       **`true`** (On)       |        **`DISABLED`**        |       Irrelevant        |   **`false`**    | Dormant state (e.g. prepared in DB before beta test starts).      |
|       **`true`** (On)       |        **`TARGETED`**        |    **Matched User**     |    **`true`**    | Enabled **only** for users assigned in `FeatureFlagTarget`.       |
|       **`true`** (On)       |        **`TARGETED`**        |  **Unmatched / Guest**  |   **`false`**    | Concealed from general participants and unauthenticated visitors. |
|       **`true`** (On)       |         **`GLOBAL`**         |       Irrelevant        |    **`true`**    | Enabled for all visitors (both authenticated and spectators).     |

### 2.2 Decision Flow Diagram

```text
               ┌──────────────────────────────┐
               │  Evaluate Flag: isEnabled?   │
               └──────────────┬───────────────┘
                              │
                    ┌─────────┴─────────┐
             No / false              Yes / true
                    │                   │
                    ▼                   ▼
           ┌─────────────────┐ ┌─────────────────┐
           │  Return FALSE   │ │ Check           │
           │ (Kill Switch)   │ │ rolloutMode     │
           └─────────────────┘ └────────┬────────┘
                                        │
           ┌────────────────────────────┼───────────────────────────┐
           │                            │                           │
           ▼                            ▼                           ▼
      [DISABLED]                   [TARGETED]                   [GLOBAL]
           │                            │                           │
           ▼                            ▼                           ▼
     Return FALSE                 Has context.userId?          Return TRUE
                                        │
                                  ┌─────┴─────┐
                                 No          Yes
                                  │           │
                                  ▼           ▼
                             Return FALSE  Is userId in
                                           targets list?
                                              │
                                        ┌─────┴─────┐
                                       No          Yes
                                        │           │
                                        ▼           ▼
                                   Return FALSE  Return TRUE
```

---

## 3. Database Schema (Prisma)

The persistence model consists of three relational models linked to HoldMeToIt's existing `User` entity:

```prisma
enum RolloutMode {
  DISABLED
  TARGETED
  GLOBAL
}

model FeatureFlag {
  id          String       @id @default(cuid())
  key         String       @unique
  name        String       @db.VarChar(128)
  description String?      @db.Text
  isEnabled   Boolean      @default(false)
  rolloutMode RolloutMode  @default(DISABLED)
  createdBy   String
  isDeleted   Boolean      @default(false)
  deletedAt   DateTime?
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  creator     User         @relation("FeatureFlagCreator", fields: [createdBy], references: [id], onDelete: Restrict)
  targets     FeatureFlagTarget[]
  auditLogs   FeatureFlagAuditLog[]

  @@index([key])
  @@index([isDeleted, isEnabled])
}

model FeatureFlagTarget {
  flagId      String
  userId      String
  createdBy   String
  createdAt   DateTime     @default(now())

  flag        FeatureFlag  @relation(fields: [flagId], references: [id], onDelete: Cascade)
  user        User         @relation("FeatureFlagTargetUser", fields: [userId], references: [id], onDelete: Cascade)
  assignedBy  User         @relation("FeatureFlagTargetAssigner", fields: [createdBy], references: [id], onDelete: Restrict)

  @@id([flagId, userId])
  @@index([userId])
}

model FeatureFlagAuditLog {
  id          String       @id @default(cuid())
  flagId      String
  actorId     String?
  action      String       @db.VarChar(64) // CREATED, UPDATED, TOGGLED_MASTER, ROLLOUT_CHANGED, TARGET_ADDED, TARGET_REMOVED, SOFT_DELETED
  oldValue    Json?
  newValue    Json?
  createdAt   DateTime     @default(now())

  flag        FeatureFlag  @relation(fields: [flagId], references: [id], onDelete: Cascade)
  actor       User?        @relation("FeatureFlagAuditActor", fields: [actorId], references: [id], onDelete: SetNull)

  @@index([flagId, createdAt(sort: Desc)])
  @@index([actorId])
}
```

---

## 4. Feature Architecture (`features/feature-flags/`)

Following HoldMeToIt's **Feature-First Vertical Slice** standard:

```text
features/feature-flags/
├── domain/                               # Pure logic (zero dependencies, 100% Vitest coverage)
│   ├── feature-flags.types.ts            # Enums, Flag entity, Evaluation context types
│   ├── feature-flags.schema.ts           # Zod schemas for admin mutation validation
│   ├── feature-flags.schema.test.ts      # Zod validation test suite
│   ├── evaluator.ts                      # Pure flag evaluation function
│   └── evaluator.test.ts                 # Matrix tests for all permutations
├── data/                                 # Database queries and atomic transactions
│   ├── feature-flags.repository.ts       # Prisma transactions & queries
│   └── feature-flags.repository.test.ts  # Repository integration tests
├── api/                                  # Server Actions and consumption helpers
│   ├── server.ts                         # Public evaluator for RSC & server routes (React cache)
│   ├── feature-flags.actions.ts          # Admin Server Actions with RBAC
│   └── feature-flags.actions.test.ts     # Action permission test suite
└── presentation/                         # Obsidian Dark Admin UI
    ├── feature-flags-admin-view.tsx      # Main admin console view
    ├── flag-card-list.tsx                # Card grid with status badges & switches
    ├── flag-editor-modal.tsx             # Create & Edit modal (key immutable on edit)
    ├── rollout-control.tsx               # Segmented pill selector (Disabled/Targeted/Global)
    ├── tester-selector-dialog.tsx        # Discord user picker with avatars & handles
    └── flag-audit-drawer.tsx             # Audit history viewer with diff visualizer
```

---

## 5. Developer Usage Guide

### 5.1 Checking a Feature Flag on the Server

In Next.js React Server Components (RSC), Route Handlers, or Server Actions, import `isFeatureEnabled` from `@/features/feature-flags/api/server`:

```typescript
import { isFeatureEnabled } from "@/features/feature-flags/api/server";

export default async function StudyCockpitPage() {
  // Automatically infers the current authenticated user from session:
  const isV2WidgetsEnabled = await isFeatureEnabled("cockpit_v2_widgets");

  if (!isV2WidgetsEnabled) {
    return <LegacyCockpitWidgets />;
  }

  return <ModernCockpitWidgets />;
}
```

### 5.2 Checking with Explicit Context (e.g. Background Jobs or API Handlers)

If evaluating for a specific user ID outside a normal user session:

```typescript
import { isFeatureEnabled } from "@/features/feature-flags/api/server";

const isEnabled = await isFeatureEnabled("enhanced_leaderboard", {
   userId: targetUser.id,
   userRole: targetUser.role,
});
```

### 5.3 Batch Evaluation (Preventing N+1 Queries)

When multiple flags are needed on a page:

```typescript
import { getFeatureFlags } from "@/features/feature-flags/api/server";

const flags = await getFeatureFlags([
   "study_streaks",
   "audio_ambience",
   "advanced_graphs",
]);

if (flags.study_streaks) {
   // render streak badge
}
```

### 5.4 Safe Fallback Guarantees

If database access fails or a flag key does not exist:

- The evaluator catches the error, logs a warning via `createLogger("feature-flags")`, and returns the default fallback (`false`).
- For mission-critical features where the safe state is `true`, pass an explicit fallback:
   ```typescript
   const showBasicTimer = await isFeatureEnabled(
      "basic_timer_fallback",
      undefined,
      true
   );
   ```

---

## 6. Flag Lifecycle & Governance

To keep the application free of technical debt, every flag follows a 5-step lifecycle:

```text
[1. Declare Key] ──► [2. Disabled] ──► [3. Targeted Beta] ──► [4. Global GA] ──► [5. Decommission]
 (Zod constants)      (Deploy code)     (Discord testers)       (All users)        (Remove from code)
```

1. **Declare Key:** Add the key to `feature-flags.constants.ts` with a description.
2. **Dormant Deploy:** Deploy the code with the flag initially set to `isEnabled = false` and `rolloutMode = DISABLED`.
3. **Targeted Beta:** Turn `isEnabled = true` and `rolloutMode = TARGETED`. Assign 3–5 Discord community members to verify behavior in production.
4. **Global Rollout:** Switch `rolloutMode = GLOBAL`. The feature is now visible to all scholars and visitors.
5. **Decommission & Prune:** Once the feature is permanently adopted:
   - Remove the `isFeatureEnabled` check and keep the new code path.
   - Delete the flag in the Admin Console (soft deletion keeps historical audit records).
   - Remove the unused key constant.

---

## 7. Security & Operator Boundaries

1. **Authentication & RBAC:**
   - Hiding UI buttons is never treated as security.
   - Every mutation Server Action (`toggleMasterSwitch`, `setRolloutMode`, `assignTester`, `deleteFlag`) invokes:
      ```typescript
      const session = await auth();
      if (!session?.user?.id || !hasAdminPrivileges(session.user.role)) {
         throw new Error("Unauthorized: Administrative privilege required.");
      }
      ```
2. **Actor Integrity:**
   - The `actorId` in `FeatureFlagAuditLog` is extracted directly from `session.user.id`, never accepted from client payloads.
3. **Key Immutability:**
   - Once created, a flag's `key` cannot be renamed through the UI. Renaming keys in a live database breaks code references.
4. **Feature Flags $\neq$ Permissions:**
   - Flags dictate _what code branches execute_, not _who is authorized to perform privileged operations_. A participant with a feature flag enabled still cannot access administrative endpoints.
