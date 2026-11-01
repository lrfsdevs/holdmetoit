# Participant Sick Mode (Under the Weather Status)

> **Feature Scope:** Informational health setback indicator, 3-day recovery reminder prompt, 7-day auto-expiry safeguard, and cross-platform badge visibility  
> **Surfaces:** Home Cockpit (`/`), Global Profile (`/profile`, `/profile/:userId`), Challenge Leaderboard (`/challenge/:id?tab=leaderboard`), Head-to-Head Matchup Rosters (`/challenge/:id`), Admin Directory (`/admin/users`)  
> **Governance:** Law L3 (Zero Grace Passes / Pure Deficits), Law L5 (Admin Override Absolute), Law L6 (Three-Condition Accountability), Law L7 (Pure Domain Isolation), Law L9 (Zero-State & Error Resilience)  
> **GitHub Issue:** #205 · **Jira Key:** KAN-66

---

## 1. Executive Summary & Product Intent

Participants engaged in rigorous study battles occasionally face acute medical setbacks (e.g. flu, migraines, fever, unexpected injuries). Previously, when a student fell ill, their daily study logging halted abruptly without context, causing rapid catch-up deficit accumulation and leaving teammates in Duo and Squad battles wondering whether their partner had slacked off, abandoned the team, or vanished.

**Sick Mode** introduces an empathetic social status indicator across HoldMeToIt:

1. **Quick Toggle on Cockpit & Profile:** Students can activate or deactivate Sick Mode with a single click and an optional note (up to 80 characters, e.g. _"Flu & high fever, resting"_).
2. **Empathetic Obsidian Status Badge:** Renders an amber pill (`bg-amber-500/15 text-amber-300 border border-amber-500/30`) with icon `🤒` across leaderboards, mobile cards, team matchup cards, profiles, and administrative rosters. Hovering or tapping displays a detailed tooltip with duration and status note.
3. **3-Day Check-in Reminder (72h):** After 72 hours, a non-blocking prompt appears on `/` asking if the participant is feeling better, offering 1-click deactivation or a 48-hour snooze (_"Still Recovering (+2 Days)"_).
4. **7-Day Auto-Expiry Safeguard (168h):** To prevent abandoned stale badges, Sick Mode automatically deactivates after 7 consecutive days if unconfirmed.

---

## 2. Non-Negotiable Stack Law Invariants

### 2.1 Law L3 (The Catch-Up Deficit Model / Zero Grace Passes)

> **Invariant:** Sick Mode is strictly an **informational and social indicator**. It **DOES NOT** pause timers, freeze deficit accrual, grant grace passes, or reduce required study hours.

Remaining deficit and required daily pace calculations in `features/leaderboard/domain/deficit.ts` (`calculateRemainingDeficit`, `calculateRequiredDailyPace`) remain 100% pure and completely unaffected by a user's illness status.

### 2.2 Law L6 (Three-Condition Accountability Invariant)

> **Invariant:** Activating Sick Mode does NOT grant automated immunity from results-lock consequences or punishments.

At event conclusion (host lock), the Three-Condition Invariant still applies unconditionally:

1. Every challenge-linked weekly task completed.
2. Declared target hours met.
3. Team is a winning team.

### 2.3 Law L5 (Admin Override Absolute)

> **Invariant:** Hosts retain full visibility of participant Sick Mode history in `/admin/users` and the challenge Manage tab.

Under FEAT-PUN-04 (Host Pardon), event hosts can review medical emergencies with audit trails and issue an administrative pardon if warranted.

---

## 3. Architecture & Vertical Slice Structure

```
apps/web/
├── features/participant-status/
│   ├── domain/
│   │   ├── sick-mode.types.ts                 # Types: SickModeDuration, SickStatusSummary, SickStatusBadgeProps
│   │   ├── sick-mode.ts                       # Pure domain: sanitization, duration math, reminder & auto-expiry checks
│   │   └── sick-mode.test.ts                  # Vitest suite (19 tests) covering pure math & law preservation
│   ├── data/
│   │   ├── sick-mode.repository.ts            # getUserSickStatus, activateSickMode, deactivateSickMode, snoozeSickReminder
│   │   └── sick-mode.repository.test.ts       # Vitest suite (6 tests) verifying DB queries & auto-expiry updates
│   ├── api/
│   │   ├── sick-mode.actions.ts               # Server actions: toggleSickModeAction, respondSickReminderAction
│   │   └── sick-mode.actions.test.ts          # Vitest suite (8 tests) verifying auth gating & input validation
│   └── presentation/
│       ├── sick-status-badge.tsx              # Empathetic soft amber pill with accessible Radix Tooltip
│       ├── sick-status-badge.test.tsx         # Presentation tests for badge rendering & variants
│       ├── sick-mode-quick-toggle.tsx         # Cockpit header chip with dialog modal & optimistic Sonner feedback
│       ├── sick-mode-quick-toggle.test.tsx    # Presentation tests for toggle & modal interactions
│       ├── sick-reminder-banner.tsx           # Non-blocking 3-day check-in prompt with 1-click turn-off / extend
│       ├── sick-reminder-banner.test.tsx      # Presentation tests for check-in banner & transitions
│       ├── sick-mode-settings-card.tsx        # Profile Settings card under Participant Preferences
│       └── index.ts                           # Barrel exports
```

---

## 4. Database Schema Migration

Added to `packages/database/prisma/schema.prisma` under the `User` model:

```prisma
model User {
  ...
  // Sick Mode / Under the Weather status (FEAT-PART-SICK / #205)
  isSick                       Boolean   @default(false)
  sickModeActivatedAt          DateTime?
  sickModeNote                 String?   @db.VarChar(120)
  sickModeReminderSnoozedUntil DateTime?
  sickModeLastDeactivatedAt    DateTime?
  ...
}
```

**Migration:** `packages/database/prisma/migrations/20261101000000_add_user_sick_mode/migration.sql`

---

## 5. Pure Domain Business Logic

- **Note Sanitizer (`sanitizeSickModeNote`):** Strips tabs, consecutive newlines, and collapses whitespace into single spaces; enforces $\le 80$ characters.
- **Elapsed Duration (`calculateSickDuration`):** Returns elapsed hours, elapsed days, and human-friendly string (`"< 1 day ago"`, `"1 day ago"`, `"[X] days ago"`).
- **Auto-Expiry Safeguard (`isSickModeAutoExpired`):** Evaluates if $\text{elapsedHours} \ge 168\text{ h}$ (7 consecutive days).
- **3-Day Check-in Prompt (`isSickReminderDue`):** Returns true if active, not auto-expired, $\text{elapsedHours} \ge 72\text{ h}$, and not currently snoozed.
- **Empathetic Tooltip (`getSickModeTooltipText`):**
   > _"Active since Oct 28 (3 days ago). This participant is resting; study logs and weekly task progress may be delayed.\nNote: \"Flu & high fever\""_

---

## 6. Verification & Quality Gates

| Quality Gate                 | Status        | Details                                                          |
| :--------------------------- | :------------ | :--------------------------------------------------------------- |
| **Prisma Migration**         | ✅ Deployed   | Applied `20261101000000_add_user_sick_mode` to database          |
| **TypeScript Typecheck**     | ✅ 0 Errors   | `npm run typecheck:web` (`tsc --noEmit` exits with 0)            |
| **Unit & Integration Tests** | ✅ 100% Green | 36 test cases passing across domain, data, api, and presentation |
| **Law L3 & L6 Compliance**   | ✅ Preserved  | Deficit formulas and Three-Condition locks untouched             |
| **Mobile Responsiveness**    | ✅ Verified   | Layouts scale cleanly down to 360px viewport                     |
