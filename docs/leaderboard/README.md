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

### 7.1 Head-to-Head Banner Card Anchoring & Dynamic Leader Badge (GH #206 / KAN-67)

1. **Card Anchoring by Creation Order:**
   - Head-to-head match cards in `ChallengeLeaderboardTab` are permanently anchored to fixed slots based on team creation order (`sortOrder` ascending) rather than dynamically swapping positions whenever hours lead changes.
   - Slot 1 (`teamA`) represents the first created team, and Slot 2 (`teamB`) represents the second created team.
   - Eliminates layout shifting and visual disorientation caused by matchup cards flipping left-to-right mid-challenge.

2. **Dynamic Leading Crown & Margin Delta:**
   - When a team holds a strictly positive lead in cumulative logged seconds (`matchHeader.leadMarginSeconds > 0`):
      - The leading team's card displays a high-contrast `👑 Leading` badge (`bg-feedback-warning-bg border-feedback-warning text-feedback-warning-text`) in the card header.
      - The leading team's total logged hours displays the lead margin delta (`+Xh Ym ahead` or `+Xh Ym Zs ahead` via `formatLeadMarginDelta`) beside the clock time.
      - The trailing team's card displays standard total hours without leading badges or margin deltas.
   - When both teams are tied or have 0 logged seconds (`matchHeader.leaderSide === "tie"`), neither card displays a leading badge or ahead delta, preserving mathematical integrity (Law L6/L7).

### 7.2 Unassigned Scholars Section in Team View Mode (GH #209 / KAN-70)

1. **Context & Motivation:**
   - When scholars enroll in a challenge prior to being assigned to a house or team, their `teamId` is unset (`null` / `"no-assigned"`).
   - Previously, in "View by Team" mode, the view only rendered houses listed in `challenge.teams`, causing unassigned scholars to disappear completely from the view.

2. **Unassigned Scholars Card:**
   - When unassigned scholars exist in `filteredStandings`, an "Unassigned Scholars" (`⏳`) card renders alongside house cards in the responsive grid.
   - Displays a prominent status pill (`{count} unassigned`) and explanatory subtitle (`Awaiting house assignment`).
   - Lists all unassigned scholars with their rank within the unassigned pool (`#1`, `#2`, ...), overall challenge rank (`(#rank)`), avatar, display name, handle, study telemetry (`totalLoggedClock` and `todayLoggedClock`), and a dedicated `⏳ Unassigned` status badge.
   - For hosts and administrators (`isAdmin: true`), renders a 1-click shortcut button linking directly to `/challenge/[id]?tab=manage&team=UNASSIGNED` to instantly assign scholars in the roster editor, as well as `Edit hr` and `Edit target` override modals.

3. **Team Filter Dropdown Integration:**
   - When unassigned scholars exist, an option `⏳ Unassigned ({count})` (`value="UNASSIGNED"`) is dynamically appended to the leaderboard team filter dropdown.
   - Selecting `UNASSIGNED` scopes both the table view and team view mode strictly to unassigned scholars.
   - Active filters pill displays `Team: Unassigned` with 1-click filter reset capabilities.

### 7.3 Desktop Standings Table Progress & Pace Status Columns (GH #208 / KAN-69)

1. **Context & Problem Statement:**
   - In accordance with **FEATURES.md §7.2 (Unified Roster Standings Table)**, the scoreboard standings table requires dedicated visibility into goal progress and participant pace status.
   - Previously, the desktop table (`hidden sm:block`) only displayed `Rank`, `Name`, `Team`, `Today's hours`, and `Total hours`.

2. **Architectural Implementation:**
   - **Progress Column:**
      - `<TableHead className="px-4 py-3 min-w-[120px]">Progress</TableHead>` in `<TableHeader>`.
      - Displays formatted completion percentage (`{Math.round(entry.completionPercentage)}%`) alongside a slim, accessible progress bar track (`bg-surface-elevated` track, `bg-feedback-success` fill clamped between 0% and 100%).
   - **Pace Status Column:**
      - `<TableHead className="px-4 py-3 text-center">Pace Status</TableHead>` in `<TableHeader>`.
      - Renders semantic status pills via `PaceStatusBadge`:
         - `Serene` / `Completed`: `bg-feedback-success-bg border-feedback-success/40 text-feedback-success-text`
         - `On Track`: `bg-feedback-success-bg border-feedback-success/40 text-feedback-success-text`
         - `Catch-Up`: `bg-feedback-warning-bg border-feedback-warning/40 text-feedback-warning-text`
         - `Punished`: `bg-feedback-error-bg border-feedback-error/40 text-feedback-error-text`
         - `Excused`: `bg-accent-bg border-accent/40 text-accent-text`
   - **View Mode Isolation:**
      - Progress and Pace Status columns are rendered in `viewMode !== "today"` (Overall Rank mode) and omitted in Today's LB mode (`initialViewMode: "today"`), preserving dedicated focus on today's study duration.
   - **Responsive & Design Integrity:**
      - Fully compliant with Obsidian Dark theme and semantic design tokens (zero hex values).
      - Compact padding and `overflow-x-auto` container ensure smooth horizontal scroll safety on 640px–1024px tablet viewports.

### 7.4 Locked Challenge Pace Status Invariant & Auto-Lock Reconciliation (GH #217 / KAN-74)

1. **Context & Problem Statement:**
   - On the challenge Leaderboard tab (`/challenge/[id]?tab=leaderboard`), scholars with uncompleted weekly target hours (e.g. 14%, 11%, 3% progress) were displaying a green **'Completed'** badge under Pace Status when a challenge was locked.
   - In `buildScoreboardViewModel` (`features/leaderboard/data/leaderboard-data.ts`), a line guarded `!isResultsLocked && deficitSeconds > 0`. Consequently, once `resultsLockedAt` was set (`isResultsLocked = true`), the deficit check was skipped. If a participant had no explicit `PunishmentRecord` and their status was `NORMAL`, they fell through to the default `Completed` state.
   - Additionally, the YPT ingestion daemon auto-lock (`apps/ypt-bot/src/db/challenge-repository.js`) updated `resultsLockedAt: now` directly without evaluating participants or creating `PunishmentRecord` entries.

2. **Architectural Implementation:**
   - **Leaderboard Data Invariant (`features/leaderboard/data/leaderboard-data.ts`):**
      - Any participant with `deficitSeconds > 0` or uncompleted challenge-linked weekly tasks (`weeklyTasksCompletedCount < weeklyTasksTotalCount`) on a completed/locked challenge is strictly evaluated as `paceStatus: "punished"` and `paceLabel: "Punished"` unless pardoned/excused (`isPardonedRecord`), preserving **Law L6 (Three-Condition Accountability Invariant)** and **Law L3 (The Catch-Up Deficit Model)**.
      - Safeguard against false 100% completion percentages: `completionPercentage` is clamped below 100% (to 99%) whenever `deficitSeconds > 0`.
   - **Automated Accountability Reconciliation (`apps/ypt-bot/src/db/challenge-repository.js`):**
      - `lockExpiredChallengesAfterGrace` triggers `reconcileChallengeAccountability` upon auto-locking expired challenges.
      - Reconciles all 3 conditions: target hours met, weekly tasks completed, and winning team (ties are draws: all teams at the maximum score win; individual competition in SOLOS format).
      - Automatically sets `status: "PUNISHED"` and creates `PunishmentRecord` rows for uncompleted participants, while setting qualifying participants to `status: "NORMAL"`.

### 7.5 Duo Battle Card Normalization & UI Alignment (GH #220 / KAN-77)

1. **Context & Problem Statement:**
   - In "View by Team" mode (`viewMode === "team"`), duo battles render side-by-side in a 2-column responsive grid (`lg:grid-cols-2`).
   - Previously, team cards and internal scholar blocks displayed uneven heights and crooked layouts depending on team name lengths, scholar display names, and hour goal numbers:
      - Team names longer than 10–12 characters pushed the scholars badge onto a second line, expanding the header to 3 lines while shorter teams remained 2 lines.
      - Inside scholar blocks, unconstrained `flex-wrap` caused badges (`Offline`, `Catch-Up`, `Serene`) and handles (`@username`) to wrap into 2, 3, or 4 random lines depending on the exact character widths of display names and clock values (`totalLoggedClock / targetClock`).
      - This produced severely misaligned, crooked cards with different vertical heights across the grid.

2. **Architectural Implementation (`features/leaderboard/presentation/challenge-leaderboard-tab.tsx`):**
   - **Normalized Team Header (Strict 2-Row Layout):**
      - **Row 1:** Left: Emoji, team name (`truncate` with native title tooltip), and duo edit pencil (caller's team only). Right: Total study time (`totalLoggedClock`) and bounded progress bar track (`w-16 sm:w-24`).
      - **Row 2:** Left: Scholars count pill (`{count} / {target} scholars`) and `Leading House` badge. Right: Weekly target hours and completion percentage (`Weekly Target: {targetHours}h • Completed: {completionPercentage}%`).
      - Row 1 and Row 2 have fixed, single-line heights across all house and unassigned cards regardless of name or hour lengths.
   - **Normalized Scholar Block (Strict 2-Line Layout & `min-h-[68px]`):**
      - **Line 1:** Intra-team rank (`#idx`), overall rank (`(#rank)`), 32px avatar, display name (`truncate font-bold`), trophy badge, and YPT status pill (`Offline` / `Studying`, `shrink-0`).
      - **Line 2:** Scholar handle (`@{username}`, `truncate max-w-[90px] sm:max-w-[130px]`), compact sick badge (`SickStatusBadge`), and pace status pill (`Catch-Up` / `Serene` / `On Track` / `Punished`, `shrink-0`).
      - **Right-Aligned Telemetry & Actions:** Formatted tabular clock (`totalLoggedClock / targetClock`, `whitespace-nowrap`), today's hours (`+todayLoggedClock`, `whitespace-nowrap`), and vertically centered compact icon-only admin controls with hover tooltips (`Clock`: "Edit Study Hours", `Target`: "Edit Weekly Target", `HeartHandshake`: "Grant Pardon"), saving ~88px of horizontal width for display names.
   - **Visual Symmetry & Equal Block Shapes:**
      - All duo cards and unassigned cards render with identical height bounding boxes and visual symmetry down to 360px mobile viewports (Law L9).

### 7.6 Compact Admin Action Buttons & Aligned Total Hours Layout

1. **Context & Problem Statement:**
   - In dev/admin view (`isAdmin: true`), the Leaderboard desktop table displayed full-text action buttons (`Edit hr`, `Edit target`, `Pardon`) directly within the `Total hours` cell.
   - For rows with 3 buttons (~260px width), the hours container was compressed, forcing `/ 45:00:00` onto a second line underneath the logged hours, creating a lopsided layout relative to rows with only 2 buttons. The wide buttons also triggered horizontal page scrolling.

2. **Architectural Implementation (`features/leaderboard/presentation/challenge-leaderboard-tab.tsx`):**
   - **Compact Icon-Only Action Buttons (`AdminRowActions`):**
      - Full-text buttons are replaced with compact icon-only buttons (`Clock`, `Target`, `HeartHandshake`).
      - Accessible for screen readers via `<span className="sr-only">` and accessible labels.
      - Includes hover tooltips via Radix UI `Tooltip` (`TooltipProvider`, `Tooltip`, `TooltipTrigger`, `TooltipContent`) alongside native `title` tooltips, explaining button capabilities ("Edit Study Hours", "Edit Weekly Target", "Grant Pardon").
   - **Dedicated Desktop `Actions` Column:**
      - In desktop standings (`hidden sm:block`), admin controls are decoupled from the hours cell into a dedicated centered `Actions` column (`w-[100px]`).
      - The `Total hours` column is rendered identically between regular and admin views (`(clock) HH:MM:SS / HH:MM:SS`, `whitespace-nowrap`, `text-right font-sans font-sans-tabular text-sm font-bold text-white`), eliminating line breaks and horizontal lopsidedness across all participant rows.
   - **Mobile Cards & Team Mode Sizing:**
      - Uses `size="sm"` (`h-6 w-6` with `h-3 w-3` icons) in mobile cards (`sm:hidden`) and team view mode to preserve responsive layout without clipping or horizontal overflow on 360px+ viewports (Law L9).

### 7.7 Filter by Day & Historical Daily Standings (GH #248 / KAN-94)

1. **Context & Motivation:**
   - Previously, the leaderboard view only supported viewing cumulative standings (`"individual"` / `"team"`) or the current day's study stats (`"today"`).
   - Participants and community hosts needed the ability to inspect rankings and study durations for any historical challenge day (Day 1, Day 2, etc.) to evaluate daily consistency, track daily MVP performers, and audit logged study sessions.

2. **Domain Architecture (`features/leaderboard/domain/leaderboard.ts`):**
   - **Day Options Generation (`getLeaderboardDayOptions`):** Returns valid challenge day options (`dayNumber`, `dateKey`, `formattedDate`, `isToday`) up to `currentDayNumber` for active challenges, or all days through `totalDays` for completed challenges.
   - **Day Selection Resolution (`resolveLeaderboardSelectedDay`):** Validates requested day number or `YYYY-MM-DD` date key against challenge day boundaries. Falls back gracefully to Today for active challenges, or the final challenge day for completed/historical challenges.
   - **Daily Ranking Engine (`rankByDaySeconds`):** Pure function ranking participants strictly by logged study seconds on the selected date key (`Law L7`). Enforces second-level integer clock precision (`Law L8`), tie-breaking by cumulative `totalLoggedSeconds` descending, then `displayName` ascending.
   - **Heading Formatter (`formatLeaderboardDayHeading`):** Formats clear context headers: `Showing Today's Standings · <Month Day, Year>` for today, or `Showing Day X Standings · <Month Day, Year>` for historical days.
   - **Team Day Scores (`calculateTeamDayScores`):** Aggregates daily study seconds per team for team battle telemetry.
   - **View Mode Extended:** Added `"day"` to `LeaderboardViewMode`, supported in `resolveLeaderboardViewMode` and synchronized across URL search params.

3. **Presentation & Responsive UX (`features/leaderboard/presentation/challenge-leaderboard-tab.tsx`):**
   - **Day Selector Dropdown:** Accessible Radix `Select` (`data-testid="leaderboard-day-select"`) displayed beside the view mode toggle whenever in daily view (`viewMode === "today" || viewMode === "day"`). Uses Obsidian Dark tokens and `min-w-dropdown-min`.
   - **Dynamic Table Header & Mobile Cards:** Table columns and mobile cards dynamically reflect `Day X Hours` / `Day X hours` (or `Today's Hours`), showing participants' logged study duration for the selected day.
   - **Cozy Zero-State Handling (`Law L9`):** When no study sessions are logged across any participant on the selected day, displays a cozy empty state (`data-testid="day-no-logs-empty-state"`) with clear recovery and date context.
   - **Deep Linking & URL Sync:** Supports query parameters `?view=day&day=X` or `?date=YYYY-MM-DD`. Switching days updates the URL via `window.history.replaceState` without full page reloads.
   - **Admin Override Pre-Selection:** When opening the admin hours override modal from daily view, the modal automatically initializes to the currently inspected day number.

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
