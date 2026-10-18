import type {
   FlagEvaluationContext,
   RolloutModeType,
} from "./feature-flags.types";

export interface EvaluatableFeatureFlag {
   key: string;
   rolloutMode: RolloutModeType;
   isDeleted?: boolean;
   targets?: { userId: string }[];
   targetUserIds?: string[];
}

/**
 * Pure evaluation function for feature flags (Law L7: Pure Domain Isolation).
 * Zero dependencies on Next.js, React, or database ORMs.
 *
 * Rules:
 * 1. Missing or soft-deleted flag returns safe fallback (default false).
 * 2. rolloutMode === "DISABLED" returns false.
 * 3. rolloutMode === "GLOBAL" returns true.
 * 4. rolloutMode === "TARGETED" returns true only if context.userId is assigned in targets.
 */
export function evaluateFeatureFlag(
   flag: EvaluatableFeatureFlag | null | undefined,
   context?: FlagEvaluationContext,
   fallback = false
): boolean {
   if (!flag || flag.isDeleted) {
      return fallback;
   }

   switch (flag.rolloutMode) {
      case "DISABLED":
         return false;

      case "GLOBAL":
         return true;

      case "TARGETED": {
         if (!context?.userId) {
            return false;
         }
         const targetUserIds =
            flag.targetUserIds || flag.targets?.map((t) => t.userId) || [];
         return targetUserIds.includes(context.userId);
      }

      default:
         return false;
   }
}
