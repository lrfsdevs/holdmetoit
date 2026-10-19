"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSessionUser } from "@/features/auth/api/require-session";
import {
   DevAccessError,
   requireDevUser,
} from "@/features/auth/api/require-dev";
import {
   getEligibleYptMembers,
   getUserActiveClaim,
   getYptRosterWithStatus,
   submitYptClaim,
   adminApproveYptClaim,
   adminRejectYptClaim,
   adminRevokeYptClaim,
   getAdminClaimsList,
   GetAdminClaimsOptions,
} from "../data/ypt-claim.repository";
import { YptClaimStatus } from "../domain/ypt-claim-state-machine";
import { classifyYptError } from "../domain/ypt-error-classifier";
import { checkRateLimit } from "@/core/security/rate-limiter";

const submitYptClaimSchema = z.object({
   yptId: z
      .string()
      .min(1, "YPT ID cannot be empty")
      .max(64, "YPT ID too long")
      .regex(/^[0-9a-zA-Z_-]+$/, "YPT ID contains invalid characters"),
   yptName: z.string().max(128).optional(),
   selectedUserId: z.string().optional(),
});

export type SubmitYptClaimInput = z.infer<typeof submitYptClaimSchema>;

const submitYptSelectionSchema = z.object({
   yptUserId: z.string().min(1, "Valid YPT ID required").max(64),
   yptNickname: z.string().max(128).optional(),
   groupId: z.string().max(64).optional(),
});

export type SubmitYptSelectionInput = z.infer<typeof submitYptSelectionSchema>;

export async function getEligibleMembersAction(search?: string) {
   try {
      const user = await requireSessionUser();
      const members = await getEligibleYptMembers({
         currentUserId: user.id,
         search,
      });

      return {
         ok: true,
         data: members,
      };
   } catch (error) {
      return {
         ok: false,
         code: "FETCH_MEMBERS_FAILED",
         message:
            error instanceof Error
               ? error.message
               : "Failed to fetch eligible members.",
         data: [],
      };
   }
}

export async function getCurrentUserClaimStatusAction() {
   try {
      const user = await requireSessionUser();
      const claim = await getUserActiveClaim(user.id);

      return {
         ok: true,
         data: claim,
      };
   } catch (error) {
      return {
         ok: false,
         code: "FETCH_STATUS_FAILED",
         message:
            error instanceof Error
               ? error.message
               : "Failed to retrieve claim status.",
         data: null,
      };
   }
}

export async function submitYptClaimAction(input: SubmitYptClaimInput) {
   try {
      const user = await requireSessionUser();
      const parsed = submitYptClaimSchema.safeParse(input);

      if (!parsed.success) {
         const firstMessage =
            parsed.error.issues?.[0]?.message ||
            (parsed.error as any).errors?.[0]?.message ||
            "Invalid claim input.";
         return {
            ok: false,
            code: "INVALID_INPUT",
            message: firstMessage,
         };
      }

      const claim = await submitYptClaim({
         userId: user.id,
         yptId: parsed.data.yptId,
         yptName: parsed.data.yptName,
         selectedUserId: parsed.data.selectedUserId,
         actor: {
            id: user.id,
            username: user.name || user.email || "user",
         },
      });

      revalidatePath("/wallet");
      revalidatePath("/profile");
      revalidatePath("/admin");

      return {
         ok: true,
         data: claim,
      };
   } catch (error) {
      return {
         ok: false,
         code: "CLAIM_SUBMISSION_FAILED",
         message:
            error instanceof Error
               ? error.message
               : "Failed to submit YPT verification request.",
      };
   }
}

/**
 * Returns searchable roster entries with claim status for the signed-in user.
 * Limits roster lookups per user and returns sanitized upstream errors.
 */
export async function getYptRosterAction(search?: string) {
   try {
      const user = await requireSessionUser();

      const rateCheck = checkRateLimit(`ypt_roster:${user.id}`, {
         maxAttempts: 30,
         windowMs: 60 * 1000,
      });

      if (!rateCheck.allowed) {
         return {
            ok: false,
            code: "RATE_LIMITED",
            message: "Too many roster lookups. Please wait a moment.",
            data: [],
         };
      }

      const roster = await getYptRosterWithStatus({
         currentUserId: user.id,
         search,
      });

      return {
         ok: true,
         data: roster,
      };
   } catch (error) {
      const message =
         error instanceof Error && error.message.includes("not configured")
            ? error.message
            : classifyYptError(error, "getYptRosterAction").sanitizedMessage;
      return {
         ok: false,
         code: "FETCH_ROSTER_FAILED",
         message,
         data: [],
      };
   }
}

/**
 * Validates and rate-limits the signed-in user’s roster selection before submitting a pending claim.
 */
export async function submitYptSelectionAction(input: SubmitYptSelectionInput) {
   try {
      const user = await requireSessionUser();
      const parsed = submitYptSelectionSchema.safeParse(input);

      if (!parsed.success) {
         const firstMessage =
            parsed.error.issues?.[0]?.message || "Invalid selection input.";
         return {
            ok: false,
            code: "INVALID_INPUT",
            message: firstMessage,
         };
      }

      const rateCheck = checkRateLimit(`ypt_claim:${user.id}`, {
         maxAttempts: 10,
         windowMs: 10 * 60 * 1000,
      });

      if (!rateCheck.allowed) {
         return {
            ok: false,
            code: "RATE_LIMITED",
            message:
               "Too many verification requests. Please wait before retrying.",
         };
      }

      const claim = await submitYptClaim({
         userId: user.id,
         yptId: parsed.data.yptUserId,
         yptName: parsed.data.yptNickname,
         groupId: parsed.data.groupId,
         actor: {
            id: user.id,
            username: user.name || user.email || "user",
         },
      });

      revalidatePath("/wallet");
      revalidatePath("/profile");
      revalidatePath("/admin");
      revalidatePath("/devboard");

      return {
         ok: true,
         data: claim,
      };
   } catch (error) {
      return {
         ok: false,
         code: "CLAIM_SUBMISSION_FAILED",
         message:
            error instanceof Error
               ? error.message
               : "Failed to submit YPT verification request.",
      };
   }
}

function isDevAccessError(error: unknown): boolean {
   return (
      error instanceof DevAccessError ||
      (typeof error === "object" &&
         error !== null &&
         (error as { code?: string }).code === "FORBIDDEN_NOT_DEV")
   );
}

export async function adminApproveClaimAction(
   claimId: string,
   reason?: string
) {
   try {
      const dev = await requireDevUser();

      const updated = await adminApproveYptClaim({
         claimId,
         admin: {
            id: dev.id,
            username: dev.username,
         },
         reason,
      });

      revalidatePath("/wallet");
      revalidatePath("/profile");
      revalidatePath("/admin");
      revalidatePath("/devboard");

      return {
         ok: true,
         data: updated,
      };
   } catch (error) {
      if (isDevAccessError(error)) {
         return {
            ok: false,
            code: "FORBIDDEN_NOT_DEV",
            message: "Developer permissions required.",
         };
      }
      return {
         ok: false,
         code: "APPROVAL_FAILED",
         message:
            error instanceof Error
               ? error.message
               : "Failed to approve YPT claim.",
      };
   }
}

export async function adminRejectClaimAction(claimId: string, reason: string) {
   try {
      const dev = await requireDevUser();

      const updated = await adminRejectYptClaim({
         claimId,
         admin: {
            id: dev.id,
            username: dev.username,
         },
         reason,
      });

      revalidatePath("/wallet");
      revalidatePath("/profile");
      revalidatePath("/admin");
      revalidatePath("/devboard");

      return {
         ok: true,
         data: updated,
      };
   } catch (error) {
      if (isDevAccessError(error)) {
         return {
            ok: false,
            code: "FORBIDDEN_NOT_DEV",
            message: "Developer permissions required.",
         };
      }
      return {
         ok: false,
         code: "REJECTION_FAILED",
         message:
            error instanceof Error
               ? error.message
               : "Failed to reject YPT claim.",
      };
   }
}

export async function adminRevokeClaimAction(claimId: string, reason: string) {
   try {
      const dev = await requireDevUser();

      const updated = await adminRevokeYptClaim({
         claimId,
         admin: {
            id: dev.id,
            username: dev.username,
         },
         reason,
      });

      revalidatePath("/wallet");
      revalidatePath("/profile");
      revalidatePath("/admin");
      revalidatePath("/devboard");

      return {
         ok: true,
         data: updated,
      };
   } catch (error) {
      if (isDevAccessError(error)) {
         return {
            ok: false,
            code: "FORBIDDEN_NOT_DEV",
            message: "Developer permissions required.",
         };
      }
      return {
         ok: false,
         code: "REVOCATION_FAILED",
         message:
            error instanceof Error
               ? error.message
               : "Failed to revoke YPT claim.",
      };
   }
}

export async function getAdminClaimsListAction(
   options?: GetAdminClaimsOptions
) {
   try {
      await requireDevUser();
      const list = await getAdminClaimsList(options);

      return {
         ok: true,
         data: list,
      };
   } catch (error) {
      if (isDevAccessError(error)) {
         return {
            ok: false,
            code: "FORBIDDEN_NOT_DEV",
            message: "Developer permissions required.",
            data: {
               claims: [],
               pagination: { page: 1, limit: 20, totalCount: 0, totalPages: 1 },
               counts: { pending: 0, verified: 0, rejected: 0 },
            },
         };
      }
      return {
         ok: false,
         code: "FETCH_CLAIMS_FAILED",
         message:
            error instanceof Error
               ? error.message
               : "Failed to retrieve claim requests.",
         data: {
            claims: [],
            pagination: { page: 1, limit: 20, totalCount: 0, totalPages: 1 },
            counts: { pending: 0, verified: 0, rejected: 0 },
         },
      };
   }
}
