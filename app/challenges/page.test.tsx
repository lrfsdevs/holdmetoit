import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import ChallengesDirectoryPage from "./page";
import { listAllChallenges } from "@/features/challenges/data/challenge.repository";
import { auth } from "@/core/auth";
import { cookies } from "next/headers";

const imageState = vi.hoisted(() => ({
   status: "loading" as "loading" | "loaded" | "error",
   onLoad: undefined as undefined | (() => void),
   onError: undefined as undefined | (() => void),
}));

vi.mock("react", async (importOriginal) => {
   const actual = await importOriginal<typeof import("react")>();
   return {
      ...actual,
      useState: (initial: unknown) => {
         if (initial === "loading") {
            return [
               imageState.status,
               (status: typeof imageState.status) => {
                  imageState.status = status;
               },
            ];
         }
         return actual.useState(initial);
      },
   };
});

vi.mock("next/image", () => ({
   default: ({
      src,
      alt,
      className,
      onLoad,
      onError,
   }: {
      src: string;
      alt: string;
      className: string;
      onLoad: () => void;
      onError: () => void;
   }) => {
      imageState.onLoad = onLoad;
      imageState.onError = onError;
      return createElement("img", { src, alt, className });
   },
}));

vi.mock("next/link", () => ({
   default: ({ href, children }: { href: string; children: ReactNode }) =>
      createElement("a", { href }, children),
}));

vi.mock("@/components/ui/button", () => ({
   Button: ({ children }: { children: ReactNode }) =>
      createElement("div", null, children),
}));

vi.mock("@/core/auth", () => ({
   auth: vi.fn(),
}));

vi.mock("next/headers", () => ({
   cookies: vi.fn(),
}));

vi.mock("@/features/challenges/data/challenge.repository", () => ({
   listAllChallenges: vi.fn(),
}));

const uploadedUrl =
   "https://example.supabase.co/storage/v1/object/public/holdmetoit-bucket/event-banners/banner.png";
const punishmentUrl =
   "https://example.supabase.co/storage/v1/object/public/holdmetoit-bucket/punishment-pfps/pfp.png";

function setChallenge(url: string | null) {
   vi.mocked(listAllChallenges).mockResolvedValue([
      {
         id: "challenge-1",
         title: "Study Battle",
         format: "TEAM_VS_TEAM",
         challengeColor: null,
         startAt: new Date("2026-10-01T00:00:00.000Z"),
         endAt: new Date("2026-10-07T00:00:00.000Z"),
         status: "ACTIVE",
         eventBannerUrl: url,
         punishmentPfpUrl: punishmentUrl,
         resultsLockedAt: null,
         hostId: "admin-1",
         createdAt: new Date("2026-10-01T00:00:00.000Z"),
         updatedAt: new Date("2026-10-01T00:00:00.000Z"),
         host: {
            id: "admin-1",
            displayName: "Host Admin",
            username: "admin",
            image: null,
         },
         teams: [],
         _count: { participants: 2 },
      },
   ] as Awaited<ReturnType<typeof listAllChallenges>>);
}

async function render() {
   return renderToStaticMarkup(await ChallengesDirectoryPage());
}

beforeEach(() => {
   vi.clearAllMocks();
   imageState.status = "loading";
   imageState.onLoad = undefined;
   imageState.onError = undefined;
   vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
   } as any);
   vi.mocked(auth).mockResolvedValue(null as any);
});

describe("ChallengesDirectoryPage", () => {
   it("renders for public spectator without admin action buttons", async () => {
      vi.mocked(auth).mockResolvedValue(null as any);
      setChallenge(uploadedUrl);
      const html = await render();

      expect(html).toContain("Study Battle");
      expect(html).toContain("Events");
      expect(html).toContain('href="/challenge/challenge-1"');
      expect(html).not.toContain("Create Challenge");
      expect(html).not.toContain("Change Accent Color");
   });

   it("renders admin action buttons when user is ADMIN", async () => {
      vi.mocked(auth).mockResolvedValue({
         user: { id: "admin-1", role: "ADMIN" },
      } as any);
      setChallenge(uploadedUrl);
      const html = await render();

      expect(html).toContain("Create Challenge");
      expect(html).toContain("Change Accent Color");
      expect(html).toContain('href="/admin/challenges/new"');
   });

   it("hides admin action buttons when admin is in preview-as-participant mode", async () => {
      vi.mocked(auth).mockResolvedValue({
         user: { id: "admin-1", role: "ADMIN" },
      } as any);
      vi.mocked(cookies).mockResolvedValue({
         get: vi.fn().mockReturnValue({ value: "true" }),
      } as any);
      setChallenge(uploadedUrl);
      const html = await render();

      expect(html).toContain("Study Battle");
      expect(html).not.toContain("Create Challenge");
      expect(html).not.toContain("Change Accent Color");
   });

   it("renders the event banner rather than the differing punishment PFP", async () => {
      setChallenge(uploadedUrl);
      const html = await render();
      expect(html).toContain(`src="${uploadedUrl}"`);
      expect(html).not.toContain(punishmentUrl);
      expect(html).toContain("Loading image for Study Battle");
      expect(html).toContain('href="/challenge/challenge-1"');
   });

   it.each([null, "", "   "])(
      "uses a neutral background for missing images (%s)",
      async (url) => {
         setChallenge(url);
         const html = await render();
         expect(html).not.toContain("<img");
         expect(html).not.toContain(punishmentUrl);
         expect(html).not.toContain("Loading image for");
         expect(html).toContain("View Challenge");
      }
   );
});
