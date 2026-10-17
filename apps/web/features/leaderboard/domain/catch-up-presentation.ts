import {
   calculateRemainingDeficit,
   calculateRequiredDailyPace,
} from "@/features/leaderboard/domain/deficit";
import {
   formatSecondsToClock,
   formatSecondsToHuman,
} from "@/features/study-logs/domain/duration";

export interface CatchUpInput {
   targetSeconds: number;
   totalLoggedSeconds: number;
   daysRemaining: number;
}

export type CatchUpTone = "on-pace" | "catch-up" | "complete" | "deadline";

export interface CatchUpSummary {
   tone: CatchUpTone;
   deficitSeconds: number;
   paceSecondsPerDay: number | null;
   progressLabel: string;
   message: string;
}

/**
 * Pure catch-up copy builder for participant cockpit (FEAT-LEAD-03 / DESIGN.md).
 */
export function buildCatchUpSummary(input: CatchUpInput): CatchUpSummary {
   const deficitSeconds = calculateRemainingDeficit(
      input.targetSeconds,
      input.totalLoggedSeconds
   );

   const progressLabel = `${formatSecondsToClock(input.totalLoggedSeconds)} / ${formatSecondsToClock(input.targetSeconds)}`;

   if (deficitSeconds === 0) {
      return {
         tone: "complete",
         deficitSeconds: 0,
         paceSecondsPerDay: 0,
         progressLabel,
         message:
            "On serene pace. You have met your weekly target — keep the gentle momentum going.",
      };
   }

   if (input.daysRemaining <= 0) {
      return {
         tone: "deadline",
         deficitSeconds,
         paceSecondsPerDay: null,
         progressLabel,
         message: `Gentle catch-up. You still need ${formatSecondsToHuman(deficitSeconds)} to reach your target before the challenge concludes.`,
      };
   }

   const paceSecondsPerDay = calculateRequiredDailyPace(
      deficitSeconds,
      input.daysRemaining
   );

   return {
      tone: "catch-up",
      deficitSeconds,
      paceSecondsPerDay,
      progressLabel,
      message: `Gentle catch-up. Need ${formatSecondsToHuman(Math.ceil(paceSecondsPerDay))}/day over the next ${input.daysRemaining} day${input.daysRemaining === 1 ? "" : "s"} to hit your target. Deficits roll forward seamlessly.`,
   };
}

export function calculateInclusiveDaysRemaining(
   endAt: Date,
   now: Date
): number {
   const end = Date.UTC(
      endAt.getUTCFullYear(),
      endAt.getUTCMonth(),
      endAt.getUTCDate()
   );
   const today = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
   );

   const diffDays = Math.ceil((end - today) / 86_400_000);
   return Math.max(0, diffDays);
}

export function sumLoggedSeconds(
   logs: readonly { durationSeconds: number }[]
): number {
   return logs.reduce((total, log) => total + log.durationSeconds, 0);
}
