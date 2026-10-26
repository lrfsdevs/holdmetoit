import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import DevBoardPage from "./page";
import { listFeatureFlags } from "@/features/feature-flags/data/feature-flags.repository";

vi.mock("@/features/feature-flags/data/feature-flags.repository", () => ({
   listFeatureFlags: vi.fn(),
}));

vi.mock("@/features/feature-flags/presentation/devboard-view", () => ({
   DevBoardView: ({ initialTab }: { initialTab?: string }) =>
      createElement("div", {
         "data-testid": "devboard-view",
         "data-initial-tab": initialTab,
      }),
}));

beforeEach(() => {
   vi.clearAllMocks();
   vi.mocked(listFeatureFlags).mockResolvedValue([]);
});

describe("DevBoardPage tab plumbing", () => {
   it("defaults to flags without a tab param", async () => {
      const html = renderToStaticMarkup(await DevBoardPage({}));

      expect(html).toContain('data-initial-tab="flags"');
   });

   it("passes through a valid tab", async () => {
      const html = renderToStaticMarkup(
         await DevBoardPage({ searchParams: { tab: "cron-logs" } })
      );

      expect(html).toContain('data-initial-tab="cron-logs"');
   });

   it("clamps unknown values", async () => {
      const html = renderToStaticMarkup(
         await DevBoardPage({ searchParams: { tab: "nonsense" } })
      );

      expect(html).toContain('data-initial-tab="flags"');
   });

   it("uses the first value for repeated query params", async () => {
      const html = renderToStaticMarkup(
         await DevBoardPage({ searchParams: { tab: ["ypt", "flags"] } })
      );

      expect(html).toContain('data-initial-tab="ypt"');
   });
});
