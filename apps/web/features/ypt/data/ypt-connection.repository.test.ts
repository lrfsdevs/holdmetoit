import { describe, it, expect, vi, beforeEach } from "vitest";
import {
   getUserYptConnection,
   updateYptConnectionStatus,
} from "./ypt-connection.repository";
import { prisma } from "@/core/db";
import { YptConnectionStatus } from "@prisma/client";

vi.mock("@/core/db", () => ({
   prisma: {
      user: { findUnique: vi.fn() },
      yptConnection: { updateMany: vi.fn() },
   },
}));

describe("features/ypt/data/ypt-connection.repository", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   it("returns null when the user does not exist", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const conn = await getUserYptConnection("missing");

      expect(conn).toBeNull();
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
      expect(conn?.yptUserId).toBe("");
   });

   it("returns VERIFIED when the user has a verified yptId", async () => {
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
      expect(conn?.yptNickname).toBe("Afnan Pathan");
   });

   it("returns PENDING_VERIFICATION when the latest claim is pending", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
         id: "user-1",
         yptId: null,
         yptConnection: {
            id: "conn-1",
            status: YptConnectionStatus.NOT_CONNECTED,
            yptUserId: "11338944",
            yptNickname: "Afnan Pathan",
            lastSyncedAt: null,
            lastSyncError: null,
         },
         yptClaims: [
            {
               id: "claim-1",
               status: "PENDING",
               yptId: "11338944",
               yptName: "Afnan Pathan",
               groupId: "111",
               rejectionReason: null,
            },
         ],
      } as any);

      const conn = await getUserYptConnection("user-1");

      expect(conn?.status).toBe(YptConnectionStatus.PENDING_VERIFICATION);
   });

   it("returns REJECTED when the latest claim is rejected", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
         id: "user-1",
         yptId: null,
         yptConnection: null,
         yptClaims: [
            {
               id: "claim-1",
               status: "REJECTED",
               yptId: "11338944",
               yptName: null,
               groupId: null,
               rejectionReason: "Not your account",
            },
         ],
      } as any);

      const conn = await getUserYptConnection("user-1");

      expect(conn?.status).toBe(YptConnectionStatus.REJECTED);
      expect(conn?.activeClaim?.rejectionReason).toBe("Not your account");
   });

   it("updates connection status and sync metadata", async () => {
      vi.mocked(prisma.yptConnection.updateMany).mockResolvedValue({
         count: 1,
      } as any);

      await updateYptConnectionStatus({
         userId: "user-1",
         status: YptConnectionStatus.VERIFIED,
         errorMessage: null,
         lastSyncedAt: new Date(),
      });

      expect(prisma.yptConnection.updateMany).toHaveBeenCalledWith(
         expect.objectContaining({
            where: { userId: "user-1" },
            data: expect.objectContaining({
               status: YptConnectionStatus.VERIFIED,
               lastSyncError: null,
            }),
         })
      );
   });
});
