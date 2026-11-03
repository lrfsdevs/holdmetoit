"use server";

import { requireSessionUser } from "@/features/auth/api/require-session";
import { isFeatureEnabled } from "@/features/feature-flags/api/server";
import { FEATURE_FLAG_KEYS } from "@/features/feature-flags/domain/feature-flag-keys";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
   placeWager,
   getUserWagersForChallenge,
   getWagersForChallenge,
} from "../data/wager.repository";
import {
   MIN_WAGER_STAKE,
   MAX_WAGER_STAKE,
   WagerValidationError,
   BettingClosedError,
} from "@/features/economy/domain/economy-settings";
import { toClientError } from "@/core/errors";

const placeWagerSchema = z.object({
   challengeId: z.string().min(1),
   targetTeamId: z.string().min(1),
   stake: z
      .number()
      .int()
      .min(MIN_WAGER_STAKE, `Minimum stake is ${MIN_WAGER_STAKE} coins`)
      .max(MAX_WAGER_STAKE, `Maximum stake is ${MAX_WAGER_STAKE} coins`),
});

export type PlaceWagerInput = z.infer<typeof placeWagerSchema>;

/**
 * Validates and places the signed-in user’s wager when betting is enabled, then refreshes affected pages.
 */
export async function placeWagerAction(input: PlaceWagerInput) {
   try {
      const user = await requireSessionUser();

      const bettingEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.betting);
      if (!bettingEnabled) {
         return {
            ok: false,
            code: "FEATURE_DISABLED",
            message: "Betting is currently unavailable.",
         };
      }

      const parsed = placeWagerSchema.safeParse(input);

      if (!parsed.success) {
         const firstMessage =
            parsed.error.issues?.[0]?.message ||
            (parsed.error as any).errors?.[0]?.message ||
            "Invalid wager parameters.";
         return {
            ok: false,
            code: "INVALID_INPUT",
            message: firstMessage,
         };
      }

      const result = await placeWager({
         userId: user.id,
         challengeId: parsed.data.challengeId,
         targetTeamId: parsed.data.targetTeamId,
         stake: parsed.data.stake,
      });

      revalidatePath(`/challenge/${parsed.data.challengeId}`);
      revalidatePath("/wallet");

      return {
         ok: true,
         wager: result.wager,
         isDuplicate: result.isDuplicate,
      };
   } catch (error) {
      const clientError = toClientError(error, {
         scope: "wagers.place",
         defaultCode: "WAGER_ERROR",
         defaultMessage: "An unexpected error occurred while placing wager.",
         context: {
            challengeId: input?.challengeId,
            targetTeamId: input?.targetTeamId,
            stake: input?.stake,
         },
      });

      return {
         ok: false,
         code: clientError.code,
         message: clientError.message,
      };
   }
}

export async function getChallengeWagersAction(challengeId: string) {
   try {
      const wagers = await getWagersForChallenge(challengeId);
      return { ok: true, wagers };
   } catch (error) {
      const clientError = toClientError(error, {
         scope: "wagers.get_challenge",
         defaultCode: "FETCH_WAGERS_FAILED",
         defaultMessage: "Failed to fetch challenge wagers.",
         context: { challengeId },
      });
      return {
         ok: false,
         wagers: [],
         message: clientError.message,
      };
   }
}

export async function getUserChallengeWagersAction(challengeId: string) {
   try {
      const user = await requireSessionUser();
      const wagers = await getUserWagersForChallenge(user.id, challengeId);
      return { ok: true, wagers };
   } catch (error) {
      const clientError = toClientError(error, {
         scope: "wagers.get_user_challenge",
         defaultCode: "FETCH_USER_WAGERS_FAILED",
         defaultMessage: "Failed to fetch user wagers.",
         context: { challengeId },
      });
      return {
         ok: false,
         wagers: [],
         message: clientError.message,
      };
   }
}
