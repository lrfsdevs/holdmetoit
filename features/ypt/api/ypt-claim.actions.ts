"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSessionUser } from "@/features/auth/api/require-session";
import { requireAdminUser } from "@/features/auth/api/require-admin";
import {
   getEligibleYptMembers,
   getUserActiveClaim,
   submitYptClaim,
   adminApproveYptClaim,
   adminRejectYptClaim,
   adminRevokeYptClaim,
   getAdminClaimsList,
   GetAdminClaimsOptions,
} from "../data/ypt-claim.repository";
import { YptClaimStatus } from "../domain/ypt-claim-state-machine";

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

export async function adminApproveClaimAction(
   claimId: string,
   reason?: string
) {
   try {
      const admin = await requireAdminUser();

      const updated = await adminApproveYptClaim({
         claimId,
         admin: {
            id: admin.id,
            username: admin.username,
         },
         reason,
      });

      revalidatePath("/wallet");
      revalidatePath("/profile");
      revalidatePath("/admin");

      return {
         ok: true,
         data: updated,
      };
   } catch (error) {
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
      const admin = await requireAdminUser();

      const updated = await adminRejectYptClaim({
         claimId,
         admin: {
            id: admin.id,
            username: admin.username,
         },
         reason,
      });

      revalidatePath("/wallet");
      revalidatePath("/profile");
      revalidatePath("/admin");

      return {
         ok: true,
         data: updated,
      };
   } catch (error) {
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
      const admin = await requireAdminUser();

      const updated = await adminRevokeYptClaim({
         claimId,
         admin: {
            id: admin.id,
            username: admin.username,
         },
         reason,
      });

      revalidatePath("/wallet");
      revalidatePath("/profile");
      revalidatePath("/admin");

      return {
         ok: true,
         data: updated,
      };
   } catch (error) {
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
      await requireAdminUser();
      const list = await getAdminClaimsList(options);

      return {
         ok: true,
         data: list,
      };
   } catch (error) {
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
