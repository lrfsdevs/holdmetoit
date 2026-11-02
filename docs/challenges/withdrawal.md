# Participant Self-Withdrawal

## 1. Scope

Enrolled participants can withdraw themselves from a challenge from the Overview
tab. Withdrawal is a soft state: the `ChallengeParticipant` row and study logs
are preserved, but the participant is excluded from public/competitive surfaces.

- Feature flag: `challenge_withdrawal_v1` (seeded `DISABLED`).
- Button: red **Withdraw** below the Participants card, visible only while the
  current user is enrolled and results are not locked.
- Confirmation: `AlertDialog` (no reason field).
- Persistence: `isWithdrawn` + `withdrawalAt` on `ChallengeParticipant`, plus one
  `PARTICIPANT_WITHDRAWN` audit event.

## 2. Eligibility

| Challenge state                  | Self-withdrawal |
| :------------------------------- | :-------------- |
| `UPCOMING`                       | Allowed         |
| `ACTIVE`                         | Allowed         |
| `COMPLETED`                      | Blocked         |
| Any state with `resultsLockedAt` | Blocked         |
| Already withdrawn                | Blocked         |

Pure resolver: `features/challenges/domain/withdrawal.ts`
(`resolveWithdrawalEligibility`). The repository re-runs it server-side.

## 3. Persistence

`ChallengeParticipant`:

- `isWithdrawn Boolean @default(false)`
- `withdrawalAt DateTime?`

Migration: `packages/database/prisma/migrations/20261026000000_add_participant_withdrawal`.

No separate withdrawal model is used.

## 4. Action usage

```ts
import { withdrawFromChallengeAction } from "@/features/challenges/api/withdraw-participant.actions";

const result = await withdrawFromChallengeAction({ challengeId });
// { ok: true } | { ok: false, code, message }
```

The action checks the feature flag first, requires a session, delegates to
`withdrawParticipant`, invalidates scoreboard/cockpit caches, revalidates the
challenge/challenges/admin/home paths, and logs `challenge.participant_withdrew`.

## 5. Data Exclusion & Frozen Historical Hours (GH-#210)

Withdrawn participants are excluded from:

- Individual public standings and podium rankings
- Active companion counts on team rosters
- Post-lock punishment records and reward/trophy distributions
- Future study logging (study logs after `withdrawalAt` are rejected)
- Wrapped lookup and challenge-linked active goal requirements

`currentUser.isEnrolled` becomes false and `currentUser.hasWithdrawn` becomes
true, so the overview hides the button and the hero shows a withdrawn state.
Admin `findAdminChallengeDetails` remains unfiltered; the event is visible in the
Event Audit `ROSTER` tab.

### 5.1 Frozen Historical Study Hours Preservation

Per GH-#210, a participant's departure mid-event must not unfairly penalize their remaining teammates in team/duo battles:

- All study hours logged prior to or at `withdrawalAt` are **frozen and permanently credited** to their team's cumulative score (`aggregateTeamScores`).
- When the host locks challenge results (`lockChallengeResults`), winning team determination includes frozen study logs from withdrawn participants.
- Withdrawn participants are exempt from individual punishments (`PunishmentRecord`), even if their team loses or targets were unmet.
- Historical study breakdown cards (`ChallengeSnapshot`) display a `Withdrawn (Hours Frozen)` badge for transparency.

## 6. Admin removal (soft)

The Manage tab’s **Remove Participant** flow now uses the same soft-withdrawal
state instead of deleting rows:

- Requires admin access, a reason (min 3 chars), and `challenge_withdrawal_v1`.
- Sets `isWithdrawn` + `withdrawalAt` on the participant.
- Preserves the participant row, `DailyStudyLog` rows, and `PunishmentRecord`
  rows for a future restore.
- Writes a distinct `PARTICIPANT_REMOVED` audit event with the admin as actor and
  the host’s reason.
- Blocks when the challenge is completed/results-locked or the participant is
  already withdrawn.
- Re-enrollment reactivates the same row (see below).

Because the flag is seeded `DISABLED`, admin removal is unavailable until
`challenge_withdrawal_v1` is enabled.

---

## 7. Re-enrollment

Withdrawn participants are shown as **not enrolled** (the overview hides the
withdraw button and the hero shows the normal Enroll CTA). Re-enrollment uses the
normal enrollment flow and reactivates the existing row:

- `isWithdrawn = false`, `withdrawalAt = null`
- new `teamId`, `targetSeconds`, and `plannedLeaveDays`
- `usedLeaveDays = 0`, `status = NORMAL`, `enrolledAt = now`
- writes a `PARTICIPANT_REENROLLED` audit event with the previous withdrawal
  state and the new enrollment values
