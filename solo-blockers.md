# Solo Challenge & Free-For-All Blocker Analysis

> **Target Event:** Solo Challenge (Free-For-All)  
> **Start Date:** Monday  
> **Analysis Date:** 2026-10-18  
> **Repository:** HoldMeToIt (`krish` branch)

---

## Executive Summary & Resolution Status

Before launching the Solo Free-For-All challenge on Monday, we identified **2 Critical Showstoppers** in the business logic and several UX branding gaps. In **Phase 2**, both critical showstoppers and the core branding issues were resolved and verified with 1,140 green unit tests and a successful production build.

### Status Tracker

| #   | Item                                                                 | Severity    | Status                    | Verification                                                                                   |
| --- | -------------------------------------------------------------------- | ----------- | ------------------------- | ---------------------------------------------------------------------------------------------- |
| 1   | Solo Auto-Punishment Math (Bypass losing team penalty for SOLOS)     | 🚨 Critical | ✅ **RESOLVED (Phase 2)** | Unit tested in `challenge-admin.repository.test.ts`                                            |
| 2   | Team Capacity Bottleneck (`maxMembers = 1` blocking solo enrollment) | 🚨 Critical | ✅ **RESOLVED (Phase 2)** | Unit tested in `participant.repository.test.ts`                                                |
| 3   | Missing Host Pardon UI (`FEAT-PUN-04`)                               | 🚨 Critical | ✅ **RESOLVED (Phase 3)** | Implemented `AdminPardonModal`, wired into Manage tab, tested in `admin-pardon-modal.test.tsx` |
| 4   | "Unassigned ⏳" Team Branding in Cockpit/Leaderboard/Profile         | ⚠️ Polish   | ✅ **RESOLVED (Phase 2)** | Shows "⚡ Solo Scholar" for SOLOS                                                              |
| 5   | Leaderboard Head-to-Head Banner on Solos                             | ⚠️ Polish   | ℹ️ Handled                | Auto-hides when < 2 teams; emphasizes podium                                                   |
| 6   | Missing Punishment Wall UI (`FEAT-PUN-02`)                           | ⚠️ Polish   | ⏸️ P0 Backlog             | Overview tab PFP download active                                                               |

---

## 🚨 Tier 1: Critical Showstoppers

### 1. Solo Auto-Punishment Math (`FEAT-PUN-01` / Law L6) — ✅ RESOLVED

- **Location:** `features/challenges/data/challenge-admin.repository.ts` (`lockChallengeResults`), `features/wrapped/domain/wrapped.ts`.
- **The Issue:**
   - In `SOLOS` format, participants compete individually. The original 3-condition rule required `isInWinningTeam` to be `true`.
   - Previously, all solo participants were flagged as `losing_team` and punished, even if they exceeded their target hours and completed all tasks.
- **Resolution Applied:**
   - Updated `lockChallengeResults` and `buildParticipantWrapped`: for `SOLOS` format, `isInWinningTeam` is automatically `true`.
   - Solo participants are now evaluated strictly on:
      1. **Declared Target Hours Met** (`totalLoggedSeconds >= targetSeconds`)
      2. **Challenge-Linked Weekly Tasks Completed** (`allWeeklyTasksComplete`)
   - Added test case in `features/challenges/data/challenge-admin.repository.test.ts`: verifies participants who meet targets are saved, while participants with deficits are punished.

---

### 2. Solo Challenge Wizard & Team Roster Architecture (`FEAT-CHAL-01`) — ✅ RESOLVED

- **Location:** `features/challenges/presentation/challenge-creator-wizard.tsx`, `features/challenges/data/challenge-admin.repository.ts`, `features/challenges/data/participant.repository.ts`.
- **The Issue:**
   - `createAdminChallenge` previously enforced `maxMembers = 1` for `SOLOS` teams, which caused any second participant joining a team to get rejected with `Team is full (max 1 member)`.
- **Resolution Applied:**
   - Changed `createAdminChallenge` to set `maxMembers = null` (uncapped) for `SOLOS` format.
   - Updated `enrollParticipantInChallenge`, `adminEnrollParticipant`, and `reassignParticipantTeam` to bypass the `maxMembers` restriction for `SOLOS` challenges.
   - Added test in `features/challenges/data/participant.repository.test.ts`: verifies unlimited participants can join teams in `SOLOS` format.

---

### 3. Host Pardon UI (`FEAT-PUN-04`) — ✅ RESOLVED

- **Location:** `features/accountability/presentation/admin-pardon-modal.tsx`, `features/challenges/presentation/challenge-manage-tab.tsx`, `features/accountability/api/admin-pardon.actions.ts`.
- **Resolution Applied:**
   - Created `AdminPardonModal` adhering strictly to Obsidian Dark tokens, loading/success/error feedback states, and accessibility standards.
   - Added "Pardon" button to the Participant Roster table in `ChallengeManageTab`.
   - Added cache tag invalidation (`cacheTags.challengeScoreboard`) on pardon action execution to ensure instant UI reactivity.
   - Dynamically imported server actions inside `startTransition` to decouple server/auth modules from client component imports.
   - Created unit tests in `features/accountability/presentation/admin-pardon-modal.test.tsx` (4 tests passing).

---

## ⚠️ Tier 2: High Priority Polish & UX Gaps

### 4. "Unassigned" Badge & Team Identity Display — ✅ RESOLVED

- **Locations Updated:**
   - `features/study-logs/data/cockpit-data.ts`: Defaults to `teamName: "Solo Scholar"`, `teamIcon: "⚡"`, `teamColor: "#3b82f6"` for `SOLOS`.
   - `features/leaderboard/data/leaderboard-data.ts`: Defaults standings rows to `teamName: "Solo Scholar"`, `teamIcon: "⚡"` for `SOLOS`.
   - `features/participant-stats/data/participant-stats.repository.ts`: Defaults profile to `teamName: "Solo Scholar"`, `teamIcon: "⚡"` for `SOLOS`.
   - `features/challenges/presentation/challenge-manage-tab.tsx`: Displays "Solo Scholars" in roster filters and team dropdowns.

---

### 5. Leaderboard Head-to-Head Banner on Solos — ℹ️ VERIFIED

- **Location:** `features/leaderboard/presentation/challenge-leaderboard-tab.tsx`.
- **Status:**
   - When `teams.length < 2` (or in a standard solo setup), the Head-to-Head "VS" card automatically collapses and hides.
   - The view emphasizes the **Top 3 Individual Podium** cards and the **Individual Standings Table**.

---

### 6. Missing Punishment Wall Component (`FEAT-PUN-02`) — ⏸️ P0 Backlog

- **Location:** `features/leaderboard/presentation/` (formerly `punishment-wall.tsx`).
- **Status:** Deleted during the Obsidian refactor; pending restoration.
- **Current Fallback:** The Punishment PFP download card is live and accessible on the Overview tab for flagged participants.

---

## 🔍 Tier 3: Operational Verification Checklist (Pre-Kickoff)

Before launching on Monday, verify these operational prerequisites:

1. **Supabase Storage Configuration:**
   - Verify `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured.
   - The challenge wizard requires uploading both an **Event Header Banner** and a **Punishment PFP** (up to 3MB each). Test uploading test images.
2. **Discord OAuth & Redirection:**
   - Verify `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, and `AUTH_SECRET` are set.
   - Verify Discord redirect URI matches your deployment domain.
3. **Database Migrations:**
   - Run `npx prisma migrate status` to ensure all migrations are applied to the active database.
4. **Kickoff Trigger:**
   - Creating the challenge sets status to `UPCOMING`.
   - Host must click **"Start Event Now"** in the Manage tab on Monday to transition status to `ACTIVE` and lock target hours.

---

## 📋 Phased Progress

- ✅ **Phase 1 (Complete):** Codebase audit and blocker identification (`solo-blockers.md`).
- ✅ **Phase 2 (Complete):**
   1. Patched `lockChallengeResults` and `buildParticipantWrapped` to eliminate losing-team penalty for `SOLOS` format.
   2. Fixed team capacity checks across `createAdminChallenge`, `enrollParticipantInChallenge`, `adminEnrollParticipant`, and `reassignParticipantTeam`.
   3. Replaced "Unassigned ⏳" with "⚡ Solo Scholar" across Cockpit, Leaderboard, Participant Stats, and Manage tab.
   4. Added regression tests in `challenge-admin.repository.test.ts` and `participant.repository.test.ts` (1,140/1,140 tests passing).
   5. Validated full production build (`npm run build` exits 0).
- ✅ **Phase 3 (Complete):**
   1. Implemented `AdminPardonModal` component (`FEAT-PUN-04`) with Obsidian Dark design tokens, accessible dialog attributes, and error/success feedback states.
   2. Added "Pardon" action button in `ChallengeManageTab` alongside hours override and target override.
   3. Invalidate `cacheTags.challengeScoreboard` in `adminPardonAction` for immediate UI sync.
   4. Created unit test suite in `features/accountability/presentation/admin-pardon-modal.test.tsx` (4 tests passing).
   5. Decoupled client modal imports from server-only auth dependencies via dynamic import.
   6. Verified 100% green test suite (1,144/1,144 tests passing across 106 test files) and production build.
- ⏳ **Phase 4 (Next):**
   1. End-to-end rehearsal and verification of the Solo Challenge lifecycle (Create Solo Challenge -> Enroll Participants -> Kickoff -> Daily Log -> Final Lock & Results).
