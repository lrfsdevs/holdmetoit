import { describe, expect, it } from "vitest";
import {
   calculateStudyReward,
   InvalidDurationError,
   InvalidProgressError,
} from "./reward-calculation";
import { SECONDS_PER_COIN } from "./economy-constants";

describe("reward-calculation domain math", () => {
   it("1. awards exactly 100 coins for 3,600 eligible seconds (1 hour)", () => {
      const result = calculateStudyReward({ eligibleSeconds: 3600 });
      expect(result.coinsCredited).toBe(100);
      expect(result.fractionalSecondsConsumed).toBe(3600);
      expect(result.fractionalSecondsRemaining).toBe(0);
   });

   it("2. awards exactly 50 coins for 1,800 eligible seconds (30 minutes)", () => {
      const result = calculateStudyReward({ eligibleSeconds: 1800 });
      expect(result.coinsCredited).toBe(50);
      expect(result.fractionalSecondsConsumed).toBe(1800);
      expect(result.fractionalSecondsRemaining).toBe(0);
   });

   it("3. awards exactly 25 coins for 900 eligible seconds (15 minutes)", () => {
      const result = calculateStudyReward({ eligibleSeconds: 900 });
      expect(result.coinsCredited).toBe(25);
      expect(result.fractionalSecondsConsumed).toBe(900);
      expect(result.fractionalSecondsRemaining).toBe(0);
   });

   it("4. awards exactly 1 coin for 36 eligible seconds", () => {
      const result = calculateStudyReward({ eligibleSeconds: 36 });
      expect(result.coinsCredited).toBe(1);
      expect(result.fractionalSecondsConsumed).toBe(36);
      expect(result.fractionalSecondsRemaining).toBe(0);
   });

   it("5. awards 1 coin cumulatively for two separate 18-second sessions", () => {
      // First session: 18 seconds from initial 0 progress
      const session1 = calculateStudyReward({
         eligibleSeconds: 18,
         currentProgressSeconds: 0,
      });
      expect(session1.coinsCredited).toBe(0);
      expect(session1.fractionalSecondsConsumed).toBe(0);
      expect(session1.fractionalSecondsRemaining).toBe(18);

      // Second session: 18 seconds starting from 18 seconds progress
      const session2 = calculateStudyReward({
         eligibleSeconds: 18,
         currentProgressSeconds: session1.fractionalSecondsRemaining,
      });
      expect(session2.coinsCredited).toBe(1);
      expect(session2.fractionalSecondsConsumed).toBe(36);
      expect(session2.fractionalSecondsRemaining).toBe(0);

      expect(session1.coinsCredited + session2.coinsCredited).toBe(1);
   });

   it("6. guarantees multiple random sessions yield the exact same reward as their combined continuous duration", () => {
      const chunks = [10, 20, 5, 1, 100, 37, 45, 18, 900, 1234];
      const totalDuration = chunks.reduce((sum, c) => sum + c, 0);

      // Continuous calculation
      const continuous = calculateStudyReward({
         eligibleSeconds: totalDuration,
      });

      // Step-by-step incremental calculation
      let currentProgress = 0;
      let totalCoinsAwarded = 0;

      for (const chunk of chunks) {
         const res = calculateStudyReward({
            eligibleSeconds: chunk,
            currentProgressSeconds: currentProgress,
         });
         totalCoinsAwarded += res.coinsCredited;
         currentProgress = res.fractionalSecondsRemaining;
      }

      expect(totalCoinsAwarded).toBe(continuous.coinsCredited);
      expect(currentProgress).toBe(continuous.fractionalSecondsRemaining);
   });

   it("7. handles very long sessions without precision loss", () => {
      // 100 hours = 360,000 seconds -> 10,000 coins
      const result = calculateStudyReward({ eligibleSeconds: 360_000 });
      expect(result.coinsCredited).toBe(10_000);
      expect(result.fractionalSecondsRemaining).toBe(0);
   });

   it("8. handles zero duration gracefully (0 coins, progress unchanged)", () => {
      const result = calculateStudyReward({
         eligibleSeconds: 0,
         currentProgressSeconds: 20,
      });
      expect(result.coinsCredited).toBe(0);
      expect(result.fractionalSecondsConsumed).toBe(0);
      expect(result.fractionalSecondsRemaining).toBe(20);
      expect(result.totalSecondsEvaluated).toBe(20);
   });

   it("9. rejects negative durations with InvalidDurationError", () => {
      expect(() => calculateStudyReward({ eligibleSeconds: -1 })).toThrow(
         InvalidDurationError
      );
      expect(() => calculateStudyReward({ eligibleSeconds: -3600 })).toThrow(
         InvalidDurationError
      );
   });

   it("10. rejects invalid durations (NaN, floating point, non-integers)", () => {
      expect(() => calculateStudyReward({ eligibleSeconds: NaN })).toThrow(
         InvalidDurationError
      );
      expect(() => calculateStudyReward({ eligibleSeconds: 36.5 })).toThrow(
         InvalidDurationError
      );
      expect(() => calculateStudyReward({ eligibleSeconds: Infinity })).toThrow(
         InvalidDurationError
      );
   });

   it("11. remains safe with large durations within Number.MAX_SAFE_INTEGER", () => {
      const largeSeconds = 100_000_000; // ~1157 days
      const result = calculateStudyReward({ eligibleSeconds: largeSeconds });
      expect(Number.isSafeInteger(result.coinsCredited)).toBe(true);
      expect(result.coinsCredited).toBe(
         Math.floor(largeSeconds / SECONDS_PER_COIN)
      );
      expect(result.fractionalSecondsRemaining).toBe(
         largeSeconds % SECONDS_PER_COIN
      );
   });

   it("12. persists fractional progress correctly across sessions", () => {
      // Session 1: 30s -> 0 coins, 30s remaining
      const step1 = calculateStudyReward({ eligibleSeconds: 30 });
      expect(step1.coinsCredited).toBe(0);
      expect(step1.fractionalSecondsRemaining).toBe(30);

      // Session 2: 10s with 30s progress -> 40s total -> 1 coin (36s), 4s remaining
      const step2 = calculateStudyReward({
         eligibleSeconds: 10,
         currentProgressSeconds: step1.fractionalSecondsRemaining,
      });
      expect(step2.coinsCredited).toBe(1);
      expect(step2.fractionalSecondsRemaining).toBe(4);

      // Session 3: 32s with 4s progress -> 36s total -> 1 coin (36s), 0s remaining
      const step3 = calculateStudyReward({
         eligibleSeconds: 32,
         currentProgressSeconds: step2.fractionalSecondsRemaining,
      });
      expect(step3.coinsCredited).toBe(1);
      expect(step3.fractionalSecondsRemaining).toBe(0);

      expect(
         step1.coinsCredited + step2.coinsCredited + step3.coinsCredited
      ).toBe(2);
   });

   it("rejects invalid currentProgressSeconds (> 35 or < 0)", () => {
      expect(() =>
         calculateStudyReward({
            eligibleSeconds: 100,
            currentProgressSeconds: 36,
         })
      ).toThrow(InvalidProgressError);
      expect(() =>
         calculateStudyReward({
            eligibleSeconds: 100,
            currentProgressSeconds: -1,
         })
      ).toThrow(InvalidProgressError);
   });
});
