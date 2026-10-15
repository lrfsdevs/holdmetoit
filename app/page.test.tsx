import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
   auth: vi.fn(),
   cookies: vi.fn(),
   getParticipantCockpit: vi.fn(),
   getUserCategorizedTasks: vi.fn(),
   findLatestAvailableChallenge: vi.fn(),
   findLatestCompletedChallengeForWrapped: vi.fn(),
   getChallengeScoreboard: vi.fn(),
   homeCockpitView: vi.fn(),
   appHeader: vi.fn(),
   isFeatureEnabled: vi.fn(),
}));

vi.mock("@/core/auth", () => ({ auth: mocks.auth }));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/features/auth/domain/preview-mode", () => ({
   PARTICIPANT_PREVIEW_COOKIE: "preview",
   getEffectiveAdminState: vi.fn(() => ({
      isActualAdmin: false,
      isPreviewActive: false,
      isAdmin: false,
      effectiveRole: "PARTICIPANT",
   })),
}));
vi.mock("@/features/auth/presentation/auth-nav", () => ({
   AppHeader: (props: unknown) => {
      mocks.appHeader(props);
      return createElement("header", null, "header");
   },
}));
vi.mock("@/features/study-logs/presentation/home-cockpit-view", () => ({
   HomeCockpitView: (props: unknown) => {
      mocks.homeCockpitView(props);
      return createElement("div", null, "home");
   },
}));
vi.mock("@/features/study-logs/data/cockpit-data", () => ({
   getParticipantCockpit: mocks.getParticipantCockpit,
}));
vi.mock("@/features/tasks/data/task.repository", () => ({
   getUserCategorizedTasks: mocks.getUserCategorizedTasks,
}));
vi.mock("@/features/challenges/data/challenge.repository", () => ({
   findLatestAvailableChallenge: mocks.findLatestAvailableChallenge,
   findLatestCompletedChallengeForWrapped:
      mocks.findLatestCompletedChallengeForWrapped,
}));
vi.mock("@/features/leaderboard/data/leaderboard-data", () => ({
   getChallengeScoreboard: mocks.getChallengeScoreboard,
}));
vi.mock("@/features/feature-flags/api/server", () => ({
   isFeatureEnabled: mocks.isFeatureEnabled,
}));

import HomePage from "./page";
import { getEffectiveAdminState } from "@/features/auth/domain/preview-mode";

function deferred<T>() {
   let resolve!: (value: T) => void;
   const promise = new Promise<T>((promiseResolve) => {
      resolve = promiseResolve;
   });
   return { promise, resolve };
}

describe("HomePage data loading", () => {
   beforeEach(() => {
      vi.clearAllMocks();
      mocks.isFeatureEnabled.mockResolvedValue(true);
      mocks.auth.mockResolvedValue({
         user: { id: "user-1", role: "PARTICIPANT" },
      });
      mocks.cookies.mockResolvedValue({
         get: vi.fn().mockReturnValue(undefined),
      });
   });

   it("starts independent authenticated queries concurrently", async () => {
      const cockpit = deferred<null>();
      const tasks = deferred<null>();
      const upcoming = deferred<null>();
      const eligibleWrapped = deferred<{ id: string } | null>();

      mocks.getParticipantCockpit.mockReturnValue(cockpit.promise);
      mocks.getUserCategorizedTasks.mockReturnValue(tasks.promise);
      mocks.findLatestAvailableChallenge.mockReturnValue(upcoming.promise);
      mocks.findLatestCompletedChallengeForWrapped.mockReturnValue(
         eligibleWrapped.promise
      );

      const page = HomePage({ searchParams: { challenge: "challenge-1" } });
      await Promise.resolve();
      await Promise.resolve();

      expect(mocks.getParticipantCockpit).toHaveBeenCalledWith(
         "user-1",
         "challenge-1"
      );
      expect(mocks.getUserCategorizedTasks).toHaveBeenCalledWith("user-1");
      expect(mocks.findLatestAvailableChallenge).toHaveBeenCalledOnce();
      expect(mocks.findLatestCompletedChallengeForWrapped).toHaveBeenCalledWith(
         "user-1"
      );
      expect(mocks.getChallengeScoreboard).not.toHaveBeenCalled();

      cockpit.resolve(null);
      tasks.resolve(null);
      upcoming.resolve(null);
      eligibleWrapped.resolve(null);

      await page;
      expect(mocks.getChallengeScoreboard).not.toHaveBeenCalled();
      expect(renderToStaticMarkup(await page)).toContain("home");
   });

   it("skips the wrapped scoreboard fetch when the wrapped flag is off", async () => {
      mocks.isFeatureEnabled.mockResolvedValue(false);
      mocks.getParticipantCockpit.mockResolvedValue(null);
      mocks.getUserCategorizedTasks.mockResolvedValue(null);
      mocks.findLatestAvailableChallenge.mockResolvedValue(null);
      mocks.findLatestCompletedChallengeForWrapped.mockResolvedValue({
         id: "chal-wrapped",
      });

      renderToStaticMarkup(await HomePage({}));

      expect(mocks.isFeatureEnabled).toHaveBeenCalledWith(
         "challenge_wrapped_v1"
      );
      expect(mocks.getChallengeScoreboard).not.toHaveBeenCalled();
      const viewProps = mocks.homeCockpitView.mock.calls[0]?.[0] as {
         wrappedChallenge: unknown;
      };
      expect(viewProps.wrappedChallenge).toBeNull();
   });

   it("fetches and injects the wrapped challenge when the flag is on", async () => {
      mocks.isFeatureEnabled.mockResolvedValue(true);
      mocks.getParticipantCockpit.mockResolvedValue(null);
      mocks.getUserCategorizedTasks.mockResolvedValue(null);
      mocks.findLatestAvailableChallenge.mockResolvedValue(null);
      mocks.findLatestCompletedChallengeForWrapped.mockResolvedValue({
         id: "chal-wrapped",
      });
      mocks.getChallengeScoreboard.mockResolvedValue({ id: "chal-wrapped" });

      renderToStaticMarkup(await HomePage({}));

      expect(mocks.getChallengeScoreboard).toHaveBeenCalledWith(
         "chal-wrapped",
         "user-1"
      );
      const viewProps = mocks.homeCockpitView.mock.calls[0]?.[0] as {
         wrappedChallenge: unknown;
      };
      expect(viewProps.wrappedChallenge).toEqual({ id: "chal-wrapped" });
   });

   it("passes the preview-downgraded user to the header", async () => {
      vi.mocked(getEffectiveAdminState).mockReturnValueOnce({
         isActualAdmin: true,
         isPreviewActive: true,
         isAdmin: false,
         effectiveRole: "PARTICIPANT",
      });
      mocks.auth.mockResolvedValue({
         user: { id: "user-1", role: "DEV" },
      });
      mocks.getParticipantCockpit.mockResolvedValue(null);
      mocks.getUserCategorizedTasks.mockResolvedValue(null);
      mocks.findLatestAvailableChallenge.mockResolvedValue(null);
      mocks.findLatestCompletedChallengeForWrapped.mockResolvedValue(null);

      renderToStaticMarkup(await HomePage({}));

      expect(mocks.appHeader.mock.calls[0]?.[0]).toMatchObject({
         user: expect.objectContaining({ role: "PARTICIPANT" }),
      });
   });
});
