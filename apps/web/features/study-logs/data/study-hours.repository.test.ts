import { describe, it, expect, vi, beforeEach } from "vitest";
import {
   getUserAuthoritativeStudySeconds,
   MAX_SECONDS_PER_DAY,
} from "./study-hours.repository";

describe("Authoritative Cumulative Study Hours Repository (Section 5)", () => {
   it("returns 0 if userId is empty", async () => {
      const total = await getUserAuthoritativeStudySeconds("");
      expect(total).toBe(0);
   });

   it("deduplicates multiple logs on the same calendar date and caps at 86,400s", async () => {
      const mockTx = {
         dailyStudyLog: {
            findMany: vi.fn().mockResolvedValue([
               // Day 1: Two logs on same date across challenges (e.g. 3h and 4h) -> should take max (4h = 14400s)
               {
                  logDate: new Date("2026-10-10T00:00:00.000Z"),
                  durationSeconds: 3 * 3600,
               },
               {
                  logDate: new Date("2026-10-10T00:00:00.000Z"),
                  durationSeconds: 4 * 3600,
               },
               // Day 2: One normal log of 5h (18000s)
               {
                  logDate: new Date("2026-10-11T00:00:00.000Z"),
                  durationSeconds: 5 * 3600,
               },
               // Day 3: A corrupted/glitched log of 100,000s -> should be capped at 86,400s
               {
                  logDate: new Date("2026-10-12T00:00:00.000Z"),
                  durationSeconds: 100000,
               },
            ]),
         },
      } as any;

      const totalSeconds = await getUserAuthoritativeStudySeconds(
         "user_123",
         mockTx
      );

      // Expected:
      // Day 1: 14,400s
      // Day 2: 18,000s
      // Day 3: 86,400s
      // Total = 14,400 + 18,000 + 86,400 = 118,800s
      expect(totalSeconds).toBe(118800);
   });

   it("returns 0 if user has no study logs", async () => {
      const mockTx = {
         dailyStudyLog: {
            findMany: vi.fn().mockResolvedValue([]),
         },
      } as any;

      const totalSeconds = await getUserAuthoritativeStudySeconds(
         "user_new",
         mockTx
      );
      expect(totalSeconds).toBe(0);
   });
});
