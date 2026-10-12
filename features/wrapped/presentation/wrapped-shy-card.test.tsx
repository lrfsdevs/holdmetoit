import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WrappedShyCard } from "./wrapped-shy-card";
import type { ChallengeWrappedViewModel } from "../domain/wrapped";

const mockWrapped: ChallengeWrappedViewModel = {
   challengeId: "chal-1",
   title: "Midterm Reading Week Sprint",
   unlockedAt: "2026-10-12T00:00:00.000Z",
   startAt: "2026-10-05T00:00:00.000Z",
   endAt: "2026-10-12T00:00:00.000Z",
   totalDays: 7,
   participantsCount: 12,
   challengeTotalSeconds: 180000,
   challengeTotalClock: "50:00:00",
   winningTeamIds: ["team-bees"],
   teams: [
      {
         id: "team-bees",
         name: "Honey Bees",
         color: "#d9822b",
         iconEmoji: "🐝",
         totalLoggedSeconds: 120000,
         totalLoggedClock: "33:20:00",
         isWinner: true,
      },
   ],
   viewer: {
      participantId: "part-1",
      displayName: "Afnan",
      image: null,
      rank: 1,
      totalParticipants: 12,
      totalSeconds: 90000,
      totalClock: "25:00:00",
      totalHuman: "25 hours",
      targetSeconds: 72000,
      targetClock: "20:00:00",
      completionPercentage: 125,
      isTargetMet: true,
      hoursDeficitSeconds: 0,
      weeklyTasksCompletedCount: 3,
      weeklyTasksTotalCount: 3,
      teamId: "team-bees",
      teamName: "Honey Bees",
      teamColor: "#d9822b",
      teamIcon: "🐝",
      teamResult: "winner",
      contributionPercentage: 75,
      bestDay: null,
      timesVsAverage: 1.5,
      daily: [],
      verdict: "saved",
      reasons: [],
   },
};

describe("WrappedShyCard", () => {
   it("renders in parked state with role='button' and aria-expanded='false'", () => {
      const html = renderToStaticMarkup(
         <WrappedShyCard wrapped={mockWrapped} onReplayStory={vi.fn()} />
      );

      expect(html).toContain('role="button"');
      expect(html).toContain('aria-expanded="false"');
      expect(html).toContain("Reveal your hidden challenge wrapped card");
      expect(html).toContain("animate-shy-nudge");
      expect(html).toContain("animate-shy-blink");
   });

   it("contains challenge title, viewer verdict, and stats", () => {
      const html = renderToStaticMarkup(
         <WrappedShyCard wrapped={mockWrapped} onReplayStory={vi.fn()} />
      );

      expect(html).toContain("Midterm Reading Week Sprint");
      expect(html).toContain("Accountability: Saved");
      expect(html).toContain("25:00:00");
      expect(html).toContain("/ 20:00:00");
      expect(html).toContain("#1");
      expect(html).toContain("of 12");
      expect(html).toContain("Honey Bees");
   });

   it("renders replay story button and view full summary link", () => {
      const html = renderToStaticMarkup(
         <WrappedShyCard wrapped={mockWrapped} onReplayStory={vi.fn()} />
      );

      expect(html).toContain("Replay Wrapped Story");
      expect(html).toContain("View Full Summary");
      expect(html).toContain('href="/challenge/chal-1?tab=summary"');
   });

   it("renders punished badge when viewer is punished", () => {
      const punishedWrapped: ChallengeWrappedViewModel = {
         ...mockWrapped,
         viewer: {
            ...mockWrapped.viewer!,
            verdict: "punished",
         },
      };

      const html = renderToStaticMarkup(
         <WrappedShyCard wrapped={punishedWrapped} onReplayStory={vi.fn()} />
      );

      expect(html).toContain("Accountability: Punished");
      expect(html).toContain("💀");
   });
});
