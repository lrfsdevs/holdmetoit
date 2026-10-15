import { describe, expect, it } from "vitest";
import {
   applyCredit,
   applyDebit,
   applyReservation,
   InsufficientFundsError,
   type WalletState,
} from "./wallet-accounting";
import { calculateStudyReward } from "./reward-calculation";

describe("concurrency and race condition simulation", () => {
   it("prevents double-spending when two concurrent operations attempt to spend more than available", async () => {
      // Simulate state in an ACID transactional engine
      let persistentState: WalletState = {
         totalBalance: 100,
         reservedBalance: 0,
         rewardProgressSeconds: 0,
         lifetimeEarned: 100,
         lifetimeSpent: 0,
      };

      const ledger: Array<{ id: string; amount: number; totalDelta: number }> =
         [];

      // Simulated atomic transactional worker with serializable isolation & balance lock
      async function spendOperation(txId: string, amount: number) {
         // Atomic compare-and-swap or row-level lock check
         const { nextState, totalDelta } = applyDebit(persistentState, amount);
         // Commit state mutation
         persistentState = nextState;
         ledger.push({ id: txId, amount: -amount, totalDelta });
         return { success: true, txId };
      }

      // Two simultaneous requests attempting to spend 80 coins each from a 100 coin wallet
      const results = await Promise.allSettled([
         spendOperation("req_1", 80),
         spendOperation("req_2", 80),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      // Exactly ONE request can succeed
      expect(fulfilled).toHaveLength(1);
      // Exactly ONE request must fail with InsufficientFundsError
      expect(rejected).toHaveLength(1);

      const failedError = (rejected[0] as PromiseRejectedResult).reason;
      expect(failedError).toBeInstanceOf(InsufficientFundsError);

      // Verify invariants: balance is 20, never negative
      expect(persistentState.totalBalance).toBe(20);
      expect(
         persistentState.totalBalance - persistentState.reservedBalance
      ).toBe(20);

      // Verify ledger has exactly 1 entry matching the successful request
      expect(ledger).toHaveLength(1);
      expect(ledger[0].totalDelta).toBe(-80);
   });

   it("prevents concurrent over-reservation of funds", async () => {
      let persistentState: WalletState = {
         totalBalance: 100,
         reservedBalance: 0,
         rewardProgressSeconds: 0,
         lifetimeEarned: 100,
         lifetimeSpent: 0,
      };

      async function reserveOperation(txId: string, amount: number) {
         const { nextState } = applyReservation(persistentState, amount);
         persistentState = nextState;
         return { success: true, txId };
      }

      // Two requests trying to reserve 60 coins concurrently from 100 available
      const results = await Promise.allSettled([
         reserveOperation("res_1", 60),
         reserveOperation("res_2", 60),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(persistentState.reservedBalance).toBe(60);
      expect(persistentState.totalBalance).toBe(100);
      // Available balance is 40, >= 0
      expect(
         persistentState.totalBalance - persistentState.reservedBalance
      ).toBe(40);
   });

   it("preserves exact fractional progress across interleaved concurrent sessions", () => {
      let currentProgress = 0;
      let totalEarned = 0;

      // Two concurrent sessions: 18s and 18s
      const s1 = calculateStudyReward({
         eligibleSeconds: 18,
         currentProgressSeconds: currentProgress,
      });
      currentProgress = s1.fractionalSecondsRemaining;
      totalEarned += s1.coinsCredited;

      const s2 = calculateStudyReward({
         eligibleSeconds: 18,
         currentProgressSeconds: currentProgress,
      });
      currentProgress = s2.fractionalSecondsRemaining;
      totalEarned += s2.coinsCredited;

      expect(totalEarned).toBe(1);
      expect(currentProgress).toBe(0);
   });

   it("processes two concurrent 18-second sessions against a wallet with 18s initial progress resulting in 54s, 1 coin, 18s remainder", async () => {
      // Wallet state starts with 18s of existing fractional progress
      let persistentWallet = {
         totalBalance: 0,
         rewardProgressSeconds: 18,
      };

      let version = 1;

      // Simulate ACID serializable transaction worker with retry on write conflict
      async function processStudyRewardTx(
         sessionId: string,
         durationSeconds: number
      ) {
         let maxAttempts = 3;
         for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
            // Read snapshot
            const localVersion = version;
            const currentWalletSnapshot = { ...persistentWallet };

            // Simulate minor parallel delay
            await new Promise((resolve) =>
               setTimeout(resolve, Math.random() * 5)
            );

            // Calculate reward
            const reward = calculateStudyReward({
               eligibleSeconds: durationSeconds,
               currentProgressSeconds:
                  currentWalletSnapshot.rewardProgressSeconds,
            });

            // Simulate serializable commit with optimistic/serialization conflict detection
            if (version !== localVersion) {
               // Serialization conflict (P2034) -> retry with fresh snapshot
               continue;
            }

            // Commit atomic update
            persistentWallet.totalBalance += reward.coinsCredited;
            persistentWallet.rewardProgressSeconds =
               reward.fractionalSecondsRemaining;
            version += 1;

            return {
               sessionId,
               coinsCredited: reward.coinsCredited,
               remainder: reward.fractionalSecondsRemaining,
            };
         }
         throw new Error("Serialization conflict exceeded max retries");
      }

      // Execute two distinct 18-second sessions concurrently
      const results = await Promise.all([
         processStudyRewardTx("session_1", 18),
         processStudyRewardTx("session_2", 18),
      ]);

      expect(results).toHaveLength(2);

      // Total earned: 1 coin (since 18 + 18 + 18 = 54s = 1 coin + 18s)
      expect(persistentWallet.totalBalance).toBe(1);
      // Remaining fractional progress: exactly 18s
      expect(persistentWallet.rewardProgressSeconds).toBe(18);

      const totalCoinsFromResults = results.reduce(
         (sum, r) => sum + r.coinsCredited,
         0
      );
      expect(totalCoinsFromResults).toBe(1);
   });
});
