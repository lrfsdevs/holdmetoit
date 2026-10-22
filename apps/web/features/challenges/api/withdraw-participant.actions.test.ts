import { beforeEach, describe, expect, it, vi } from "vitest";

import { withdrawFromChallengeAction } from "./withdraw-participant.actions";
import * as requireSessionModule from "@/features/auth/api/require-session";
import * as participantRepo from "@/features/challenges/data/participant.repository";
import { isFeatureEnabled } from "@/features/feature-flags/api/server";
import { invalidateTags } from "@/core/cache";
import { revalidatePath } from "next/cache";

vi.mock("next/cache", () => ({
   revalidatePath: vi.fn(),
}));

vi.mock("@/core/cache", () => ({
   cacheTags: {
      challengeScoreboard: (id: string) => `scoreboard:${id}`,
      participantCockpit: (userId: string, challengeId: string) =>
         `cockpit:${userId}:${challengeId}`,
   },
   invalidateTags: vi.fn(),
}));

vi.mock("@/core/observability/logger", () => ({
   createLogger: () => ({ info: vi.fn(), error: vi.fn() }),
   logEvents: {
      challengeParticipantWithdrew: "challenge.participant_withdrew",
   },
}));

vi.mock("@/features/feature-flags/api/server", () => ({
   isFeatureEnabled: vi.fn(),
}));

vi.mock("@/features/auth/api/require-session", () => ({
   requireSessionUser: vi.fn(),
}));

vi.mock("@/features/challenges/data/participant.repository", () => ({
   withdrawParticipant: vi.fn(),
}));

describe("withdrawFromChallengeAction", () => {
   beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(isFeatureEnabled).mockResolvedValue(true);
      vi.mocked(requireSessionModule.requireSessionUser).mockResolvedValue({
         id: "usr_1",
      } as never);
      vi.mocked(participantRepo.withdrawParticipant).mockResolvedValue({
         participantId: "part_1",
         withdrawalAt: new Date(),
      });
   });

   it("returns FEATURE_DISABLED when the withdrawal flag is off", async () => {
      vi.mocked(isFeatureEnabled).mockResolvedValue(false);

      const result = await withdrawFromChallengeAction({
         challengeId: "chal_1",
      });

      expect(result).toEqual({
         ok: false,
         code: "FEATURE_DISABLED",
         message: "Withdrawal is currently unavailable.",
      });
      expect(requireSessionModule.requireSessionUser).not.toHaveBeenCalled();
      expect(participantRepo.withdrawParticipant).not.toHaveBeenCalled();
   });

   it("withdraws the current participant and revalidates caches", async () => {
      const result = await withdrawFromChallengeAction({
         challengeId: "chal_1",
      });

      expect(result).toEqual({ ok: true });
      expect(participantRepo.withdrawParticipant).toHaveBeenCalledWith({
         challengeId: "chal_1",
         userId: "usr_1",
      });
      expect(invalidateTags).toHaveBeenCalledWith([
         "scoreboard:chal_1",
         "cockpit:usr_1:chal_1",
      ]);
      expect(revalidatePath).toHaveBeenCalledWith("/challenge/chal_1");
      expect(revalidatePath).toHaveBeenCalledWith("/challenges");
      expect(revalidatePath).toHaveBeenCalledWith("/admin");
      expect(revalidatePath).toHaveBeenCalledWith("/");
   });

   it("maps repository failures to WITHDRAWAL_FAILED", async () => {
      vi.mocked(participantRepo.withdrawParticipant).mockRejectedValue(
         new Error("Results are locked; withdrawal is no longer possible.")
      );

      const result = await withdrawFromChallengeAction({
         challengeId: "chal_1",
      });

      expect(result).toEqual({
         ok: false,
         code: "WITHDRAWAL_FAILED",
         message: "Results are locked; withdrawal is no longer possible.",
      });
   });
});
