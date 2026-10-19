# YPT Linking & Study Sync (`features/ypt`)

## 1. Executive Summary & Scope

HoldMeToIt links each participant to their **Yeolpumta (YPT)** account so that verified
study hours can be read and credited to the challenge scoreboard and the coin economy.

Session 137 reworked linking to a **shared service account** model. Participants no longer
enter their YPT email/password, and the platform no longer stores per-user YPT credentials
or refresh tokens.

- **Auth:** the server authenticates one shared YPT account using `YPT_EMAIL` / `YPT_PASSWORD`.
- **Discovery:** the member roster of the configured group(s) (`YPT_GROUP_IDS`) is read via `ypt-js`.
- **Selection:** the participant picks their own account from that roster.
- **Verification:** a **DEV** approves the claim in the DevBoard (DevBoard-only; ADMINs cannot approve).
- **Sync:** study time is read from the same service-account roster, ingested as `DailyStudyLog`, and rewarded with coins.

Out of scope: no user password collection, no per-user tokens, no nickname verification code,
no changes to accountability math.

## 2. ypt-js method coverage (docs: https://www.npmjs.com/package/ypt-js)

| Task                                       | Method                                                                                                            |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Authenticate the service account           | `auth.signIn({ email, password })` (client also supports the `credentials` option for lazy auto-login + re-login) |
| Restore a session                          | `auth.restoreSession(refreshToken)`                                                                               |
| Joined groups                              | `groups.listJoined()`                                                                                             |
| Members of one group                       | `groups.getMembers(groupId)`                                                                                      |
| All members across joined groups (deduped) | `groups.listAllMembers({ concurrency })`                                                                          |
| Per-member live study time                 | member fields `todayStudyMs`, `liveStudyMs`, `isStudying`, `currentSubject`                                       |

No method is missing for this feature. Two constraints are handled client-side: there is no
"get user by YPT id" endpoint (members are read via a group roster) and no server-side member
search (the fetched roster is filtered locally).

## 3. Domain State Machine & Decisions

`YptIdentityClaim.status`: `PENDING → VERIFIED | REJECTED`; `VERIFIED → REVOKED`;
`REJECTED | REVOKED → PENDING` (re-linking). Enforced by
`features/ypt/domain/ypt-claim-state-machine.ts` (Law L7 — pure domain, no framework imports).

Linking decision flow:

```
not linked ──submit──▶ PENDING ──DEV approve──▶ VERIFIED (User.yptId set)
                          │
                          └──DEV reject──▶ REJECTED ──re-submit──▶ PENDING
                                                   VERIFIED ──DEV revoke──▶ REVOKED / unlinked
```

Invariant: **one YPT id ↔ one HoldMeToIt user** (enforced on submit and re-checked inside the
approval transaction).

Roster link labels shown to a participant: `AVAILABLE` (free), `PENDING`/`VERIFIED` (theirs),
`LINKED` (claimed by another user — not selectable).

## 4. Database Persistence Models

- `User.yptId` — authoritative verified YPT numeric id (`@unique`).
- `YptIdentityClaim` — the approval request (`yptId`, `yptName`, `groupId`, `status`, reviewer, rejection reason).
- `YptConnection` — link status + sync metadata (`yptUserId`, `yptNickname`, `status`, `lastSyncedAt`, `lastSyncError`). **No token column** — `encryptedRefreshToken` was dropped in `20261024000000_ypt_shared_service_account`.
- `YptSyncRun` — per-sync audit row (`connectionId`, durations, coins, error).

## 5. Developer & Operator Usage Guide

Layout: `domain/` (pure, Law L7), `data/` (repositories + service account), `api/` (server actions), `presentation/` (React).

Key modules:

- `data/ypt-service-account.ts` — the shared account client + roster.
   - `getYptServiceClient()` — cached, authenticated `YptJs` client (in-memory per server instance).
   - `getYptServiceRoster({ fresh? })` — all members, scoped to `YPT_GROUP_IDS`, TTL-cached (~60s) with in-flight de-dup.
   - `findYptServiceMember(yptId)` — fresh single lookup (used by sync).
- `data/ypt-claim.repository.ts` — `getYptRosterWithStatus`, `submitYptClaim`, `adminApproveYptClaim` / `adminRejectYptClaim` / `adminRevokeYptClaim`, `getAdminClaimsList`.
- `api/ypt-claim.actions.ts` — participant: `getYptRosterAction`, `submitYptSelectionAction`; DEV: `adminApproveClaimAction` / `adminRejectClaimAction` / `adminRevokeClaimAction` / `getAdminClaimsListAction`.
- `api/ypt-connection.actions.ts` — participant: `getYptConnectionStatusAction`, `syncYptStudyNowAction`.
- `api/ypt-sync.service.ts` — `syncUserYptStudy(userId)`: reads via `findYptServiceMember`, ingests, logs `YptSyncRun`.
- `presentation/ypt-settings-card.tsx` — renders `YptMemberSelector` directly (no credential modal) plus verified/pending/rejected states.
- `presentation/ypt-verification-panel.tsx` — DEV review queue, mounted in the DevBoard `ypt` tab.

**Display de-duplication:** `getYptRosterWithStatus` collapses rows that share a normalized
`nickname + avatarUrl` (same person listed under different YPT ids) into one row, keeping the
account with the most study time, unioning `groupIds`, and preserving `LINKED > VERIFIED >
PENDING > AVAILABLE` precedence. `getYptServiceRoster` itself is **not** collapsed — it must keep
every id so `findYptServiceMember` (study sync) can resolve each account by exact id.

Operator configuration (server env): `YPT_EMAIL`, `YPT_PASSWORD`, `YPT_GROUP_IDS` (comma-separated),
and `YPT_INGEST_API_KEY` (guards the bot ingest route). The service account must be a member of every
group in `YPT_GROUP_IDS`.

## 6. Security & Authorization Rules

- Service credentials are read **only** from server env and never sent to the client.
- `getYptRosterAction` requires a session and is rate-limited (30/min/user); `submitYptSelectionAction` is rate-limited (10/10min/user).
- The roster is scoped to `YPT_GROUP_IDS` and returns limited fields only.
- Rate limiting: `core/security/rate-limiter.ts` (in-memory sliding window).
- Approval is **DEV-only**: all admin claim actions call `requireDevUser()` and return `FORBIDDEN_NOT_DEV`. No `hasAdminPrivileges` path.
- Every approve/reject/revoke writes an immutable `AuditLog` event via `recordAuditEvent`.

## 7. Feature Lifecycle & Decommissioning

States: Dormant (env unset → roster lookup throws "not configured") → Targeted → Global → Prune.

Decommission path: remove the feature folder, revert the `YptConnection`/`YptIdentityClaim`/`YptSyncRun`
models and migrate down (re-add storage only if a per-user model returns). Superseded code from the
credential-flow era (per-user token storage, encryption util, legacy `linkYptAccountAction`) has already
been deleted.
