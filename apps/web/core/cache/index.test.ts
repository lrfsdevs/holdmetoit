import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
   revalidateTag: vi.fn(),
   unstable_cache: vi.fn(
      (read: (...args: never[]) => Promise<unknown>) => read
   ),
}));

import { revalidateTag } from "next/cache";
import { CACHE_REVALIDATE_SECONDS, cacheTags, invalidateTags } from "./index";

describe("cache policy", () => {
   it("creates scoped tags for shared and private reads", () => {
      expect(cacheTags.challengeScoreboard("challenge-1")).toBe(
         "challenge:challenge-1:scoreboard"
      );
      expect(cacheTags.userTasks("user-1")).toBe("user:user-1:tasks");
      expect(cacheTags.participantCockpit("user-1", "challenge-1")).toBe(
         "user:user-1:challenge:challenge-1:cockpit"
      );
   });

   it("keeps live data fresher than stable metadata", () => {
      expect(CACHE_REVALIDATE_SECONDS.live).toBeLessThan(
         CACHE_REVALIDATE_SECONDS.standard
      );
      expect(CACHE_REVALIDATE_SECONDS.standard).toBeLessThan(
         CACHE_REVALIDATE_SECONDS.stable
      );
   });

   it("invalidates each requested tag", () => {
      invalidateTags(["tag:one", "tag:two"]);

      expect(revalidateTag).toHaveBeenNthCalledWith(1, "tag:one");
      expect(revalidateTag).toHaveBeenNthCalledWith(2, "tag:two");
   });
});
