export type WagerResolution = "WON" | "LOST" | "REFUND";

export interface EvaluateWagerOutcomeParams {
   targetTeamId: string;
   winningTeamIds: string[];
   isCancelled?: boolean;
}

/**
 * Pure domain evaluation of a wager's final resolution.
 *
 * Rules:
 * - Cancelled challenges always refund wagers.
 * - Draws/Ties (multiple winning teams with equal max hours, or zero winning teams)
 *   always refund wagers (Law L6 / Tie Policy).
 * - Exact single winning team matching targetTeamId yields WON.
 * - All other outcomes yield LOST.
 */
export function evaluateWagerOutcome(
   params: EvaluateWagerOutcomeParams
): WagerResolution {
   if (params.isCancelled) {
      return "REFUND";
   }

   // Tie / Draw: More than one team tied for first place
   if (params.winningTeamIds.length !== 1) {
      return "REFUND";
   }

   const [soloWinningTeamId] = params.winningTeamIds;
   if (soloWinningTeamId === params.targetTeamId) {
      return "WON";
   }

   return "LOST";
}

export interface WagerAccountingEffect {
   resolution: WagerResolution;
   payoutAmount: number;
   netProfit: number;
   totalDelta: number;
   reservedDelta: number;
}

/**
 * Computes exact balance and reservation deltas for each wager outcome:
 * - WON: Net profit equal to stake (1:1 odds). Total +stake, Reserved -stake.
 * - LOST: Reserved stake is consumed. Total -stake, Reserved -stake.
 * - REFUND: Reserved stake is released back to available balance. Total 0, Reserved -stake.
 */
export function calculateWagerAccountingDeltas(
   stake: number,
   resolution: WagerResolution
): WagerAccountingEffect {
   if (!Number.isSafeInteger(stake) || stake <= 0) {
      throw new Error(`Stake must be a positive integer (received: ${stake}).`);
   }

   switch (resolution) {
      case "WON":
         return {
            resolution,
            payoutAmount: stake * 2,
            netProfit: stake,
            totalDelta: stake,
            reservedDelta: -stake,
         };
      case "LOST":
         return {
            resolution,
            payoutAmount: 0,
            netProfit: -stake,
            totalDelta: -stake,
            reservedDelta: -stake,
         };
      case "REFUND":
         return {
            resolution,
            payoutAmount: stake,
            netProfit: 0,
            totalDelta: 0,
            reservedDelta: -stake,
         };
   }
}
