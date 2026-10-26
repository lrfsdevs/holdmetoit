# HoldMeToIt — Master Feature Specification

> **Document Version:** 2.0  
> **Source of Truth:** Repository Root — Authoritative Product Feature Catalog  
> **Rule:** Every screen, user flow, and functional capability across all product phases is detailed here.  
> **Last Updated:** 2026-10-14  
> **Status:** Active Master Specification (Updated with Phase 0/1 implementation reality)

---

## 1. Phase Legend & Delivery Roadmap

All features are strictly tagged with their planned deployment phase:

| Phase Tag | Phase Name                    | Target Window | Core Focus                                                                                                                                      |
| :-------- | :---------------------------- | :-----------: | :---------------------------------------------------------------------------------------------------------------------------------------------- |
| `[P0]`    | **MVP Core**                  |   ~10 Days    | Spreadsheet replacement: self-logging in `HH:MM:SS`, live scoreboard, mandatory goals, auto-punishments, PFP download.                          |
| `[P1]`    | **Automation & Integrations** |    2 Weeks    | YPT API Bot automated ingestion, 24/7 `@HoldMeToItBot` Discord bot, auto-expiring countdown timers.                                             |
| `[V1]`    | **Gamification & Fair Math**  |   2–3 Weeks   | Overflow diminishing returns ($\alpha=0.5$), Auto-balancer snake draft (15h cap), daily challenge streaks, achievement badges, member profiles. |
| `[V2]`    | **Spontaneous Duels & Scale** |    2 Weeks    | Peer-to-peer 1v1 sprint duels (mutual consent, zero mod overhead), multi-guild schema readiness.                                                |

---

## 2. Master Feature Catalog (Quick Matrix)

| Feature ID      | Feature Name                                                   | Module              | Phase  | Target Persona        |                    Implementation Status                    |
| :-------------- | :------------------------------------------------------------- | :------------------ | :----: | :-------------------- | :---------------------------------------------------------: |
| `FEAT-AUTH-01`  | Discord OAuth 2.0 Authentication                               | Auth & Identity     | `[P0]` | Participant, Admin    |                          ✅ `DONE`                          |
| `FEAT-AUTH-02`  | Public Read-Only Spectator Mode                                | Auth & Identity     | `[P0]` | Spectator / Public    |                          ✅ `DONE`                          |
| `FEAT-AUTH-03`  | Multi-Guild Tenant Isolation                                   | Auth & Identity     | `[V2]` | System                |                         ⏸️ Planned                          |
| `FEAT-CHAL-01`  | Multi-Format Challenge Creator (Team, Duo, Solo)               | Challenge Ops       | `[P0]` | Admin                 |                          ✅ `DONE`                          |
| `FEAT-CHAL-02`  | Host Manual Event Kickoff Trigger                              | Challenge Ops       | `[P0]` | Admin                 |                          ✅ `DONE`                          |
| `FEAT-CHAL-03`  | Automated Countdown Timer & Expiration                         | Challenge Ops       | `[P1]` | System                |  ⚠️ Timestamp lifecycle active; background worker pending   |
| `FEAT-CHAL-04`  | Auto-Balancer Snake Draft & 15h Cap                            | Challenge Ops       | `[V1]` | Admin                 |                         ⏸️ Planned                          |
| `FEAT-CHAL-05`  | Event Lock & Freeze Final Results                              | Challenge Ops       | `[P0]` | Admin                 |  ✅ `DONE` (`resultsLockedAt`, idempotent lock, 10s undo)   |
| `FEAT-CHAL-06`  | Duo Partner Self-Naming & Dynamic Team Identities              | Challenge Ops       | `[P0]` | Participant, Admin    |  ⚠️ Team identities live; participant self-naming pending   |
| `FEAT-AUDIT-01` | Append-Only Immutable System Audit Trail                       | Admin & Audit       | `[P0]` | Admin, System         |  ✅ `DONE` (PostgreSQL `AuditLog` model + Event Audit tab)  |
| `FEAT-DECL-01`  | Declared Target Hours (`HH:MM:SS`)                             | Declarations        | `[P0]` | Participant           |                          ✅ `DONE`                          |
| `FEAT-DECL-02`  | Mandatory Weekly Goals Checklist                               | Declarations        | `[P0]` | Participant           |      ✅ `DONE` (challenge-linked tasks + soft delete)       |
| `FEAT-DECL-03`  | Pre-Kickoff Declaration Lock                                   | Declarations        | `[P0]` | System                |                          ✅ `DONE`                          |
| `FEAT-DECL-04`  | Host Goal Unlock & Mid-Event Edit                              | Declarations        | `[P0]` | Admin                 |   ✅ `DONE` (Wired to `AdminTargetOverrideModal` in tabs)   |
| `FEAT-LOG-01`   | Daily Clock-Time Self-Logging (`HH:MM:SS`)                     | Study Logging       | `[P0]` | Participant           |                     ✅ `DONE` (at `/`)                      |
| `FEAT-LOG-02`   | 24-Hour Single-Day Limit Validation                            | Study Logging       | `[P0]` | System                |                          ✅ `DONE`                          |
| `FEAT-LOG-03`   | Direct YPT API Bot Ingestion Endpoint                          | Study Logging       | `[P1]` | System / Teammate Bot |                         ⏸️ Planned                          |
| `FEAT-LOG-04`   | Admin Inline Hours Override Grid                               | Study Logging       | `[P0]` | Admin                 |     ✅ `DONE` (`AdminHoursOverrideModal` live in tabs)      |
| `FEAT-LOG-05`   | Participant Planned Leave Budget & Quota Enforcement           | Study Logging       | `[P0]` | Participant           |   ✅ `DONE` (`plannedLeaveDays` + `usedLeaveDays` check)    |
| `FEAT-LEAD-01`  | Head-to-Head Live Match Scoreboard                             | Standings & Math    | `[P0]` | All Users             |                          ✅ `DONE`                          |
| `FEAT-LEAD-02`  | Unified Roster Standings Table                                 | Standings & Math    | `[P0]` | All Users             |                          ✅ `DONE`                          |
| `FEAT-LEAD-03`  | Dynamic Daily Catch-Up Deficit Engine                          | Standings & Math    | `[P0]` | Participant           |                          ✅ `DONE`                          |
| `FEAT-LEAD-04`  | Overflow Diminishing Returns Scoring Engine                    | Standings & Math    | `[V1]` | System                |                         ⏸️ Planned                          |
| `FEAT-LEAD-05`  | Host Manual Weekly Hours Board (Deprecated)                    | Standings & Math    | `[P0]` | Admin, All Users      |   🚫 `REMOVED` (superseded by Admin Hours Override Grid)    |
| `FEAT-LEAD-06`  | Challenge-Specific Participant Statistics & Read-Only Profiles | Standings & Math    | `[P0]` | All Users             |  ✅ `DONE` (`/challenge/[id]/participant/[participantId]`)  |
| `FEAT-TASK-01`  | Offline-First Categorized To-Do Board                          | Tasks & Sync        | `[P0]` | All Users             |           ✅ `DONE` (IndexedDB + background sync)           |
| `FEAT-TASK-02`  | Drag-and-Drop Task & Category Reordering                       | Tasks & Sync        | `[P0]` | All Users             |             ✅ `DONE` (HTML5 DnD + `sortOrder`)             |
| `FEAT-FEED-01`  | In-App Feedback & Discord/GitHub/Jira Dispatch                 | Observability       | `[P1]` | All Users             | ✅ `DONE` (text + media attachments, Discord, GitHub, Jira) |
| `FEAT-PUN-01`   | Three-Condition Auto-Flagging Engine                           | Accountability      | `[P0]` | System                | ✅ `DONE` (weekly tasks + hours + winning team; ties safe)  |
| `FEAT-PUN-02`   | Punishment Wall & Deficit Roster                               | Accountability      | `[P0]` | All Users             |         ⚠️ Public UI component pending restoration          |
| `FEAT-PUN-03`   | Direct Punishment PFP Asset Download                           | Accountability      | `[P0]` | Flagged Member        |    ✅ `DONE` (Live in Overview tab Forfeit Avatar card)     |
| `FEAT-PUN-04`   | Host Pardon / Excuse Override                                  | Accountability      | `[P0]` | Admin                 |             ⚠️ Backend action live; UI pending              |
| `FEAT-PUN-05`   | Hall of Accountability Historical Archive                      | Accountability      | `[V1]` | All Users             |                         ⏸️ Planned                          |
| `FEAT-WRAP-01`  | Challenge Wrapped Story Popup                                  | Post-Event          | `[P0]` | Participant           |      ✅ `DONE` (auto-popup, 3-day window + auto-seen)       |
| `FEAT-WRAP-02`  | Challenge Wrapped Summary Tab (`?tab=summary`)                 | Post-Event          | `[P0]` | All Users             |          ✅ `DONE` (spectators + personal wrapped)          |
| `FEAT-DISC-01`  | 1-Click Formatted Markdown Summary Copy                        | Discord Broadcaster | `[P0]` | Admin                 |  🚫 `REMOVED` (superseded by Summary tab; purged in S104)   |
| `FEAT-DISC-02`  | 24/7 `@HoldMeToItBot` Slash Commands                           | Discord Broadcaster | `[P1]` | Discord Users         |                         ⏸️ Planned                          |
| `FEAT-DISC-03`  | Automated Daily & Final Results Embeds                         | Discord Broadcaster | `[P1]` | Discord Channel       |                         ⏸️ Planned                          |
| `FEAT-GAME-01`  | Daily Challenge Streaks                                        | Gamification        | `[V1]` | Participant           |                         ⏸️ Planned                          |
| `FEAT-GAME-02`  | Condition-Based Achievement Badges (5 Types)                   | Gamification        | `[V1]` | Participant           |                         ⏸️ Planned                          |
| `FEAT-GAME-03`  | Member Profile Cockpit (`/profile/[id]`)                       | Gamification        | `[V1]` | All Users             |                         ⏸️ Planned                          |
| `FEAT-DUEL-01`  | Spontaneous 1v1 Mutual Study Sprint Duels                      | P2P Battles         | `[V2]` | Discord Members       |                         ⏸️ Planned                          |

---

## 3. Module Specifications: Authentication & Identity

### §3.1 Discord OAuth 2.0 Authentication `[P0]`

- **User Flow:** User visits landing page $\rightarrow$ clicks "Login with Discord" $\rightarrow$ grants `identify` scope $\rightarrow$ redirected back with session.
- **Data Captured:** Discord Snowflake ID, username, global display name, avatar URL hash.
- **Persistence:** Upserts record into `User` table; synchronizes avatar and display name on every login.
- **Access Roles:**
   - `DEV`: Discord Snowflake in `DEV_DISCORD_IDS` (full development & host console privileges).
   - `ADMIN`: Evaluated dynamically via Discord Guild role IDs in `DISCORD_ADMIN_ROLE_IDS`.
   - `PARTICIPANT`: Default role for all enrolled community members.

### §3.2 Public Read-Only Spectator Mode `[P0]`

- **User Flow:** Anyone visiting `/challenge/:id` without an active session can view the live match scoreboard, participant hours, and download the punishment PFP.
- **Security Invariant:** Write actions (logging hours, checking goals, editing rosters) are disabled and hidden for unauthenticated guests.

### §3.3 Multi-Guild Tenant Isolation `[V2]`

- **Description:** Adds optional `guild_id` to `Challenge` and `User` models, preparing the codebase to be installed across multiple independent Discord communities without data leakage.

---

## 4. Module Specifications: Challenge Operations & Lifecycle

### §4.1 Multi-Format Challenge Creator & Dynamic Identities `[P0]`

- **Route:** `/admin/challenges/new`
- **Supported Formats:**
   1. `TEAM_VS_TEAM`: Two competing named rosters.
   2. `DUOS`: Pairs of $N=2$ accountability partners.
   3. `SOLOS`: Free-for-all individual leaderboard ($N=1$).
- **Dynamic Per-Event Team Themes:**
   - Team identities are never hardcoded across challenges. Every challenge defines its own thematic team names, icons/emojis, mascot illustrations, and accent colors (e.g. _Honey Bees vs Lavender Butterflies_, _Owls vs Larks_, _Matcha vs Espresso_, _Sunflowers vs Ferns_, _Dragons vs Griffins_).
   - Configurable during event creation via the host wizard and editable prior to kickoff.
- **Configuration Fields:** Title, Start Date/Time, End Date/Time, Format, Dynamic Team Names/Colors/Mascots, Participant Assignment, and two independent image uploads (both required for new challenges; PNG/JPEG/WebP, max 3 MB each):
   - **Event Header Image:** Stored as `eventBannerUrl` in the configured `event-banners` directory; supplies only the challenge hero and admin event-card thumbnails with wide cropping/readability overlays.
   - **Assigned Punishment PFP:** Stored as `punishmentPfpUrl` in the configured `punishment-pfps` directory in the same public bucket; supplies accountability avatar previews and downloads, never event headers.
   - Both can be replaced independently in Manage. Existing challenges retain their saved legacy values (including null) when editing unrelated details; changed image URLs must belong to their designated directory. Migration backfills legacy banners from the old image without changing PFPs or storage files.
   - Uploads provide loading, empty, and error/retry states. Cleanup after replacement/deletion checks references in both image fields across all challenges and retains shared files.

### §4.2 Host Manual Event Kickoff Trigger `[P0]`

- **Mechanism:** Even after the scheduled start time arrives, the host retains a "Start Event Now" button to verify all rosters and declared goals before locking inputs.
- **State Transition:** Advances `startAt` to current timestamp if in the future, deriving status `ACTIVE` via `calculateChallengeStatus`.

### §4.3 Automated Countdown Timer & Expiration `[P1]`

- **Mechanism:** Background scheduler checks active challenge end timestamps.
- **Automated Transition:** When the countdown hits `00:00:00`, challenge automatically transitions to `COMPLETED`, freezes logging forms, and executes the punishment calculation routine.

### §4.4 Auto-Balancer Snake Draft & 15-Hour Cap `[V1]`

- **15-Hour Sanity Cap:** System rejects any declared target $>15\text{ hours/day}$ ($>105\text{ hours/week}$).
- **Draft Algorithm:**
   - Calculates composite rating: $R_i = 0.6 \times \text{DeclaredTarget} + 0.4 \times \text{HistoricalDailyAverage}$.
   - Sorts participants and runs a snake draft ($A, B, B, A, A, B\dots$) to produce evenly matched teams.
   - **Host Override:** Drag-and-drop roster editor lets mods swap participants before launching.

### §4.5 Event Lock & Finalize Results `[P0]`

- **Route:** `/challenge/:id?tab=manage` (Manage tab)
- **Action:** Host clicks "Lock Final Results". Freezes all participant data rows and triggers the final punishment evaluation (`lockChallengeResultsAction`).
- **Lifecycle Invariant:** Dynamic status is derived via `calculateChallengeStatus(startAt, endAt)`. Challenges track `resultsLockedAt` in the database, allowing idempotent result locking and punishment evaluation even after natural expiration.

### §4.6 Append-Only Immutable System Audit Trail `[P0]`

- **Feature ID:** `FEAT-AUDIT-01`
- **Description:** An immutable, tamper-proof audit log recording administrative actions, manual hours adjustments, pardons, and challenge kickoff/lock transitions.
- **Implementation Note:** Events are generated via `recordAuditEvent` in `features/audit/data/audit-log.repository.ts`, persisted to the relational `AuditLog` database model (with in-memory fallback), and rendered in the admin Event Audit tab (`/challenge/:id?tab=audit`).

### §4.7 Duo Partner Self-Identity Editing (Name + Emoji) `[P0]`

- **Feature ID:** `FEAT-CHAL-06`
- **Description:** In `DUOS` format events (pairs of $N=2$ accountability partners), team identity autonomy is granted directly to the participants forming each pair. Both the duo name and its emoji are editable.
- **Rules & User Flow:**
   1. **Self-Identity Window (`UPCOMING` + `ACTIVE`):** Either partner can edit the duo name (e.g., _"Caffeine & Calculus"_, _"Midnight Chai"_) and its single emoji while the event has not completed and `resultsLockedAt` is null. Presets are offered, but free-text single-emoji input is accepted.
   2. **Real-Time Synchronization:** When partner A updates the duo identity, partner B sees the updated badge on their next load of the Cockpit, challenge hero, leaderboard, and event roster.
   3. **Results-Lock Freeze:** Duo names and emojis become read-only when the host locks final results (`resultsLockedAt` set). A completed-but-unlocked event is also treated as read-only.
   4. **Host Override Absolute (Law L5):** Community hosts retain administrative authority to rename offensive, disruptive, or duplicate duo names and adjust team emojis from the Manage tab at any time, with all edits recorded in the audit trail (`FEAT-AUDIT-01`).
   5. **Implementation Note:** Participant edits go through `updateDuoTeamIdentityAction` / `updateDuoTeamIdentity` (name duplicate-checked case-insensitively per challenge, emoji validated as one grapheme). Each save emits one `HOUSE_IDENTITY_UPDATED` audit event on the `TEAM` entity with `previousValue`/`newValue` containing both `name` and `iconEmoji`, plus a reason naming the changed fields.

---

## 5. Module Specifications: Pre-Challenge Declarations

### §5.1 Declared Weekly Target Hours `[P0]`

- **Requirement:** Every enrolled participant enters their target hours in `HH:MM:SS` (e.g., `35h 00m 00s`) during the `UPCOMING` phase.
- **Constraint:** Minimum $1\text{ hour}$, maximum $105\text{ hours}$ per week.

### §5.2 Weekly Goals & Tasks Architecture `[P0]`

- **Challenge-Linked Tasks (Decision 2026-10-11):** Tasks carry an optional `challengeId` (`Task.challengeId`). While a user is enrolled in a challenge that is not locked/ended, every task created after enrollment is stamped to that challenge by default (`resolveTaskChallengeId` — the ACTIVE challenge is preferred, else the soonest `UPCOMING`); with no ongoing challenge they are standalone. A one-time backfill linked all pre-existing tasks to the current October challenge. This resolves the earlier Product Gate: challenge-scoped goals return as challenge-linked weekly tasks.
- **Soft Delete:** Tasks and categories are soft-deleted (`deletedAt`; category names are tombstoned so they can be re-used). Deleted-while-incomplete weekly tasks still count at lock, closing the delete-to-pass loophole.

### §5.3 Pre-Kickoff Declaration Lock `[P0]`

- **Invariant:** When the event status becomes `ACTIVE`, all participant target hours become permanently read-only. Late enrollments remain permitted while `ACTIVE`.

### §5.4 Host Target & Goal Administration `[P0]`

- **Purpose:** Accommodate real-life emergency adjustments.
- **Action:** Admins adjust participant targets via `AdminTargetOverrideModal` across the Manage, Leaderboard, and Participant Statistics tabs, with changes persisted and recorded in the audit trail (`FEAT-AUDIT-01`).

---

## 6. Module Specifications: Study Hour Ingestion & Logging

### §6.1 Daily Clock-Time Self-Logging (`HH:MM:SS`) `[P0]`

- **Route:** `/` (Home Cockpit, replacing the legacy `/dashboard` route)
- **Input Fields:** Modal with relative challenge day selector ("Today" vs "Yesterday") with server-side UTC date resolution + three numeric inputs: `Hours`, `Minutes`, `Seconds`. Pre-fills existing log values when updating.
- **Display Representation:** Stored as total integer seconds, rendered formatted as `HH:MM:SS` (matching YPT display).

### §6.2 24-Hour Single-Day Limit Validation `[P0]`

- **Rule:** Total study time logged for any single participant on any single calendar date cannot exceed $86,400\text{ seconds}$ ($24\text{ hours}$).

### §6.3 Direct YPT API Bot Ingestion Endpoint `[P1]`

- **Route:** `POST /api/v1/ingest/ypt`
- **Authentication:** Pre-shared Bearer API Token between teammate's YPT bot and web server.
- **Payload:** `{ discordId, date, durationSeconds, yptSubject }`.
- **Behavior:** Automatically upserts `DailyStudyLog` records and recalculates standings without human effort.

### §6.4 Admin Inline Hours Override Grid `[P0]`

- **Location:** Manage, Leaderboard, and Overview tabs (`/challenge/:id`)
- **Capability:** Full administrative hours adjustments supported via `AdminHoursOverrideModal`. Admins adjust participant study logs for any challenge day with second-level integer duration precision, recording `isOverride = true`, `overrideById = adminUserId`, and an immutable audit reason (`FEAT-AUDIT-01`).

### §6.5 Challenge Participant Leave Budget & Quota Enforcement `[P0]`

- **Feature ID:** `FEAT-LOG-05`
- **Enrollment Planned Leaves:** Participants declare their planned rest/leave days budget (`plannedLeaveDays` $\ge 0$) upon challenge enrollment.
- **Daily Leave Logging:** When logging for a day, participants can mark `isLeave = true` via `DailyHoursModal`.
- **Transactional Quota Enforcement:** If a participant attempts to log a new leave day when `usedLeaveDays >= plannedLeaveDays`, the system strictly throws and surfaces the exact error: `"Maximum leaves taken for the challenge"`.
- **Idempotency & Reversibility:** Updating notes or re-saving an already marked leave day is idempotent without incrementing the quota counter. Unmarking a leave day (`isLeave = false`) automatically decrements `usedLeaveDays` (bounded by 0).
- **Cockpit UI Counter:** The study modal displays live leave budget progress: `🌴 Leaves: {usedLeaveDays}/{plannedLeaveDays}`, visually disallowing leave toggles when quota is exhausted.

---

## 7. Module Specifications: Standings, Scoreboard & Calculations

### §7.1 Head-to-Head Live Match Scoreboard `[P0]`

- **Layout:** High-contrast top banner displaying dynamic team identities (e.g. _Honey Bees vs Lavender Butterflies_, _Owls vs Larks_, or top contending Duo pairs in Duos mode).
- **Metrics:** Total cumulative time (`HH:MM:SS`), leader crown icon, split progress share percentage bar, and lead margin delta (`+Xh Ym Zs ahead`).

### §7.2 Unified Roster Standings Table `[P0]`

- **Columns:** Rank, Participant (Avatar + Discord Handle), Team Tag, Total Logged (`HH:MM:SS`), Today's Logged (`HH:MM:SS`), Target (`HH:MM:SS`), % Completed, Status Badge (`On Track` / `At Risk`).
- **Responsive Layout:** Automatically renders a multi-column table on desktop ($\ge 640\text{px}$) and converts into high-density stacked cards on mobile ($<640\text{px}$).

### §7.3 Dynamic Daily Catch-Up Deficit Engine `[P0]`

- **Formula:**
  $$\text{Deficit} = \max(0, \text{Target Seconds} - \text{Logged Seconds})$$
  $$\text{Required Pace / Day} = \frac{\text{Deficit}}{\text{Days Remaining}}$$
- **UI Feedback:** Displays dynamic encouragement on Cockpit and leaderboard: _"Need 3h 45m/day over next 2 days to pass target."_

### §7.4 Overflow Diminishing Returns Scoring Engine `[V1]`

- **Problem Solved:** Prevents single extreme outliers from breaking team competitive balance.
- **Dual-Credit Invariant:**
   1. **Personal Profile / Badges:** Always awards **100% full credit** for all logged hours.
   2. **Team Match Score:** Hours beyond daily target apply a half-weight damping factor ($\alpha = 0.5$):
      $$\text{If } L \le T_{\text{daily}}: \quad \text{TeamScore} = L$$
      $$\text{If } L > T_{\text{daily}}: \quad \text{TeamScore} = T_{\text{daily}} + 0.5 \times (L - T_{\text{daily}})$$

### §7.5 Host Manual Weekly Hours Board `[REMOVED]`

- **Feature ID:** `FEAT-LEAD-05`
- **Route:** ~`/challenge/:id/manual`~ (Deprecated & Removed)
- **Status:** Removed in favor of the canonical **Admin Hours Override Grid** (`FEAT-LOG-04` / `AdminHoursOverrideModal`), which directly adjusts second-level integer duration precision (`DailyStudyLog`) with audit trail logging, fully enforcing **Law L8** and eliminating legacy `Decimal(6,2)` tables.

### §7.6 Challenge-Specific Participant Statistics & Read-Only Profiles `[P0]`

- **Feature ID:** `FEAT-LEAD-06`
- **Route:** `/challenge/:id/participant/:participantId`
- **Description:** Dedicated, challenge-scoped statistics cockpit providing deep visibility into an enrolled scholar's study progress:
   - **Identity Header:** Avatar, display name, `@username`, house badge, challenge-scoped rank, and pace badge.
   - **Summary Metrics:** Total study duration (`HH:MM:SS`), today's study duration, declared target, goal completion percentage, current leaderboard rank, remaining duration or excess duration.
   - **Daily Study History:** Full chronological timeline with one row per challenge day (Day 1..Day N), preserving zero-study rest days, second-level duration precision, cumulative durations, and subtle indicators for host/admin manual overrides.
   - **Progress Visualization:** Lightweight, accessible daily study bar chart.
   - **Team Metrics:** For team-based challenges, displays team rank, total house study hours, and participant contribution share percentage.
   - **Accountability Status:** Live deficit calculations, required daily catch-up pace, and pardon/forfeit statuses.
   - **Security & Read-Only Access:** Strictly read-only for participants and public spectators; zero form inputs or mutation actions; cross-challenge isolation enforced server-side.

---

## 8. Module Specifications: Accountability & Punishment

### §8.1 Three-Condition Auto-Flagging Engine `[P0]`

- **Trigger:** Evaluated automatically when the host locks final results (`resultsLockedAt` is set and the challenge becomes `COMPLETED`).
- **Rule:** A participant is **saved only if ALL three hold**:
   1. **Challenge-linked weekly tasks** — every `Task` linked to this challenge with `taskType = "WEEKLY"` has `status = "COMPLETED"`. Soft-deleted rows are still counted (a task deleted while incomplete counts as incomplete); an empty board is vacuously complete.
   2. **Weekly goal met** — `totalLoggedSeconds >= targetSeconds`.
   3. **Winning team** — no other team has strictly more combined hours. **Equal totals never punish**: every team at the maximum counts as a winner.

   Otherwise the participant is **punished regardless of team** — winning-team members can be punished for missed tasks/hours, and losing-team members are punished even with perfect personal stats.

- **Result:** Punished participants are assigned status `PUNISHED` and receive a `PunishmentRecord` row (row presence = punished; `evaluatedAt` stamped). Pardons are preserved via `isPardoned` / `pardonReason` / `pardonedById`; excused participants keep `EXCUSED`.
- **Ties & teamless:** ties (including all-equal and all-zero totals) never produce a losing side. Teamless participants fail the team condition (expected to disappear once Discord-role-based team detection ships).
- **Rollback:** a mistaken lock is recoverable — the Manage tab shows a **10-second Undo** prompt right after locking, and the local-only ops script `npm run db:unlock-results` performs the same full revert (statuses → `NORMAL`, all punishment records removed, wrapped flags reset, pre-lock `endAt` restored from the lock audit). Every rollback appends a `CHALLENGE_UNLOCKED` audit event.

### §8.2 Punishment Wall & Deficit Roster `[P0]`

- **Display:** Public overview section showing flagged members. Before the host locks results it previews live deficit catch-up members; after lock it reflects the final `PUNISHED` / `EXCUSED` records. UI component scheduled for restoration in the Overview tab.

### §8.3 Direct Punishment PFP Asset Download `[P0]`

- **Action:** Prominent **"Download Forfeit PFP"** button. Live in the Overview tab (`/challenge/:id`) inside the Assigned Forfeit Picture section, allowing scholars and spectators to directly download the forfeit avatar image stored in Supabase Storage (`punishment-pfps`).

### §8.4 Host Pardon / Excuse Override `[P0]`

- **Action:** Admin pardon capability (`adminPardonAction`) marking `isPardoned = true` and setting status `EXCUSED` with an audit reason. UI scheduled for restoration in the Manage tab.

### §8.5 Hall of Accountability Historical Archive `[V1]`

- **Description:** Permanent record tracking total punishments incurred, target completion rate, and redemption history across past challenges.

### §8.6 Challenge Wrapped (Story Popup & Summary Tab) `[P0]`

- **Availability:** Once the host locks results, a `Summary` tab (`?tab=summary`) appears alongside Overview and Leaderboard for everyone (spectators get the challenge-level story; enrolled participants also get their personal block). An auto-opening story popup targets enrolled participants.
- **Popup Lifecycle:** The popup reopens on each visit until the wrapped has been seen AND feedback has been filled, capped at **3 days after lock** (`WRAPPED_POPUP_WINDOW_DAYS = 3`): if `isWrappedSeen` is still false after 3 days, a page-load check auto-sets it (`markWrappedSeenIfExpiredAction`). `isWrappedSeen` flips when the viewer reaches the feedback slide; both flags are mirrored to `localStorage` (`hmt:wrapped:{challengeId}`) with the local value taking precedence.
- **Feedback flow:** deferred — the feedback slide's button ships empty and `isFeedbackFilled` stays false until the feedback collection flow lands.
- **Presentation (2026-10-11):** the popup is a 1:1 port of the `holdmetoit Wrapped.html` reference — grayscale slide surfaces with the card `grayscale(100%)` filter, dot navigation, count-up stat, you-vs-average chart with crosshair tooltip, hold-to-reveal verdict stamp, swipe/keyboard navigation, and reduced-motion handling. Typography uses the app's Inter/Outfit (no extra font loads).

---

## 9. Module Specifications: Discord Broadcaster & Bot

### §9.1 1-Click Formatted Markdown Summary Copy `[P0]` (Removed)

- **Status:** Removed from scope and completely purged from codebase in Session 104. Superseded by the in-app Challenge Summary tab (`/challenge/:id?tab=summary`) and personal Wrapped story dialog. Standings and results are viewed directly in the application.

### §9.2 24/7 `@HoldMeToItBot` Slash Commands `[P1]`

- **Commands:**
   - `/stats [user]`: Shows daily logged time, weekly target progress, and goal status.
   - `/standings`: Returns live team scoreboard and podium rankings.
   - `/deficit`: Displays remaining hours and required daily catch-up pace.

### §9.3 Automated Daily & Final Results Embeds `[P1]`

- **Daily Check-in:** Bot posts a 12:00 PM mid-day standings embed to `#study-announcements`.
- **Final Broadcast:** Bot automatically posts the final winner/punishment embed when the countdown timer expires.

---

## 10. Module Specifications: Gamification, Streaks & Badges

### §10.1 Daily Challenge Streaks `[V1]`

- **Rule:** Daily streak increments by 1 if a participant logs $\ge 100\%$ of their required daily target ($T_{\text{weekly}} / 7$). Resets if a challenge day ends with 0 hours.

### §10.2 Condition-Based Achievement Badges `[V1]`

| Badge Name           | Icon | Trigger Condition                                                            |
| :------------------- | :--: | :--------------------------------------------------------------------------- |
| **Centurion**        |  🏛️  | Log $\ge 100\text{ hours}$ of verified study time across challenges.         |
| **Night Owl**        |  🦉  | Log $\ge 30\text{ hours}$ between 10:00 PM and 4:00 AM.                      |
| **Flawless Grinder** |  🎯  | Complete $100\%$ of target hours AND $100\%$ of weekly goals in a challenge. |
| **Comeback Kid**     |  ⚡  | Overcome a $>5\text{-hour}$ deficit in the final 48 hours to meet target.    |
| **Veteran**          |  ⚔️  | Participate in 5 completed community challenge events.                       |

### §10.3 Member Profile Cockpit (`/profile/[id]`) `[V1]`

- **Route:** `/profile/[id]`
- **Content:** Total lifetime hours, W/L record in team battles, current daily streak, badge showcase, and Hall of Accountability record.

---

## 11. Module Specifications: Peer-to-Peer Real-Time Features

### §11.1 Spontaneous 1v1 Mutual Study Sprint Duels `[V2]`

- **Workflow:**
   1. Member A initiates: `/duel @user duration:2h`.
   2. Member B accepts via Discord button or web notification.
   3. A temporary head-to-head sprint room is created with live countdown.
   4. Winner declared automatically when the duration expires.
   5. **Zero Admin Friction:** No moderator creation, review, or approval needed.

---

## 12. Module Specifications: Categorized Tasks & Offline Sync `[P0]`

### §12.1 Offline-First IndexedDB Persistence & Background Sync (`FEAT-TASK-01`)

- **Storage Engine:** Browser-safe IndexedDB (`holdmetoit_db`, version 1) managing object stores `tasks`, `categories`, and `queued_mutations`.
- **Zero UI Latency:** Toggle, create, edit, delete, and reorder mutations execute instantly (0ms) against local IndexedDB without waiting for server response.
- **Silent Background Sync:** Listens to `window.online` and `document.visibilitychange` events to drain `queued_mutations` via `POST /api/tasks/sync`. Transactions process atomically on PostgreSQL with FIFO execution and queue compaction.
- **Guest-to-User Migration:** Unauthenticated guest tasks stored locally in IndexedDB are automatically migrated and bound to the authenticated user ID upon Discord OAuth sign-in (`migrateGuestDataToUser`).
- **Challenge Linkage & Soft Delete:** New tasks are stamped with the user's current challenge by default (`resolveTaskChallengeId`) and stay standalone when no challenge is ongoing; deletion is a soft delete (`deletedAt`, tombstoned category names) so the lock evaluation can still account for deleted-while-incomplete weekly tasks.

### §12.2 Drag-and-Drop Task & Category Reordering (`FEAT-TASK-02`)

- **Interaction Engine:** HTML5 Drag and Drop with full-card translucent drag preview (`setDragImage`) and elevated floating drop cues.
- **Reordering Math:** Pure domain functions (`reorderArray`, `moveTaskBetweenCategories`, `moveCategoryBetweenColumns`) in `features/tasks/domain/task-reorder.ts` maintaining integer `sortOrder`.
- **Cross-Column Safety:** Automatic name disambiguation (`(Moved)`) prevents `P2002` unique constraint violations when moving categories between Daily and Weekly boards.

---

## 13. Module Specifications: In-App Feedback & Observability `[P1]`

### §13.1 In-App Feedback & Discord Embed Dispatch (`FEAT-FEED-01`)

- **Trigger:** Floating feedback trigger button accessible across all screens.
- **Form:** Modal dialog with category toggle (Bug / Suggestion), title, description, and client-captured route URL.
- **Identifier:** Monotonically increasing sequential tracking codes (`FB-01`, `FB-02`, etc.) generated via `feedback-code.ts`.
- **Discord Bot Embeds:** REST API v10 dispatch to configured Discord channels (`DISCORD_FEEDBACK_CHANNEL_ID` / `DISCORD_FEEDBACK_BUG_CHANNEL_ID` / `DISCORD_FEEDBACK_SUGGESTIONS_CHANNEL_ID`) with color-coded embeds (Crimson for bugs, Purple for suggestions).
- **LogRocket Integration:** Hydrates client LogRocket session replay URL into feedback payload and Discord embed for instant debugging.
- **Media Attachments (Bug Reports Only):** Bug reports accept up to 3 images/videos. Allowed types are PNG/JPEG/WebP/GIF (max 5 MB) and MP4/WebM/MOV (max 50 MB). Files upload directly to Supabase Storage (`feedback-attachments/` in `SUPABASE_STORAGE_BUCKET`, public bucket) via short-lived signed upload URLs, then the server verifies existence, size, and magic bytes before linking. Paths are persisted on the new `FeedbackAttachment` model. Discord renders the first image inline and lists every attachment as a link. Removing/closing before submit cleans up unreferenced objects.
- **GitHub Issue Sync (Bugs & Suggestions):** When `GITHUB_TOKEN` and `GITHUB_REPO` are configured, every submission also creates a GitHub issue via the REST API using a repo-scoped fine-grained PAT. Issues are labelled `bug` / `enhancement`, include the page, reporter, LogRocket link, description, and attachment links (images render inline), and carry a hidden `holdmetoit-feedback:FB-N` marker. Delivery is fail-soft and recorded as `CREATED` / `FAILED` / `SKIPPED` on the `Feedback` row; a missing label triggers one retry without labels.
- **Jira Issue Sync (Bugs & Suggestions):** When `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, and `JIRA_PROJECT_KEY` are configured, every submission also creates a Jira Cloud issue via REST v3 using Basic auth. Bugs map to the `Task` issue type and suggestions to `Story`; descriptions are Atlassian Document Format with the page, reporter, LogRocket link, description text, attachment links, and the `holdmetoit-feedback:FB-N` marker. Delivery is fail-soft (`CREATED` / `FAILED` / `SKIPPED`) and never blocks the feedback response.

---

## 14. Deliberately Excluded / Rejected Features

The following features were evaluated and deliberately excluded based on user feedback:

- ❌ **Native In-Browser Study Timer (Pomodoro/Stopwatch):** Excluded because members study on diverse mobile devices where YPT is preferred.
- ❌ **In-App Virtual Study Rooms:** Excluded because community members already study inside Discord voice/video channels.
- ❌ **Automated Discord Role Assignments (Roles for Winners/Losers):** Excluded for now to avoid server role clutter.
- ❌ **Grace Passes / Freeze Days:** Excluded in favor of the pure cumulative catch-up deficit model.
