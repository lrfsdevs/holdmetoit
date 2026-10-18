import { afterEach, describe, expect, it, vi } from "vitest";

import { isLogRocketEnabled } from "@/core/observability/logrocket-config";

afterEach(() => {
   vi.unstubAllGlobals();
   vi.unstubAllEnvs();
});

describe("logrocket-config: isLogRocketEnabled", () => {
   it("is disabled on the server (no window)", () => {
      expect(isLogRocketEnabled()).toBe(false);
   });

   it("is disabled in local development by default", () => {
      vi.stubGlobal("window", {});
      vi.stubEnv("NODE_ENV", "development");
      expect(isLogRocketEnabled()).toBe(false);
   });

   it("is enabled in production", () => {
      vi.stubGlobal("window", {});
      vi.stubEnv("NODE_ENV", "production");
      expect(isLogRocketEnabled()).toBe(true);
   });
});
