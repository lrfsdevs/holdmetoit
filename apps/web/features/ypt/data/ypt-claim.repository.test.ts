import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   getEligibleYptMembers,
   getUserActiveClaim,
   getYptRosterWithStatus,
   submitYptClaim,
   adminApproveYptClaim,
   adminRejectYptClaim,
   adminRevokeYptClaim,
   getAdminClaimsList,
} from "./ypt-claim.repository";
import { prisma } from "@/core/db";
import { recordAuditEvent } from "@/features/audit/data/audit-log.repository";
import { getYptServiceRoster } from "./ypt-service-account";

vi.mock("@/core/db", () => ({
   prisma: {
      user: {
         findMany: vi.fn(),
         findFirst: vi.fn(),
         findUnique: vi.fn(),
         update: vi.fn(),
         count: vi.fn(),
      },
      yptIdentityClaim: {
         findMany: vi.fn(),
         findFirst: vi.fn(),
         findUnique: vi.fn(),
         create: vi.fn(),
         update: vi.fn(),
         count: vi.fn(),
      },
      yptConnection: {
         upsert: vi.fn(),
         updateMany: vi.fn(),
         findUnique: vi.fn(),
      },
      $transaction: vi.fn((callback) => callback(prisma)),
   },
}));

vi.mock("@/features/audit/data/audit-log.repository", () => ({
   recordAuditEvent: vi.fn().mockResolvedValue({}),
}));

vi.mock("./ypt-service-account", () => ({
   getYptServiceRoster: vi.fn(),
}));

describe("YPT Claim Repository", () => {
   const mockActor = { id: "usr_alice", username: "alice" };
   const mockAdmin = { id: "admin_1", username: "HostAdmin" };

   beforeEach(() => {
      vi.clearAllMocks();
   });

   describe("getEligibleYptMembers", () => {
      it("returns members and labels statuses correctly", async () => {
         vi.mocked(prisma.user.findMany).mockResolvedValue([
            {
               id: "usr_alice",
               displayName: "Alice",
               username: "alice",
               name: "Alice A",
               image: null,
               yptId: "ypt_alice",
               yptClaims: [
                  { id: "c1", status: "VERIFIED", yptId: "ypt_alice" },
               ],
            },
            {
               id: "usr_bob",
               displayName: "Bob",
               username: "bob",
               name: null,
               image: null,
               yptId: null,
               yptClaims: [],
            },
         ] as any);

         vi.mocked(prisma.yptIdentityClaim.findMany).mockResolvedValue([
            { yptId: "ypt_alice", userId: "usr_alice" },
         ] as any);

         const result = await getEligibleYptMembers({
            currentUserId: "usr_alice",
         });

         expect(result).toHaveLength(2);
         expect(result[0].isSelf).toBe(true);
         expect(result[0].status).toBe("VERIFIED");
         expect(result[1].isSelf).toBe(false);
         expect(result[1].status).toBe("AVAILABLE");
      });
   });

   describe("submitYptClaim", () => {
      it("creates a PENDING claim when YPT ID is available", async () => {
         vi.mocked(prisma.yptIdentityClaim.findFirst)
            .mockResolvedValueOnce(null) // findVerifiedClaimByYptId
            .mockResolvedValueOnce(null); // latestClaim for user
         vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
         vi.mocked(prisma.yptIdentityClaim.create).mockResolvedValue({
            id: "claim_1",
            userId: "usr_alice",
            yptId: "11338944",
            yptName: "Alice",
            status: "PENDING",
         } as any);

         const claim = await submitYptClaim({
            userId: "usr_alice",
            yptId: "11338944",
            yptName: "Alice",
            actor: mockActor,
         });

         expect(claim.status).toBe("PENDING");
         expect(recordAuditEvent).toHaveBeenCalledWith(
            expect.objectContaining({
               actionType: "YPT_CLAIM_CREATED",
            })
         );
      });

      it("rejects claim if YPT ID is already verified by another user", async () => {
         vi.mocked(prisma.yptIdentityClaim.findFirst).mockResolvedValueOnce({
            id: "claim_other",
            userId: "usr_other",
            yptId: "11338944",
            status: "VERIFIED",
         } as any);

         await expect(
            submitYptClaim({
               userId: "usr_alice",
               yptId: "11338944",
               actor: mockActor,
            })
         ).rejects.toThrow(
            "This YPT identity is already linked to another verified participant."
         );
      });
   });

   describe("admin approval & rejection", () => {
      it("approves pending claim and updates user yptId", async () => {
         vi.mocked(prisma.yptIdentityClaim.findUnique).mockResolvedValue({
            id: "claim_1",
            userId: "usr_alice",
            yptId: "11338944",
            status: "PENDING",
         } as any);
         vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
         vi.mocked(prisma.yptIdentityClaim.findFirst).mockResolvedValue(null);
         vi.mocked(prisma.yptIdentityClaim.update).mockResolvedValue({
            id: "claim_1",
            status: "VERIFIED",
         } as any);

         const result = await adminApproveYptClaim({
            claimId: "claim_1",
            admin: mockAdmin,
         });

         expect(result.status).toBe("VERIFIED");
         expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: "usr_alice" },
            data: { yptId: "11338944" },
         });
         expect(recordAuditEvent).toHaveBeenCalledWith(
            expect.objectContaining({
               actionType: "YPT_CLAIM_APPROVED",
            })
         );
      });

      it("rejects pending claim with reason", async () => {
         vi.mocked(prisma.yptIdentityClaim.findUnique).mockResolvedValue({
            id: "claim_1",
            userId: "usr_alice",
            status: "PENDING",
         } as any);
         vi.mocked(prisma.yptIdentityClaim.update).mockResolvedValue({
            id: "claim_1",
            status: "REJECTED",
         } as any);

         const result = await adminRejectYptClaim({
            claimId: "claim_1",
            admin: mockAdmin,
            reason: "Incorrect username",
         });

         expect(result.status).toBe("REJECTED");
         expect(recordAuditEvent).toHaveBeenCalledWith(
            expect.objectContaining({
               actionType: "YPT_CLAIM_REJECTED",
            })
         );
      });

      it("revokes verified claim and unlinks user yptId", async () => {
         vi.mocked(prisma.yptIdentityClaim.findUnique).mockResolvedValue({
            id: "claim_1",
            userId: "usr_alice",
            yptId: "11338944",
            status: "VERIFIED",
         } as any);
         vi.mocked(prisma.yptIdentityClaim.update).mockResolvedValue({
            id: "claim_1",
            status: "REVOKED",
         } as any);

         const result = await adminRevokeYptClaim({
            claimId: "claim_1",
            admin: mockAdmin,
            reason: "Account unlinked",
         });

         expect(result.status).toBe("REVOKED");
         expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: "usr_alice" },
            data: { yptId: null },
         });
         expect(recordAuditEvent).toHaveBeenCalledWith(
            expect.objectContaining({
               actionType: "YPT_ID_UNLINKED",
            })
         );
      });
   });
});

describe("getYptRosterWithStatus", () => {
   function rosterMember(overrides: Record<string, unknown> = {}) {
      return {
         yptUserId: "111",
         nickname: "Afnan",
         avatarUrl: "avatar-a.png",
         todayStudySeconds: 0,
         isStudying: false,
         currentSubject: null,
         studyDate: "2026-10-19",
         groupIds: [],
         ...overrides,
      };
   }

   beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
         yptId: null,
      } as any);
      vi.mocked(prisma.yptIdentityClaim.findMany).mockResolvedValue([] as any);
   });

   it("collapses same nickname + avatar into one row, keeping the most active account", async () => {
      vi.mocked(getYptServiceRoster).mockResolvedValue([
         rosterMember({
            yptUserId: "111",
            todayStudySeconds: 100,
            groupIds: ["g1"],
         }),
         rosterMember({
            yptUserId: "222",
            todayStudySeconds: 500,
            groupIds: ["g2"],
         }),
      ] as any);

      const result = await getYptRosterWithStatus({
         currentUserId: "user-1",
      });

      expect(result).toHaveLength(1);
      expect(result[0].yptUserId).toBe("222");
      expect(result[0].groupIds.sort()).toEqual(["g1", "g2"]);
   });

   it("keeps entries with different avatars separate", async () => {
      vi.mocked(getYptServiceRoster).mockResolvedValue([
         rosterMember({ yptUserId: "111", avatarUrl: "a.png" }),
         rosterMember({ yptUserId: "222", avatarUrl: "b.png" }),
      ] as any);

      const result = await getYptRosterWithStatus({
         currentUserId: "user-1",
      });

      expect(result).toHaveLength(2);
   });

   it("keeps a collapsed row locked when any underlying id is linked to another user", async () => {
      vi.mocked(getYptServiceRoster).mockResolvedValue([
         rosterMember({ yptUserId: "111" }),
         rosterMember({ yptUserId: "222" }),
      ] as any);
      vi.mocked(prisma.yptIdentityClaim.findMany).mockResolvedValue([
         { yptId: "222", userId: "other-user", status: "VERIFIED" },
      ] as any);

      const result = await getYptRosterWithStatus({
         currentUserId: "user-1",
      });

      expect(result).toHaveLength(1);
      expect(result[0].claimStatus).toBe("LINKED");
   });
});
