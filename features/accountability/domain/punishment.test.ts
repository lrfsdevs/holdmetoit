import { describe, expect, it } from "vitest";

import { DurationRangeError } from "@/features/study-logs/domain/duration";
import {
   evaluateLockOutcome,
   resolveWinningTeamIds,
} from "@/features/accountability/domain/punishment";

const target = 126_000;

describe("evaluateLockOutcome", () => {
   it("saves a participant when all three conditions hold", () => {
      const result = evaluateLockOutcome({
         targetSeconds: target,
         loggedSeconds: target,
         weeklyTasks: [{ status: "COMPLETED" }, { status: "COMPLETED" }],
         isInWinningTeam: true,
      });

      expect(result).toEqual({
         isPunished: false,
         reasons: [],
         hoursDeficitSeconds: 0,
         completedWeeklyTasks: 2,
         totalWeeklyTasks: 2,
         isInWinningTeam: true,
      });
   });

   it("punishes on an hours deficit even when tasks and team are fine", () => {
      const result = evaluateLockOutcome({
         targetSeconds: target,
         loggedSeconds: 100_000,
         weeklyTasks: [{ status: "COMPLETED" }],
         isInWinningTeam: true,
      });

      expect(result.isPunished).toBe(true);
      expect(result.reasons).toEqual(["hours_deficit"]);
      expect(result.hoursDeficitSeconds).toBe(26_000);
   });

   it("punishes on incomplete weekly tasks even when hours and team are fine", () => {
      const result = evaluateLockOutcome({
         targetSeconds: target,
         loggedSeconds: target,
         weeklyTasks: [{ status: "COMPLETED" }, { status: "IN_PROGRESS" }],
         isInWinningTeam: true,
      });

      expect(result.isPunished).toBe(true);
      expect(result.reasons).toEqual(["incomplete_weekly_tasks"]);
      expect(result.completedWeeklyTasks).toBe(1);
      expect(result.totalWeeklyTasks).toBe(2);
   });

   it("treats CROSSED_OUT tasks as incomplete", () => {
      const result = evaluateLockOutcome({
         targetSeconds: target,
         loggedSeconds: target,
         weeklyTasks: [{ status: "CROSSED_OUT" }],
         isInWinningTeam: true,
      });

      expect(result.isPunished).toBe(true);
      expect(result.reasons).toEqual(["incomplete_weekly_tasks"]);
   });

   it("punishes with the losing_team reason when the team condition fails", () => {
      const result = evaluateLockOutcome({
         targetSeconds: target,
         loggedSeconds: target,
         weeklyTasks: [{ status: "COMPLETED" }],
         isInWinningTeam: false,
      });

      expect(result.isPunished).toBe(true);
      expect(result.reasons).toEqual(["losing_team"]);
   });

   it("collects every failed reason", () => {
      const result = evaluateLockOutcome({
         targetSeconds: target,
         loggedSeconds: 90_000,
         weeklyTasks: [{ status: "TODO" }],
         isInWinningTeam: false,
      });

      expect(result.isPunished).toBe(true);
      expect(result.reasons).toEqual([
         "hours_deficit",
         "incomplete_weekly_tasks",
         "losing_team",
      ]);
   });

   it("treats an empty weekly-task board as vacuously complete", () => {
      const result = evaluateLockOutcome({
         targetSeconds: target,
         loggedSeconds: target,
         weeklyTasks: [],
         isInWinningTeam: true,
      });

      expect(result.isPunished).toBe(false);
      expect(result.totalWeeklyTasks).toBe(0);
   });

   it("rejects negative duration inputs", () => {
      expect(() =>
         evaluateLockOutcome({
            targetSeconds: -1,
            loggedSeconds: 0,
            weeklyTasks: [],
            isInWinningTeam: true,
         })
      ).toThrow(DurationRangeError);
      expect(() =>
         evaluateLockOutcome({
            targetSeconds: target,
            loggedSeconds: -1,
            weeklyTasks: [],
            isInWinningTeam: true,
         })
      ).toThrow(DurationRangeError);
   });
});

describe("resolveWinningTeamIds", () => {
   it("returns the single highest team", () => {
      expect(
         resolveWinningTeamIds([
            { teamId: "a", totalSeconds: 100 },
            { teamId: "b", totalSeconds: 80 },
         ])
      ).toEqual(["a"]);
   });

   it("returns every team tied at the top (ties never punish)", () => {
      expect(
         resolveWinningTeamIds([
            { teamId: "a", totalSeconds: 100 },
            { teamId: "b", totalSeconds: 100 },
         ])
      ).toEqual(["a", "b"]);
   });

   it("returns all teams when every total is equal, including all-zero", () => {
      expect(
         resolveWinningTeamIds([
            { teamId: "a", totalSeconds: 0 },
            { teamId: "b", totalSeconds: 0 },
         ])
      ).toEqual(["a", "b"]);
   });

   it("returns an empty list when there are no teams", () => {
      expect(resolveWinningTeamIds([])).toEqual([]);
   });
});
