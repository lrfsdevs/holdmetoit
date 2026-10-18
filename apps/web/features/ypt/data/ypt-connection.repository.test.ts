import { describe, it, expect, vi, beforeEach } from "vitest";
import {
   getUserYptConnection,
   saveAuthenticatedYptConnection,
   submitYptMemberClaim,
   adminApproveClaim,
   adminRejectClaim,
   disconnectYptConnection,
} from "./ypt-connection.repository";
import { prisma } from "@/core/db";
import { YptConnectionStatus } from "@prisma/client";

vi.mock("@/core/db", () => {
   const mockTx = {
      yptIdentityClaim: {
         update: vi.fn(),
      },
      user: {
         update: vi.fn(),
      },
      yptConnection: {
         upsert: vi.fn(),
         updateMany: vi.fn(),
      },
   };

   return {
      prisma: {
         user: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            update: vi.fn(),
         },
         yptConnection: {
            findUnique: vi.fn(),
            upsert: vi.fn(),
            updateMany: vi.fn(),
         },
         yptIdentityClaim: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            create: vi.fn(),
            updateMany: vi.fn(),
         },
         $transaction: vi.fn(async (cb: any) => cb(mockTx)),
      },
   };
});

vi.mock("@/core/security/encryption", () => ({
   encryptSensitiveToken: vi.fn((token: string) => `encrypted_${token}`),
   decryptSensitiveToken: vi.fn((cipher: string) =>
      cipher.replace("encrypted_", "")
   ),
}));

vi.mock("@/features/audit/data/audit-log.repository", () => ({
   recordAuditEvent: vi.fn().mockResolvedValue({ id: "audit-1" }),
}));

describe("features/ypt/data/ypt-connection.repository", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   it("returns NOT_CONNECTED when user has no connection or claim", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
         id: "user-1",
         yptId: null,
         yptConnection: null,
         yptClaims: [],
      } as any);

      const conn = await getUserYptConnection("user-1");
      expect(conn?.status).toBe(YptConnectionStatus.NOT_CONNECTED);
      expect(conn?.hasSavedSession).toBe(false);
   });

   it("preserves existing verified user with yptId", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
         id: "user-1",
         yptId: "11338944",
         yptConnection: null,
         yptClaims: [
            {
               id: "claim-1",
               status: "VERIFIED",
               yptId: "11338944",
               yptName: "Afnan Pathan",
               groupId: null,
               rejectionReason: null,
            },
         ],
      } as any);

      const conn = await getUserYptConnection("user-1");
      expect(conn?.status).toBe(YptConnectionStatus.VERIFIED);
      expect(conn?.yptUserId).toBe("11338944");
   });

   it("saves authenticated YPT connection with encrypted refresh token", async () => {
      vi.mocked(prisma.yptConnection.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.yptConnection.upsert).mockResolvedValue({
         id: "conn-1",
         userId: "user-1",
         yptUserId: "11338944",
         status: YptConnectionStatus.CONNECTED,
      } as any);

      await saveAuthenticatedYptConnection({
         userId: "user-1",
         yptUserId: "11338944",
         yptNickname: "Afnan Pathan",
         refreshToken: "raw-refresh-token",
      });

      expect(prisma.yptConnection.upsert).toHaveBeenCalledWith(
         expect.objectContaining({
            where: { userId: "user-1" },
            create: expect.objectContaining({
               userId: "user-1",
               yptUserId: "11338944",
               encryptedRefreshToken: "encrypted_raw-refresh-token",
            }),
         })
      );
   });

   it("preserves VERIFIED status when connecting for existing verified user", async () => {
      vi.mocked(prisma.yptConnection.findUnique).mockResolvedValue({
         status: YptConnectionStatus.VERIFIED,
         yptUserId: "11338944",
      } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
         yptId: "11338944",
      } as any);
      vi.mocked(prisma.yptConnection.upsert).mockResolvedValue({
         id: "conn-1",
         userId: "user-1",
         yptUserId: "11338944",
         status: YptConnectionStatus.VERIFIED,
      } as any);

      await saveAuthenticatedYptConnection({
         userId: "user-1",
         yptUserId: "11338944",
         refreshToken: "new-refresh-token",
      });

      expect(prisma.yptConnection.upsert).toHaveBeenCalledWith(
         expect.objectContaining({
            create: expect.objectContaining({
               status: YptConnectionStatus.VERIFIED,
            }),
            update: expect.objectContaining({
               status: YptConnectionStatus.VERIFIED,
            }),
         })
      );
   });

   it("submits identity claim and updates connection to PENDING_VERIFICATION", async () => {
      vi.mocked(prisma.yptIdentityClaim.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.yptIdentityClaim.create).mockResolvedValue({
         id: "claim-new",
         userId: "user-1",
         yptId: "11338944",
         status: "PENDING",
      } as any);

      const claim = await submitYptMemberClaim({
         userId: "user-1",
         yptUserId: "11338944",
         yptNickname: "Afnan Pathan",
         groupId: "group-101",
      });

      expect(claim.status).toBe("PENDING");
      expect(prisma.yptConnection.upsert).toHaveBeenCalledWith(
         expect.objectContaining({
            create: expect.objectContaining({
               status: YptConnectionStatus.PENDING_VERIFICATION,
            }),
         })
      );
   });

   it("rejects claim when YPT ID is already verified by another user", async () => {
      vi.mocked(prisma.yptIdentityClaim.findFirst).mockResolvedValue({
         id: "existing-claim",
         userId: "other-user",
         status: "VERIFIED",
      } as any);

      await expect(
         submitYptMemberClaim({
            userId: "user-1",
            yptUserId: "11338944",
         })
      ).rejects.toThrow("already linked and verified by another user");
   });

   it("disconnects YPT connection safely", async () => {
      await disconnectYptConnection("user-1");

      expect(prisma.yptConnection.updateMany).toHaveBeenCalledWith({
         where: { userId: "user-1" },
         data: {
            encryptedRefreshToken: null,
            status: YptConnectionStatus.NOT_CONNECTED,
            lastSyncError: null,
         },
      });
   });
});
