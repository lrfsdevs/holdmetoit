import { beforeEach, describe, expect, it, vi } from "vitest";

import { enrollInChallengeAction } from "@/features/challenges/api/enroll-participant.actions";
import * as requireSessionModule from "@/features/auth/api/require-session";
import * as participantRepoModule from "@/features/challenges/data/participant.repository";

vi.mock("next/cache", () => ({
   revalidatePath: vi.fn(),
   revalidateTag: vi.fn(),
}));

vi.mock("@/features/auth/api/require-session", () => ({
   AuthError: class AuthError extends Error {},
   requireSessionUser: vi.fn(),
}));

vi.mock("@/features/challenges/data/participant.repository", () => ({
   enrollParticipantInChallenge: vi.fn(),
}));

describe("enrollInChallengeAction (FEAT-CHAL-02)", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   it("successfully enrolls authenticated user with valid weekly target", async () => {
      vi.mocked(requireSessionModule.requireSessionUser).mockResolvedValue({
         id: "u_1",
      } as never);

      vi.mocked(
         participantRepoModule.enrollParticipantInChallenge
      ).mockResolvedValue({
         id: "part_new",
         userId: "u_1",
         challengeId: "c_1",
         teamId: "t_1",
         targetSeconds: 126000,
      } as never);

      const result = await enrollInChallengeAction({
         challengeId: "c_1",
         teamId: "t_1",
         hours: 35,
         minutes: 0,
         seconds: 0,
      });

      expect(result).toEqual({ ok: true });
      expect(
         participantRepoModule.enrollParticipantInChallenge
      ).toHaveBeenCalledWith({
         userId: "u_1",
         challengeId: "c_1",
         teamId: "t_1",
         targetSeconds: 126000,
         plannedLeaveDays: 0,
      });
   });

   it("rejects when unauthenticated", async () => {
      vi.mocked(requireSessionModule.requireSessionUser).mockRejectedValue(
         new Error("User is not authenticated.")
      );

      const result = await enrollInChallengeAction({
         challengeId: "c_1",
         teamId: "t_1",
         hours: 35,
         minutes: 0,
         seconds: 0,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
         expect(result.code).toBe("ENROLLMENT_FAILED");
         expect(result.message).toContain("User is not authenticated");
      }
   });

   it("rejects weekly target that is too low (e.g. 0 hours)", async () => {
      vi.mocked(requireSessionModule.requireSessionUser).mockResolvedValue({
         id: "u_1",
      } as never);

      const result = await enrollInChallengeAction({
         challengeId: "c_1",
         teamId: "t_1",
         hours: 0,
         minutes: 0,
         seconds: 0,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
         expect(result.code).toBe("TARGET_TOO_LOW");
      }
      expect(
         participantRepoModule.enrollParticipantInChallenge
      ).not.toHaveBeenCalled();
   });

   it("handles repository rejection when challenge is closed", async () => {
      vi.mocked(requireSessionModule.requireSessionUser).mockResolvedValue({
         id: "u_1",
      } as never);

      vi.mocked(
         participantRepoModule.enrollParticipantInChallenge
      ).mockRejectedValue(
         new Error("Cannot join a challenge that has already ended.")
      );

      const result = await enrollInChallengeAction({
         challengeId: "c_1",
         teamId: "t_1",
         hours: 35,
         minutes: 0,
         seconds: 0,
      });

      expect(result).toEqual({
         ok: false,
         code: "ENROLLMENT_FAILED",
         message: "Cannot join a challenge that has already ended.",
      });
   });

   it("successfully enrolls without teamId as unassigned", async () => {
      vi.mocked(requireSessionModule.requireSessionUser).mockResolvedValue({
         id: "u_1",
      } as never);

      vi.mocked(
         participantRepoModule.enrollParticipantInChallenge
      ).mockResolvedValue({
         id: "part_new",
         userId: "u_1",
         challengeId: "c_1",
         teamId: null,
         targetSeconds: 126000,
      } as never);

      const result = await enrollInChallengeAction({
         challengeId: "c_1",
         hours: 35,
         minutes: 0,
         seconds: 0,
         leaveDays: 2,
      });

      expect(result).toEqual({ ok: true });
      expect(
         participantRepoModule.enrollParticipantInChallenge
      ).toHaveBeenCalledWith({
         userId: "u_1",
         challengeId: "c_1",
         teamId: null,
         targetSeconds: 126000,
         plannedLeaveDays: 2,
      });
   });
});
