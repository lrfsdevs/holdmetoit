import { describe, expect, it } from "vitest";

import {
   assertCanKickoffChallenge,
   assertCanLockChallenge,
   calculateChallengeStatus,
   canKickoffChallenge,
   canLockChallenge,
   canLogStudyTime,
   isChallengeReadOnly,
   isChallengeResultsLocked,
   validateChallengeCreation,
   ChallengeStateError,
} from "./challenge-lifecycle";

describe("challenge lifecycle domain (FEAT-CHAL-02, FEAT-CHAL-05)", () => {
   describe("calculateChallengeStatus", () => {
      const startAt = new Date("2026-10-05T00:00:00Z");
      const endAt = new Date("2026-10-12T00:00:00Z");

      it("returns UPCOMING when current time is before startAt", () => {
         const now = new Date("2026-10-04T12:00:00Z");
         expect(calculateChallengeStatus({ startAt, endAt }, now)).toBe(
            "UPCOMING"
         );
      });

      it("returns ACTIVE when current time is between startAt and endAt", () => {
         const onStart = new Date("2026-10-05T00:00:00Z");
         expect(calculateChallengeStatus({ startAt, endAt }, onStart)).toBe(
            "ACTIVE"
         );

         const midEvent = new Date("2026-10-08T15:30:00Z");
         expect(calculateChallengeStatus({ startAt, endAt }, midEvent)).toBe(
            "ACTIVE"
         );
      });

      it("returns COMPLETED when current time is at or after endAt", () => {
         const onEnd = new Date("2026-10-12T00:00:00Z");
         expect(calculateChallengeStatus({ startAt, endAt }, onEnd)).toBe(
            "COMPLETED"
         );

         const afterEnd = new Date("2026-10-13T09:00:00Z");
         expect(calculateChallengeStatus({ startAt, endAt }, afterEnd)).toBe(
            "COMPLETED"
         );
      });
   });
   describe("canKickoffChallenge & assertCanKickoffChallenge", () => {
      it("permits kickoff when status is UPCOMING", () => {
         expect(canKickoffChallenge("UPCOMING")).toBe(true);
         expect(() => assertCanKickoffChallenge("UPCOMING")).not.toThrow();
      });

      it("rejects kickoff when already ACTIVE", () => {
         expect(canKickoffChallenge("ACTIVE")).toBe(false);
         expect(() => assertCanKickoffChallenge("ACTIVE")).toThrowError(
            ChallengeStateError
         );
      });

      it("rejects kickoff when COMPLETED", () => {
         expect(canKickoffChallenge("COMPLETED")).toBe(false);
         expect(() => assertCanKickoffChallenge("COMPLETED")).toThrowError(
            ChallengeStateError
         );
      });
   });

   describe("canLockChallenge & assertCanLockChallenge", () => {
      it("permits locking final results when status is ACTIVE and results are not locked", () => {
         expect(canLockChallenge("ACTIVE")).toBe(true);
         expect(canLockChallenge("ACTIVE", null)).toBe(true);
         expect(() => assertCanLockChallenge("ACTIVE")).not.toThrow();
         expect(() => assertCanLockChallenge("ACTIVE", null)).not.toThrow();
      });

      it("rejects locking when UPCOMING", () => {
         expect(canLockChallenge("UPCOMING")).toBe(false);
         expect(canLockChallenge("UPCOMING", null)).toBe(false);
         expect(() => assertCanLockChallenge("UPCOMING")).toThrowError(
            ChallengeStateError
         );
         expect(() => assertCanLockChallenge("UPCOMING")).toThrowError(
            "Cannot lock final results on an event that has not started yet."
         );
      });

      it("permits locking when COMPLETED after natural expiry if results are not yet locked (Fix D1)", () => {
         expect(canLockChallenge("COMPLETED", null)).toBe(true);
         expect(canLockChallenge("COMPLETED")).toBe(true);
         expect(() => assertCanLockChallenge("COMPLETED", null)).not.toThrow();
         expect(() => assertCanLockChallenge("COMPLETED")).not.toThrow();
      });

      it("rejects locking when results are already locked (resultsLockedAt is set)", () => {
         const lockedDate = new Date("2026-10-12T12:00:00Z");
         expect(canLockChallenge("COMPLETED", lockedDate)).toBe(false);
         expect(canLockChallenge("ACTIVE", lockedDate)).toBe(false);

         expect(() =>
            assertCanLockChallenge("COMPLETED", lockedDate)
         ).toThrowError(ChallengeStateError);
         expect(() =>
            assertCanLockChallenge("COMPLETED", lockedDate)
         ).toThrowError("Challenge results are already locked and finalized.");
         expect(() =>
            assertCanLockChallenge("ACTIVE", lockedDate)
         ).toThrowError("Challenge results are already locked and finalized.");
      });

      it("supports passing challenge object directly to canLockChallenge & assertCanLockChallenge", () => {
         const activeChallenge = {
            status: "ACTIVE" as const,
            resultsLockedAt: null,
         };
         expect(canLockChallenge(activeChallenge)).toBe(true);
         expect(() => assertCanLockChallenge(activeChallenge)).not.toThrow();

         const expiredUnlockedChallenge = {
            status: "COMPLETED" as const,
            resultsLockedAt: null,
         };
         expect(canLockChallenge(expiredUnlockedChallenge)).toBe(true);
         expect(() =>
            assertCanLockChallenge(expiredUnlockedChallenge)
         ).not.toThrow();

         const expiredLockedChallenge = {
            status: "COMPLETED" as const,
            resultsLockedAt: new Date("2026-10-12T12:00:00Z"),
         };
         expect(canLockChallenge(expiredLockedChallenge)).toBe(false);
         expect(() =>
            assertCanLockChallenge(expiredLockedChallenge)
         ).toThrowError("Challenge results are already locked and finalized.");
      });

      it("evaluates isChallengeResultsLocked correctly", () => {
         expect(isChallengeResultsLocked({ resultsLockedAt: null })).toBe(
            false
         );
         expect(isChallengeResultsLocked({ resultsLockedAt: undefined })).toBe(
            false
         );
         expect(
            isChallengeResultsLocked({
               resultsLockedAt: new Date("2026-10-12T12:00:00Z"),
            })
         ).toBe(true);
      });
   });

   describe("validateChallengeCreation", () => {
      it("validates valid TEAM_VS_TEAM input", () => {
         const result = validateChallengeCreation({
            title: "Midterm Study Battle",
            format: "TEAM_VS_TEAM",
            startAt: new Date("2026-09-01T08:00:00Z"),
            endAt: new Date("2026-09-08T08:00:00Z"),
            teams: [
               { name: "Honey Bees", color: "#d9822b", iconEmoji: "🐝" },
               {
                  name: "Lavender Butterflies",
                  color: "#9986b8",
                  iconEmoji: "🦋",
               },
            ],
         });

         expect(result.valid).toBe(true);
         expect(result.errors).toEqual({});
      });

      it("accepts separate optional event banner and punishment PFP URLs", () => {
         const result = validateChallengeCreation({
            title: "Midterm Study Battle",
            format: "SOLOS",
            startAt: new Date("2026-09-01T08:00:00Z"),
            endAt: new Date("2026-09-08T08:00:00Z"),
            eventBannerUrl: "https://example.com/banner.webp",
            punishmentPfpUrl: "https://example.com/pfp.png",
            teams: [{ name: "Solo Grinders" }],
         });

         expect(result.valid).toBe(true);
         expect(result.errors).toEqual({});
      });

      it("rejects short or empty titles", () => {
         const result = validateChallengeCreation({
            title: "Hi",
            format: "DUOS",
            startAt: new Date("2026-09-01T08:00:00Z"),
            endAt: new Date("2026-09-08T08:00:00Z"),
            teams: [{ name: "Pair 1" }],
         });

         expect(result.valid).toBe(false);
         expect(result.errors.title).toBe(
            "Challenge title must be at least 3 characters."
         );
      });

      it("rejects end date before or equal to start date", () => {
         const result = validateChallengeCreation({
            title: "Invalid Dates Battle",
            format: "SOLOS",
            startAt: new Date("2026-09-08T08:00:00Z"),
            endAt: new Date("2026-09-01T08:00:00Z"),
            teams: [{ name: "Solo Grinders" }],
         });

         expect(result.valid).toBe(false);
         expect(result.errors.endAt).toBe("End time must be after start time.");
      });

      it("rejects TEAM_VS_TEAM with fewer than 2 teams", () => {
         const result = validateChallengeCreation({
            title: "One Team Battle",
            format: "TEAM_VS_TEAM",
            startAt: new Date("2026-09-01T08:00:00Z"),
            endAt: new Date("2026-09-08T08:00:00Z"),
            teams: [{ name: "Only Team" }],
         });

         expect(result.valid).toBe(false);
         expect(result.errors.teams).toBe(
            "Team vs Team format requires at least 2 competing teams."
         );
      });

      it("rejects duplicate team names", () => {
         const result = validateChallengeCreation({
            title: "Duplicate Teams",
            format: "TEAM_VS_TEAM",
            startAt: new Date("2026-09-01T08:00:00Z"),
            endAt: new Date("2026-09-08T08:00:00Z"),
            teams: [{ name: "Bees" }, { name: "bees" }],
         });

         expect(result.valid).toBe(false);
         expect(result.errors.teams).toBe(
            "Team names must be unique within the challenge."
         );
      });
   });

   describe("canLogStudyTime & isChallengeReadOnly with resultsLockedAt", () => {
      it("allows study logging on ACTIVE challenges when results are not locked", () => {
         expect(canLogStudyTime("ACTIVE")).toBe(true);
         expect(canLogStudyTime("ACTIVE", null)).toBe(true);
      });

      it("allows study logging on COMPLETED challenges before results are locked (natural expiry grace period)", () => {
         expect(canLogStudyTime("COMPLETED", null)).toBe(true);
      });

      it("forbids study logging on UPCOMING challenges regardless of lock status", () => {
         expect(canLogStudyTime("UPCOMING")).toBe(false);
         expect(canLogStudyTime("UPCOMING", null)).toBe(false);
      });

      it("forbids study logging once challenge results are locked", () => {
         const lockedAt = new Date("2026-10-12T12:00:00Z");
         expect(canLogStudyTime("ACTIVE", lockedAt)).toBe(false);
         expect(canLogStudyTime("COMPLETED", lockedAt)).toBe(false);
      });

      it("evaluates isChallengeReadOnly based on lock and status", () => {
         const lockedAt = new Date("2026-10-12T12:00:00Z");
         expect(isChallengeReadOnly("COMPLETED")).toBe(true);
         expect(isChallengeReadOnly("ACTIVE")).toBe(false);
         expect(isChallengeReadOnly("COMPLETED", lockedAt)).toBe(true);
         expect(isChallengeReadOnly("ACTIVE", lockedAt)).toBe(true);
         expect(isChallengeReadOnly("COMPLETED", null)).toBe(false);
      });
   });
});
