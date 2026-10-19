import { describe, expect, it } from "vitest";
import { yptIngestSchema, yptManualImportSchema } from "./ypt.types";

describe("yptIngestSchema", () => {
   it("accepts valid payload with discordId", () => {
      const res = yptIngestSchema.safeParse({
         discordId: "123456789",
         date: "2026-10-15",
         durationSeconds: 3600,
         yptSubject: "Mathematics",
         externalActivityId: "act_101",
      });
      expect(res.success).toBe(true);
   });

   it("accepts valid payload with yptId", () => {
      const res = yptIngestSchema.safeParse({
         yptId: "ypt_student_42",
         date: "2026-10-15",
         durationSeconds: 7200,
      });
      expect(res.success).toBe(true);
   });

   it("rejects when neither discordId nor yptId is provided", () => {
      const res = yptIngestSchema.safeParse({
         date: "2026-10-15",
         durationSeconds: 3600,
      });
      expect(res.success).toBe(false);
   });

   it("rejects negative duration", () => {
      const res = yptIngestSchema.safeParse({
         discordId: "123",
         date: "2026-10-15",
         durationSeconds: -100,
      });
      expect(res.success).toBe(false);
   });

   it("rejects duration exceeding 24 hours (86,400s)", () => {
      const res = yptIngestSchema.safeParse({
         discordId: "123",
         date: "2026-10-15",
         durationSeconds: 86401,
      });
      expect(res.success).toBe(false);
   });

   it("rejects invalid date format", () => {
      const res = yptIngestSchema.safeParse({
         discordId: "123",
         date: "15-10-2026",
         durationSeconds: 3600,
      });
      expect(res.success).toBe(false);
   });
});

describe("yptManualImportSchema", () => {
   it("accepts valid array of records", () => {
      const res = yptManualImportSchema.safeParse({
         records: [
            { date: "2026-10-14", durationSeconds: 3600, subject: "Math" },
            { date: "2026-10-15", durationSeconds: 5400, subject: "Physics" },
         ],
      });
      expect(res.success).toBe(true);
   });

   it("rejects empty records array", () => {
      const res = yptManualImportSchema.safeParse({ records: [] });
      expect(res.success).toBe(false);
   });
});
