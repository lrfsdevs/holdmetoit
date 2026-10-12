import { describe, expect, it } from "vitest";

import {
   calculateChallengeTotalDays,
   getChallengeDayBuckets,
   getChallengeDayDateKey,
   getChallengeDayFromDateKey,
   getChallengeDayNumber,
   getChallengeDayOptions,
   getCalendarWeekDayOptions,
   validateStudyLogChallengeDay,
   validateAdminOverrideChallengeDay,
   isChallengeDayInPast,
   validateAddTaskChallengeDay,
   validateMoveTaskChallengeDay,
} from "./challenge-day";

describe("challenge day calculation", () => {
   const startAt = new Date("2026-10-05T18:00:00.000Z");

   it("keeps the same challenge day after UTC midnight", () => {
      expect(getChallengeDayNumber(startAt, "2026-10-06T00:30:00.000Z")).toBe(
         1
      );
      expect(getChallengeDayDateKey(startAt, 1)).toBe("2026-10-05");
   });

   it("moves to the next challenge day at the exact 24-hour boundary", () => {
      expect(getChallengeDayNumber(startAt, "2026-10-06T17:59:59.000Z")).toBe(
         1
      );
      expect(getChallengeDayNumber(startAt, "2026-10-06T18:00:00.000Z")).toBe(
         2
      );
      expect(getChallengeDayDateKey(startAt, 2)).toBe("2026-10-06");
   });

   it("returns no previous bucket on day one and the prior bucket thereafter", () => {
      expect(
         getChallengeDayBuckets(startAt, "2026-10-05T18:00:00.000Z")
      ).toEqual({
         current: { dayNumber: 1, dateKey: "2026-10-05" },
         previous: null,
      });
      expect(
         getChallengeDayBuckets(startAt, "2026-10-06T18:00:00.000Z")
      ).toEqual({
         current: { dayNumber: 2, dateKey: "2026-10-06" },
         previous: { dayNumber: 1, dateKey: "2026-10-05" },
      });
   });

   it("does not expose a pre-start day as day zero", () => {
      expect(getChallengeDayNumber(startAt, "2026-10-05T17:59:59.000Z")).toBe(
         0
      );
      expect(
         getChallengeDayBuckets(startAt, "2026-10-05T17:59:59.000Z").current
      ).toEqual({
         dayNumber: 1,
         dateKey: "2026-10-05",
      });
   });
});

describe("getChallengeDayFromDateKey", () => {
   const startAt = new Date("2026-10-05T18:00:00.000Z");

   it("reverses getChallengeDayDateKey back to dayNumber", () => {
      expect(getChallengeDayFromDateKey(startAt, "2026-10-05")).toBe(1);
      expect(getChallengeDayFromDateKey(startAt, "2026-10-06")).toBe(2);
      expect(getChallengeDayFromDateKey(startAt, "2026-10-11")).toBe(7);
   });

   it("returns 0 or negative for dates before start", () => {
      expect(getChallengeDayFromDateKey(startAt, "2026-10-04")).toBe(0);
      expect(getChallengeDayFromDateKey(startAt, "2026-10-01")).toBe(-3);
   });

   it("throws on invalid date string format", () => {
      expect(() => getChallengeDayFromDateKey(startAt, "not-a-date")).toThrow(
         TypeError
      );
   });
});

describe("getChallengeDayOptions", () => {
   const startAt = new Date("2026-10-05T18:00:00.000Z"); // Monday Oct 5

   it("generates 7 day options when currently on day 3", () => {
      const now = new Date("2026-10-07T20:00:00.000Z"); // Day 3 (Wed)
      const options = getChallengeDayOptions(startAt, now, 7);

      expect(options).toHaveLength(7);

      // Day 1: Past
      expect(options[0]).toMatchObject({
         dayNumber: 1,
         dateKey: "2026-10-05",
         isToday: false,
         isYesterday: false,
         isFuture: false,
         isPast: true,
      });

      // Day 2: Yesterday
      expect(options[1]).toMatchObject({
         dayNumber: 2,
         dateKey: "2026-10-06",
         isToday: false,
         isYesterday: true,
         isFuture: false,
         isPast: true,
      });

      // Day 3: Today
      expect(options[2]).toMatchObject({
         dayNumber: 3,
         dateKey: "2026-10-07",
         isToday: true,
         isYesterday: false,
         isFuture: false,
         isPast: false,
      });

      // Day 4..7: Future
      expect(options[3].isFuture).toBe(true);
      expect(options[3].isPast).toBe(false);
      expect(options[4].isFuture).toBe(true);
      expect(options[4].isPast).toBe(false);
      expect(options[5].isFuture).toBe(true);
      expect(options[5].isPast).toBe(false);
      expect(options[6].isFuture).toBe(true);
      expect(options[6].isPast).toBe(false);
   });
});

describe("getCalendarWeekDayOptions", () => {
   it("generates 7 days of the ISO week with correct Monday start and today marker", () => {
      // 2026-10-07 is Wednesday (Day 3 in Mon-Sun week)
      const nowWed = new Date("2026-10-07T12:00:00.000Z");
      const options = getCalendarWeekDayOptions(nowWed);

      expect(options).toHaveLength(7);
      expect(options[0].dateKey).toBe("2026-10-05"); // Monday
      expect(options[0].weekday).toBe("Mon");
      expect(options[0].dayNumber).toBe(1);

      expect(options[1].dateKey).toBe("2026-10-06"); // Tuesday
      expect(options[1].isYesterday).toBe(true);

      expect(options[2].dateKey).toBe("2026-10-07"); // Wednesday (Today)
      expect(options[2].isToday).toBe(true);
      expect(options[2].weekday).toBe("Wed");

      expect(options[6].dateKey).toBe("2026-10-11"); // Sunday
      expect(options[6].weekday).toBe("Sun");
      expect(options[6].dayNumber).toBe(7);
      expect(options[6].isFuture).toBe(true);
   });
});

describe("validateStudyLogChallengeDay", () => {
   const startAt = new Date("2026-10-05T18:00:00.000Z");
   const nowDay3 = new Date("2026-10-07T20:00:00.000Z"); // Day 3 (2026-10-07)

   it("allows logging today (current day)", () => {
      const result = validateStudyLogChallengeDay(
         startAt,
         { challengeDay: 3 },
         nowDay3
      );
      expect(result).toEqual({
         ok: true,
         dayNumber: 3,
         dateKey: "2026-10-07",
      });
   });

   it("allows logging yesterday (previous day)", () => {
      const result = validateStudyLogChallengeDay(
         startAt,
         { challengeDay: 2 },
         nowDay3
      );
      expect(result).toEqual({
         ok: true,
         dayNumber: 2,
         dateKey: "2026-10-06",
      });
   });

   it("rejects days before yesterday with ONLY_TODAY_OR_YESTERDAY_ALLOWED", () => {
      // Currently on Day 3; Day 1 is before yesterday (Day 2)
      const result = validateStudyLogChallengeDay(
         startAt,
         { challengeDay: 1 },
         nowDay3
      );
      expect(result).toEqual({
         ok: false,
         code: "ONLY_TODAY_OR_YESTERDAY_ALLOWED",
         message:
            "Participants can only log study time for today or yesterday. Contact a moderator to adjust earlier days.",
      });
   });

   it("allows logging by explicit valid past or current date string", () => {
      const result = validateStudyLogChallengeDay(
         startAt,
         { date: "2026-10-06" },
         nowDay3
      );
      expect(result).toEqual({
         ok: true,
         dayNumber: 2,
         dateKey: "2026-10-06",
      });
   });

   it("rejects future challenge day with FUTURE_DATE_NOT_ALLOWED", () => {
      const result = validateStudyLogChallengeDay(
         startAt,
         { challengeDay: 4 },
         nowDay3
      );
      expect(result).toEqual({
         ok: false,
         code: "FUTURE_DATE_NOT_ALLOWED",
         message: "Cannot log study time for future dates.",
      });
   });

   it("rejects future date with FUTURE_DATE_NOT_ALLOWED", () => {
      const result = validateStudyLogChallengeDay(
         startAt,
         { date: "2026-10-08" },
         nowDay3
      );
      expect(result).toEqual({
         ok: false,
         code: "FUTURE_DATE_NOT_ALLOWED",
         message: "Cannot log study time for future dates.",
      });
   });

   it("rejects challenge day < 1 with DATE_BEFORE_CHALLENGE", () => {
      const result = validateStudyLogChallengeDay(
         startAt,
         { challengeDay: 0 },
         nowDay3
      );
      expect(result).toEqual({
         ok: false,
         code: "DATE_BEFORE_CHALLENGE",
         message:
            "Cannot log study time for days before the challenge started.",
      });
   });

   it("rejects date prior to challenge start with DATE_BEFORE_CHALLENGE", () => {
      const result = validateStudyLogChallengeDay(
         startAt,
         { date: "2026-10-04" },
         nowDay3
      );
      expect(result).toEqual({
         ok: false,
         code: "DATE_BEFORE_CHALLENGE",
         message:
            "Cannot log study time for dates before the challenge started.",
      });
   });

   it("rejects mismatch between challengeDay and date", () => {
      const result = validateStudyLogChallengeDay(
         startAt,
         { challengeDay: 1, date: "2026-10-06" },
         nowDay3
      );
      expect(result).toEqual({
         ok: false,
         code: "MISMATCHED_DATE_AND_DAY",
         message: "The provided challenge day and date do not match.",
      });
   });
});

describe("validateAdminOverrideChallengeDay (Moderator Future Date Lock)", () => {
   const startAt = new Date("2026-10-05T18:00:00.000Z");
   const nowDay3 = new Date("2026-10-07T20:00:00.000Z"); // Day 3 (2026-10-07)

   it("allows moderator to override earlier past days (Day 1) that are locked for normal participants", () => {
      const result = validateAdminOverrideChallengeDay(
         startAt,
         { challengeDay: 1 },
         nowDay3
      );
      expect(result).toEqual({
         ok: true,
         dayNumber: 1,
         dateKey: "2026-10-05",
      });
   });

   it("allows moderator to override yesterday (Day 2) and today (Day 3)", () => {
      const day2Result = validateAdminOverrideChallengeDay(
         startAt,
         { challengeDay: 2 },
         nowDay3
      );
      expect(day2Result).toEqual({
         ok: true,
         dayNumber: 2,
         dateKey: "2026-10-06",
      });

      const day3Result = validateAdminOverrideChallengeDay(
         startAt,
         { challengeDay: 3 },
         nowDay3
      );
      expect(day3Result).toEqual({
         ok: true,
         dayNumber: 3,
         dateKey: "2026-10-07",
      });
   });

   it("STRICTLY REJECTS moderators trying to override future days (Day 4..7)", () => {
      const resultDay4 = validateAdminOverrideChallengeDay(
         startAt,
         { challengeDay: 4 },
         nowDay3
      );
      expect(resultDay4).toEqual({
         ok: false,
         code: "FUTURE_DATE_NOT_ALLOWED",
         message: "Cannot log study time for future dates.",
      });

      const resultDay7 = validateAdminOverrideChallengeDay(
         startAt,
         { challengeDay: 7 },
         nowDay3
      );
      expect(resultDay7).toEqual({
         ok: false,
         code: "FUTURE_DATE_NOT_ALLOWED",
         message: "Cannot log study time for future dates.",
      });
   });

   it("STRICTLY REJECTS moderators trying to override by future date string", () => {
      const result = validateAdminOverrideChallengeDay(
         startAt,
         { date: "2026-10-08" },
         nowDay3
      );
      expect(result).toEqual({
         ok: false,
         code: "FUTURE_DATE_NOT_ALLOWED",
         message: "Cannot log study time for future dates.",
      });
   });

   it("STRICTLY REJECTS all days if the challenge is UPCOMING (has not started yet)", () => {
      const futureStart = new Date("2026-10-15T00:00:00.000Z");
      const nowBeforeStart = new Date("2026-10-08T12:00:00.000Z");

      const result = validateAdminOverrideChallengeDay(
         futureStart,
         { challengeDay: 1 },
         nowBeforeStart
      );
      expect(result).toEqual({
         ok: false,
         code: "FUTURE_DATE_NOT_ALLOWED",
         message: "Cannot log study time for future dates.",
      });
   });

   it("rejects dates before challenge start with DATE_BEFORE_CHALLENGE", () => {
      const result = validateAdminOverrideChallengeDay(
         startAt,
         { date: "2026-10-04" },
         nowDay3
      );
      expect(result).toEqual({
         ok: false,
         code: "DATE_BEFORE_CHALLENGE",
         message:
            "Cannot log study time for dates before the challenge started.",
      });
   });
});

describe("getChallengeDayOptions with UPCOMING challenges", () => {
   it("marks all days as isFuture = true and isToday = false when now < startAt", () => {
      const futureStart = new Date("2026-10-15T00:00:00.000Z");
      const nowBeforeStart = new Date("2026-10-08T12:00:00.000Z");

      const options = getChallengeDayOptions(futureStart, nowBeforeStart, 7);
      expect(options).toHaveLength(7);
      for (const opt of options) {
         expect(opt.isFuture).toBe(true);
         expect(opt.isToday).toBe(false);
         expect(opt.isYesterday).toBe(false);
         expect(opt.isPast).toBe(false);
      }
   });
});

describe("isChallengeDayInPast", () => {
   const startAt = new Date("2026-10-05T00:00:00.000Z");
   const nowDay3 = new Date("2026-10-07T12:00:00.000Z"); // Day 3

   it("identifies past challenge days by dayNumber", () => {
      expect(isChallengeDayInPast(startAt, { dayNumber: 1 }, nowDay3)).toBe(
         true
      );
      expect(isChallengeDayInPast(startAt, { dayNumber: 2 }, nowDay3)).toBe(
         true
      );
      expect(isChallengeDayInPast(startAt, { dayNumber: 3 }, nowDay3)).toBe(
         false
      );
      expect(isChallengeDayInPast(startAt, { dayNumber: 4 }, nowDay3)).toBe(
         false
      );
   });

   it("identifies past challenge days by dateKey", () => {
      expect(
         isChallengeDayInPast(startAt, { dateKey: "2026-10-05" }, nowDay3)
      ).toBe(true);
      expect(
         isChallengeDayInPast(startAt, { dateKey: "2026-10-06" }, nowDay3)
      ).toBe(true);
      expect(
         isChallengeDayInPast(startAt, { dateKey: "2026-10-07" }, nowDay3)
      ).toBe(false);
      expect(
         isChallengeDayInPast(startAt, { dateKey: "2026-10-08" }, nowDay3)
      ).toBe(false);
   });

   it("returns false if challenge has not started yet", () => {
      const beforeStart = new Date("2026-10-01T00:00:00.000Z");
      expect(isChallengeDayInPast(startAt, { dayNumber: 1 }, beforeStart)).toBe(
         false
      );
   });
});

describe("validateAddTaskChallengeDay", () => {
   it("rejects adding tasks when day is in the past", () => {
      const result = validateAddTaskChallengeDay(true);
      expect(result.ok).toBe(false);
      if (!result.ok) {
         expect(result.code).toBe("PAST_DAY_NOT_ALLOWED");
         expect(result.message).toContain("past challenge days is locked");
      }
   });

   it("allows adding tasks when day is today or future", () => {
      const result = validateAddTaskChallengeDay(false);
      expect(result.ok).toBe(true);
   });
});

describe("validateMoveTaskChallengeDay", () => {
   const todayKey = "2026-10-08"; // Today (Day 4)
   const pastDay1Key = "2026-10-05"; // Day 1 (past)
   const pastDay2Key = "2026-10-06"; // Day 2 (past)
   const futureDay5Key = "2026-10-09"; // Day 5 (future)

   it("allows moving tasks from a previous day to today", () => {
      const res = validateMoveTaskChallengeDay(pastDay1Key, todayKey, todayKey);
      expect(res.ok).toBe(true);
   });

   it("allows moving tasks from a previous day to a future day", () => {
      const res = validateMoveTaskChallengeDay(
         pastDay1Key,
         futureDay5Key,
         todayKey
      );
      expect(res.ok).toBe(true);
   });

   it("allows moving tasks from today to a future day", () => {
      const res = validateMoveTaskChallengeDay(
         todayKey,
         futureDay5Key,
         todayKey
      );
      expect(res.ok).toBe(true);
   });

   it("allows moving tasks from a future day to today", () => {
      const res = validateMoveTaskChallengeDay(
         futureDay5Key,
         todayKey,
         todayKey
      );
      expect(res.ok).toBe(true);
   });

   it("strictly rejects moving tasks from present (today) to a past day", () => {
      const res = validateMoveTaskChallengeDay(todayKey, pastDay1Key, todayKey);
      expect(res.ok).toBe(false);
      if (!res.ok) {
         expect(res.code).toBe("PAST_DAY_MOVE_NOT_ALLOWED");
         expect(res.message).toContain(
            "Cannot move tasks from present or future days to a day that has already passed"
         );
      }
   });

   it("strictly rejects moving tasks from a future day to a past day", () => {
      const res = validateMoveTaskChallengeDay(
         futureDay5Key,
         pastDay1Key,
         todayKey
      );
      expect(res.ok).toBe(false);
      if (!res.ok) {
         expect(res.code).toBe("PAST_DAY_MOVE_NOT_ALLOWED");
         expect(res.message).toContain(
            "Cannot move tasks from present or future days to a day that has already passed"
         );
      }
   });

   it("rejects moving tasks between different past days", () => {
      const res = validateMoveTaskChallengeDay(
         pastDay1Key,
         pastDay2Key,
         todayKey
      );
      expect(res.ok).toBe(false);
      if (!res.ok) {
         expect(res.code).toBe("TARGET_DAY_IN_PAST");
         expect(res.message).toContain(
            "Cannot move tasks into a past challenge day that has already concluded"
         );
      }
   });

   it("allows maintaining task on the same past day (e.g. text/status edit)", () => {
      const res = validateMoveTaskChallengeDay(
         pastDay1Key,
         pastDay1Key,
         todayKey
      );
      expect(res.ok).toBe(true);
   });
});

describe("calculateChallengeTotalDays", () => {
   it("calculates 7 days for a 7-day challenge", () => {
      const startAt = "2026-10-05T18:00:00.000Z";
      const endAt = "2026-10-12T18:00:00.000Z";
      expect(calculateChallengeTotalDays(startAt, endAt)).toBe(7);
   });

   it("returns fallback days if endAt is null or undefined", () => {
      const startAt = "2026-10-05T18:00:00.000Z";
      expect(calculateChallengeTotalDays(startAt, null)).toBe(7);
      expect(calculateChallengeTotalDays(startAt, undefined, 14)).toBe(14);
   });

   it("handles non-7-day challenges accurately", () => {
      const startAt = "2026-10-01T00:00:00.000Z";
      const endAt = "2026-10-15T00:00:00.000Z";
      expect(calculateChallengeTotalDays(startAt, endAt)).toBe(14);
   });
});

describe("Day 7 Grace Period (Post-Expiry Unlocked Period)", () => {
   const startAt = new Date("2026-10-05T18:00:00.000Z");
   // 7-day challenge ends at 2026-10-12T18:00:00.000Z.
   // Now is Day 8 calendar time (e.g. 2026-10-12T20:00:00.000Z or next morning 2026-10-13T06:00:00.000Z)
   const nowDay8 = new Date("2026-10-12T20:00:00.000Z");

   it("caps challengeDayBuckets to Day 7 instead of computing Day 8", () => {
      const buckets = getChallengeDayBuckets(startAt, nowDay8, 7);
      expect(buckets.current.dayNumber).toBe(7);
      expect(buckets.current.dateKey).toBe("2026-10-11");
      expect(buckets.previous?.dayNumber).toBe(6);
      expect(buckets.previous?.dateKey).toBe("2026-10-10");
   });

   it("generates exactly 7 day options without generating an 8th day option", () => {
      const buckets = getChallengeDayBuckets(startAt, nowDay8, 7);
      const options = getChallengeDayOptions(
         "2026-10-05",
         buckets.current.dateKey,
         7
      );
      expect(options).toHaveLength(7);

      // Day 7 is marked as Today (Day 7)
      expect(options[6]).toMatchObject({
         dayNumber: 7,
         dateKey: "2026-10-11",
         label: "Today (Day 7)",
         isToday: true,
         isYesterday: false,
         isPast: false,
         isFuture: false,
      });

      // Day 6 is marked as Yesterday (Day 6)
      expect(options[5]).toMatchObject({
         dayNumber: 6,
         dateKey: "2026-10-10",
         label: "Yesterday (Day 6)",
         isToday: false,
         isYesterday: true,
         isPast: true,
         isFuture: false,
      });
   });

   it("validates Day 7 as today and Day 6 as yesterday during grace period", () => {
      const day7Res = validateStudyLogChallengeDay(
         startAt,
         { challengeDay: 7 },
         nowDay8,
         { totalDays: 7 }
      );
      expect(day7Res).toEqual({
         ok: true,
         dayNumber: 7,
         dateKey: "2026-10-11",
      });

      const day6Res = validateStudyLogChallengeDay(
         startAt,
         { challengeDay: 6 },
         nowDay8,
         { totalDays: 7 }
      );
      expect(day6Res).toEqual({
         ok: true,
         dayNumber: 6,
         dateKey: "2026-10-10",
      });

      // Logging for Day 8 is strictly rejected as future date
      const day8Res = validateStudyLogChallengeDay(
         startAt,
         { challengeDay: 8 },
         nowDay8,
         { totalDays: 7 }
      );
      expect(day8Res.ok).toBe(false);
      if (!day8Res.ok) {
         expect(day8Res.code).toBe("FUTURE_DATE_NOT_ALLOWED");
      }

      // Logging for Day 5 is rejected as outside today/yesterday for participants
      const day5Res = validateStudyLogChallengeDay(
         startAt,
         { challengeDay: 5 },
         nowDay8,
         { totalDays: 7 }
      );
      expect(day5Res.ok).toBe(false);
      if (!day5Res.ok) {
         expect(day5Res.code).toBe("ONLY_TODAY_OR_YESTERDAY_ALLOWED");
      }
   });

   it("isChallengeDayInPast correctly evaluates Day 7 and Day 6 during grace period", () => {
      const buckets = getChallengeDayBuckets(startAt, nowDay8, 7);
      // Day 7 is today (active), so not in past
      expect(
         isChallengeDayInPast(
            "2026-10-05",
            { dayNumber: 7 },
            buckets.current.dateKey
         )
      ).toBe(false);
      // Day 6 is in past
      expect(
         isChallengeDayInPast(
            "2026-10-05",
            { dayNumber: 6 },
            buckets.current.dateKey
         )
      ).toBe(true);
   });
});
