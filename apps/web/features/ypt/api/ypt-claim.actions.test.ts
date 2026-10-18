import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   adminApproveClaimAction,
   adminRejectClaimAction,
   adminRevokeClaimAction,
   getAdminClaimsListAction,
} from "./ypt-claim.actions";
import * as repo from "../data/ypt-claim.repository";
import * as requireDev from "@/features/auth/api/require-dev";

vi.mock("@/features/auth/api/require-session", () => ({
   requireSessionUser: vi.fn(),
}));

vi.mock("@/features/auth/api/require-dev", () => {
   class DevAccessError extends Error {
      code = "FORBIDDEN_NOT_DEV";
      constructor(msg = "Developer permissions required.") {
         super(msg);
         this.name = "DevAccessError";
      }
   }
   return { requireDevUser: vi.fn(), DevAccessError };
});

vi.mock("../data/ypt-claim.repository", () => ({
   getEligibleYptMembers: vi.fn(),
   getUserActiveClaim: vi.fn(),
   submitYptClaim: vi.fn(),
   adminApproveYptClaim: vi.fn(),
   adminRejectYptClaim: vi.fn(),
   adminRevokeYptClaim: vi.fn(),
   getAdminClaimsList: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("YPT claim admin actions (DEV-only)", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   const devUser = {
      id: "dev_1",
      username: "dev",
      displayName: "Dev",
      role: "DEV" as const,
   };

   it("rejects non-DEV callers with FORBIDDEN_NOT_DEV", async () => {
      vi.mocked(requireDev.requireDevUser).mockRejectedValue(
         new requireDev.DevAccessError()
      );

      const approve = await adminApproveClaimAction("c_1");
      expect(approve.ok).toBe(false);
      if (!approve.ok) expect(approve.code).toBe("FORBIDDEN_NOT_DEV");

      const list = await getAdminClaimsListAction();
      expect(list.ok).toBe(false);
      if (!list.ok) expect(list.code).toBe("FORBIDDEN_NOT_DEV");

      expect(repo.adminApproveYptClaim).not.toHaveBeenCalled();
      expect(repo.getAdminClaimsList).not.toHaveBeenCalled();
   });

   it("allows DEV callers and delegates to the repository", async () => {
      vi.mocked(requireDev.requireDevUser).mockResolvedValue(devUser);
      vi.mocked(repo.adminApproveYptClaim).mockResolvedValue({
         id: "c_1",
         status: "VERIFIED",
      } as any);
      vi.mocked(repo.adminRejectYptClaim).mockResolvedValue({
         id: "c_2",
         status: "REJECTED",
      } as any);
      vi.mocked(repo.adminRevokeYptClaim).mockResolvedValue({
         id: "c_3",
         status: "REVOKED",
      } as any);
      vi.mocked(repo.getAdminClaimsList).mockResolvedValue({
         claims: [],
         pagination: { page: 1, limit: 20, totalCount: 0, totalPages: 1 },
         counts: { pending: 0, verified: 0, rejected: 0 },
      } as any);

      const approve = await adminApproveClaimAction("c_1");
      expect(approve.ok).toBe(true);
      expect(repo.adminApproveYptClaim).toHaveBeenCalledWith(
         expect.objectContaining({
            claimId: "c_1",
            admin: { id: "dev_1", username: "dev" },
         })
      );

      const reject = await adminRejectClaimAction("c_2", "bad id");
      expect(reject.ok).toBe(true);
      expect(repo.adminRejectYptClaim).toHaveBeenCalledWith(
         expect.objectContaining({ claimId: "c_2", reason: "bad id" })
      );

      const revoke = await adminRevokeClaimAction("c_3", "cleanup");
      expect(revoke.ok).toBe(true);

      const list = await getAdminClaimsListAction({ status: "PENDING" });
      expect(list.ok).toBe(true);
      expect(repo.getAdminClaimsList).toHaveBeenCalledWith({
         status: "PENDING",
      });
   });
});
