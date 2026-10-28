import { beforeEach, describe, expect, it, vi } from "vitest";

import { invalidateTags } from "@/core/cache";
import { revalidatePath } from "next/cache";
import * as requireSessionModule from "@/features/auth/api/require-session";
import { DuoTeamIdentityError } from "@/features/challenges/domain/duo-team-identity";
import * as teamRepo from "@/features/challenges/data/team.repository";
import { clearTeamColorCache } from "@/features/challenges/domain/team-colors";
import { updateDuoTeamIdentityAction } from "./update-duo-team-identity.actions";

vi.mock("next/cache", () => ({
   revalidatePath: vi.fn(),
}));

vi.mock("@/core/cache", () => ({
   cacheTags: {
      challengeScoreboard: (id: string) => `scoreboard:${id}`,
      challengeMetadata: (id: string) => `metadata:${id}`,
   },
   invalidateTags: vi.fn(),
}));

vi.mock("@/core/observability/logger", () => ({
   createLogger: () => ({
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
   }),
   logEvents: { challengeUpdated: "challenge.updated" },
}));

vi.mock("@/features/auth/api/require-session", () => ({
   AuthError: class AuthError extends Error {
      constructor(message = "You must sign in to continue.") {
         super(message);
         this.name = "AuthError";
      }
   },
   requireSessionUser: vi.fn(),
}));

vi.mock("@/features/challenges/data/team.repository", () => ({
   updateDuoTeamIdentity: vi.fn(),
}));

vi.mock("@/features/challenges/domain/team-colors", () => ({
   clearTeamColorCache: vi.fn(),
}));

describe("updateDuoTeamIdentityAction", () => {
   beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(requireSessionModule.requireSessionUser).mockResolvedValue({
         id: "user-1",
         name: "afnan",
         displayName: "Afnan",
      } as never);
      vi.mocked(teamRepo.updateDuoTeamIdentity).mockResolvedValue({
         id: "team-1",
         name: "Caffeine & Calculus",
         iconEmoji: "🦊",
      } as never);
   });

   it("saves the name and emoji and invalidates scoreboard caches", async () => {
      const result = await updateDuoTeamIdentityAction({
         challengeId: "chal-1",
         name: "  Caffeine & Calculus  ",
         iconEmoji: "🦊",
      });

      expect(result).toEqual({ ok: true });
      expect(teamRepo.updateDuoTeamIdentity).toHaveBeenCalledWith({
         challengeId: "chal-1",
         userId: "user-1",
         name: "Caffeine & Calculus",
         iconEmoji: "🦊",
         actor: { username: "afnan", displayName: "Afnan" },
      });
      expect(invalidateTags).toHaveBeenCalledWith([
         "scoreboard:chal-1",
         "metadata:chal-1",
      ]);
      expect(clearTeamColorCache).toHaveBeenCalled();
      expect(revalidatePath).toHaveBeenCalledWith("/challenge/chal-1");
      expect(revalidatePath).toHaveBeenCalledWith("/");
      expect(revalidatePath).toHaveBeenCalledWith("/challenges");
   });

   it("normalizes an omitted or blank emoji to null", async () => {
      await updateDuoTeamIdentityAction({
         challengeId: "chal-1",
         name: "New Name",
      });

      await updateDuoTeamIdentityAction({
         challengeId: "chal-1",
         name: "New Name",
         iconEmoji: "   ",
      });

      expect(teamRepo.updateDuoTeamIdentity).toHaveBeenNthCalledWith(
         1,
         expect.objectContaining({ iconEmoji: null })
      );
      expect(teamRepo.updateDuoTeamIdentity).toHaveBeenNthCalledWith(
         2,
         expect.objectContaining({ iconEmoji: null })
      );
   });

   it("rejects an empty name before touching the repository", async () => {
      const result = await updateDuoTeamIdentityAction({
         challengeId: "chal-1",
         name: "   ",
         iconEmoji: "🔥",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
         expect(result.code).toBe("INVALID_INPUT");
      }
      expect(teamRepo.updateDuoTeamIdentity).not.toHaveBeenCalled();
   });

   it("returns UNAUTHENTICATED for signed-out callers", async () => {
      vi.mocked(requireSessionModule.requireSessionUser).mockRejectedValue(
         new requireSessionModule.AuthError()
      );

      const result = await updateDuoTeamIdentityAction({
         challengeId: "chal-1",
         name: "New Name",
         iconEmoji: "🔥",
      });

      expect(result).toEqual({
         ok: false,
         code: "UNAUTHENTICATED",
         message: "You must sign in to continue.",
      });
   });

   it("passes through domain error codes", async () => {
      vi.mocked(teamRepo.updateDuoTeamIdentity).mockRejectedValue(
         new DuoTeamIdentityError(
            "INVALID_EMOJI",
            "Please pick a single emoji."
         )
      );

      const result = await updateDuoTeamIdentityAction({
         challengeId: "chal-1",
         name: "Midnight Chai",
         iconEmoji: "🐝🐝",
      });

      expect(result).toEqual({
         ok: false,
         code: "INVALID_EMOJI",
         message: "Please pick a single emoji.",
      });
   });

   it("maps unexpected failures to UPDATE_FAILED", async () => {
      vi.mocked(teamRepo.updateDuoTeamIdentity).mockRejectedValue(
         new Error("db down")
      );

      const result = await updateDuoTeamIdentityAction({
         challengeId: "chal-1",
         name: "New Name",
         iconEmoji: null,
      });

      expect(result).toEqual({
         ok: false,
         code: "UPDATE_FAILED",
         message: "Failed to update your duo team.",
      });
   });
});
