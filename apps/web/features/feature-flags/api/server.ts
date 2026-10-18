import { cache } from "react";
import { auth } from "@/core/auth";
import { createLogger, logEvents } from "@/core/observability/logger";
import {
   getAllActiveFlagsWithTargets,
   getFlagWithTargetsByKey,
} from "../data/feature-flags.repository";
import { evaluateFeatureFlag } from "../domain/evaluator";
import type { FlagEvaluationContext } from "../domain/feature-flags.types";

const logger = createLogger("feature-flags");

/**
 * Server-only evaluation helper with React cache() to deduplicate database queries
 * across Server Components within the same incoming request lifecycle.
 */
export const isFeatureEnabled = cache(
   async (
      key: string,
      explicitContext?: FlagEvaluationContext,
      fallback = false
   ): Promise<boolean> => {
      try {
         let context = explicitContext;

         if (!context) {
            const session = await auth();
            context = {
               userId: session?.user?.id ?? null,
               userRole: session?.user?.role ?? null,
               isSpectator: !session?.user?.id,
            };
         }

         const flag = await getFlagWithTargetsByKey(key);
         return evaluateFeatureFlag(flag, context, fallback);
      } catch (error) {
         logger.error(logEvents.appError, {
            context: { flagKey: key },
            error,
         });
         return fallback;
      }
   }
);

/**
 * Bulk feature flag evaluation to prevent N+1 queries when a view requires multiple flags.
 */
export const getFeatureFlags = cache(
   async (
      keys?: string[],
      explicitContext?: FlagEvaluationContext
   ): Promise<Record<string, boolean>> => {
      try {
         let context = explicitContext;

         if (!context) {
            const session = await auth();
            context = {
               userId: session?.user?.id ?? null,
               userRole: session?.user?.role ?? null,
               isSpectator: !session?.user?.id,
            };
         }

         const allFlags = await getAllActiveFlagsWithTargets();
         const results: Record<string, boolean> = {};

         const keySet = keys ? new Set(keys) : null;

         for (const flag of allFlags) {
            if (!keySet || keySet.has(flag.key)) {
               results[flag.key] = evaluateFeatureFlag(flag, context, false);
            }
         }

         if (keys) {
            for (const k of keys) {
               if (results[k] === undefined) {
                  results[k] = false;
               }
            }
         }

         return results;
      } catch (error) {
         logger.error(logEvents.appError, { error });
         if (keys) {
            return keys.reduce(
               (acc, k) => {
                  acc[k] = false;
                  return acc;
               },
               {} as Record<string, boolean>
            );
         }
         return {};
      }
   }
);
