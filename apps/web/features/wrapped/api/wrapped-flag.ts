import { isFeatureEnabled } from "@/features/feature-flags/api/server";

/** Canonical feature-flag key for the Challenge Wrapped experience (toggled in /devboard). */
export const WRAPPED_FEATURE_FLAG_KEY = "challenge_wrapped_v1";

/**
 * Server-only. Fails closed: a missing flag row or `rolloutMode = DISABLED`
 * both resolve to `false`.
 */
export function isWrappedFeatureEnabled(): Promise<boolean> {
   return isFeatureEnabled(WRAPPED_FEATURE_FLAG_KEY);
}
