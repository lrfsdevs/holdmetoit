import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { redirect } from "next/navigation";
import ProfilePage from "./page";
import { auth } from "@/core/auth";
import * as globalProfileRepo from "@/features/participant-stats/data/global-profile.repository";

vi.mock("next/navigation", () => ({
   redirect: vi.fn(),
   useRouter: () => ({
      refresh: vi.fn(),
      push: vi.fn(),
      replace: vi.fn(),
   }),
   useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/core/auth", () => ({
   auth: vi.fn(),
}));

vi.mock("@/features/participant-stats/data/global-profile.repository", () => ({
   getGlobalUserProfile: vi.fn(),
   getChallengeSnapshotForUser: vi.fn(),
}));

vi.mock(
   "@/features/participant-stats/presentation/global-profile-view",
   () => ({
      GlobalProfileView: (props: any) =>
         createElement(
            "div",
            { "data-testid": "global-profile-view", ...props },
            "Global Profile View"
         ),
   })
);

describe("ProfilePage (/profile)", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   const mockProfileData = {
      user: {
         id: "user_session",
         displayName: "Current User",
         username: "currentuser",
         image: null,
         role: "PARTICIPANT",
         joinedAt: "2026-01-01T00:00:00.000Z",
         trophyBalance: 500,
         yptId: "11223344",
      },
      careerStats: {
         lifetimeStudyHours: 10,
         lifetimeStudySeconds: 36000,
         lifetimeStudyClock: "10:00:00",
         lifetimeStudyHuman: "10h",
         totalActiveStudyDays: 3,
         currentStreak: 1,
         longestStreak: 2,
         totalChallengesEntered: 1,
         challengesCompleted: 0,
         totalTasksCompleted: 5,
         trophyTotal: 500,
         trophyRank: "Silver Scholar",
         pokedexCount: 2,
      },
      challengeHistory: [
         {
            challengeId: "chal_active",
            participantId: "part_active",
            title: "Active Challenge",
            mode: "SOLOS",
            status: "ACTIVE",
            startDate: "2026-10-25T00:00:00.000Z",
            endDate: "2026-11-05T00:00:00.000Z",
            targetHours: 15,
            loggedHours: 10,
            trophyDelta: 0,
         },
      ],
   };

   it("redirects unauthenticated users to home page", async () => {
      vi.mocked(auth).mockResolvedValue(null as any);

      await ProfilePage({});

      expect(redirect).toHaveBeenCalledWith("/");
   });

   it("redirects to home if user profile does not exist in database", async () => {
      vi.mocked(auth).mockResolvedValue({
         user: { id: "user_nonexistent" },
      } as any);
      vi.mocked(globalProfileRepo.getGlobalUserProfile).mockResolvedValue(null);

      await ProfilePage({});

      expect(redirect).toHaveBeenCalledWith("/");
   });

   it("renders GlobalProfileView for authenticated user", async () => {
      vi.mocked(auth).mockResolvedValue({
         user: { id: "user_session", role: "PARTICIPANT" },
      } as any);
      vi.mocked(globalProfileRepo.getGlobalUserProfile).mockResolvedValue(
         mockProfileData as any
      );
      vi.mocked(
         globalProfileRepo.getChallengeSnapshotForUser
      ).mockResolvedValue({
         profile: { challengeTitle: "Active Challenge" },
      } as any);

      const jsx = await ProfilePage({
         searchParams: { challengeId: "chal_active" },
      });

      expect(globalProfileRepo.getGlobalUserProfile).toHaveBeenCalledWith(
         "user_session"
      );
      expect(
         globalProfileRepo.getChallengeSnapshotForUser
      ).toHaveBeenCalledWith(
         "user_session",
         "chal_active",
         expect.objectContaining({
            currentUserId: "user_session",
            isAdmin: false,
         })
      );
      expect(jsx).toBeDefined();
   });
});
