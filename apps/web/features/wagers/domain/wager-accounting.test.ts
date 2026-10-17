import { describe, expect, it } from "vitest";
import {
   calculateWagerAccountingDeltas,
   evaluateWagerOutcome,
} from "./wager-accounting";

describe("evaluateWagerOutcome", () => {
   it("returns REFUND when challenge is cancelled", () => {
      const outcome = evaluateWagerOutcome({
         targetTeamId: "team_a",
         winningTeamIds: ["team_a"],
         isCancelled: true,
      });
      expect(outcome).toBe("REFUND");
   });

   it("returns REFUND when multiple teams are tied for first place (Draw)", () => {
      const outcome = evaluateWagerOutcome({
         targetTeamId: "team_a",
         winningTeamIds: ["team_a", "team_b"],
      });
      expect(outcome).toBe("REFUND");
   });

   it("returns REFUND when zero winning teams are resolved", () => {
      const outcome = evaluateWagerOutcome({
         targetTeamId: "team_a",
         winningTeamIds: [],
      });
      expect(outcome).toBe("REFUND");
   });

   it("returns WON when single winning team matches targetTeamId", () => {
      const outcome = evaluateWagerOutcome({
         targetTeamId: "team_a",
         winningTeamIds: ["team_a"],
      });
      expect(outcome).toBe("WON");
   });

   it("returns LOST when single winning team does not match targetTeamId", () => {
      const outcome = evaluateWagerOutcome({
         targetTeamId: "team_a",
         winningTeamIds: ["team_b"],
      });
      expect(outcome).toBe("LOST");
   });
});

describe("calculateWagerAccountingDeltas", () => {
   it("calculates correct deltas for WON resolution (1:1 payout)", () => {
      const effect = calculateWagerAccountingDeltas(100, "WON");
      expect(effect.resolution).toBe("WON");
      expect(effect.payoutAmount).toBe(200);
      expect(effect.netProfit).toBe(100);
      expect(effect.totalDelta).toBe(100);
      expect(effect.reservedDelta).toBe(-100);
   });

   it("calculates correct deltas for LOST resolution", () => {
      const effect = calculateWagerAccountingDeltas(100, "LOST");
      expect(effect.resolution).toBe("LOST");
      expect(effect.payoutAmount).toBe(0);
      expect(effect.netProfit).toBe(-100);
      expect(effect.totalDelta).toBe(-100);
      expect(effect.reservedDelta).toBe(-100);
   });

   it("calculates correct deltas for REFUND resolution", () => {
      const effect = calculateWagerAccountingDeltas(100, "REFUND");
      expect(effect.resolution).toBe("REFUND");
      expect(effect.payoutAmount).toBe(100);
      expect(effect.netProfit).toBe(0);
      expect(effect.totalDelta).toBe(0);
      expect(effect.reservedDelta).toBe(-100);
   });

   it("rejects non-positive stakes", () => {
      expect(() => calculateWagerAccountingDeltas(0, "WON")).toThrow();
      expect(() => calculateWagerAccountingDeltas(-50, "REFUND")).toThrow();
   });
});
