import { afterEach, describe, expect, it, vi } from "vitest";

import {
   isLogRocketEnabled,
   setLogRocketEnabled,
} from "@/core/observability/logrocket-config";

afterEach(() => {
   vi.unstubAllGlobals();
   vi.unstubAllEnvs();
});

describe("logrocket-config: isLogRocketEnabled", () => {
   it("is disabled on the server (no window)", () => {
      expect(isLogRocketEnabled()).toBe(false);
   });

   it("is disabled in local development even when the flag is on", () => {
      vi.stubGlobal("window", {});
      vi.stubEnv("NODE_ENV", "development");
      setLogRocketEnabled(true);
      expect(isLogRocketEnabled()).toBe(false);
   });

   it("is disabled in production when the flag is unset", () => {
      vi.stubGlobal("window", {});
      vi.stubEnv("NODE_ENV", "production");
      expect(isLogRocketEnabled()).toBe(false);
   });

   it("is disabled in production when the flag is off", () => {
      vi.stubGlobal("window", {});
      vi.stubEnv("NODE_ENV", "production");
      setLogRocketEnabled(false);
      expect(isLogRocketEnabled()).toBe(false);
   });

   it("is enabled in production when the flag is on", () => {
      vi.stubGlobal("window", {});
      vi.stubEnv("NODE_ENV", "production");
      setLogRocketEnabled(true);
      expect(isLogRocketEnabled()).toBe(true);
   });
});

describe("logrocket-config: setLogRocketEnabled", () => {
   it("applies the flag to the current window", () => {
      const fakeWindow: Window & { __HMI_LOGROCKET_ENABLED__?: boolean } = {
         __HMI_LOGROCKET_ENABLED__: false,
      } as never;
      vi.stubGlobal("window", fakeWindow);

      setLogRocketEnabled(true);
      expect(window.__HMI_LOGROCKET_ENABLED__).toBe(true);

      setLogRocketEnabled(false);
      expect(window.__HMI_LOGROCKET_ENABLED__).toBe(false);
   });
});
