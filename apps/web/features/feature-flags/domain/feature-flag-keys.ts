/** Canonical feature-flag keys. Never use bare string literals at call sites. */
export const FEATURE_FLAG_KEYS = {
   pokemon: "pokemon_system_v1",
   betting: "betting_system_v1",
   globalLeaderboard: "global_leaderboard_v1",
   logrocket: "logrocket_v1",
} as const;

export type FeatureFlagKey =
   (typeof FEATURE_FLAG_KEYS)[keyof typeof FEATURE_FLAG_KEYS];
