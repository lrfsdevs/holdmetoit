import { describe, expect, it } from "vitest";

import {
   buildChallengeWrappedViewModel,
   getChallengeCompletionDate,
   isChallengeCompleted,
   isWrappedPopupDue,
   isWrappedWindowExpired,
   isWrappedWindowOpen,
   WRAPPED_POPUP_WINDOW_DAYS,
} from "./wrapped";
import type {
   ChallengeScoreboardViewModel,
   ScoreboardStandingEntry,
   ScoreboardTeam,
} from "@/features/leaderboard/data/leaderboard-data";

const DAY_MS = 86_400_000;
const LOCKED_AT = "2026-10-12T00:00:00.000Z";

function buildTeam(overrides: Partial<ScoreboardTeam> = {}): ScoreboardTeam {
   return {
      id: "team-bees",
      name: "Honey Bees",
      color: "#d9822b",
      iconEmoji: "🐝",
      mascotUrl: null,
      sortOrder: 0,
      companionCount: 1,
      totalLoggedSeconds: 72_000,
      totalLoggedClock: "20:00:00",
      targetSeconds: 72_000,
      targetClock: "20:00:00",
      targetHours: 20,
      completionPercentage: 100,
      isLeader: true,
      ...overrides,
   };
}

function buildStanding(
   overrides: Partial<ScoreboardStandingEntry> = {}
): ScoreboardStandingEntry {
   return {
      rank: 1,
      participantId: "part-1",
      userId: "user-1",
      displayName: "AuraStudier",
      username: "aura",
      image: null,
      teamId: "team-bees",
      teamName: "Honey Bees",
      teamColor: "#d9822b",
      teamIcon: "🐝",
      totalLoggedSeconds: 72_000,
      totalLoggedClock: "20:00:00",
      todayLoggedSeconds: 0,
      todayLoggedClock: "00:00:00",
      targetSeconds: 72_000,
      targetClock: "20:00:00",
      completionPercentage: 100,
      weeklyTasksCompletedCount: 2,
      weeklyTasksTotalCount: 2,
      paceStatus: "serene",
      paceLabel: "Completed",
      status: "NORMAL",
      deficitSeconds: 0,
      dailyLogs: {},
      ...overrides,
   };
}

function buildChallenge(
   overrides: Partial<ChallengeScoreboardViewModel> = {}
): ChallengeScoreboardViewModel {
   return {
      id: "chal-1",
      title: "October Team Battle",
      heroImageUrl: null,
      eventBannerUrl: null,
      punishmentPfpUrl: null,
      format: "TEAM_VS_TEAM",
      status: "COMPLETED",
      resultsLockedAt: LOCKED_AT,
      startAt: "2026-10-05T00:00:00.000Z",
      endAt: "2026-10-12T00:00:00.000Z",
      daysRemaining: 0,
      totalDays: 7,
      currentDayNumber: 7,
      timeRemainingHuman: "Event concluded",
      teams: [buildTeam()],
      matchHeader: {
         hasMatchup: false,
         teamA: null,
         teamB: null,
         leadMarginSeconds: 0,
         leadMarginClock: "00:00:00",
         leadMarginHuman: "0 minutes",
         leaderTeamId: null,
         leaderSide: "tie",
         ratioPercentageA: 0,
         ratioPercentageB: 0,
      },
      standings: [buildStanding()],
      punishmentWall: {
         punishmentPfpUrl: "/assets/punishment_pfp.jpg",
         flaggedMembers: [],
         isEventCompleted: true,
      },
      currentUser: {
         isLoggedIn: false,
         isEnrolled: false,
         participantId: null,
         isWrappedSeen: false,
         isFeedbackFilled: false,
      },
      ...overrides,
   };
}

describe("wrapped window helpers", () => {
   it("keeps the window open inside 3 days of lock", () => {
      const now = new Date(new Date(LOCKED_AT).getTime() + 1 * DAY_MS);
      expect(isWrappedWindowOpen(LOCKED_AT, now)).toBe(true);
      expect(isWrappedWindowExpired(LOCKED_AT, now)).toBe(false);
   });

   it("closes and expires the window after 3 days", () => {
      const now = new Date(
         new Date(LOCKED_AT).getTime() +
            (WRAPPED_POPUP_WINDOW_DAYS + 1) * DAY_MS
      );
      expect(isWrappedWindowOpen(LOCKED_AT, now)).toBe(false);
      expect(isWrappedWindowExpired(LOCKED_AT, now)).toBe(true);
   });

   it("treats missing or invalid lock timestamps as never open", () => {
      expect(isWrappedWindowOpen(null)).toBe(false);
      expect(isWrappedWindowOpen(undefined)).toBe(false);
      expect(isWrappedWindowOpen("not-a-date")).toBe(false);
      expect(isWrappedWindowExpired(null)).toBe(false);
   });

   it("supports checking window with challenge object or endAt", () => {
      const endAt = "2026-10-10T00:00:00.000Z";
      const openNow = new Date(new Date(endAt).getTime() + 2 * DAY_MS);
      const expiredNow = new Date(new Date(endAt).getTime() + 4 * DAY_MS);

      expect(isWrappedWindowOpen({ endAt }, openNow)).toBe(true);
      expect(isWrappedWindowExpired({ endAt }, openNow)).toBe(false);

      expect(isWrappedWindowOpen({ endAt }, expiredNow)).toBe(false);
      expect(isWrappedWindowExpired({ endAt }, expiredNow)).toBe(true);
   });

   it("resolves completion date prioritizing resultsLockedAt over endAt", () => {
      expect(
         getChallengeCompletionDate({
            resultsLockedAt: LOCKED_AT,
            endAt: "2026-10-10T00:00:00.000Z",
         })
      ).toEqual(new Date(LOCKED_AT));

      expect(
         getChallengeCompletionDate({
            resultsLockedAt: null,
            endAt: "2026-10-10T00:00:00.000Z",
         })
      ).toEqual(new Date("2026-10-10T00:00:00.000Z"));
   });

   it("identifies if a challenge is completed via lock or past endAt", () => {
      const now = new Date("2026-10-11T00:00:00.000Z");
      expect(
         isChallengeCompleted({ resultsLockedAt: LOCKED_AT, endAt: null }, now)
      ).toBe(true);
      expect(
         isChallengeCompleted(
            {
               resultsLockedAt: null,
               endAt: "2026-10-10T00:00:00.000Z",
            },
            now
         )
      ).toBe(true);
      expect(
         isChallengeCompleted(
            {
               resultsLockedAt: null,
               endAt: "2026-10-15T00:00:00.000Z",
            },
            now
         )
      ).toBe(false);
   });
});

describe("isWrappedPopupDue", () => {
   const openNow = new Date(new Date(LOCKED_AT).getTime() + 1 * DAY_MS);

   it("is due while unseen inside the window", () => {
      expect(
         isWrappedPopupDue({
            resultsLockedAt: LOCKED_AT,
            isWrappedSeen: false,
            isFeedbackFilled: false,
            now: openNow,
         })
      ).toBe(true);
   });

   it("stops being due once seen (even if feedback is still not filled)", () => {
      expect(
         isWrappedPopupDue({
            resultsLockedAt: LOCKED_AT,
            isWrappedSeen: true,
            isFeedbackFilled: false,
            now: openNow,
         })
      ).toBe(false);

      expect(
         isWrappedPopupDue({
            resultsLockedAt: LOCKED_AT,
            isWrappedSeen: true,
            isFeedbackFilled: true,
            now: openNow,
         })
      ).toBe(false);
   });

   it("prefers localStorage values over the server flags", () => {
      expect(
         isWrappedPopupDue({
            resultsLockedAt: LOCKED_AT,
            isWrappedSeen: false,
            localSeen: true,
            now: openNow,
         })
      ).toBe(false);

      expect(
         isWrappedPopupDue({
            resultsLockedAt: LOCKED_AT,
            isWrappedSeen: true,
            localSeen: false,
            now: openNow,
         })
      ).toBe(true);
   });

   it("never opens outside the window", () => {
      const lateNow = new Date(
         new Date(LOCKED_AT).getTime() +
            (WRAPPED_POPUP_WINDOW_DAYS + 1) * DAY_MS
      );
      expect(
         isWrappedPopupDue({
            resultsLockedAt: LOCKED_AT,
            isWrappedSeen: false,
            isFeedbackFilled: false,
            now: lateNow,
         })
      ).toBe(false);
   });
});

describe("buildChallengeWrappedViewModel", () => {
   it("returns challenge-level data with a null viewer for spectators", () => {
      const wrapped = buildChallengeWrappedViewModel(buildChallenge(), null);

      expect(wrapped.viewer).toBeNull();
      expect(wrapped.challengeId).toBe("chal-1");
      expect(wrapped.teams).toHaveLength(1);
      expect(wrapped.teams[0].isWinner).toBe(true);
      expect(wrapped.winningTeamIds).toEqual(["team-bees"]);
      expect(wrapped.totalDays).toBe(7);
      expect(wrapped.challengeTotalSeconds).toBe(72_000);
   });

   it("marks every team at the max as a winner on tied totals", () => {
      const challenge = buildChallenge({
         teams: [
            buildTeam({ id: "t-a", name: "A", totalLoggedSeconds: 10_000 }),
            buildTeam({ id: "t-b", name: "B", totalLoggedSeconds: 10_000 }),
         ],
      });

      const wrapped = buildChallengeWrappedViewModel(challenge, null);

      expect(wrapped.winningTeamIds).toEqual(["t-a", "t-b"]);
      expect(wrapped.teams.map((team) => team.isWinner)).toEqual([true, true]);
   });

   it("builds the viewer block with daily series, best day, averages and contribution", () => {
      const challenge = buildChallenge({
         teams: [buildTeam({ totalLoggedSeconds: 16_800 })],
         standings: [
            buildStanding({
               dailyLogs: {
                  "2026-10-05": 3_600,
                  "2026-10-06": 7_200,
                  "2026-10-07": 1_800,
               },
               totalLoggedSeconds: 12_600,
               targetSeconds: 12_600,
               targetClock: "03:30:00",
            }),
            buildStanding({
               participantId: "part-2",
               userId: "user-2",
               displayName: "SlothBrain",
               rank: 2,
               teamId: "team-bees",
               totalLoggedSeconds: 4_200,
               targetSeconds: 36_000,
               paceStatus: "punished",
               paceLabel: "Punished",
               status: "PUNISHED",
               weeklyTasksCompletedCount: 0,
               weeklyTasksTotalCount: 1,
               dailyLogs: { "2026-10-05": 4_200 },
            }),
         ],
      });

      const wrapped = buildChallengeWrappedViewModel(challenge, "part-1");
      const viewer = wrapped.viewer;

      expect(viewer).not.toBeNull();
      expect(viewer?.verdict).toBe("saved");
      expect(viewer?.reasons).toEqual([]);
      expect(viewer?.daily).toHaveLength(7);
      expect(viewer?.daily[0]).toMatchObject({
         dateKey: "2026-10-05",
         dayNumber: 1,
         durationSeconds: 3_600,
         averageSeconds: 3_900, // (3600 + 4200) / 2
      });
      expect(viewer?.bestDay?.dateKey).toBe("2026-10-06");
      expect(viewer?.bestDay?.durationSeconds).toBe(7_200);
      // average total = (12600 + 4200) / 2 = 8400 -> 12600/8400 = 1.5x
      expect(viewer?.timesVsAverage).toBe(1.5);
      // contribution: 12600 / team total (12600 + 4200) = 75%
      expect(viewer?.contributionPercentage).toBe(75);
   });

   it("carries the punishment reasons for a punished viewer", () => {
      const challenge = buildChallenge({
         standings: [
            buildStanding({
               participantId: "part-2",
               userId: "user-2",
               displayName: "SlothBrain",
               teamId: "team-bees",
               totalLoggedSeconds: 36_000,
               targetSeconds: 72_000,
               weeklyTasksCompletedCount: 1,
               weeklyTasksTotalCount: 3,
               paceStatus: "punished",
               paceLabel: "Punished",
               status: "PUNISHED",
            }),
         ],
      });

      const wrapped = buildChallengeWrappedViewModel(challenge, "part-2");

      expect(wrapped.viewer?.verdict).toBe("punished");
      expect(wrapped.viewer?.reasons).toEqual([
         "hours_deficit",
         "incomplete_weekly_tasks",
      ]);
      expect(wrapped.viewer?.hoursDeficitSeconds).toBe(36_000);
      expect(wrapped.viewer?.isTargetMet).toBe(false);
   });

   it("reports the losing_team reason for a beaten team with perfect personal stats", () => {
      const challenge = buildChallenge({
         teams: [
            buildTeam({
               id: "t-win",
               name: "Winners",
               totalLoggedSeconds: 90_000,
            }),
            buildTeam({
               id: "t-lose",
               name: "Losers",
               totalLoggedSeconds: 10_000,
            }),
         ],
         standings: [
            buildStanding({
               teamId: "t-lose",
               teamName: "Losers",
               totalLoggedSeconds: 72_000,
               targetSeconds: 72_000,
               weeklyTasksCompletedCount: 3,
               weeklyTasksTotalCount: 3,
               paceStatus: "punished",
               paceLabel: "Punished",
               status: "PUNISHED",
            }),
         ],
      });

      const wrapped = buildChallengeWrappedViewModel(challenge, "part-1");

      expect(wrapped.viewer?.teamResult).toBe("beaten");
      expect(wrapped.viewer?.reasons).toEqual(["losing_team"]);
   });

   it("maps an excused pace status to the excused verdict", () => {
      const challenge = buildChallenge({
         standings: [
            buildStanding({
               paceStatus: "excused",
               paceLabel: "Excused",
               status: "EXCUSED",
            }),
         ],
      });

      const wrapped = buildChallengeWrappedViewModel(challenge, "part-1");

      expect(wrapped.viewer?.verdict).toBe("excused");
   });

   it("marks teamless participants as no-team", () => {
      const challenge = buildChallenge({
         standings: [
            buildStanding({
               teamId: "no-assigned",
               teamName: "Unassigned",
            }),
         ],
      });

      const wrapped = buildChallengeWrappedViewModel(challenge, "part-1");

      expect(wrapped.viewer?.teamResult).toBe("no-team");
      expect(wrapped.viewer?.reasons).toEqual(["losing_team"]);
      expect(wrapped.viewer?.contributionPercentage).toBe(0);
   });
});
