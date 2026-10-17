"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSessionUser } from "@/features/auth/api/require-session";
import { requireAdminUser } from "@/features/auth/api/require-admin";
import {
   getUserYptConnection,
   saveAuthenticatedYptConnection,
   fetchRealYptGroupMembers,
   submitYptMemberClaim,
   adminApproveClaim,
   adminRejectClaim,
   disconnectYptConnection,
} from "../data/ypt-connection.repository";
import { authenticateYptAccount } from "../data/ypt-client.service";
import { syncUserYptStudy } from "./ypt-sync.service";
import { YptConnectionStatus } from "@prisma/client";

const connectCredentialsSchema = z.object({
   email: z.string().email("Valid email required"),
   password: z.string().min(1, "Password required"),
});

const submitSelectionSchema = z.object({
   yptUserId: z.string().min(1, "Valid YPT ID required"),
   yptNickname: z.string().max(128).optional(),
   groupId: z.string().optional(),
});

export async function getYptConnectionStatusAction() {
   try {
      const user = await requireSessionUser();
      const connection = await getUserYptConnection(user.id);

      return {
         ok: true,
         data: connection,
      };
   } catch (error) {
      return {
         ok: false,
         code: "FETCH_STATUS_FAILED",
         message:
            error instanceof Error
               ? error.message
               : "Failed to retrieve YPT connection status.",
         data: null,
      };
   }
}

import { classifyYptError } from "../domain/ypt-error-classifier";
import { checkRateLimit, resetRateLimit } from "@/core/security/rate-limiter";

export async function connectYptAccountAction(input: {
   email: string;
   password: string;
}) {
   try {
      const user = await requireSessionUser();

      // Enforce rate limiting: max 5 attempts per 5 minutes per user
      const rateLimitKey = `ypt_auth:${user.id}`;
      const rateCheck = checkRateLimit(rateLimitKey, {
         maxAttempts: 5,
         windowMs: 5 * 60 * 1000,
      });

      if (!rateCheck.allowed) {
         return {
            ok: false,
            code: "RATE_LIMITED",
            message:
               "Too many authentication attempts. Please wait 5 minutes before retrying.",
         };
      }

      const parsed = connectCredentialsSchema.safeParse(input);

      if (!parsed.success) {
         return {
            ok: false,
            code: "INVALID_CREDENTIALS",
            message: parsed.error.issues?.[0]?.message || "Invalid input.",
         };
      }

      // 1. Authenticate with YPT using ypt-js
      const authResult = await authenticateYptAccount({
         email: parsed.data.email,
         password: parsed.data.password,
      });

      // Reset rate limit count upon successful authentication
      resetRateLimit(rateLimitKey);

      // 2. Save encrypted refresh token in connection repository
      const conn = await saveAuthenticatedYptConnection({
         userId: user.id,
         yptUserId: String(authResult.user.id),
         yptNickname: authResult.user.nickname,
         refreshToken: authResult.refreshToken,
         status: YptConnectionStatus.CONNECTED,
      });

      revalidatePath("/wallet");
      revalidatePath("/profile");

      return {
         ok: true,
         data: {
            yptUserId: String(authResult.user.id),
            yptNickname: authResult.user.nickname,
            status: conn.status,
         },
      };
   } catch (error) {
      const classified = classifyYptError(error, "connectYptAccountAction");
      return {
         ok: false,
         code: classified.kind,
         message: classified.sanitizedMessage,
      };
   }
}

export async function getRealYptGroupMembersAction() {
   try {
      const user = await requireSessionUser();
      const members = await fetchRealYptGroupMembers(user.id);

      return {
         ok: true,
         data: members,
      };
   } catch (error) {
      const classified = classifyYptError(
         error,
         "getRealYptGroupMembersAction"
      );
      return {
         ok: false,
         code: classified.kind,
         message: classified.sanitizedMessage,
         data: [],
      };
   }
}

export async function submitYptSelectionAction(input: {
   yptUserId: string;
   yptNickname?: string;
   groupId?: string;
}) {
   try {
      const user = await requireSessionUser();
      const parsed = submitSelectionSchema.safeParse(input);

      if (!parsed.success) {
         return {
            ok: false,
            code: "INVALID_INPUT",
            message: parsed.error.issues?.[0]?.message || "Invalid input.",
         };
      }

      const claim = await submitYptMemberClaim({
         userId: user.id,
         yptUserId: parsed.data.yptUserId,
         yptNickname: parsed.data.yptNickname,
         groupId: parsed.data.groupId,
      });

      revalidatePath("/wallet");
      revalidatePath("/admin");

      return {
         ok: true,
         data: claim,
      };
   } catch (error) {
      return {
         ok: false,
         code: "SUBMIT_CLAIM_FAILED",
         message:
            error instanceof Error
               ? error.message
               : "Failed to submit verification claim.",
      };
   }
}

export async function syncYptStudyNowAction() {
   try {
      const user = await requireSessionUser();
      const result = await syncUserYptStudy(user.id);

      revalidatePath("/wallet");
      revalidatePath("/");
      revalidatePath("/dashboard");

      return result;
   } catch (error) {
      return {
         ok: false,
         code: "SYNC_ERROR",
         message:
            error instanceof Error
               ? error.message
               : "Study synchronization failed.",
         importedDurationSeconds: 0,
         coinsCredited: 0,
         isDuplicate: false,
         lastSyncedAt: null,
      };
   }
}

export async function disconnectYptAccountAction() {
   try {
      const user = await requireSessionUser();
      await disconnectYptConnection(user.id);

      revalidatePath("/wallet");

      return {
         ok: true,
         message: "Disconnected from Yeolpumta.",
      };
   } catch (error) {
      return {
         ok: false,
         code: "DISCONNECT_FAILED",
         message:
            error instanceof Error ? error.message : "Failed to disconnect.",
      };
   }
}

export async function adminConfirmYptClaimAction(input: { claimId: string }) {
   try {
      const admin = await requireAdminUser();
      const updated = await adminApproveClaim({
         claimId: input.claimId,
         adminUserId: admin.id,
      });

      // Trigger automatic initial sync for the approved user
      try {
         await syncUserYptStudy(updated.userId);
      } catch {
         // Silently catch initial sync errors so admin confirmation is never blocked
      }

      revalidatePath("/admin");
      revalidatePath("/wallet");
      revalidatePath("/leaderboard");

      return {
         ok: true,
         data: updated,
      };
   } catch (error) {
      return {
         ok: false,
         code: "APPROVAL_FAILED",
         message:
            error instanceof Error ? error.message : "Failed to approve claim.",
      };
   }
}

export async function adminRejectYptClaimAction(input: {
   claimId: string;
   reason: string;
}) {
   try {
      const admin = await requireAdminUser();
      const updated = await adminRejectClaim({
         claimId: input.claimId,
         adminUserId: admin.id,
         rejectionReason: input.reason,
      });

      revalidatePath("/admin");
      revalidatePath("/wallet");

      return {
         ok: true,
         data: updated,
      };
   } catch (error) {
      return {
         ok: false,
         code: "REJECTION_FAILED",
         message:
            error instanceof Error ? error.message : "Failed to reject claim.",
      };
   }
}
