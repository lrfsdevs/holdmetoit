/**
 * Canonical configuration constants for HoldMeToIt Virtual Economy (Phase 1).
 *
 * Governed by Law L7 (Pure Domain Isolation) and Law L8 (Second-Level Clock Precision).
 * No floating point math: 100 coins per 3,600 seconds reduces exactly to 1 coin per 36 seconds.
 */

export const COINS_PER_ELIGIBLE_HOUR = 100;
export const SECONDS_PER_HOUR = 3600;

/**
 * Seconds required to earn exactly 1 whole coin.
 * 3600 / 100 = 36 seconds per coin.
 */
export const SECONDS_PER_COIN = SECONDS_PER_HOUR / COINS_PER_ELIGIBLE_HOUR; // 36

export const ECONOMY_SOURCE_TYPES = {
   DAILY_STUDY_LOG: "DAILY_STUDY_LOG",
   ADMIN_ADJUSTMENT: "ADMIN_ADJUSTMENT",
   REVERSAL: "REVERSAL",
} as const;

export const TRANSACTION_TYPES = {
   STUDY_REWARD: "STUDY_REWARD",
   CHALLENGE_REWARD: "CHALLENGE_REWARD",
   WAGER_RESERVATION: "WAGER_RESERVATION",
   WAGER_SETTLEMENT: "WAGER_SETTLEMENT",
   WAGER_REFUND: "WAGER_REFUND",
   GACHA_PURCHASE: "GACHA_PURCHASE",
   TRADE_RESERVATION: "TRADE_RESERVATION",
   TRADE_SETTLEMENT: "TRADE_SETTLEMENT",
   TRADE_REFUND: "TRADE_REFUND",
   ADMIN_ADJUSTMENT: "ADMIN_ADJUSTMENT",
   REVERSAL: "REVERSAL",
} as const;

export type TransactionTypeValue =
   (typeof TRANSACTION_TYPES)[keyof typeof TRANSACTION_TYPES];
