import { beforeEach, describe, expect, it, vi } from "vitest";

import {
   ParticipantAccessError,
   requireOwnedParticipant,
} from "@/features/auth/api/require-participant";
import {
   AuthError,
   requireSessionUser,
} from "@/features/auth/api/require-session";
import * as participantRepo from "@/features/challenges/data/participant.repository";
import * as coreAuth from "@/core/auth";

vi.mock("@/core/auth", () => ({
   auth: vi.fn(),
}));

vi.mock("@/features/challenges/data/participant.repository", () => ({
   findOwnedParticipant: vi.fn(),
}));

describe("participant authorization", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   describe("requireSessionUser", () => {
      it("rejects unauthenticated access when session is missing", async () => {
         vi.mocked(coreAuth.auth).mockResolvedValue(null as never);

         await expect(requireSessionUser()).rejects.toThrow(AuthError);
      });

      it("rejects unauthenticated access when session user id is missing", async () => {
         vi.mocked(coreAuth.auth).mockResolvedValue({ user: {} } as never);

         await expect(requireSessionUser()).rejects.toThrow(AuthError);
      });

      it("resolves the authenticated user when session is valid", async () => {
         const mockUser = { id: "usr_alice", displayName: "Alice" };
         vi.mocked(coreAuth.auth).mockResolvedValue({
            user: mockUser,
         } as never);

         const user = await requireSessionUser();
         expect(user).toEqual(mockUser);
      });
   });

   describe("requireOwnedParticipant", () => {
      it("allows authenticated participant to access their own data", async () => {
         const mockParticipant = {
            id: "part_123",
            userId: "usr_alice",
            challengeId: "chal_bees",
            challenge: { id: "chal_bees", status: "ACTIVE" },
         };

         vi.mocked(participantRepo.findOwnedParticipant).mockResolvedValue(
            mockParticipant as never
         );

         const participant = await requireOwnedParticipant(
            "usr_alice",
            "chal_bees"
         );
         expect(participant).toEqual(mockParticipant);
         expect(participantRepo.findOwnedParticipant).toHaveBeenCalledWith(
            "usr_alice",
            "chal_bees"
         );
      });

      it("rejects access when user does not own or belong to the participant record", async () => {
         vi.mocked(participantRepo.findOwnedParticipant).mockResolvedValue(
            null
         );

         await expect(
            requireOwnedParticipant("usr_attacker", "chal_bees")
         ).rejects.toThrow(ParticipantAccessError);
      });

      it("exposes a stable not-enrolled error code on ParticipantAccessError", () => {
         const error = new ParticipantAccessError();
         expect(error.name).toBe("ParticipantAccessError");
         expect(error.code).toBe("NOT_ENROLLED");
      });
   });
});
