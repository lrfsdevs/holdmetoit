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
   AppHeader: () => createElement("header", null, "header"),
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

import HomePage from "./page";

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
});
