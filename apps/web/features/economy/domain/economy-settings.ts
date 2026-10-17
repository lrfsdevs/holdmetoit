import { z } from "zod";

/**
 * Centralized economy & betting configuration constants.
 * Governed by Law L7 (Pure Domain Isolation).
 */
export const MIN_WAGER_STAKE = 10;
export const MAX_WAGER_STAKE = 1000;
export const DEFAULT_CHALLENGE_REWARD_COINS = 500;
export const MAX_CHALLENGE_REWARD_COINS = 10000;

export const SUPPORTED_BETTING_FORMATS = [
   "SOLOS",
   "DUOS",
   "TEAM_VS_TEAM",
] as const;

export type SupportedBettingFormat = (typeof SUPPORTED_BETTING_FORMATS)[number];

export class WagerValidationError extends Error {
   readonly code = "WAGER_VALIDATION_ERROR";
   constructor(message: string) {
      super(message);
      this.name = "WagerValidationError";
   }
}

export class BettingClosedError extends Error {
   readonly code = "BETTING_CLOSED";
   constructor(
      message = "Betting is closed for this challenge. Wagers can only be placed before the challenge starts."
   ) {
      super(message);
      this.name = "BettingClosedError";
   }
}

export interface WagerValidationParams {
   stake: number;
   availableBalance: number;
   challengeStatus: string;
   isBettingEnabled: boolean;
   resultsLockedAt: Date | null;
   startAt: Date;
   currentTime?: Date;
   targetTeamExists: boolean;
}

export function validateWagerPlacement(params: WagerValidationParams): void {
   const now = params.currentTime ?? new Date();

   if (!params.isBettingEnabled) {
      throw new WagerValidationError(
         "Betting is disabled for this challenge tournament."
      );
   }

   if (params.resultsLockedAt != null) {
      throw new BettingClosedError("Challenge results are already locked.");
   }

   // Lock condition: Wagers must be placed before challenge start time (during UPCOMING phase)
   if (
      params.challengeStatus !== "UPCOMING" ||
      now.getTime() >= params.startAt.getTime()
   ) {
      throw new BettingClosedError(
         "Betting closes permanently once the challenge kicks off."
      );
   }

   if (!Number.isSafeInteger(params.stake) || params.stake < MIN_WAGER_STAKE) {
      throw new WagerValidationError(
         `Minimum wager stake is ${MIN_WAGER_STAKE} coins.`
      );
   }

   if (params.stake > MAX_WAGER_STAKE) {
      throw new WagerValidationError(
         `Maximum wager stake is ${MAX_WAGER_STAKE} coins per bet.`
      );
   }

   if (params.stake > params.availableBalance) {
      throw new WagerValidationError(
         `Insufficient available balance (${params.availableBalance} coins) to place a ${params.stake} coin wager.`
      );
   }

   if (!params.targetTeamExists) {
      throw new WagerValidationError(
         "Selected target team does not exist in this challenge."
      );
   }
}

export const challengeRewardSettingsSchema = z.object({
   rewardCoins: z
      .number()
      .int()
      .min(0, "Reward coins cannot be negative")
      .max(
         MAX_CHALLENGE_REWARD_COINS,
         `Reward coins cannot exceed ${MAX_CHALLENGE_REWARD_COINS}`
      ),
   isBettingEnabled: z.boolean(),
});

export type ChallengeRewardSettings = z.infer<
   typeof challengeRewardSettingsSchema
>;
