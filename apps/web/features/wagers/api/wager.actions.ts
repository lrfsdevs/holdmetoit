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
      if (
         error instanceof WagerValidationError ||
         error instanceof BettingClosedError
      ) {
         return {
            ok: false,
            code: error.code,
            message: error.message,
         };
      }

      return {
         ok: false,
         code: "WAGER_ERROR",
         message:
            error instanceof Error
               ? error.message
               : "An unexpected error occurred while placing wager.",
      };
   }
}

export async function getChallengeWagersAction(challengeId: string) {
   try {
      const wagers = await getWagersForChallenge(challengeId);
      return { ok: true, wagers };
   } catch (error) {
      return {
         ok: false,
         wagers: [],
         message:
            error instanceof Error
               ? error.message
               : "Failed to fetch challenge wagers.",
      };
   }
}

export async function getUserChallengeWagersAction(challengeId: string) {
   try {
      const user = await requireSessionUser();
      const wagers = await getUserWagersForChallenge(user.id, challengeId);
      return { ok: true, wagers };
   } catch (error) {
      return {
         ok: false,
         wagers: [],
         message:
            error instanceof Error
               ? error.message
               : "Failed to fetch user wagers.",
      };
   }
}
