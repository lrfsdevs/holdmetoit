"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSessionUser } from "@/features/auth/api/require-session";
import { requireAdminUser } from "@/features/auth/api/require-admin";
import { isFeatureEnabled } from "@/features/feature-flags/api/server";
import { FEATURE_FLAG_KEYS } from "@/features/feature-flags/domain/feature-flag-keys";
import {
   getTrophyLeaderboard,
   getTrophyHistory,
   getUserCompetitiveStats,
   adminAdjustTrophies,
} from "../data/trophy.repository";

const adminAdjustTrophiesSchema = z.object({
   userId: z.string().min(1, "Target user ID required"),
   amount: z
      .number()
      .int("Trophy amount must be an integer")
      .refine((val) => val !== 0, "Adjustment cannot be zero"),
   reason: z
      .string()
      .min(3, "Reason must be at least 3 characters")
      .max(256, "Reason too long"),
});

export type AdminAdjustTrophiesInput = z.infer<
   typeof adminAdjustTrophiesSchema
>;

export async function getTrophyLeaderboardAction(options?: {
   page?: number;
   limit?: number;
}) {
   const leaderboardEnabled = await isFeatureEnabled(
      FEATURE_FLAG_KEYS.globalLeaderboard
   );
   if (!leaderboardEnabled) {
      return {
         ok: false,
         code: "FEATURE_DISABLED",
         message: "Trophy leaderboard is currently unavailable.",
         data: {
            entries: [],
            pagination: { page: 1, limit: 50, totalCount: 0, totalPages: 1 },
         },
      };
   }

   try {
      const data = await getTrophyLeaderboard(options);
      return { ok: true, data };
   } catch (error) {
      return {
         ok: false,
         code: "LEADERBOARD_FETCH_FAILED",
         message:
            error instanceof Error
               ? error.message
               : "Failed to fetch trophy leaderboard.",
         data: {
            entries: [],
            pagination: { page: 1, limit: 50, totalCount: 0, totalPages: 1 },
         },
      };
   }
}

export async function getUserCompetitiveStatsAction(userId?: string) {
   try {
      let targetUserId = userId;
      if (!targetUserId) {
         const user = await requireSessionUser();
         targetUserId = user.id;
      }

      const stats = await getUserCompetitiveStats(targetUserId);

      if (!stats) {
         return {
            ok: false,
            code: "USER_NOT_FOUND",
            message: "User stats not found.",
            data: null,
         };
      }

      return { ok: true, data: stats };
   } catch (error) {
      return {
         ok: false,
         code: "STATS_FETCH_FAILED",
         message:
            error instanceof Error
               ? error.message
               : "Failed to retrieve user competitive stats.",
         data: null,
      };
   }
}

export async function getUserTrophyHistoryAction(options?: {
   userId?: string;
   page?: number;
   limit?: number;
}) {
   try {
      let targetUserId = options?.userId;
      if (!targetUserId) {
         const user = await requireSessionUser();
         targetUserId = user.id;
      }

      const history = await getTrophyHistory(targetUserId, {
         page: options?.page,
         limit: options?.limit,
      });

      return { ok: true, data: history };
   } catch (error) {
      return {
         ok: false,
         code: "HISTORY_FETCH_FAILED",
         message:
            error instanceof Error
               ? error.message
               : "Failed to retrieve trophy history.",
         data: {
            transactions: [],
            pagination: { page: 1, limit: 20, totalCount: 0, totalPages: 1 },
         },
      };
   }
}

export async function adminAdjustTrophiesAction(
   input: AdminAdjustTrophiesInput
) {
   try {
      const admin = await requireAdminUser();

      const leaderboardEnabled = await isFeatureEnabled(
         FEATURE_FLAG_KEYS.globalLeaderboard
      );
      if (!leaderboardEnabled) {
         return {
            ok: false,
            code: "FEATURE_DISABLED",
            message: "Trophy adjustments are currently unavailable.",
         };
      }

      const parsed = adminAdjustTrophiesSchema.safeParse(input);

      if (!parsed.success) {
         const firstMessage =
            parsed.error.issues?.[0]?.message ||
            (parsed.error as any).errors?.[0]?.message ||
            "Invalid adjustment parameters.";
         return {
            ok: false,
            code: "INVALID_INPUT",
            message: firstMessage,
         };
      }

      const result = await adminAdjustTrophies(
         parsed.data.userId,
         {
            id: admin.id,
            username: admin.username,
         },
         parsed.data.amount,
         parsed.data.reason
      );

      revalidatePath("/wallet");
      revalidatePath("/profile");
      revalidatePath("/leaderboard");
      revalidatePath("/admin");

      return {
         ok: true,
         data: result,
      };
   } catch (error) {
      return {
         ok: false,
         code: "ADJUSTMENT_FAILED",
         message:
            error instanceof Error
               ? error.message
               : "Failed to adjust user trophies.",
      };
   }
}
