import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { notFound } from "next/navigation";
import UserProfilePage, { generateMetadata } from "./page";
import { auth } from "@/core/auth";
import * as globalProfileRepo from "@/features/participant-stats/data/global-profile.repository";
import * as privacyDomain from "@/features/participant-stats/domain/profile-privacy";
import * as privacyRepo from "@/features/participant-stats/data/profile-privacy.repository";

vi.mock("next/navigation", () => ({
   notFound: vi.fn(),
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

vi.mock("@/features/participant-stats/domain/profile-privacy", () => ({
   canViewFullProfileHistory: vi.fn(),
}));

vi.mock("@/features/participant-stats/data/profile-privacy.repository", () => ({
   checkAreAcceptedFriends: vi.fn(),
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

describe("UserProfilePage (/profile/[userId])", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   const mockProfileData = {
      user: {
         id: "user_target",
         displayName: "Bob Builder",
         username: "bobbuilder",
         image: "https://example.com/bob.png",
         role: "PARTICIPANT",
         joinedAt: "2026-03-01T00:00:00.000Z",
         trophyBalance: 800,
         yptId: null,
      },
      careerStats: {
         lifetimeStudyHours: 20,
         lifetimeStudySeconds: 72000,
         lifetimeStudyClock: "20:00:00",
         lifetimeStudyHuman: "20h",
         totalActiveStudyDays: 5,
         currentStreak: 2,
         longestStreak: 3,
         totalChallengesEntered: 1,
         challengesCompleted: 1,
         totalTasksCompleted: 10,
         trophyTotal: 800,
         trophyRank: "Gold Scholar",
         pokedexCount: 4,
      },
      challengeHistory: [
         {
            challengeId: "chal_1",
            participantId: "part_1",
            title: "Sprint 1",
            mode: "SOLOS",
            status: "COMPLETED",
            startDate: "2026-10-01T00:00:00.000Z",
            endDate: "2026-10-08T00:00:00.000Z",
            targetHours: 20,
            loggedHours: 20,
            trophyDelta: 50,
         },
      ],
   };

   describe("generateMetadata", () => {
      it("returns fallback title when user does not exist", async () => {
         vi.mocked(globalProfileRepo.getGlobalUserProfile).mockResolvedValue(
            null
         );

         const meta = await generateMetadata({ params: { userId: "missing" } });
         expect(meta.title).toBe("Scholar Not Found | HoldMeToIt");
      });

      it("returns dynamic title and description for existing user", async () => {
         vi.mocked(globalProfileRepo.getGlobalUserProfile).mockResolvedValue(
            mockProfileData as any
         );

         const meta = await generateMetadata({
            params: { userId: "user_target" },
         });
         expect(meta.title).toContain("Bob Builder (@bobbuilder)");
         expect(meta.description).toContain("20h lifetime study hours");
      });
   });

   describe("Page rendering", () => {
      it("triggers notFound when user profile does not exist", async () => {
         vi.mocked(auth).mockResolvedValue(null as any);
         vi.mocked(globalProfileRepo.getGlobalUserProfile).mockResolvedValue(
            null
         );

         await UserProfilePage({ params: { userId: "missing_user" } });
         expect(notFound).toHaveBeenCalled();
      });

      it("resolves target userId when 'me' alias is used by authenticated session", async () => {
         vi.mocked(auth).mockResolvedValue({
            user: { id: "user_me", role: "PARTICIPANT" },
         } as any);
         vi.mocked(globalProfileRepo.getGlobalUserProfile).mockResolvedValue(
            mockProfileData as any
         );
         vi.mocked(privacyDomain.canViewFullProfileHistory).mockReturnValue(
            true
         );

         await UserProfilePage({ params: { userId: "me" } });

         expect(globalProfileRepo.getGlobalUserProfile).toHaveBeenCalledWith(
            "user_me"
         );
      });

      it("enforces privacy rules and loads initial challenge snapshot when authorized", async () => {
         vi.mocked(auth).mockResolvedValue({
            user: { id: "user_viewer", role: "PARTICIPANT" },
         } as any);
         vi.mocked(globalProfileRepo.getGlobalUserProfile).mockResolvedValue(
            mockProfileData as any
         );
         vi.mocked(privacyRepo.checkAreAcceptedFriends).mockResolvedValue(true);
         vi.mocked(privacyDomain.canViewFullProfileHistory).mockReturnValue(
            true
         );
         vi.mocked(
            globalProfileRepo.getChallengeSnapshotForUser
         ).mockResolvedValue({
            profile: { challengeTitle: "Sprint 1" },
         } as any);

         const jsx = await UserProfilePage({
            params: { userId: "user_target" },
            searchParams: { challengeId: "chal_1" },
         });

         expect(privacyDomain.canViewFullProfileHistory).toHaveBeenCalledWith(
            expect.objectContaining({
               viewerId: "user_viewer",
               targetUserId: "user_target",
               isAcceptedFriend: true,
            })
         );

         expect(
            globalProfileRepo.getChallengeSnapshotForUser
         ).toHaveBeenCalledWith(
            "user_target",
            "chal_1",
            expect.objectContaining({
               currentUserId: "user_viewer",
               isAdmin: false,
            })
         );
         expect(jsx).toBeDefined();
      });
   });
});
