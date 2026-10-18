import { describe, expect, it } from "vitest";
import {
   getRankForTrophies,
   calculateTrophyDelta,
   applyTrophyChange,
   detectRankChange,
   DEFAULT_TROPHY_CONFIG,
} from "./trophy-rank";

describe("Trophy Domain Math & Ranks", () => {
   describe("getRankForTrophies", () => {
      it("maps lower bounds correctly to Clash-of-Clans style roles", () => {
         expect(getRankForTrophies(0).role).toBe("Recruit");
         expect(getRankForTrophies(99).role).toBe("Recruit");
         expect(getRankForTrophies(100).role).toBe("Bronze");
         expect(getRankForTrophies(249).role).toBe("Bronze");
         expect(getRankForTrophies(250).role).toBe("Silver");
         expect(getRankForTrophies(499).role).toBe("Silver");
         expect(getRankForTrophies(500).role).toBe("Gold");
         expect(getRankForTrophies(749).role).toBe("Gold");
         expect(getRankForTrophies(750).role).toBe("Platinum");
         expect(getRankForTrophies(999).role).toBe("Platinum");
         expect(getRankForTrophies(1000).role).toBe("Diamond");
         expect(getRankForTrophies(1499).role).toBe("Diamond");
         expect(getRankForTrophies(1500).role).toBe("Master");
         expect(getRankForTrophies(1999).role).toBe("Master");
         expect(getRankForTrophies(2000).role).toBe("Grandmaster");
         expect(getRankForTrophies(2499).role).toBe("Grandmaster");
         expect(getRankForTrophies(2500).role).toBe("Champion");
         expect(getRankForTrophies(5000).role).toBe("Champion");
      });

      it("clamps negative trophies to 0 floor (Recruit)", () => {
         const result = getRankForTrophies(-50);
         expect(result.trophies).toBe(0);
         expect(result.role).toBe("Recruit");
      });

      it("calculates progress bar metrics accurately", () => {
         // Diamond: 1000 to 1500. At 1250, span = 500, current = 250 -> 50%
         const diamondMid = getRankForTrophies(1250);
         expect(diamondMid.role).toBe("Diamond");
         expect(diamondMid.nextRole).toBe("Master");
         expect(diamondMid.nextThreshold).toBe(1500);
         expect(diamondMid.trophiesToNext).toBe(250);
         expect(diamondMid.progressPercentage).toBe(50);
         expect(diamondMid.isMaxRank).toBe(false);

         // Champion: max rank
         const champion = getRankForTrophies(2800);
         expect(champion.role).toBe("Champion");
         expect(champion.nextRole).toBeNull();
         expect(champion.nextThreshold).toBeNull();
         expect(champion.trophiesToNext).toBe(0);
         expect(champion.progressPercentage).toBe(100);
         expect(champion.isMaxRank).toBe(true);
      });
   });

   describe("calculateTrophyDelta", () => {
      it("returns +25 for WIN and -15 for LOSS with default config", () => {
         expect(calculateTrophyDelta("WIN")).toBe(25);
         expect(calculateTrophyDelta("LOSS")).toBe(-15);
         expect(calculateTrophyDelta("DRAW")).toBe(0);
         expect(calculateTrophyDelta("CANCELLED")).toBe(0);
      });

      it("respects custom configuration", () => {
         expect(calculateTrophyDelta("WIN", { winBase: 40 })).toBe(40);
         expect(calculateTrophyDelta("LOSS", { lossBase: 20 })).toBe(-20);
      });
   });

   describe("applyTrophyChange (Floor enforcement)", () => {
      it("adds trophies properly on win", () => {
         const res = applyTrophyChange(100, 25);
         expect(res.previousBalance).toBe(100);
         expect(res.balanceAfter).toBe(125);
         expect(res.effectiveDelta).toBe(25);
      });

      it("deducts trophies properly on loss", () => {
         const res = applyTrophyChange(100, -15);
         expect(res.previousBalance).toBe(100);
         expect(res.balanceAfter).toBe(85);
         expect(res.effectiveDelta).toBe(-15);
      });

      it("enforces 0 floor: user has 8 trophies, loss = -15 -> new balance = 0", () => {
         const res = applyTrophyChange(8, -15);
         expect(res.previousBalance).toBe(8);
         expect(res.balanceAfter).toBe(0);
         expect(res.effectiveDelta).toBe(-8);
      });

      it("does not allow negative starting balances", () => {
         const res = applyTrophyChange(-10, -5);
         expect(res.previousBalance).toBe(0);
         expect(res.balanceAfter).toBe(0);
         expect(res.effectiveDelta).toBe(0);
      });
   });

   describe("detectRankChange", () => {
      it("detects promotion when crossing upward threshold", () => {
         const res = detectRankChange(990, 1015);
         expect(res.changed).toBe(true);
         expect(res.type).toBe("PROMOTED");
         expect(res.previousRole).toBe("Platinum");
         expect(res.newRole).toBe("Diamond");
      });

      it("detects demotion when falling below threshold", () => {
         const res = detectRankChange(1005, 990);
         expect(res.changed).toBe(true);
         expect(res.type).toBe("DEMOTED");
         expect(res.previousRole).toBe("Diamond");
         expect(res.newRole).toBe("Platinum");
      });

      it("detects no change within same tier", () => {
         const res = detectRankChange(1100, 1125);
         expect(res.changed).toBe(false);
         expect(res.type).toBe("NONE");
         expect(res.previousRole).toBe("Diamond");
         expect(res.newRole).toBe("Diamond");
      });
   });
});
