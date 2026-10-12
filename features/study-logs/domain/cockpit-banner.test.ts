import { describe, expect, it } from "vitest";
import {
   determineBannerVariant,
   formatOrdinalRank,
   formatStudiedTodayHours,
} from "./cockpit-banner";

describe("determineBannerVariant", () => {
   it("returns ENROLL_SOLO when not enrolled and format is SOLOS", () => {
      const result = determineBannerVariant({
         isEnrolled: false,
         challengeFormat: "SOLOS",
         todayLoggedSeconds: 0,
         isYesterdayMissed: false,
      });
      expect(result).toBe("ENROLL_SOLO");
   });

   it("returns ENROLL_DUO when not enrolled and format is DUOS", () => {
      const result = determineBannerVariant({
         isEnrolled: false,
         challengeFormat: "DUOS",
         todayLoggedSeconds: 0,
         isYesterdayMissed: false,
      });
      expect(result).toBe("ENROLL_DUO");
   });

   it("returns ENROLL_GROUP when not enrolled and format is TEAM_VS_TEAM", () => {
      const result = determineBannerVariant({
         isEnrolled: false,
         challengeFormat: "TEAM_VS_TEAM",
         todayLoggedSeconds: 0,
         isYesterdayMissed: false,
      });
      expect(result).toBe("ENROLL_GROUP");
   });

   it("returns CHALLENGE_COMPLETED when enrolled and isResultsLocked is true", () => {
      const result = determineBannerVariant({
         isEnrolled: true,
         challengeStatus: "COMPLETED",
         isResultsLocked: true,
         todayLoggedSeconds: 3600,
         isYesterdayMissed: false,
      });
      expect(result).toBe("CHALLENGE_COMPLETED");
   });

   it("returns STUDIED_TODAY on post-expiry (COMPLETED) challenge when results are not locked and user studied today", () => {
      const result = determineBannerVariant({
         isEnrolled: true,
         challengeStatus: "COMPLETED",
         isResultsLocked: false,
         todayLoggedSeconds: 3600,
         isYesterdayMissed: false,
      });
      expect(result).toBe("STUDIED_TODAY");
   });

   it("returns NOT_LOGGED_TODAY on post-expiry (COMPLETED) challenge when results are not locked and user has not logged today", () => {
      const result = determineBannerVariant({
         isEnrolled: true,
         challengeStatus: "COMPLETED",
         isResultsLocked: false,
         todayLoggedSeconds: 0,
         isYesterdayMissed: false,
      });
      expect(result).toBe("NOT_LOGGED_TODAY");
   });

   it("returns FORGOT_YESTERDAY on post-expiry (COMPLETED) challenge when results are not locked and yesterday was missed", () => {
      const result = determineBannerVariant({
         isEnrolled: true,
         challengeStatus: "COMPLETED",
         isResultsLocked: false,
         todayLoggedSeconds: 0,
         isYesterdayMissed: true,
      });
      expect(result).toBe("FORGOT_YESTERDAY");
   });

   it("returns ON_LEAVE_TODAY on post-expiry (COMPLETED) challenge when results are not locked and user is on leave", () => {
      const result = determineBannerVariant({
         isEnrolled: true,
         challengeStatus: "COMPLETED",
         isResultsLocked: false,
         todayLoggedSeconds: 0,
         todayIsLeave: true,
         isYesterdayMissed: false,
      });
      expect(result).toBe("ON_LEAVE_TODAY");
   });

   it("returns ENROLLED_UPCOMING when enrolled and challenge status is UPCOMING", () => {
      const result = determineBannerVariant({
         isEnrolled: true,
         challengeStatus: "UPCOMING",
         todayLoggedSeconds: 0,
         isYesterdayMissed: false,
      });
      expect(result).toBe("ENROLLED_UPCOMING");
   });

   it("returns FORGOT_YESTERDAY when active and yesterday was missed", () => {
      const result = determineBannerVariant({
         isEnrolled: true,
         challengeStatus: "ACTIVE",
         todayLoggedSeconds: 0,
         isYesterdayMissed: true,
      });
      expect(result).toBe("FORGOT_YESTERDAY");
   });

   it("returns FORGOT_YESTERDAY even if today is logged when yesterday was missed (priority)", () => {
      const result = determineBannerVariant({
         isEnrolled: true,
         challengeStatus: "ACTIVE",
         todayLoggedSeconds: 7200,
         isYesterdayMissed: true,
      });
      expect(result).toBe("FORGOT_YESTERDAY");
   });

   it("returns STUDIED_TODAY when active, yesterday not missed, and todayLoggedSeconds > 0", () => {
      const result = determineBannerVariant({
         isEnrolled: true,
         challengeStatus: "ACTIVE",
         todayLoggedSeconds: 46800, // 13 hours
         isYesterdayMissed: false,
      });
      expect(result).toBe("STUDIED_TODAY");
   });

   it("returns NOT_LOGGED_TODAY when active, yesterday not missed, and todayLoggedSeconds == 0", () => {
      const result = determineBannerVariant({
         isEnrolled: true,
         challengeStatus: "ACTIVE",
         todayLoggedSeconds: 0,
         isYesterdayMissed: false,
      });
      expect(result).toBe("NOT_LOGGED_TODAY");
   });

   it("returns ON_LEAVE_TODAY when active, yesterday not missed, and todayIsLeave is true", () => {
      const result = determineBannerVariant({
         isEnrolled: true,
         challengeStatus: "ACTIVE",
         todayLoggedSeconds: 0,
         todayIsLeave: true,
         isYesterdayMissed: false,
      });
      expect(result).toBe("ON_LEAVE_TODAY");
   });

   it("returns NONE when hasChallenge is explicitly false", () => {
      const result = determineBannerVariant({
         isEnrolled: false,
         hasChallenge: false,
         challengeFormat: "TEAM_VS_TEAM",
         todayLoggedSeconds: 0,
         isYesterdayMissed: false,
      });
      expect(result).toBe("NONE");
   });

   it("returns NONE when not enrolled and there is no event in the app (format/status undefined)", () => {
      const result = determineBannerVariant({
         isEnrolled: false,
         todayLoggedSeconds: 0,
         isYesterdayMissed: false,
      });
      expect(result).toBe("NONE");
   });

   it("returns NONE when not enrolled and format is null", () => {
      const result = determineBannerVariant({
         isEnrolled: false,
         challengeFormat: null,
         challengeStatus: null,
         todayLoggedSeconds: 0,
         isYesterdayMissed: false,
      });
      expect(result).toBe("NONE");
   });
});

describe("formatStudiedTodayHours", () => {
   it("formats 13 hours as '13 hours' (matches Figma mockup)", () => {
      expect(formatStudiedTodayHours(13 * 3600)).toBe("13 hours");
   });

   it("formats 1 hour singular as '1 hour'", () => {
      expect(formatStudiedTodayHours(3600)).toBe("1 hour");
   });

   it("formats hours and minutes combined as '2h 30m'", () => {
      expect(formatStudiedTodayHours(2 * 3600 + 30 * 60)).toBe("2h 30m");
   });

   it("formats minutes only under an hour as '45 minutes'", () => {
      expect(formatStudiedTodayHours(45 * 60)).toBe("45 minutes");
   });

   it("formats 1 minute singular as '1 minute'", () => {
      expect(formatStudiedTodayHours(60)).toBe("1 minute");
   });

   it("formats 0 or negative as '0 hours'", () => {
      expect(formatStudiedTodayHours(0)).toBe("0 hours");
      expect(formatStudiedTodayHours(-10)).toBe("0 hours");
   });
});

describe("formatOrdinalRank", () => {
   it("formats standard ordinals (1st, 2nd, 3rd, 4th)", () => {
      expect(formatOrdinalRank(1)).toBe("1st");
      expect(formatOrdinalRank(2)).toBe("2nd");
      expect(formatOrdinalRank(3)).toBe("3rd");
      expect(formatOrdinalRank(4)).toBe("4th");
   });

   it("formats teen exceptions correctly (11th, 12th, 13th)", () => {
      expect(formatOrdinalRank(11)).toBe("11th");
      expect(formatOrdinalRank(12)).toBe("12th");
      expect(formatOrdinalRank(13)).toBe("13th");
   });

   it("formats numbers in 20s and beyond correctly", () => {
      expect(formatOrdinalRank(21)).toBe("21st");
      expect(formatOrdinalRank(22)).toBe("22nd");
      expect(formatOrdinalRank(23)).toBe("23rd");
      expect(formatOrdinalRank(24)).toBe("24th");
      expect(formatOrdinalRank(100)).toBe("100th");
      expect(formatOrdinalRank(101)).toBe("101st");
      expect(formatOrdinalRank(111)).toBe("111th");
      expect(formatOrdinalRank(112)).toBe("112th");
   });

   it("handles non-positive numbers gracefully", () => {
      expect(formatOrdinalRank(0)).toBe("0");
      expect(formatOrdinalRank(-1)).toBe("-1");
   });
});
