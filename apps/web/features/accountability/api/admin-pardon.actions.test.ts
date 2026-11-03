import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminPardonAction } from "./admin-pardon.actions";
import * as requireAdminModule from "@/features/auth/api/require-admin";
import * as accountabilityRepo from "@/features/accountability/data/admin-pardon.repository";
import { revalidatePath } from "next/cache";

vi.mock("next/cache", () => ({
   revalidatePath: vi.fn(),
}));

vi.mock("@/core/cache", () => ({
   cacheTags: {
      challengeScoreboard: (id: string) => `scoreboard:${id}`,
   },
   invalidateTags: vi.fn(),
}));

vi.mock("@/features/auth/api/require-admin", () => {
   class AdminAccessError extends Error {
      readonly code = "FORBIDDEN_NOT_ADMIN";
      constructor(message = "Admin access required.") {
         super(message);
         this.name = "AdminAccessError";
      }
   }
   return {
      requireAdminUser: vi.fn(),
      AdminAccessError,
   };
});

vi.mock("@/features/accountability/data/admin-pardon.repository", () => ({
   adminPardonParticipant: vi.fn(),
}));

describe("adminPardonAction", () => {
   const validAdmin = {
      id: "admin_1",
      username: "HostAdmin",
      displayName: "Host Admin",
      role: "ADMIN" as const,
   };

   beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(requireAdminModule.requireAdminUser).mockResolvedValue(
         validAdmin
      );
      vi.mocked(accountabilityRepo.adminPardonParticipant).mockResolvedValue(
         undefined as never
      );
   });

   it("successfully pardons a participant and revalidates caches", async () => {
      const res = await adminPardonAction({
         challengeId: "c_1",
         participantId: "p_1",
         reason: "Hospitalized due to acute emergency",
      });

      expect(res.ok).toBe(true);
      expect(accountabilityRepo.adminPardonParticipant).toHaveBeenCalledWith({
         participantId: "p_1",
         reason: "Hospitalized due to acute emergency",
         admin: { id: "admin_1", username: "HostAdmin" },
      });
      expect(revalidatePath).toHaveBeenCalledWith("/challenge/c_1");
   });

   it("rejects non-admin caller and preserves whitelisted AdminAccessError message", async () => {
      vi.mocked(requireAdminModule.requireAdminUser).mockRejectedValue(
         new requireAdminModule.AdminAccessError("Admin privileges required.")
      );

      const res = await adminPardonAction({
         challengeId: "c_1",
         participantId: "p_1",
         reason: "Hospitalized emergency reason here",
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
         expect(res.code).toBe("FORBIDDEN_NOT_ADMIN");
         expect(res.message).toBe("Admin privileges required.");
      }
   });

   it("masks internal database errors without leaking query or schema details", async () => {
      vi.mocked(accountabilityRepo.adminPardonParticipant).mockRejectedValue(
         new Error(
            "FATAL: connection pool closed at postgres://postgres:secret@db.internal:5432/hmt"
         )
      );

      const res = await adminPardonAction({
         challengeId: "c_1",
         participantId: "p_1",
         reason: "Hospitalized emergency reason here",
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
         expect(res.code).toBe("PARDON_FAILED");
         expect(res.message).toBe("Failed to pardon participant.");
         expect(res.message).not.toContain("postgres://");
         expect(res.message).not.toContain("db.internal");
      }
   });
});
