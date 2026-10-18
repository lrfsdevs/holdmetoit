import { DurationRangeError } from "@/features/study-logs/domain/duration";

/**
 * Why a participant was not saved at challenge lock (FEAT-PUN-01).
 * A participant is saved only when every condition holds, so any reason listed
 * here means `isPunished` is true.
 */
export type LockReason =
   "hours_deficit" | "incomplete_weekly_tasks" | "losing_team";

export interface WeeklyTaskStatus {
   status: string;
}

export interface LockOutcome {
   isPunished: boolean;
   reasons: LockReason[];
   hoursDeficitSeconds: number;
   completedWeeklyTasks: number;
   totalWeeklyTasks: number;
   isInWinningTeam: boolean;
}

/**
 * Three-condition lock evaluation:
 * saved = (hours met AND all challenge-linked weekly tasks completed AND in a winning team).
 * An empty weekly-task list is vacuously complete.
 */
export function evaluateLockOutcome(input: {
   targetSeconds: number;
   loggedSeconds: number;
   weeklyTasks: readonly WeeklyTaskStatus[];
   isInWinningTeam: boolean;
}): LockOutcome {
   assertNonNegativeInteger("targetSeconds", input.targetSeconds);
   assertNonNegativeInteger("loggedSeconds", input.loggedSeconds);

   const totalWeeklyTasks = input.weeklyTasks.length;
   const completedWeeklyTasks = input.weeklyTasks.filter(
      (task) => task.status === "COMPLETED"
   ).length;
   const allWeeklyTasksComplete = completedWeeklyTasks === totalWeeklyTasks;
   const hoursDeficitSeconds = Math.max(
      0,
      input.targetSeconds - input.loggedSeconds
   );

   const reasons: LockReason[] = [];

   if (hoursDeficitSeconds > 0) {
      reasons.push("hours_deficit");
   }
   if (!allWeeklyTasksComplete) {
      reasons.push("incomplete_weekly_tasks");
   }
   if (!input.isInWinningTeam) {
      reasons.push("losing_team");
   }

   return {
      isPunished: reasons.length > 0,
      reasons,
      hoursDeficitSeconds,
      completedWeeklyTasks,
      totalWeeklyTasks,
      isInWinningTeam: input.isInWinningTeam,
   };
}

/**
 * Winning teams = every team at the maximum combined hours.
 * Equal hours never produce a losing side: top ties, all-equal, and all-zero
 * totals all return every tied team as a winner.
 */
export function resolveWinningTeamIds(
   teamTotals: readonly { teamId: string; totalSeconds: number }[]
): string[] {
   if (teamTotals.length === 0) {
      return [];
   }

   const maxSeconds = Math.max(...teamTotals.map((team) => team.totalSeconds));

   return teamTotals
      .filter((team) => team.totalSeconds === maxSeconds)
      .map((team) => team.teamId);
}

function assertNonNegativeInteger(label: string, value: number): void {
   if (!Number.isInteger(value)) {
      throw new DurationRangeError(`${label} must be an integer.`);
   }

   if (value < 0) {
      throw new DurationRangeError(`${label} cannot be negative.`);
   }
}
