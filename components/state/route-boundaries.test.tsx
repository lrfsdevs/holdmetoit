import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import RootNotFound from "@/app/not-found";
import ChallengeNotFound from "@/app/challenge/[id]/not-found";
import ParticipantNotFound from "@/app/challenge/[id]/participant/[participantId]/not-found";

import AppError from "@/app/error";
import GlobalError from "@/app/global-error";
import ChallengesError from "@/app/challenges/error";
import ChallengeError from "@/app/challenge/[id]/error";
import AdminError from "@/app/admin/error";
import NewChallengeError from "@/app/admin/challenges/new/error";
import ProfileError from "@/app/profile/error";

import NewChallengeLoading from "@/app/admin/challenges/new/loading";
import ProfileLoading from "@/app/profile/loading";

vi.mock("next/navigation", () => ({
   useParams: () => ({ id: "chal-42" }),
}));

vi.mock("@/core/observability/logger", () => ({
   logError: vi.fn(),
   logEvents: { appError: "app.error" },
}));

vi.mock("@/core/observability/logrocket", () => ({
   initLogRocket: vi.fn(),
}));

describe("Route Not-Found Boundaries", () => {
   it("renders RootNotFound with 404 header and lounge link", () => {
      const html = renderToStaticMarkup(createElement(RootNotFound));
      expect(html).toContain("404 Error");
      expect(html).toContain("Page Not Found");
      expect(html).toContain("Return to Study Lounge");
   });

   it("renders ChallengeNotFound with 404 header and browse link", () => {
      const html = renderToStaticMarkup(createElement(ChallengeNotFound));
      expect(html).toContain("404 Not Found");
      expect(html).toContain("Challenge Not Found");
      expect(html).toContain("Browse Challenges");
   });

   it("renders ParticipantNotFound with 404 header and links", () => {
      const html = renderToStaticMarkup(createElement(ParticipantNotFound));
      expect(html).toContain("404 Not Found");
      expect(html).toContain("Participant Record Not Found");
      expect(html).toContain("Browse Challenges");
   });
});

describe("Route Error Boundaries", () => {
   const dummyError = Object.assign(new Error("Test error"), {
      digest: "test-digest-123",
   });

   it("renders AppError with error message and dual action buttons", () => {
      const html = renderToStaticMarkup(
         createElement(AppError, { error: dummyError, reset: vi.fn() })
      );
      expect(html).toContain("Something went wrong");
      expect(html).toContain("Try again");
      expect(html).toContain("Return to Study Lounge");
   });

   it("renders GlobalError with critical error shell and error digest", () => {
      const html = renderToStaticMarkup(
         createElement(GlobalError, { error: dummyError, reset: vi.fn() })
      );
      expect(html).toContain("Critical Application Error");
      expect(html).toContain("Error ID: test-digest-123");
      expect(html).toContain("Try again");
      expect(html).toContain("Return to Lounge");
   });

   it("renders ChallengesError with message and recovery buttons", () => {
      const html = renderToStaticMarkup(
         createElement(ChallengesError, { error: dummyError, reset: vi.fn() })
      );
      expect(html).toContain("Couldn&#x27;t load challenges");
      expect(html).toContain("Try again");
      expect(html).toContain("Return to Study Lounge");
   });

   it("renders ChallengeError with message and browse button", () => {
      const html = renderToStaticMarkup(
         createElement(ChallengeError, { error: dummyError, reset: vi.fn() })
      );
      expect(html).toContain("Couldn&#x27;t load challenge scoreboard");
      expect(html).toContain("Try again");
      expect(html).toContain("Browse Challenges");
   });

   it("renders AdminError with message and challenges link", () => {
      const html = renderToStaticMarkup(
         createElement(AdminError, { error: dummyError, reset: vi.fn() })
      );
      expect(html).toContain("Admin Console Error");
      expect(html).toContain("Try again");
      expect(html).toContain("Go to Challenges");
   });

   it("renders NewChallengeError with message and challenges link", () => {
      const html = renderToStaticMarkup(
         createElement(NewChallengeError, { error: dummyError, reset: vi.fn() })
      );
      expect(html).toContain("Couldn&#x27;t load challenge creator");
      expect(html).toContain("Try again");
      expect(html).toContain("Return to Challenges");
   });

   it("renders ProfileError with message and lounge link", () => {
      const html = renderToStaticMarkup(
         createElement(ProfileError, { error: dummyError, reset: vi.fn() })
      );
      expect(html).toContain("Couldn&#x27;t resolve profile");
      expect(html).toContain("Try again");
      expect(html).toContain("Return to Study Lounge");
   });
});

describe("Route Loading Skeletons", () => {
   it("renders NewChallengeLoading wizard skeleton", () => {
      const html = renderToStaticMarkup(createElement(NewChallengeLoading));
      expect(html).toContain("animate-pulse");
   });

   it("renders ProfileLoading dynamic spinner skeleton", () => {
      const html = renderToStaticMarkup(createElement(ProfileLoading));
      expect(html).toContain("Locating your profile...");
      expect(html).toContain("animate-spin");
   });
});
