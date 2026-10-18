import { describe, expect, it, vi, beforeEach } from "vitest";
import { redirect } from "next/navigation";
import ProfilePage from "./page";
import { auth } from "@/core/auth";
import { prisma } from "@/core/db";
import { findParticipantForUser } from "@/features/challenges/data/participant.repository";

vi.mock("next/navigation", () => ({
   redirect: vi.fn(),
}));

vi.mock("@/core/auth", () => ({
   auth: vi.fn(),
}));

vi.mock("@/core/db", () => ({
   prisma: {
      challenge: {
         findUnique: vi.fn(),
         findFirst: vi.fn(),
      },
   },
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

   it("prioritizes challengeId from searchParams when enrolled participant is found", async () => {
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

   it("redirects to fallback challenge participant page when user is not enrolled in targeted challenge", async () => {
      vi.mocked(auth).mockResolvedValue({
         user: { id: "user_123" },
      } as any);

      vi.mocked(findParticipantForUser).mockResolvedValue(null);
      vi.mocked(prisma.challenge.findUnique).mockResolvedValue({
         id: "chal_specific",
      } as any);

      await ProfilePage({
         searchParams: { challengeId: "chal_specific" },
      });

      expect(findParticipantForUser).toHaveBeenCalledWith(
         "user_123",
         "chal_specific"
      );
      expect(prisma.challenge.findUnique).toHaveBeenCalledWith({
         where: { id: "chal_specific", isDeleted: false },
         select: { id: true },
      });
      expect(redirect).toHaveBeenCalledWith(
         "/challenge/chal_specific/participant/user_123"
      );
   });

   it("redirects to latest challenge participant fallback page when user has no enrollments across any challenge", async () => {
      vi.mocked(auth).mockResolvedValue({
         user: { id: "user_new" },
      } as any);

      vi.mocked(findParticipantForUser).mockResolvedValue(null);
      vi.mocked(prisma.challenge.findFirst).mockResolvedValue({
         id: "chal_latest",
      } as any);

      await ProfilePage({});

      expect(findParticipantForUser).toHaveBeenCalledWith("user_new");
      expect(prisma.challenge.findFirst).toHaveBeenCalledWith({
         where: { isDeleted: false },
         orderBy: { createdAt: "desc" },
         select: { id: true },
      });
      expect(redirect).toHaveBeenCalledWith(
         "/challenge/chal_latest/participant/user_new"
      );
   });

   it("falls back to /challenges when user is not enrolled and no challenges exist in DB", async () => {
      vi.mocked(auth).mockResolvedValue({
         user: { id: "user_new" },
      } as any);

      vi.mocked(findParticipantForUser).mockResolvedValue(null);
      vi.mocked(prisma.challenge.findFirst).mockResolvedValue(null);

      await ProfilePage({});

      expect(findParticipantForUser).toHaveBeenCalledWith("user_new");
      expect(redirect).toHaveBeenCalledWith("/challenges");
   });
});
