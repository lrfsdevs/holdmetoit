import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ParticipantStatsPage, { generateMetadata } from "./page";
import { getChallengeParticipantStats } from "@/features/participant-stats/data/participant-stats.repository";
import { auth } from "@/core/auth";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { PARTICIPANT_PREVIEW_COOKIE } from "@/features/auth/domain/preview-mode";

vi.mock("next/navigation", () => ({
   notFound: vi.fn(() => {
      throw new Error("NEXT_NOT_FOUND");
   }),
}));

vi.mock(
   "@/features/participant-stats/data/participant-stats.repository",
   () => ({
      getChallengeParticipantStats: vi.fn(),
   })
);

vi.mock("@/core/auth", () => ({
   auth: vi.fn(),
}));

vi.mock("next/headers", () => ({
   cookies: vi.fn(),
}));

vi.mock("next/link", () => ({
   default: ({ href, children, ...rest }: any) => (
      <a href={href} {...rest}>
         {children}
      </a>
   ),
}));

vi.mock("next/image", () => ({
   // eslint-disable-next-line @next/next/no-img-element
   default: ({ src, alt, ...rest }: any) => (
      <img src={src} alt={alt} {...rest} />
   ),
}));

describe("ParticipantStatsPage", () => {
   beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(cookies).mockResolvedValue({
         get: vi.fn().mockReturnValue(undefined),
      } as any);
      vi.mocked(auth).mockResolvedValue(null as any);
   });

   const mockStats = {
      profile: {
         participantId: "part_1",
         userId: "user_1",
         displayName: "Bob Scholar",
         username: "bob",
         image: null,
         teamId: "team_1",
         teamName: "Serpents",
         teamColor: "#22c55e",
         teamIcon: "🐍",
         rank: 2,
         totalParticipants: 8,
         paceStatus: "catch-up",
         paceLabel: "Catch-Up",
         challengeId: "chal_1",
         challengeTitle: "Winter Battle",
         challengeFormat: "TEAM_VS_TEAM",
         challengeStatus: "ACTIVE",
      },
      summary: {
         totalLoggedSeconds: 36000,
         totalLoggedClock: "10:00:00",
         totalLoggedHuman: "10h",
         todayLoggedSeconds: 7200,
         todayLoggedClock: "02:00:00",
         todayLoggedHuman: "2h",
         targetSeconds: 72000,
         targetClock: "20:00:00",
         targetHuman: "20h",
         completionPercentage: 50,
         rank: 2,
         totalParticipants: 8,
         remainingSeconds: 36000,
         remainingClock: "10:00:00",
         remainingHuman: "10h",
         isTargetMet: false,
         excessSeconds: 0,
         excessClock: "00:00:00",
         excessHuman: "0s",
         paceStatus: "catch-up",
         paceLabel: "Catch-Up",
      },
      dailyHistory: [],
      teamStats: null,
      accountability: {
         deficitSeconds: 36000,
         deficitClock: "10:00:00",
         deficitHuman: "10h",
         requiredDailyPaceSeconds: 12000,
         requiredDailyPaceClock: "03:20:00",
         requiredDailyPaceHuman: "3h 20m",
         daysRemaining: 3,
         isPunished: false,
         isPardoned: false,
         pardonReason: null,
         statusBadge: "Catch-Up",
      },
      viewer: {
         isAdmin: false,
         isOwner: false,
      },
   };

   it("renders participant stats view when record is found", async () => {
      vi.mocked(getChallengeParticipantStats).mockResolvedValue(
         mockStats as any
      );

      const pageElement = await ParticipantStatsPage({
         params: { id: "chal_1", participantId: "part_1" },
      });

      const html = renderToStaticMarkup(pageElement);
      expect(html).toContain("Bob Scholar");
      expect(html).toContain("Winter Battle");
      expect(html).toContain("10:00:00");
   });

   it("forwards participant preview state to the stats repository", async () => {
      vi.mocked(auth).mockResolvedValue({
         user: { id: "admin_1", role: "ADMIN" },
      } as any);
      vi.mocked(cookies).mockResolvedValue({
         get: vi.fn((name: string) =>
            name === PARTICIPANT_PREVIEW_COOKIE ? { value: "true" } : undefined
         ),
      } as any);
      vi.mocked(getChallengeParticipantStats).mockResolvedValue(
         mockStats as any
      );

      await ParticipantStatsPage({
         params: { id: "chal_1", participantId: "part_1" },
      });

      expect(getChallengeParticipantStats).toHaveBeenCalledWith(
         "chal_1",
         "part_1",
         expect.objectContaining({ isAdmin: false, isPreviewActive: true })
      );
   });

   it("triggers notFound when participant record is not found", async () => {
      vi.mocked(getChallengeParticipantStats).mockResolvedValue(null);

      await expect(
         ParticipantStatsPage({
            params: { id: "chal_1", participantId: "part_nonexistent" },
         })
      ).rejects.toThrow("NEXT_NOT_FOUND");

      expect(notFound).toHaveBeenCalled();
   });

   it("generates metadata with participant and challenge title", async () => {
      vi.mocked(getChallengeParticipantStats).mockResolvedValue(
         mockStats as any
      );

      const meta = await generateMetadata({
         params: { id: "chal_1", participantId: "part_1" },
      });

      expect(meta.title).toBe("Bob Scholar — Winter Battle | HoldMeToIt");
   });

   it("generates fallback metadata when participant is not found", async () => {
      vi.mocked(getChallengeParticipantStats).mockResolvedValue(null);

      const meta = await generateMetadata({
         params: { id: "chal_1", participantId: "part_missing" },
      });

      expect(meta.title).toBe("Participant Not Found | HoldMeToIt");
   });

   it("renders error state when stats fetch throws", async () => {
      vi.mocked(getChallengeParticipantStats).mockRejectedValue(
         new Error("P2022: column isLeave does not exist")
      );

      const pageElement = await ParticipantStatsPage({
         params: { id: "chal_1", participantId: "part_1" },
      });

      const html = renderToStaticMarkup(pageElement);
      expect(html).toContain("Couldn&#x27;t load participant stats");
      expect(html).toContain("/challenge/chal_1?tab=leaderboard");
   });

   it("generates fallback metadata when stats fetch throws", async () => {
      vi.mocked(getChallengeParticipantStats).mockRejectedValue(
         new Error("boom")
      );

      const meta = await generateMetadata({
         params: { id: "chal_1", participantId: "part_1" },
      });

      expect(meta.title).toBe("Participant Not Found | HoldMeToIt");
   });
});
