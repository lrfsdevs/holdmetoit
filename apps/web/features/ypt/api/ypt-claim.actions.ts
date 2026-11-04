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
import { toClientError } from "@/core/errors";

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
      const clientError = toClientError(error, {
         scope: "ypt.claim.eligible_members",
         defaultCode: "FETCH_MEMBERS_FAILED",
         defaultMessage: "Failed to fetch eligible members.",
      });
      return {
         ok: false,
         code: clientError.code,
         message: clientError.message,
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
      const clientError = toClientError(error, {
         scope: "ypt.claim.status",
         defaultCode: "FETCH_STATUS_FAILED",
         defaultMessage: "Failed to retrieve claim status.",
      });
      return {
         ok: false,
         code: clientError.code,
         message: clientError.message,
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
      const clientError = toClientError(error, {
         scope: "ypt.claim.submit",
         defaultCode: "CLAIM_SUBMISSION_FAILED",
         defaultMessage: "Failed to submit YPT verification request.",
         context: { yptId: input?.yptId },
      });
      return {
         ok: false,
         code: clientError.code,
         message: clientError.message,
      };
   }
}

/**
 * Returns searchable roster entries with claim status for the signed-in user.
 * Returns sanitized upstream errors.
 */
export async function getYptRosterAction(search?: string) {
   try {
      const user = await requireSessionUser();

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
 * Validates the signed-in user’s roster selection before submitting a pending claim.
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
      const clientError = toClientError(error, {
         scope: "ypt.claim.select",
         defaultCode: "CLAIM_SUBMISSION_FAILED",
         defaultMessage: "Failed to submit YPT verification request.",
         context: { yptUserId: input?.yptUserId },
      });
      return {
         ok: false,
         code: clientError.code,
         message: clientError.message,
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
      const clientError = toClientError(error, {
         scope: "ypt.claim.approve",
         defaultCode: "APPROVAL_FAILED",
         defaultMessage: "Failed to approve YPT claim.",
         context: { claimId },
      });
      return {
         ok: false,
         code: clientError.code,
         message: clientError.message,
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
      const clientError = toClientError(error, {
         scope: "ypt.claim.reject",
         defaultCode: "REJECTION_FAILED",
         defaultMessage: "Failed to reject YPT claim.",
         context: { claimId },
      });
      return {
         ok: false,
         code: clientError.code,
         message: clientError.message,
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
      const clientError = toClientError(error, {
         scope: "ypt.claim.revoke",
         defaultCode: "REVOCATION_FAILED",
         defaultMessage: "Failed to revoke YPT claim.",
         context: { claimId },
      });
      return {
         ok: false,
         code: clientError.code,
         message: clientError.message,
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
      const clientError = toClientError(error, {
         scope: "ypt.claim.admin_list",
         defaultCode: "FETCH_CLAIMS_FAILED",
         defaultMessage: "Failed to retrieve claim requests.",
      });
      return {
         ok: false,
         code: clientError.code,
         message: clientError.message,
         data: {
            claims: [],
            pagination: { page: 1, limit: 20, totalCount: 0, totalPages: 1 },
            counts: { pending: 0, verified: 0, rejected: 0 },
         },
      };
   }
}
