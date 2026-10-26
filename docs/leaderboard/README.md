# Global Trophy Leaderboard (`/leaderboard`)

## 1. Executive Summary & Scope

The global leaderboard ranks every user by `User.trophyBalance` and is available to
signed-in users and spectators. It is separate from the per-challenge scoreboard
(`/challenge/[id]?tab=leaderboard`), which ranks participants by logged study seconds.

- **Route:** `apps/web/app/leaderboard/page.tsx` (`force-dynamic`, gated by the
  `global_leaderboard_v1` feature flag).
- **View:** `apps/web/features/trophies/presentation/trophy-leaderboard-view.tsx`.
- **Data:** `apps/web/features/trophies/data/trophy.repository.ts#getTrophyLeaderboard`.
- **Query helpers:** `apps/web/features/trophies/domain/leaderboard-query.ts` (pure, Law L7).

Anti-overengineering guardrails: ranking is intentionally a single in-memory sort over one
`trophyBalance` query; there is no materialized leaderboard table and no separate solo/duo
ranking path.

## 2. Domain Decisions & Ranking Invariants

1. **Source of truth:** `User.trophyBalance` (`Int`, floor `0`). Trophies are written only
   through `recordTrophyTransaction` / `settleChallengeTrophies` (+25 win, -15 loss).
2. **Rank assignment:** `rank` is the 1-based index of the canonical standing. The data layer
   explicitly orders users by `trophyBalance desc` with `id asc` as a stable tie-break, then
   re-sorts in memory before assigning ranks. Rank **1 is always the highest balance**.
3. **Client sort semantics:** the default `"trophies"` / `"desc"` sort orders rows by the
   canonical `rank` ascending (best first). It never sorts ascending and then reverses the
   array. Ties fall back to `trophyBalance` only when an entry has no rank.
4. **Other sort keys:** `winRate`, `wins`, and `name` reorder rows for scanning, but the badge
   still shows the user's true global `rank` (e.g. the highest win-rate user may be `#42`).
5. **Pagination:** `LEADERBOARD_PAGE_SIZE = 10`, applied after filter + sort. Page 1 therefore
   contains ranks 1–10 under the default sort.
6. **Tiers:** `TROPHY_TIERS` in `features/trophies/domain/trophy-rank.ts` maps balances to
   Recruit → Champion. The tier pill (`TrophyRoleBadge`) is derived from the balance and is
   unaffected by row ordering.

Decision table:

| Viewer state                                               | Header CTA                            |
| :--------------------------------------------------------- | :------------------------------------ |
| Signed out                                                 | "Join Active Battles" → `/challenges` |
| Signed in, no ongoing enrollment                           | "Join Active Battles" → `/challenges` |
| Signed in, enrolled in an active, not-yet-locked challenge | CTA hidden                            |

"Ongoing" means `startAt <= now < endAt`, `isDeleted = false`, and
`resultsLockedAt = null`. The probe is `findActiveChallengeEnrollment` in
`features/challenges/data/participant.repository.ts`.

## 3. Database Persistence Models

- `User.trophyBalance` — cached competitive balance (indexed `desc`).
- `TrophyTransaction` — immutable ledger (`type`, `amount`, `balanceAfter`,
  `idempotencyKey`, optional `relatedTransactionId` for reversals).
- `ChallengeParticipant` — membership used by the CTA probe (`userId`, `challengeId`,
  `enrolledAt`).
- `Challenge` — `startAt`, `endAt`, `isDeleted`, `resultsLockedAt` drive the "ongoing" check.

## 4. Developer Usage Guide

```ts
// Server component / server action
import { getTrophyLeaderboard } from "@/features/trophies/data/trophy.repository";

const { entries } = await getTrophyLeaderboard({ all: true });
// entries[0].rank === 1, highest trophyBalance first
```

```tsx
// Rendering
import { TrophyLeaderboardView } from "@/features/trophies/presentation/trophy-leaderboard-view";

<TrophyLeaderboardView
   initialEntries={entries}
   currentUserId={session?.user?.id ?? null}
   hasActiveChallenge={Boolean(activeEnrollment)}
/>;
```

```ts
// Client-side filtering/sorting/pagination helpers (pure)
import {
   filterLeaderboardEntries,
   sortLeaderboardEntries,
   paginateLeaderboard,
} from "@/features/trophies/domain/leaderboard-query";
```

`getTrophyLeaderboardAction` (`features/trophies/api/trophy.actions.ts`) is the client-callable
wrapper; it returns `FEATURE_DISABLED` when the flag is off.

## 5. Security & Authorization Rules

- The route is public read-only; guests see the standings with no mutation controls.
- The only per-viewer data is `currentUserId` (highlight "YOU") and the boolean enrollment
  probe. No other user's membership or logs are exposed.
- Admin trophy adjustments stay behind `adminAdjustTrophiesAction` (ADMIN/DEV) and remain
  audited; the leaderboard itself never mutates data.

## 6. Feature Lifecycle & Decommissioning

1. **Dormant deploy:** `global_leaderboard_v1` off → locked `EmptyState`, header link hidden,
   actions return `FEATURE_DISABLED`; stored trophies/rank badges stay visible elsewhere.
2. **Targeted beta:** enable the flag for testers via `/devboard`.
3. **Global GA:** `rolloutMode = GLOBAL`.
4. **Decommission:** remove the flag and the `/leaderboard` route; trophy settlement and
   `TrophyRoleBadge` can remain for profile/wallet surfaces.

## 7. Challenge Leaderboard (`/challenge/[id]?tab=leaderboard`)

The per-challenge standings are separate from the global trophy board. Two format rules apply:

1. **DUOS defaults to “View by Team.”** `resolveLeaderboardViewMode(value, format)` returns
   `"team"` when no explicit `?view=` is present and the challenge format is `DUOS`; every
   other format (and every explicit param) is unchanged. The canonical URL omits `?view=`
   for the format's default mode, so switching a duo back to the default removes the param
   rather than writing `?view=team`.
2. **No head-to-head panel for DUOS.** The large “Team A VS Team B” matchup/tug-of-war panel
   renders for `TEAM_VS_TEAM` only (`showHeadToHead = challenge.format !== "DUOS"`). Duo
   battles rely on the top-3 podium and the team-view cards instead. `matchHeader.hasMatchup`
   is intentionally untouched because Discord embeds still derive their description from it.

Rename eligibility for the caller's duo is exposed on `currentUser.teamId`,
`currentUser.teamName`, `currentUser.teamIcon`, and `currentUser.canEditDuoTeam`; the
team-view header shows the pencil control only for the caller's own team. See
`docs/challenges/README.md` §8.

## 8. Trophy Rank Badges in Challenge Standings

`TrophyRoleBadge` pills inside `/challenge/[id]?tab=leaderboard` (mobile cards, desktop table,
and team view) are gated by the same `global_leaderboard_v1` flag as the `/leaderboard` route.
The challenge page evaluates `isFeatureEnabled(FEATURE_FLAG_KEYS.globalLeaderboard)` and
passes `isGlobalLeaderboardEnabled` through `ChallengeView` to `ChallengeLeaderboardTab`.
The prop defaults to `false`, so the badges fail closed when the flag is missing or disabled.
Trophy balances remain in the view model; only the badge rendering is gated.
