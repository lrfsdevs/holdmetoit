# Admin Global User Directory & Participant Roster

> **Feature Scope:** Administrative user directory, participant roster tracking, role assignment, and activity auditing  
> **Route:** `/admin/users`  
> **Governance:** Law L1 (Unified Teams), Law L4 (Discord Identity Primacy), Law L5 (Admin Override Absolute), Law L9 (Zero-State & Error Resilience)  
> **GitHub Issue:** #163 · **Jira Key:** KAN-48

---

## 1. Executive Summary & Scope

Previously, hosts and administrators could only view members who had enrolled in a specific challenge via the challenge **Manage** tab. If a member registered via Discord OAuth but had not yet joined an active event, administrators had zero visibility into their account.

The Global User Directory provides:

1. **Full Member Visibility:** Complete roster of all registered platform users, including users with 0 challenge enrollments.
2. **Aggregated Career & Enrollment Metrics:** Lifetime study hours calculated from daily study logs, Clash of Clans–style competitive trophy rank, wallet balances, and YPT connection status.
3. **Cross-Challenge Roster Tracking:** Real-time visibility into active challenge enrollments with links to participant statistics (`/challenge/:id/participant/:participantId`).
4. **Administrative Controls & Security Invariants:**
   - Role assignment (`USER`, `HOST`, `ADMIN`) mapped to Prisma `UserRole` (`PARTICIPANT`, `ADMIN`).
   - Self-demotion guard protecting the current administrator session against accidental privilege removal.
   - Immutable audit logging (`USER_ROLE_UPDATED`) tracking previous and new roles with a mandatory reason.
   - Quick actions to adjust wallet coins (`AdminAdjustmentDialog`), adjust competitive trophies (`AdminTrophyAdjustmentDialog`), and trigger Discord avatar self-healing sync.
   - Chronological user-specific audit trail inspection.

---

## 2. Architecture & Layering

```
apps/web/
├── app/admin/users/
│   ├── page.tsx               # Protected Server Component (requireAdminUser + initial roster prefetch)
│   ├── loading.tsx            # Full loading skeleton (cards + search bar + table skeleton)
│   ├── error.tsx              # Error boundary with recovery action and console link
│   └── page.test.tsx          # Integration unit tests for route guarding
├── features/admin/
│   ├── domain/
│   │   └── user-directory.types.ts  # Types: AdminUserRosterItem, UserDirectoryQuery, UserDirectorySummary
│   ├── data/
│   │   ├── user-directory.repository.ts       # getAdminUserRoster(), role resolution, YPT status mapping
│   │   └── user-directory.repository.test.ts  # 15 Vitest test cases covering repository logic
│   ├── api/
│   │   ├── user-directory.actions.ts          # Server actions: fetch, update role, fetch audit logs
│   │   └── user-directory.actions.test.ts     # 11 Vitest test cases covering security guards & mutations
│   └── presentation/
│       ├── user-directory-view.tsx            # Main roster view with stat cards, search/filters, table, pagination
│       ├── user-directory-view.test.tsx       # Presentation tests for UI states and cards
│       ├── user-inspector-sheet.tsx           # Side inspector sheet with role mutation, tools & audit trail
│       └── admin-console-view.tsx             # Updated with quick navigation card and header link
└── features/audit/
    ├── domain/audit-log.ts                    # Extended with USER_ROLE_UPDATED action type
    └── data/audit-log.repository.ts           # Added getUserAuditTrail(targetUserId, limit)
```

---

## 3. Security Invariants & Stack Laws

### 3.1 Authentication & Authorization Gating

- Root layout `/admin/layout.tsx` gates all `/admin/*` subroutes using `requireAdminUser()` and redirects non-administrators to `/`.
- All server actions in `user-directory.actions.ts` execute `await requireAdminUser()` before processing any payload.

### 3.2 Self-Demotion Guard

An administrator inspecting their own account cannot demote themselves:

```ts
if (actor.id === targetUserId && newRole !== "ADMIN") {
   return {
      ok: false,
      code: "SELF_DEMOTION_FORBIDDEN",
      message: "Administrators cannot demote their own administrative role.",
   };
}
```

### 3.3 Immutable Audit Logging

Any role mutation writes an append-only audit record to `audit_logs`:

- `actionType`: `"USER_ROLE_UPDATED"`
- `targetEntityType`: `"USER"`
- `previousValue`: `{ role: prevDbRole }`
- `newValue`: `{ role: updatedUser.role, rosterRole: newRole }`
- `auditReason`: Mandatory user-supplied reason ($\ge 3$ characters).

---

## 4. Query Filtering & Sorting Specifications

- **Search:** Case-insensitive substring match against `name`, `displayName`, `username`, and Discord Snowflake ID.
- **Role Filter:** `ALL` | `USER` | `HOST` | `ADMIN`.
- **Enrollment Filter:**
   - `ACTIVE`: Has $\ge 1$ active challenge enrollment (`startAt <= now < endAt`, non-deleted, unlocked).
   - `IDLE`: Participated in challenges previously, but currently has 0 active challenges.
   - `NEVER_ENROLLED`: Has 0 total lifetime challenge enrollments.
- **YPT Filter:** `ALL` | `CONNECTED` (`CONNECTED`, `VERIFIED`) | `DISCONNECTED` (`NOT_CONNECTED`, `REJECTED`, or null).
- **Sort Options:** `createdAt` (default desc), `lifetimeHours` (desc/asc), `trophies` (desc/asc).
- **Pagination:** `<DataPagination />` component integrated with configurable page sizes (default 15).
