import { describe, it, expect, beforeEach } from "vitest";
import {
   checkRateLimit,
   resetRateLimit,
   clearRateLimitStore,
} from "./rate-limiter";

describe("rate-limiter", () => {
   beforeEach(() => {
      clearRateLimitStore();
   });

   it("allows requests under the maximum limit", () => {
      const res1 = checkRateLimit("user-1", {
         maxAttempts: 3,
         windowMs: 10000,
      });
      expect(res1.allowed).toBe(true);
      expect(res1.remaining).toBe(2);

      const res2 = checkRateLimit("user-1", {
         maxAttempts: 3,
         windowMs: 10000,
      });
      expect(res2.allowed).toBe(true);
      expect(res2.remaining).toBe(1);

      const res3 = checkRateLimit("user-1", {
         maxAttempts: 3,
         windowMs: 10000,
      });
      expect(res3.allowed).toBe(true);
      expect(res3.remaining).toBe(0);
   });

   it("blocks requests once maximum limit is reached", () => {
      const opts = { maxAttempts: 2, windowMs: 10000 };
      checkRateLimit("user-2", opts);
      checkRateLimit("user-2", opts);

      const blocked = checkRateLimit("user-2", opts);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.resetMs).toBeGreaterThan(0);
   });

   it("resets rate limit for a key", () => {
      const opts = { maxAttempts: 1, windowMs: 10000 };
      checkRateLimit("user-3", opts);
      expect(checkRateLimit("user-3", opts).allowed).toBe(false);

      resetRateLimit("user-3");
      expect(checkRateLimit("user-3", opts).allowed).toBe(true);
   });
});
