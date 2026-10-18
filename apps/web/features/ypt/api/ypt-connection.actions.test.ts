import { describe, it, expect, vi, beforeEach } from "vitest";
import {
   getYptConnectionStatusAction,
   connectYptAccountAction,
   submitYptSelectionAction,
   syncYptStudyNowAction,
   adminConfirmYptClaimAction,
   adminRejectYptClaimAction,
} from "./ypt-connection.actions";
import { requireSessionUser } from "@/features/auth/api/require-session";
import { requireAdminUser } from "@/features/auth/api/require-admin";
import {
   getUserYptConnection,
   saveAuthenticatedYptConnection,
   submitYptMemberClaim,
   adminApproveClaim,
   adminRejectClaim,
} from "../data/ypt-connection.repository";
import { authenticateYptAccount } from "../data/ypt-client.service";
import { syncUserYptStudy } from "./ypt-sync.service";
import { YptConnectionStatus } from "@prisma/client";

vi.mock("@/features/auth/api/require-session", () => ({
   requireSessionUser: vi.fn(),
}));

vi.mock("@/features/auth/api/require-admin", () => ({
   requireAdminUser: vi.fn(),
}));

vi.mock("../data/ypt-connection.repository", () => ({
   getUserYptConnection: vi.fn(),
   saveAuthenticatedYptConnection: vi.fn(),
   fetchRealYptGroupMembers: vi.fn(),
   submitYptMemberClaim: vi.fn(),
   adminApproveClaim: vi.fn(),
   adminRejectClaim: vi.fn(),
   disconnectYptConnection: vi.fn(),
}));

vi.mock("../data/ypt-client.service", () => ({
   authenticateYptAccount: vi.fn(),
}));

vi.mock("./ypt-sync.service", () => ({
   syncUserYptStudy: vi.fn(),
}));

vi.mock("next/cache", () => ({
   revalidatePath: vi.fn(),
}));

import { clearRateLimitStore } from "@/core/security/rate-limiter";

describe("features/ypt/api/ypt-connection.actions", () => {
   beforeEach(() => {
      vi.clearAllMocks();
      clearRateLimitStore();
      vi.mocked(requireSessionUser).mockResolvedValue({
         id: "user-1",
         email: "user@example.com",
         role: "STUDENT",
      } as any);
   });

   it("retrieves connection status for session user", async () => {
      vi.mocked(getUserYptConnection).mockResolvedValue({
         userId: "user-1",
         yptUserId: "11338944",
         yptNickname: "Afnan",
         status: YptConnectionStatus.VERIFIED,
         hasSavedSession: true,
         lastSyncedAt: new Date(),
         lastSyncError: null,
      });

      const res = await getYptConnectionStatusAction();
      expect(res.ok).toBe(true);
      expect(res.data?.status).toBe(YptConnectionStatus.VERIFIED);
   });

   it("authenticates YPT credentials and saves encrypted connection", async () => {
      vi.mocked(authenticateYptAccount).mockResolvedValue({
         user: {
            id: 11338944,
            nickname: "Afnan Pathan",
            email: "afnan@example.com",
            today: "2026-10-16",
         },
         refreshToken: "refresh-token-123",
      });

      vi.mocked(saveAuthenticatedYptConnection).mockResolvedValue({
         id: "conn-1",
         userId: "user-1",
         yptUserId: "11338944",
         yptNickname: "Afnan Pathan",
         status: YptConnectionStatus.CONNECTED,
      } as any);

      const res = await connectYptAccountAction({
         email: "afnan@example.com",
         password: "Password123!",
      });

      expect(res.ok).toBe(true);
      expect(res.data?.yptUserId).toBe("11338944");
      expect(authenticateYptAccount).toHaveBeenCalledWith({
         email: "afnan@example.com",
         password: "Password123!",
      });
      expect(saveAuthenticatedYptConnection).toHaveBeenCalledWith(
         expect.objectContaining({
            userId: "user-1",
            yptUserId: "11338944",
            refreshToken: "refresh-token-123",
         })
      );
   });

   it("handles error 112 by returning sanitized INVALID_CREDENTIALS response", async () => {
      vi.mocked(authenticateYptAccount).mockRejectedValue(
         new Error("YPT API error (code 112)")
      );

      const res = await connectYptAccountAction({
         email: "user@example.com",
         password: "WrongPassword!",
      });

      expect(res.ok).toBe(false);
      expect(res.code).toBe("INVALID_CREDENTIALS");
      expect(res.message).toContain("Incorrect password");
      expect(res.message).not.toContain("code 112");
   });

   it("blocks authentication after rate limit threshold is exceeded", async () => {
      vi.mocked(authenticateYptAccount).mockRejectedValue(
         new Error("YPT API error (code 112)")
      );

      // Attempt 5 times (allowed)
      for (let i = 0; i < 5; i++) {
         await connectYptAccountAction({
            email: "user@example.com",
            password: "WrongPassword!",
         });
      }

      // 6th attempt should be blocked by rate limiter
      const blocked = await connectYptAccountAction({
         email: "user@example.com",
         password: "WrongPassword!",
      });

      expect(blocked.ok).toBe(false);
      expect(blocked.code).toBe("RATE_LIMITED");
      expect(blocked.message).toContain("Too many authentication attempts");
   });

   it("submits YPT identity claim", async () => {
      vi.mocked(submitYptMemberClaim).mockResolvedValue({
         id: "claim-1",
         userId: "user-1",
         yptId: "11338944",
         status: "PENDING",
      } as any);

      const res = await submitYptSelectionAction({
         yptUserId: "11338944",
         yptNickname: "Afnan Pathan",
         groupId: "group-1",
      });

      expect(res.ok).toBe(true);
      expect(res.data?.status).toBe("PENDING");
   });

   it("triggers manual sync for verified user", async () => {
      vi.mocked(syncUserYptStudy).mockResolvedValue({
         ok: true,
         message: "Synced",
         importedDurationSeconds: 3600,
         coinsCredited: 100,
         isDuplicate: false,
         lastSyncedAt: new Date(),
      });

      const res = await syncYptStudyNowAction();

      expect(res.ok).toBe(true);
      expect(res.coinsCredited).toBe(100);
      expect(syncUserYptStudy).toHaveBeenCalledWith("user-1");
   });

   it("allows admin to approve verification claim", async () => {
      vi.mocked(requireAdminUser).mockResolvedValue({
         id: "admin-1",
         role: "ADMIN",
      } as any);

      vi.mocked(adminApproveClaim).mockResolvedValue({
         id: "claim-1",
         userId: "user-1",
         status: "VERIFIED",
      } as any);

      const res = await adminConfirmYptClaimAction({ claimId: "claim-1" });

      expect(res.ok).toBe(true);
      expect(adminApproveClaim).toHaveBeenCalledWith({
         claimId: "claim-1",
         adminUserId: "admin-1",
      });
   });

   it("allows admin to reject verification claim with reason", async () => {
      vi.mocked(requireAdminUser).mockResolvedValue({
         id: "admin-1",
         role: "ADMIN",
      } as any);

      vi.mocked(adminRejectClaim).mockResolvedValue({
         id: "claim-1",
         userId: "user-1",
         status: "REJECTED",
      } as any);

      const res = await adminRejectYptClaimAction({
         claimId: "claim-1",
         reason: "YPT ID does not match Discord applicant.",
      });

      expect(res.ok).toBe(true);
      expect(adminRejectClaim).toHaveBeenCalledWith({
         claimId: "claim-1",
         adminUserId: "admin-1",
         rejectionReason: "YPT ID does not match Discord applicant.",
      });
   });
});
