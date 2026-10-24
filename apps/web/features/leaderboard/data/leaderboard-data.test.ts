import { describe, expect, it } from "vitest";

import {
   buildScoreboardViewModel,
   normalizeScoreboardPayload,
   type RawChallengePayload,
} from "./leaderboard-data";

describe("buildScoreboardViewModel", () => {
   const mockChallenge: RawChallengePayload = {
      id: "test-challenge-1",
      title: "Midterm Reading Week Sprint",
      format: "TEAM_VS_TEAM",
      status: "ACTIVE",
      startAt: new Date("2026-09-01T00:00:00.000Z"),
      endAt: new Date("2026-09-08T00:00:00.000Z"),
      eventBannerUrl: "/assets/challenge_hero_battle.jpg",
      punishmentPfpUrl: "/assets/punishment_pfp.jpg",
      teams: [
         {
            id: "team-bees",
            name: "Honey Bees",
            color: "#d9822b",
            iconEmoji: "🐝",
            mascotUrl: "/assets/mascot_bees.jpg",
            sortOrder: 0,
         },
         {
            id: "team-butterflies",
            name: "Lavender Butterflies",
            color: "#9986b8",
            iconEmoji: "🦋",
            mascotUrl: "/assets/mascot_butterflies.jpg",
            sortOrder: 1,
         },
      ],
      participants: [
         {
            id: "part-1",
            userId: "user-1",
            teamId: "team-bees",
            targetSeconds: 126_000, // 35h
            status: "NORMAL",
            user: {
               id: "user-1",
               displayName: "AuraStudier",
               username: "aura",
               name: null,
               image: null,
            },
            dailyStudyLogs: [
               { durationSeconds: 16_200 }, // 4h30m
               { durationSeconds: 18_900 }, // 5h15m
            ],
         },
         {
            id: "part-2",
            userId: "user-2",
            teamId: "team-butterflies",
            targetSeconds: 126_000, // 35h
            status: "NORMAL",
            user: {
               id: "user-2",
               displayName: "SlothBrain",
               username: "sloth",
               name: null,
               image: null,
            },
            dailyStudyLogs: [
               { durationSeconds: 7_200 }, // 2h
            ],
         },
      ],
   };

   const fixedNow = new Date("2026-09-04T12:00:00.000Z");

   it("excludes withdrawn participants from standings and team totals", () => {
      const result = buildScoreboardViewModel(
         {
            ...mockChallenge,
            participants: [
               { ...mockChallenge.participants[0], isWithdrawn: true },
               mockChallenge.participants[1],
            ],
         },
         "user-1",
         fixedNow
      );

      expect(result.standings.map((entry) => entry.participantId)).toEqual([
         "part-2",
      ]);

      const bees = result.teams.find((team) => team.id === "team-bees");
      expect(bees).toMatchObject({
         companionCount: 0,
         totalLoggedSeconds: 0,
      });

      const butterflies = result.teams.find(
         (team) => team.id === "team-butterflies"
      );
      expect(butterflies?.totalLoggedSeconds).toBe(7_200);

      expect(result.currentUser.isEnrolled).toBe(false);
   });

   it("keeps differing hero and punishment image URLs separate", () => {
      const url =
         "https://example.supabase.co/storage/v1/object/public/holdmetoit-bucket/event-banners/upload.png";
      const result = buildScoreboardViewModel(
         { ...mockChallenge, eventBannerUrl: url },
         undefined,
         fixedNow
      );

      expect(result.heroImageUrl).toBe(url);
      expect(result.eventBannerUrl).toBe(url);
      expect(result.punishmentPfpUrl).toBe(mockChallenge.punishmentPfpUrl);
      expect(result.currentUser.isLoggedIn).toBe(false);
   });

   it.each([null, "", "   "])(
      "preserves the raw top-level PFP without the wall fallback (%s)",
      (url) => {
         const result = buildScoreboardViewModel(
            { ...mockChallenge, punishmentPfpUrl: url },
            undefined,
            fixedNow
         );

         expect(result.punishmentPfpUrl).toBe(url);
         expect(result.heroImageUrl).toBe(mockChallenge.eventBannerUrl);
      }
   );

   it.each([null, "", "   "])(
      "does not use the PFP when the banner is missing (%s)",
      (url) => {
         const result = buildScoreboardViewModel(
            { ...mockChallenge, eventBannerUrl: url },
            undefined,
            fixedNow
         );

         expect(result.heroImageUrl).toBeNull();
         expect(result.eventBannerUrl).toBe(url);
      }
   );

   it("retains whitespace in the raw banner while normalizing the hero", () => {
      const url =
         "  https://example.com/legacy-banner.webp?download=banner.webp#preview  ";
      const result = buildScoreboardViewModel(
         { ...mockChallenge, eventBannerUrl: url },
         undefined,
         fixedNow
      );

      expect(result.eventBannerUrl).toBe(url);
      expect(result.heroImageUrl).toBe(url.trim());
      expect(result.punishmentPfpUrl).toBe(mockChallenge.punishmentPfpUrl);
   });

   it("maps a replacement image without retaining the previous URL", () => {
      const first = buildScoreboardViewModel(
         mockChallenge,
         undefined,
         fixedNow
      );
      const replacementUrl =
         "https://example.supabase.co/storage/v1/object/public/holdmetoit-bucket/event-banners/replacement.webp";
      const updated = buildScoreboardViewModel(
         { ...mockChallenge, eventBannerUrl: replacementUrl },
         undefined,
         fixedNow
      );

      expect(updated.heroImageUrl).toBe(replacementUrl);
      expect(updated.heroImageUrl).not.toBe(first.heroImageUrl);
      expect(updated.punishmentPfpUrl).toBe(first.punishmentPfpUrl);
   });

   it("does not change the hero when only the punishment PFP changes", () => {
      const result = buildScoreboardViewModel(
         {
            ...mockChallenge,
            punishmentPfpUrl: "https://example.com/replacement-pfp.png",
         },
         undefined,
         fixedNow
      );

      expect(result.heroImageUrl).toBe(mockChallenge.eventBannerUrl);
      expect(result.punishmentPfpUrl).toBe(
         "https://example.com/replacement-pfp.png"
      );
   });

   it("correctly aggregates team scores and calculates lead margin", () => {
      const result = buildScoreboardViewModel(
         mockChallenge,
         "user-1",
         fixedNow
      );

      // Bees: 16200 + 18900 = 35100s
      // Butterflies: 7200s
      expect(result.teams).toHaveLength(2);
      const bees = result.teams.find((t) => t.id === "team-bees");
      const butterflies = result.teams.find((t) => t.id === "team-butterflies");

      expect(bees?.totalLoggedSeconds).toBe(35_100);
      expect(bees?.isLeader).toBe(true);
      expect(bees?.targetSeconds).toBe(126_000);
      expect(bees?.targetHours).toBe(35);
      expect(bees?.completionPercentage).toBe(28); // 35100 / 126000 = 27.85% -> 28%

      expect(butterflies?.totalLoggedSeconds).toBe(7_200);
      expect(butterflies?.isLeader).toBe(false);
      expect(butterflies?.targetSeconds).toBe(126_000);
      expect(butterflies?.targetHours).toBe(35);
      expect(butterflies?.completionPercentage).toBe(6); // 7200 / 126000 = 5.71% -> 6%

      // Match banner
      expect(result.matchHeader.hasMatchup).toBe(true);
      expect(result.matchHeader.leaderSide).toBe("a");
      expect(result.matchHeader.leadMarginSeconds).toBe(27_900); // 35100 - 7200 = 27900
      expect(result.matchHeader.leaderTeamId).toBe("team-bees");
      expect(result.matchHeader.ratioPercentageA).toBe(83); // 35100 / (35100+7200) = 82.978% -> 83%
      expect(result.matchHeader.ratioPercentageB).toBe(17);
   });

   it("sorts participant standings descending by logged seconds", () => {
      const result = buildScoreboardViewModel(
         mockChallenge,
         "user-1",
         fixedNow
      );

      expect(result.standings).toHaveLength(2);
      expect(result.standings[0].displayName).toBe("AuraStudier");
      expect(result.standings[0].rank).toBe(1);
      expect(result.standings[1].displayName).toBe("SlothBrain");
      expect(result.standings[1].rank).toBe(2);
   });

   it("marks completed challenge punishments from live deficits when results are unlocked", () => {
      const completedChallenge: RawChallengePayload = {
         ...mockChallenge,
         status: "COMPLETED",
         participants: [
            {
               ...mockChallenge.participants[0],
               // Met target 35h: 126000s, all goals completed
               dailyStudyLogs: [
                  { durationSeconds: 7 * 3600 },
                  { durationSeconds: 7 * 3600 },
                  { durationSeconds: 7 * 3600 },
                  { durationSeconds: 7 * 3600 },
                  { durationSeconds: 7 * 3600 },
               ],
            },
            {
               ...mockChallenge.participants[1],
               // Target 35h: only 7200s, goals incomplete
               dailyStudyLogs: [{ durationSeconds: 7_200 }],
            },
         ],
      };

      const result = buildScoreboardViewModel(
         completedChallenge,
         undefined,
         fixedNow
      );

      expect(result.standings[0].paceStatus).toBe("serene");
      expect(result.standings[0].paceLabel).toBe("Completed");

      expect(result.standings[1].paceStatus).toBe("punished");
      expect(result.standings[1].paceLabel).toBe("Punished");
   });

   it("treats locked punishment records as the source of truth over live deficits", () => {
      const lockedChallenge: RawChallengePayload = {
         ...mockChallenge,
         status: "COMPLETED",
         resultsLockedAt: new Date("2026-09-09T00:00:00.000Z"),
         participants: [
            {
               ...mockChallenge.participants[0],
               // Personal deficit but saved at lock by the three-condition rule
               dailyStudyLogs: [{ durationSeconds: 7_200 }],
            },
            {
               ...mockChallenge.participants[1],
               status: "PUNISHED",
               punishmentRecords: [{ isPardoned: false, pardonReason: null }],
            },
         ],
      };

      const result = buildScoreboardViewModel(
         lockedChallenge,
         undefined,
         fixedNow
      );

      expect(result.standings[0].paceStatus).toBe("serene");
      expect(result.standings[0].paceLabel).toBe("Completed");

      const punished = result.standings.find(
         (s) => s.participantId === "part-2"
      );
      expect(punished?.paceStatus).toBe("punished");
   });

   it("handles empty participants gracefully", () => {
      const emptyChallenge: RawChallengePayload = {
         ...mockChallenge,
         participants: [],
      };

      const result = buildScoreboardViewModel(
         emptyChallenge,
         undefined,
         fixedNow
      );

      expect(result.standings).toEqual([]);
      expect(result.matchHeader.leadMarginSeconds).toBe(0);
      expect(result.matchHeader.ratioPercentageA).toBe(0);
      expect(result.matchHeader.ratioPercentageB).toBe(0);
      expect(result.teams[0].totalLoggedSeconds).toBe(0);
      expect(result.teams[0].targetSeconds).toBe(0);
      expect(result.teams[0].targetHours).toBe(0);
      expect(result.teams[0].completionPercentage).toBe(0);
   });

   it("calculates 100% share for Team A and 0% for Team B when Team B has zero logged hours", () => {
      const oneSidedChallenge: RawChallengePayload = {
         ...mockChallenge,
         participants: [
            {
               id: "part-1",
               userId: "user-1",
               teamId: "team-bees",
               targetSeconds: 126_000,
               status: "NORMAL",
               user: {
                  id: "user-1",
                  displayName: "SoloWorker",
                  username: "solo",
                  name: null,
                  image: null,
               },
               dailyStudyLogs: [{ durationSeconds: 25_200 }], // 7h
            },
            {
               id: "part-2",
               userId: "user-2",
               teamId: "team-butterflies",
               targetSeconds: 126_000,
               status: "NORMAL",
               user: {
                  id: "user-2",
                  displayName: "ZeroWorker",
                  username: "zero",
                  name: null,
                  image: null,
               },
               dailyStudyLogs: [], // 0h
            },
         ],
      };

      const result = buildScoreboardViewModel(
         oneSidedChallenge,
         undefined,
         fixedNow
      );

      expect(result.matchHeader.ratioPercentageA).toBe(100);
      expect(result.matchHeader.ratioPercentageB).toBe(0);

      const bees = result.teams.find((t) => t.id === "team-bees");
      const butterflies = result.teams.find((t) => t.id === "team-butterflies");

      expect(bees?.completionPercentage).toBe(20); // 25200 / 126000 = 20%
      expect(butterflies?.completionPercentage).toBe(0);
   });

   describe("countdown and dynamic lifecycle status", () => {
      it("calculates daysRemaining against startAt when challenge is UPCOMING (e.g. tomorrow = 1 day left)", () => {
         // Challenge starts tomorrow Oct 5 and ends Oct 12
         const upcomingChallenge: RawChallengePayload = {
            ...mockChallenge,
            status: undefined,
            startAt: new Date("2026-10-05T00:00:00.000Z"),
            endAt: new Date("2026-10-12T00:00:00.000Z"),
         };

         // Current time is Oct 4
         const nowOct4 = new Date("2026-10-04T12:00:00.000Z");
         const result = buildScoreboardViewModel(
            upcomingChallenge,
            undefined,
            nowOct4
         );

         expect(result.status).toBe("UPCOMING");
         // Must be 1 day left, NOT 8 days left!
         expect(result.daysRemaining).toBe(1);
         expect(result.currentDayNumber).toBe(0);
         expect(result.timeRemainingHuman).toContain("Starts in");
      });

      it("calculates daysRemaining as 0 and starts today when current time is kickoff day before startAt", () => {
         const upcomingChallenge: RawChallengePayload = {
            ...mockChallenge,
            status: undefined,
            startAt: new Date("2026-10-05T18:00:00.000Z"),
            endAt: new Date("2026-10-12T00:00:00.000Z"),
         };

         const nowKickoffDay = new Date("2026-10-05T08:00:00.000Z");
         const result = buildScoreboardViewModel(
            upcomingChallenge,
            undefined,
            nowKickoffDay
         );

         expect(result.status).toBe("UPCOMING");
         expect(result.daysRemaining).toBe(0);
         expect(result.timeRemainingHuman).toContain("Starts in");
      });

      it("calculates daysRemaining against endAt when challenge is ACTIVE", () => {
         const activeChallenge: RawChallengePayload = {
            ...mockChallenge,
            status: undefined,
            startAt: new Date("2026-10-01T00:00:00.000Z"),
            endAt: new Date("2026-10-08T00:00:00.000Z"),
         };

         const midDate = new Date("2026-10-04T12:00:00.000Z");
         const result = buildScoreboardViewModel(
            activeChallenge,
            undefined,
            midDate
         );

         expect(result.status).toBe("ACTIVE");
         expect(result.daysRemaining).toBe(4);
         expect(result.currentDayNumber).toBe(4);
      });

      it("computes todayLoggedSeconds and todayLoggedClock when participant has study logs matching today", () => {
         const today = new Date("2026-10-05T14:30:00.000Z");
         const challengeWithTodayLogs: RawChallengePayload = {
            ...mockChallenge,
            participants: [
               {
                  id: "part-1",
                  userId: "user-1",
                  teamId: "team-bees",
                  targetSeconds: 126_000,
                  status: "NORMAL",
                  user: {
                     id: "user-1",
                     displayName: "AuraStudier",
                     username: "aura",
                     name: null,
                     image: null,
                  },
                  dailyStudyLogs: [
                     {
                        durationSeconds: 7_200,
                        logDate: new Date("2026-10-04T10:00:00.000Z"),
                     },
                     {
                        durationSeconds: 14_400,
                        logDate: new Date("2026-10-05T09:00:00.000Z"),
                     },
                  ],
               },
            ],
         };

         const result = buildScoreboardViewModel(
            challengeWithTodayLogs,
            "user-1",
            today
         );
         expect(result.standings[0].todayLoggedSeconds).toBe(14_400);
         expect(result.standings[0].todayLoggedClock).toBe("04:00:00");
         expect(result.standings[0].totalLoggedSeconds).toBe(21_600);
         expect(result.standings[0].totalLoggedClock).toBe("06:00:00");
      });
   });
});

describe("normalizeScoreboardPayload", () => {
   const serializedChallenge = {
      id: "serialized-challenge",
      title: "Cached Challenge",
      format: "TEAM_VS_TEAM" as const,
      status: "ACTIVE" as const,
      startAt: "2026-09-01T00:00:00.000Z",
      endAt: "2026-09-08T00:00:00.000Z",
      eventBannerUrl: null,
      punishmentPfpUrl: null,
      teams: [],
      participants: [
         {
            id: "participant-1",
            userId: "user-1",
            teamId: null,
            targetSeconds: 1,
            status: "NORMAL" as const,
            user: {
               id: "user-1",
               displayName: "Cached User",
               username: "cached",
               name: null,
               image: null,
            },
            dailyStudyLogs: [
               {
                  durationSeconds: 60,
                  logDate: "2026-09-02T00:00:00.000Z",
               },
            ],
            punishmentRecords: [],
         },
      ],
   };

   it("normalizes serialized challenge and study-log dates", () => {
      const normalized = normalizeScoreboardPayload(serializedChallenge);

      expect(normalized.startAt).toBeInstanceOf(Date);
      expect(normalized.endAt).toBeInstanceOf(Date);
      expect(
         normalized.participants[0].dailyStudyLogs[0].logDate
      ).toBeInstanceOf(Date);
   });

   it("rejects invalid cached challenge dates", () => {
      expect(() =>
         normalizeScoreboardPayload({
            ...serializedChallenge,
            endAt: "not-a-date",
         })
      ).toThrow("Invalid scoreboard endAt.");
   });

   it("rejects invalid cached study-log dates", () => {
      expect(() =>
         normalizeScoreboardPayload({
            ...serializedChallenge,
            participants: [
               {
                  ...serializedChallenge.participants[0],
                  dailyStudyLogs: [
                     { durationSeconds: 60, logDate: "not-a-date" },
                  ],
               },
            ],
         })
      ).toThrow("Invalid scoreboard logDate.");
   });
});
