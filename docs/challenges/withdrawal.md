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

## 5. Data exclusion

Withdrawn participants are excluded from:

- Public standings/ranks and team totals/companion counts
- Challenge participant counts
- Participant statistics lookups
- YPT study-time ingest
- Wrapped lookup
- Weekly task/punishment, reward, and trophy evaluation at lock

`currentUser.isEnrolled` becomes false and `currentUser.hasWithdrawn` becomes
true, so the overview hides the button and the hero shows a withdrawn state.
Admin `findAdminChallengeDetails` remains unfiltered; the event is visible in the
Event Audit `ROSTER` tab.

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

The enrollment action is not gated by `challenge_withdrawal_v1`; the flag only
gates new withdrawals/removals.

## 8. Lifecycle

- The flag gates **new withdrawals only**. Existing withdrawn rows stay excluded
  if the flag is later disabled.
- Withdrawal/removal is reversible through re-enrollment while the challenge is
  not completed.
- To decommission: remove the button/action, then remove the filters and columns
  in a follow-up migration (keep the historical migration).
