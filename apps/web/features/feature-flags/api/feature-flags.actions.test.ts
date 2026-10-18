import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   assignTesterAction,
   createFeatureFlagAction,
   deleteFeatureFlagAction,
   removeTesterAction,
   setRolloutModeAction,
} from "./feature-flags.actions";
import { requireDevUser } from "@/features/auth/api/require-dev";
import * as repo from "../data/feature-flags.repository";

vi.mock("@/features/auth/api/require-dev", () => ({
   requireDevUser: vi.fn(),
   DevAccessError: class extends Error {
      readonly code = "FORBIDDEN_NOT_DEV";
   },
}));

vi.mock("next/cache", () => ({
   revalidatePath: vi.fn(),
}));

vi.mock("../data/feature-flags.repository", () => ({
   createFeatureFlagTx: vi.fn(),
   updateFeatureFlagTx: vi.fn(),
   setRolloutModeTx: vi.fn(),
   assignTesterTx: vi.fn(),
   removeTesterTx: vi.fn(),
   softDeleteFeatureFlagTx: vi.fn(),
   getFlagAuditTrail: vi.fn(),
   searchAssignableDiscordUsers: vi.fn(),
}));

describe("feature-flags.actions (DevBoard Role Guard)", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   it("blocks non-DEV users with authorization error", async () => {
      vi.mocked(requireDevUser).mockRejectedValueOnce(
         new Error("Developer permissions required.")
      );

      const result = await createFeatureFlagAction({
         key: "modern_feed",
         name: "Modern Feed",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
         expect(result.error).toContain("Developer permissions required.");
      }
   });

   it("validates input schema before executing creation", async () => {
      vi.mocked(requireDevUser).mockResolvedValueOnce({
         id: "dev_1",
         username: "hyperdev",
         displayName: "Hyper Dev",
         role: "DEV",
      });

      const result = await createFeatureFlagAction({
         key: "INVALID KEY WITH SPACES",
         name: "Modern Feed",
      });

      expect(result.ok).toBe(false);
      expect(repo.createFeatureFlagTx).not.toHaveBeenCalled();
   });

   it("allows DEV user to create a feature flag", async () => {
      vi.mocked(requireDevUser).mockResolvedValueOnce({
         id: "dev_1",
         username: "hyperdev",
         displayName: "Hyper Dev",
         role: "DEV",
      });

      vi.mocked(repo.createFeatureFlagTx).mockResolvedValueOnce({
         id: "flag_1",
         key: "voice_log",
         name: "Voice Log",
         rolloutMode: "DISABLED",
      } as never);

      const result = await createFeatureFlagAction({
         key: "voice_log",
         name: "Voice Log",
         description: "Speech to text",
      });

      expect(result.ok).toBe(true);
      expect(repo.createFeatureFlagTx).toHaveBeenCalledWith(
         expect.objectContaining({ key: "voice_log", name: "Voice Log" }),
         "dev_1"
      );
   });

   it("allows DEV user to set rollout mode", async () => {
      vi.mocked(requireDevUser).mockResolvedValueOnce({
         id: "dev_1",
         username: "hyperdev",
         displayName: "Hyper Dev",
         role: "DEV",
      });

      vi.mocked(repo.setRolloutModeTx).mockResolvedValueOnce({
         id: "flag_1",
         rolloutMode: "TARGETED",
      } as never);

      const result = await setRolloutModeAction({
         flagId: "flag_1",
         rolloutMode: "TARGETED",
      });

      expect(result.ok).toBe(true);
      expect(repo.setRolloutModeTx).toHaveBeenCalledWith(
         "flag_1",
         "TARGETED",
         "dev_1"
      );
   });

   it("allows DEV user to assign and remove testers", async () => {
      vi.mocked(requireDevUser).mockResolvedValue({
         id: "dev_1",
         username: "hyperdev",
         displayName: "Hyper Dev",
         role: "DEV",
      });

      // Assign
      const assignRes = await assignTesterAction({
         flagId: "flag_1",
         targetUserId: "user_test_1",
      });
      expect(assignRes.ok).toBe(true);
      expect(repo.assignTesterTx).toHaveBeenCalledWith(
         "flag_1",
         "user_test_1",
         "dev_1"
      );

      // Remove
      const removeRes = await removeTesterAction({
         flagId: "flag_1",
         targetUserId: "user_test_1",
      });
      expect(removeRes.ok).toBe(true);
      expect(repo.removeTesterTx).toHaveBeenCalledWith(
         "flag_1",
         "user_test_1",
         "dev_1"
      );
   });

   it("allows DEV user to delete a feature flag", async () => {
      vi.mocked(requireDevUser).mockResolvedValueOnce({
         id: "dev_1",
         username: "hyperdev",
         displayName: "Hyper Dev",
         role: "DEV",
      });

      const result = await deleteFeatureFlagAction("flag_1");
      expect(result.ok).toBe(true);
      expect(repo.softDeleteFeatureFlagTx).toHaveBeenCalledWith(
         "flag_1",
         "dev_1"
      );
   });
});
