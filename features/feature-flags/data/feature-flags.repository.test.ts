import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/core/db";
import {
   assignTesterTx,
   createFeatureFlagTx,
   getFlagWithTargetsByKey,
   listFeatureFlags,
   removeTesterTx,
   setRolloutModeTx,
   softDeleteFeatureFlagTx,
   toggleMasterSwitchTx,
} from "./feature-flags.repository";

vi.mock("@/core/db", () => {
   const mockPrisma = {
      $transaction: vi.fn(async (cb: (tx: unknown) => unknown) =>
         cb(mockPrisma)
      ),
      featureFlag: {
         findMany: vi.fn(),
         findUnique: vi.fn(),
         findUniqueOrThrow: vi.fn(),
         create: vi.fn(),
         update: vi.fn(),
      },
      featureFlagTarget: {
         upsert: vi.fn(),
         delete: vi.fn(),
      },
      featureFlagAuditLog: {
         create: vi.fn(),
         findMany: vi.fn(),
      },
      user: {
         findMany: vi.fn(),
      },
   };
   return { prisma: mockPrisma };
});

describe("feature-flags.repository", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   it("lists active feature flags", async () => {
      vi.mocked(prisma.featureFlag.findMany).mockResolvedValueOnce([
         { id: "flag_1", key: "test_flag" } as never,
      ]);

      const result = await listFeatureFlags();
      expect(result).toHaveLength(1);
      expect(prisma.featureFlag.findMany).toHaveBeenCalledWith({
         where: { isDeleted: false },
         orderBy: { createdAt: "desc" },
         include: expect.any(Object),
      });
   });

   it("retrieves a flag with targets by key", async () => {
      vi.mocked(prisma.featureFlag.findUnique).mockResolvedValueOnce({
         id: "flag_1",
         key: "search_v2",
         isEnabled: true,
         rolloutMode: "GLOBAL",
         targets: [],
      } as never);

      const result = await getFlagWithTargetsByKey("search_v2");
      expect(result?.key).toBe("search_v2");
      expect(prisma.featureFlag.findUnique).toHaveBeenCalledWith({
         where: { key: "search_v2", isDeleted: false },
         include: { targets: { select: { userId: true } } },
      });
   });

   it("creates a flag and writes an audit log in transaction", async () => {
      vi.mocked(prisma.featureFlag.create).mockResolvedValueOnce({
         id: "flag_new",
         key: "new_flag",
         name: "New Flag",
         isEnabled: false,
         rolloutMode: "DISABLED",
      } as never);

      const result = await createFeatureFlagTx(
         {
            key: "new_flag",
            name: "New Flag",
            isEnabled: false,
            rolloutMode: "DISABLED",
         },
         "dev_user_1"
      );

      expect(result.id).toBe("flag_new");
      expect(prisma.featureFlag.create).toHaveBeenCalled();
      expect(prisma.featureFlagAuditLog.create).toHaveBeenCalledWith({
         data: {
            flagId: "flag_new",
            actorId: "dev_user_1",
            action: "CREATED",
            newValue: expect.objectContaining({ key: "new_flag" }),
         },
      });
   });

   it("toggles the master switch and writes audit log", async () => {
      vi.mocked(prisma.featureFlag.findUniqueOrThrow).mockResolvedValueOnce({
         id: "flag_1",
         isEnabled: false,
      } as never);

      vi.mocked(prisma.featureFlag.update).mockResolvedValueOnce({
         id: "flag_1",
         isEnabled: true,
      } as never);

      const result = await toggleMasterSwitchTx("flag_1", true, "dev_user_1");
      expect(result.isEnabled).toBe(true);
      expect(prisma.featureFlagAuditLog.create).toHaveBeenCalledWith({
         data: {
            flagId: "flag_1",
            actorId: "dev_user_1",
            action: "TOGGLED_MASTER",
            oldValue: { isEnabled: false },
            newValue: { isEnabled: true },
         },
      });
   });

   it("updates rollout mode and writes audit log", async () => {
      vi.mocked(prisma.featureFlag.findUniqueOrThrow).mockResolvedValueOnce({
         id: "flag_1",
         rolloutMode: "DISABLED",
      } as never);

      vi.mocked(prisma.featureFlag.update).mockResolvedValueOnce({
         id: "flag_1",
         rolloutMode: "TARGETED",
      } as never);

      const result = await setRolloutModeTx("flag_1", "TARGETED", "dev_user_1");
      expect(result.rolloutMode).toBe("TARGETED");
      expect(prisma.featureFlagAuditLog.create).toHaveBeenCalledWith({
         data: {
            flagId: "flag_1",
            actorId: "dev_user_1",
            action: "ROLLOUT_CHANGED",
            oldValue: { rolloutMode: "DISABLED" },
            newValue: { rolloutMode: "TARGETED" },
         },
      });
   });

   it("assigns and removes testers with audit logs", async () => {
      // Assign
      vi.mocked(prisma.featureFlagTarget.upsert).mockResolvedValueOnce({
         flagId: "flag_1",
         userId: "tester_1",
         user: { username: "tester1", displayName: "Tester One" },
      } as never);

      await assignTesterTx("flag_1", "tester_1", "dev_user_1");
      expect(prisma.featureFlagAuditLog.create).toHaveBeenCalledWith({
         data: {
            flagId: "flag_1",
            actorId: "dev_user_1",
            action: "TARGET_ADDED",
            newValue: expect.objectContaining({ targetUserId: "tester_1" }),
         },
      });

      // Remove
      vi.mocked(prisma.featureFlagTarget.delete).mockResolvedValueOnce({
         flagId: "flag_1",
         userId: "tester_1",
         user: { username: "tester1" },
      } as never);

      await removeTesterTx("flag_1", "tester_1", "dev_user_1");
      expect(prisma.featureFlagAuditLog.create).toHaveBeenCalledWith({
         data: {
            flagId: "flag_1",
            actorId: "dev_user_1",
            action: "TARGET_REMOVED",
            oldValue: expect.objectContaining({ targetUserId: "tester_1" }),
         },
      });
   });

   it("soft deletes a flag and turns it off", async () => {
      vi.mocked(prisma.featureFlag.findUniqueOrThrow).mockResolvedValueOnce({
         id: "flag_1",
         key: "obsolete_feature",
         name: "Old Feature",
      } as never);

      vi.mocked(prisma.featureFlag.update).mockResolvedValueOnce({
         id: "flag_1",
         isDeleted: true,
         isEnabled: false,
      } as never);

      const result = await softDeleteFeatureFlagTx("flag_1", "dev_user_1");
      expect(result.isDeleted).toBe(true);
      expect(prisma.featureFlag.update).toHaveBeenCalledWith({
         where: { id: "flag_1" },
         data: expect.objectContaining({ isDeleted: true, isEnabled: false }),
      });
      expect(prisma.featureFlagAuditLog.create).toHaveBeenCalledWith({
         data: {
            flagId: "flag_1",
            actorId: "dev_user_1",
            action: "SOFT_DELETED",
            oldValue: { key: "obsolete_feature", name: "Old Feature" },
         },
      });
   });
});
