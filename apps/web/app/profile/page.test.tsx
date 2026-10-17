import { describe, expect, it, vi, beforeEach } from "vitest";
import { redirect } from "next/navigation";
import ProfilePage from "./page";
import { auth } from "@/core/auth";
import { findParticipantForUser } from "@/features/challenges/data/participant.repository";

vi.mock("next/navigation", () => ({
   redirect: vi.fn(),
}));

vi.mock("@/core/auth", () => ({
   auth: vi.fn(),
}));

vi.mock("@/features/challenges/data/participant.repository", () => ({
   findParticipantForUser: vi.fn(),
}));

describe("ProfilePage (/profile)", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   it("redirects unauthenticated users to home page", async () => {
      vi.mocked(auth).mockResolvedValue(null as any);

      await ProfilePage({});

      expect(redirect).toHaveBeenCalledWith("/");
   });

   it("redirects to participant stats page when enrolled participant is found", async () => {
      vi.mocked(auth).mockResolvedValue({
         user: { id: "user_123" },
      } as any);

      vi.mocked(findParticipantForUser).mockResolvedValue({
         id: "part_456",
         challengeId: "chal_789",
      } as any);

      await ProfilePage({});

      expect(findParticipantForUser).toHaveBeenCalledWith("user_123");
      expect(redirect).toHaveBeenCalledWith(
         "/challenge/chal_789/participant/part_456"
      );
   });

   it("prioritizes challengeId from searchParams when provided", async () => {
      vi.mocked(auth).mockResolvedValue({
         user: { id: "user_123" },
      } as any);

      vi.mocked(findParticipantForUser).mockResolvedValue({
         id: "part_target",
         challengeId: "chal_specific",
      } as any);

      await ProfilePage({
         searchParams: { challengeId: "chal_specific" },
      });

      expect(findParticipantForUser).toHaveBeenCalledWith(
         "user_123",
         "chal_specific"
      );
      expect(redirect).toHaveBeenCalledWith(
         "/challenge/chal_specific/participant/part_target"
      );
   });

   it("falls back to /challenges when user is not enrolled in any challenge", async () => {
      vi.mocked(auth).mockResolvedValue({
         user: { id: "user_new" },
      } as any);

      vi.mocked(findParticipantForUser).mockResolvedValue(null);

      await ProfilePage({});

      expect(findParticipantForUser).toHaveBeenCalledWith("user_new");
      expect(redirect).toHaveBeenCalledWith("/challenges");
   });
});
