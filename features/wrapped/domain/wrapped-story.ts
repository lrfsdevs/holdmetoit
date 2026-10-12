import type { LockReason } from "@/features/accountability/domain/punishment";
import type {
   ChallengeWrappedViewModel,
   ParticipantWrappedViewModel,
   WrappedDailyPoint,
   WrappedVerdict,
} from "@/features/wrapped/domain/wrapped";

/**
 * Pure story model for the wrapped modal (ported from `holdmetoit Wrapped.html`).
 * Maps the wrapped view model into the five slides and chart geometry so the
 * component stays presentational.
 */

export const WRAPPED_CHART_GEOMETRY = {
   width: 326,
   height: 184,
   x0: 32,
   x1: 316,
   top: 12,
   base: 160,
} as const;

const DAY_MS = 86_400_000;

export type WrappedStoryTone = WrappedVerdict;

export interface WrappedStoryDay {
   index: number;
   label: string;
   dayNumber: number;
   hoursYou: number;
   hoursAvg: number;
   minutesYou: number;
   minutesAvg: number;
}

export interface WrappedStoryChart {
   width: number;
   height: number;
   x0: number;
   x1: number;
   top: number;
   base: number;
   yMax: number;
   days: WrappedStoryDay[];
   ticks: number[];
   x: number[];
   yYou: number[];
   yAvg: number[];
   youPath: string;
   avgPath: string;
   areaPath: string;
   bestIndex: number;
   bestLabel: string | null;
   bestHuman: string | null;
}

export interface WrappedStoryVerdict {
   stamp: "Saved" | "Punished" | "Excused";
   tone: WrappedStoryTone;
   headline: string;
   totalHuman: string;
   targetHuman: string;
   note: string;
}

export interface WrappedStory {
   periodLabel: string;
   title: string;
   time: {
      minutes: number;
      totalHuman: string;
   };
   chart: WrappedStoryChart;
   chartCopy: {
      timesVsAverage: number | null;
      contributionPercent: number;
      teamName: string;
      hasData: boolean;
   };
   verdict: WrappedStoryVerdict;
}

const SHORT_REASONS: Record<LockReason, string> = {
   hours_deficit: "target hours",
   incomplete_weekly_tasks: "weekly tasks",
   losing_team: "team result",
};

const MONTH_DAY_FORMAT = new Intl.DateTimeFormat("en-US", {
   month: "short",
   day: "numeric",
   timeZone: "UTC",
});

function formatDay(date: Date): string {
   return MONTH_DAY_FORMAT.format(date);
}

/**
 * "Oct 5 – 11 · Wrapped" — the last label is the last challenge day
 * (`ceil((endAt - startAt) / day) - 1` days after the start).
 */
export function buildWrappedPeriodLabel(
   startAt: string | Date,
   endAt: string | Date
): string {
   const start = new Date(startAt);
   const end = new Date(endAt);
   const totalDays = Math.max(
      1,
      Math.ceil((end.getTime() - start.getTime()) / DAY_MS)
   );
   const lastDay = new Date(start.getTime() + (totalDays - 1) * DAY_MS);

   const startLabel = formatDay(start);
   const lastLabel = formatDay(lastDay);

   if (start.getTime() === lastDay.getTime()) {
      return `${startLabel} · Wrapped`;
   }

   const sameMonth =
      start.getUTCMonth() === lastDay.getUTCMonth() &&
      start.getUTCFullYear() === lastDay.getUTCFullYear();

   const range = sameMonth
      ? `${startLabel} – ${lastDay.getUTCDate()}`
      : `${startLabel} – ${lastLabel}`;

   return `${range} · Wrapped`;
}

/**
 * ~5 evenly spaced x-axis tick indices (first and last included).
 */
export function buildTickIndices(dayCount: number): number[] {
   if (dayCount <= 1) {
      return [0];
   }

   const tickCount = Math.min(dayCount, 5);
   const indices = Array.from({ length: tickCount }, (_, index) =>
      Math.round((index * (dayCount - 1)) / (tickCount - 1))
   );

   return Array.from(new Set(indices));
}

/**
 * SVG line path (1-decimal coords, `M… L…`) matching the reference chart.
 */
export function buildLinePath(
   points: readonly { x: number; y: number }[]
): string {
   if (points.length === 0) {
      return "";
   }

   const format = (value: number) => value.toFixed(1);

   return `M${points
      .map((point) => `${format(point.x)} ${format(point.y)}`)
      .join(" L")}`;
}

export function buildWrappedChart(
   daily: readonly WrappedDailyPoint[]
): WrappedStoryChart {
   const geometry = WRAPPED_CHART_GEOMETRY;
   const dayCount = daily.length;

   const days: WrappedStoryDay[] = daily.map((day, index) => ({
      index,
      label: day.label,
      dayNumber: day.dayNumber,
      hoursYou: day.durationSeconds / 3600,
      hoursAvg: day.averageSeconds / 3600,
      minutesYou: Math.round(day.durationSeconds / 60),
      minutesAvg: Math.round(day.averageSeconds / 60),
   }));

   const maxHours = days.reduce(
      (max, day) => Math.max(max, day.hoursYou, day.hoursAvg),
      0
   );
   const yMax = Math.max(1, Math.ceil(maxHours * 1.1));

   const x = days.map((day) =>
      dayCount <= 1
         ? (geometry.x0 + geometry.x1) / 2
         : geometry.x0 +
           (day.index / (dayCount - 1)) * (geometry.x1 - geometry.x0)
   );
   const toY = (hours: number) =>
      geometry.base - (hours / yMax) * (geometry.base - geometry.top);
   const yYou = days.map((day) => toY(day.hoursYou));
   const yAvg = days.map((day) => toY(day.hoursAvg));

   const youPath = buildLinePath(
      days.map((day) => ({ x: x[day.index], y: yYou[day.index] }))
   );
   const avgPath = buildLinePath(
      days.map((day) => ({ x: x[day.index], y: yAvg[day.index] }))
   );

   const lastX = x.length > 0 ? x[x.length - 1] : geometry.x0;
   const areaPath =
      dayCount > 0
         ? `${youPath} L${lastX.toFixed(1)} ${geometry.base} L${geometry.x0.toFixed(1)} ${geometry.base} Z`
         : "";

   const bestIndex = daily.findIndex((day) => day.isBestDay);
   const bestDay = bestIndex >= 0 ? daily[bestIndex] : null;

   return {
      width: geometry.width,
      height: geometry.height,
      x0: geometry.x0,
      x1: geometry.x1,
      top: geometry.top,
      base: geometry.base,
      yMax,
      days,
      ticks: buildTickIndices(dayCount),
      x,
      yYou,
      yAvg,
      youPath,
      avgPath,
      areaPath,
      bestIndex,
      bestLabel: bestDay?.label ?? null,
      bestHuman: bestDay?.durationHuman ?? null,
   };
}

export function buildWrappedVerdict(
   viewer: ParticipantWrappedViewModel
): WrappedStoryVerdict {
   const displayName = viewer.displayName;

   if (viewer.verdict === "saved") {
      return {
         stamp: "Saved",
         tone: "saved",
         headline: "You cleared every condition.",
         totalHuman: viewer.totalHuman,
         targetHuman: viewer.targetClock,
         note: `Seriously good work, ${displayName}. Next time, aim even higher.`,
      };
   }

   if (viewer.verdict === "excused") {
      return {
         stamp: "Excused",
         tone: "excused",
         headline: "The host excused you.",
         totalHuman: viewer.totalHuman,
         targetHuman: viewer.targetClock,
         note: "Your result was pardoned by the host for this event.",
      };
   }

   const reasonsText = viewer.reasons
      .map((reason) => SHORT_REASONS[reason])
      .join(" · ");

   return {
      stamp: "Punished",
      tone: "punished",
      headline: "You missed it this time.",
      totalHuman: viewer.totalHuman,
      targetHuman: viewer.targetClock,
      note: reasonsText
         ? `Still a strong month, ${displayName}. Missed: ${reasonsText}.`
         : `Still a strong month, ${displayName}. Next time, you will clear it.`,
   };
}

/**
 * Builds the full story model. Returns null for spectators (no personal block).
 */
export function buildWrappedStory(
   wrapped: ChallengeWrappedViewModel
): WrappedStory | null {
   const viewer = wrapped.viewer;
   if (!viewer) {
      return null;
   }

   return {
      periodLabel: buildWrappedPeriodLabel(wrapped.startAt, wrapped.endAt),
      title: wrapped.title,
      time: {
         minutes: Math.round(viewer.totalSeconds / 60),
         totalHuman: viewer.totalHuman,
      },
      chart: buildWrappedChart(viewer.daily),
      chartCopy: {
         timesVsAverage: viewer.timesVsAverage,
         contributionPercent: viewer.contributionPercentage,
         teamName: viewer.teamName,
         hasData: viewer.totalSeconds > 0,
      },
      verdict: buildWrappedVerdict(viewer),
   };
}
