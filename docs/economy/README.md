# Virtual Economy System (Phase 1) — Architecture, Accounting & Developer Guide

> **Project:** HoldMeToIt  
> **Status:** Ratified Implementation Architecture (Phase 1 Foundation)  
> **Storage:** Supabase PostgreSQL (via Prisma ORM 6.x)  
> **Runtime:** Next.js 14+ App Router (Server-Authoritative Evaluation)  
> **Last Updated:** 2026-10-15

---

## 1. Executive Summary & Core Rules

HoldMeToIt Virtual Economy Phase 1 establishes an auditable, transaction-safe, double-entry-style virtual currency ledger integrated with the study-accountability platform.

### Core Economic Tenets

1. **Virtual-Only Currency:**
   - No real-money purchases, cash-outs, or fiat conversions.
   - Whole integer accounting only (no floating-point numbers).
   - Available balance cannot become negative: `availableBalance >= 0`.
2. **Proportional Base Study Reward:**
   - Configured base rate: **100 coins per 3,600 eligible study seconds** (1 coin per 36 seconds).
   - Fractional progress is preserved across short sessions.
   - Cumulative rewards across multiple short sessions match a continuous session of equivalent duration.
3. **Server-Authoritative Exactly-Once Processing:**
   - Client never dictates balances or reward amounts.
   - Each study session is rewarded exactly once, keyed by a persistent idempotency key (`study-log:<id>`).
4. **Dual Balance Model (Available vs Reserved):**
   - Available funds represent spendable coins.
   - Reserved funds represent coins locked for pending operations (e.g. future wagers and trading).
5. **Append-Only Immutable Ledger:**
   - Completed ledger rows are immutable.
   - Balances are derived and auditable. Any correction requires an explicit reversal or administrative adjustment entry.

---

## 2. Mathematical Model & Precision

### 2.1 The Proportional Reward Formula

$$\text{Rate} = \frac{100\text{ coins}}{3,600\text{ seconds}} = \frac{1\text{ coin}}{36\text{ seconds}}$$

Given a study log duration of $S$ seconds and previous unrewarded fractional progress $P_{\text{prev}} \in [0, 35]$ seconds:

$$\text{Total Seconds Evaluated} = P_{\text{prev}} + S$$

$$\text{Coins Credited} = \left\lfloor \frac{P_{\text{prev}} + S}{36} \right\rfloor$$

$$P_{\text{next}} = (P_{\text{prev}} + S) \pmod{36}$$

$$\text{Seconds Consumed} = \text{Coins Credited} \times 36$$

### 2.2 Proof of Fractional Progress Preservation

- **Session A:** 18 eligible seconds from $P = 0\text{s}$:
   - $\text{Total} = 18\text{s} \implies \text{Coins} = 0, P_{\text{next}} = 18\text{s}$.
- **Session B:** 18 eligible seconds from $P = 18\text{s}$:
   - $\text{Total} = 36\text{s} \implies \text{Coins} = 1, P_{\text{next}} = 0\text{s}$.
- Cumulative coins earned = $1\text{ coin}$, exactly matching a continuous 36-second session.

---

## 3. Database Schema & Invariants

### 3.1 Logical Entities

```text
┌─────────────────────────────────┐
│              User               │
└───────────────┬─────────────────┘
                │ 1:1
┌───────────────▼─────────────────┐       1:N       ┌───────────────────────────────┐
│             Wallet              ├────────────────►│       LedgerTransaction       │
│ - totalBalance                  │                 │ - totalDelta                  │
│ - reservedBalance               │                 │ - reservedDelta               │
│ - rewardProgressSeconds (0..35) │                 │ - idempotencyKey              │
│ - lifetimeEarned                │                 └───────────────────────────────┘
│ - lifetimeSpent                 │       1:N       ┌───────────────────────────────┐
└─────────────────────────────────┴────────────────►│       StudyRewardRecord       │
                                                    │ - studySessionId              │
                                                    │ - coinsCredited               │
                                                    │ - fractionalSecondsRemaining  │
                                                    └───────────────────────────────┘
```

### 3.2 Invariant Constraints

1. **Available Funds Non-Negative:**
   $$\text{availableBalance} = \text{totalBalance} - \text{reservedBalance} \ge 0$$
2. **Reserved Non-Negative:**
   $$\text{reservedBalance} \ge 0$$
3. **Total Bounds:**
   $$\text{totalBalance} \ge \text{reservedBalance}$$
4. **Fractional Progress Bound:**
   $$0 \le \text{rewardProgressSeconds} < 36$$
5. **Ledger Equality Invariant:**
   $$\text{wallet.totalBalance} = \sum \text{totalDelta}$$
   $$\text{wallet.reservedBalance} = \sum \text{reservedDelta}$$

---

## 4. Ledger Semantics & Accounting Table

| Transaction Type        | Total Balance Delta (`totalDelta`) | Reserved Delta (`reservedDelta`) | Available Balance Delta |    Lifetime Earned     | Lifetime Spent | Economic Semantic                                      |
| :---------------------- | :--------------------------------: | :------------------------------: | :---------------------: | :--------------------: | :------------: | :----------------------------------------------------- |
| **`STUDY_REWARD`**      |                $+A$                |               $0$                |          $+A$           |          $+A$          |      $0$       | Currency minting from eligible study time              |
| **`CHALLENGE_REWARD`**  |                $+A$                |               $0$                |          $+A$           |          $+A$          |      $0$       | Host challenge bonus prize                             |
| **`WAGER_RESERVATION`** |                $0$                 |               $+A$               |          $-A$           |          $0$           |      $0$       | Funds locked for pending wager; currency not destroyed |
| **`WAGER_REFUND`**      |                $0$                 |               $-A$               |          $+A$           |          $0$           |      $0$       | Wager cancelled/drawn; locked funds unlocked           |
| **`WAGER_SETTLEMENT`**  |                $-A$                |               $-A$               |           $0$           |          $0$           |      $+A$      | Wager resolved as loss; funds sink                     |
| **`GACHA_PURCHASE`**    |                $-A$                |               $0$                |          $-A$           |          $0$           |      $+A$      | Direct currency sink (future phases)                   |
| **`ADMIN_ADJUSTMENT`**  |              $\pm A$               |               $0$                |         $\pm A$         | $+A \text{ (if } > 0)$ |       $+       | A                                                      | \text{ (if } < 0)$ | Moderator correction with audit reason |
| **`REVERSAL`**          |      $-\Delta_{\text{orig}}$       |   $-\Delta_{\text{res, orig}}$   |        Inverted         |        Adjusted        |    Adjusted    | Compulsory inversion of prior transaction              |

---

## 5. Study Session Eligibility Policy

1. **Ownership Requirement:** The study record's `participant.userId` must match the target user.
2. **Non-Deleted Challenge:** Challenges flagged `isDeleted: true` do not grant rewards.
3. **Leave Day Isolation:** If `isLeave === true`, $0\text{ coins}$ are granted.
4. **Positive Duration:** Only logs with $\text{durationSeconds} > 0$ qualify.
5. **Exact-Once Idempotency:** The pair `(sourceType, studySessionId)` has a database unique constraint. Subsequent attempts return the existing reward record without granting duplicate coins.
6. **No Silent Historical Backfill:** Historical study logs created prior to Phase 1 launch are not automatically credited, preventing inflation.

---

## 6. Concurrency & Atomicity Guards

- **Serializable Transactions:** All wallet mutations execute under `Prisma.TransactionIsolationLevel.Serializable`.
- **Automatic Retry Loop:** Conflicts (`P2034`) automatically retry up to 3 times before failing.
- **Pre-Condition Checks:** The available balance check ($\text{available} \ge \text{amount}$) occurs inside the transaction boundary, preventing double-spending race conditions.
- **Atomic Compound Writes:** Wallet balance updates and `LedgerTransaction` insertions occur within the exact same database transaction.

---

## 7. Audit & Reconciliation Engine

The system provides an automated reconciliation tool (`reconcileWalletState`):

1. Sums all `totalDelta` and `reservedDelta` values in `LedgerTransaction`.
2. Validates that wallet `totalBalance` and `reservedBalance` match ledger sums.
3. Checks that every `StudyRewardRecord` with $\text{coinsCredited} > 0$ has a corresponding `STUDY_REWARD` ledger row.
4. Detects orphan records, negative balances, and duplicate reward attempts.
5. Accessible via UI at `/wallet` ("Audit & Reconcile") and via server action `reconcileWalletAction()`.

---

## 8. Verification & Test Commands

```bash
# 1. Run all economy domain and calculation tests
npx vitest run features/economy/domain/

# 2. Run service and server action tests
npx vitest run features/economy/api/

# 3. Run UI component tests
npx vitest run features/economy/presentation/

# 4. Run route tests
npx vitest run app/wallet/

# 5. Type safety check
npm run typecheck

# 6. Full test suite (all 100+ suites)
npm run test
```

---

## 9. Future Phase Deferrals

The following systems are intentionally deferred to future phases:

- Pokémon catalogue, collection, and rarity tiers.
- Gacha banners and pity counters.
- Wager settlement contracts and trading marketplaces.
- Competitive economy trophies.
