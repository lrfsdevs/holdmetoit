// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ChallengeManageTab } from "./challenge-manage-tab";
import { deleteChallengeAction } from "@/features/challenges/api/challenge-admin.actions";
import type {
   ChallengeScoreboardViewModel,
   ScoreboardStandingEntry,
} from "@/features/leaderboard/data/leaderboard-data";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
   useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}));

vi.mock("next/image", () => ({
   default: ({ src, alt, ...rest }: any) =>
      createElement("img", { src, alt, ...rest }),
}));

vi.mock("next/link", () => ({
   default: ({ href, children, ...rest }: any) =>
      createElement("a", { href, ...rest }, children),
}));

vi.mock(
   "@/features/study-logs/presentation/admin-hours-override-modal",
   () => ({
      AdminHoursOverrideModal: () => null,
   })
);

vi.mock("./admin-target-override-modal", () => ({
   AdminTargetOverrideModal: () => null,
}));

vi.mock("./challenge-image-input", () => ({
   ChallengeImageInput: () => null,
}));

vi.mock("@/features/challenges/api/challenge-admin.actions", () => ({
   deleteChallengeAction: vi.fn(),
   kickoffChallengeAction: vi.fn(),
   lockChallengeResultsAction: vi.fn(),
   reassignParticipantTeamAction: vi.fn(),
   removeChallengeParticipantAction: vi.fn(),
   unlockChallengeResultsAction: vi.fn(),
   updateChallengeAction: vi.fn(),
}));

vi.mock("@/features/challenges/api/punishment-pfp.actions", () => ({
   discardChallengeImageUploadAction: vi.fn(),
}));

function createStanding(id: string, name: string): ScoreboardStandingEntry {
   return {
      rank: 1,
      userId: `user-${id}`,
      participantId: id,
      username: name.toLowerCase(),
      displayName: name,
      image: null,
      teamId: "team-1",
      teamName: "Bees",
      teamColor: "#ff9900",
      teamIcon: null,
      totalLoggedSeconds: 3600,
      totalLoggedClock: "01:00:00",
      todayLoggedSeconds: 3600,
      todayLoggedClock: "01:00:00",
      targetSeconds: 36000,
      targetClock: "10:00:00",
      completionPercentage: 10,
      paceStatus: "on-track",
      paceLabel: "On Track",
      weeklyTasksCompletedCount: 1,
      weeklyTasksTotalCount: 1,
      status: "ACTIVE",
      deficitSeconds: 0,
      dailyLogs: { "2026-10-01": 3600 },
   };
}

const mockChallenge: ChallengeScoreboardViewModel = {
   id: "chal-manage-1",
   title: "Study Battle",
   heroImageUrl: null,
   eventBannerUrl: null,
   punishmentPfpUrl: null,
   format: "TEAM_VS_TEAM",
   status: "ACTIVE",
   startAt: "2026-10-01T00:00:00.000Z",
   endAt: "2026-10-08T00:00:00.000Z",
   daysRemaining: 4,
   totalDays: 7,
   currentDayNumber: 3,
   timeRemainingHuman: "4d",
   teams: [],
   matchHeader: {
      hasMatchup: false,
      teamA: null,
      teamB: null,
      leaderTeamId: null,
      leaderSide: "a",
      leadMarginSeconds: 0,
      leadMarginClock: "00:00:00",
      leadMarginHuman: "0s",
      ratioPercentageA: 50,
      ratioPercentageB: 50,
   },
   standings: [createStanding("p1", "Alice Smith")],
   currentUser: {
      isLoggedIn: true,
      isEnrolled: true,
      participantId: "p1",
      isWrappedSeen: false,
      isFeedbackFilled: false,
   },
};

afterEach(cleanup);

describe("ChallengeManageTab confirm dialogs", () => {
   beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(deleteChallengeAction).mockResolvedValue({
         ok: true,
      } as any);
   });

   it("opens the delete confirmation and calls the action on confirm", async () => {
      render(createElement(ChallengeManageTab, { challenge: mockChallenge }));

      fireEvent.click(screen.getByRole("button", { name: /delete event/i }));

      expect(await screen.findByText("Delete Challenge Event?")).toBeTruthy();

      fireEvent.click(
         screen.getByRole("button", { name: /yes, delete event/i })
      );

      expect(deleteChallengeAction).toHaveBeenCalledWith("chal-manage-1");
   });

   it("does not delete when the confirmation is cancelled", async () => {
      render(createElement(ChallengeManageTab, { challenge: mockChallenge }));

      fireEvent.click(screen.getByRole("button", { name: /delete event/i }));
      await screen.findByText("Delete Challenge Event?");

      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

      expect(deleteChallengeAction).not.toHaveBeenCalled();
   });
});
