import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
   clampDailyStudySeconds,
   MAX_DAILY_STUDY_SECONDS,
   clampContinuousSessionMs,
   cappedLiveStudyMs,
   MAX_CONTINUOUS_SESSION_SECONDS,
   MAX_CONTINUOUS_SESSION_MS,
} from "../src/config/limits.js";

describe("MAX_DAILY_STUDY_SECONDS", () => {
   test("is exactly 14 hours in seconds", () => {
      assert.strictEqual(MAX_DAILY_STUDY_SECONDS, 50400);
   });
});

describe("clampDailyStudySeconds", () => {
   test("passes through durations under the cap", () => {
      assert.strictEqual(clampDailyStudySeconds(0), 0);
      assert.strictEqual(clampDailyStudySeconds(3600), 3600);
      assert.strictEqual(clampDailyStudySeconds(50399), 50399);
   });

   test("keeps the exact cap value unchanged", () => {
      assert.strictEqual(clampDailyStudySeconds(50400), 50400);
   });

   test("caps durations above 14 hours down to the cap", () => {
      assert.strictEqual(clampDailyStudySeconds(50401), 50400);
      assert.strictEqual(clampDailyStudySeconds(60000), 50400);
      assert.strictEqual(clampDailyStudySeconds(14 * 60 * 60 * 2), 50400);
   });

   test("floors negative and non-numeric inputs to 0", () => {
      assert.strictEqual(clampDailyStudySeconds(-1), 0);
      assert.strictEqual(clampDailyStudySeconds(-99999), 0);
      assert.strictEqual(clampDailyStudySeconds(undefined), 0);
      assert.strictEqual(clampDailyStudySeconds(null), 0);
      assert.strictEqual(clampDailyStudySeconds("abc"), 0);
      assert.strictEqual(clampDailyStudySeconds(NaN), 0);
   });

   test("floors fractional seconds", () => {
      assert.strictEqual(clampDailyStudySeconds(120.9), 120);
   });
});

describe("MAX_CONTINUOUS_SESSION (4h)", () => {
   test("constant is exactly 4 hours", () => {
      assert.strictEqual(MAX_CONTINUOUS_SESSION_SECONDS, 14400);
      assert.strictEqual(MAX_CONTINUOUS_SESSION_MS, 14400000);
   });

   test("clampContinuousSessionMs passes through under-cap elapsed time", () => {
      assert.strictEqual(clampContinuousSessionMs(0), 0);
      assert.strictEqual(clampContinuousSessionMs(3600000), 3600000);
      assert.strictEqual(clampContinuousSessionMs(14399999), 14399999);
      assert.strictEqual(clampContinuousSessionMs(14400000), 14400000);
   });

   test("clampContinuousSessionMs caps elapsed time above 4 hours", () => {
      assert.strictEqual(clampContinuousSessionMs(14400001), 14400000);
      assert.strictEqual(
         clampContinuousSessionMs(5 * 60 * 60 * 1000),
         14400000
      );
      assert.strictEqual(
         clampContinuousSessionMs(24 * 60 * 60 * 1000),
         14400000
      );
   });

   test("clampContinuousSessionMs floors negative and non-numeric inputs", () => {
      assert.strictEqual(clampContinuousSessionMs(-1), 0);
      assert.strictEqual(clampContinuousSessionMs(undefined), 0);
      assert.strictEqual(clampContinuousSessionMs(null), 0);
      assert.strictEqual(clampContinuousSessionMs("abc"), 0);
      assert.strictEqual(clampContinuousSessionMs(NaN), 0);
   });

   test("cappedLiveStudyMs caps only the session term", () => {
      // 1h recorded + 5h session -> 1h + 4h
      assert.strictEqual(
         cappedLiveStudyMs(3600000, 5 * 60 * 60 * 1000),
         3600000 + 14400000
      );
      // 1h recorded + 1h session -> uncapped
      assert.strictEqual(cappedLiveStudyMs(3600000, 3600000), 7200000);
      // 1h recorded + no active session -> unchanged
      assert.strictEqual(cappedLiveStudyMs(3600000, 0), 3600000);
      // negative base floored to 0
      assert.strictEqual(cappedLiveStudyMs(-500, 3600000), 3600000);
   });
});
