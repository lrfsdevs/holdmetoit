import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFeedbackSchema } from "./feedback.schema";

describe("createFeedbackSchema", () => {
   it("accepts valid bug report input", () => {
      const valid = {
         type: "bug",
         title: "Challenge submit failed",
         description:
            "Clicking submit does not trigger network request on Firefox",
         url: "/challenge/clxyz123",
         logrocketSessionId: "https://app.logrocket.com/org/app/sessions/123",
      };

      const parsed = createFeedbackSchema.safeParse(valid);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
         expect(parsed.data.type).toBe("bug");
         expect(parsed.data.title).toBe("Challenge submit failed");
      }
   });

   it("accepts valid enhancement suggestion without logrocketSessionId", () => {
      const valid = {
         type: "enhancement",
         title: "Add sound effects",
         description: "Would be awesome to hear a bell ring when logging hours",
         url: "/dashboard",
      };

      const parsed = createFeedbackSchema.safeParse(valid);
      expect(parsed.success).toBe(true);
   });

   it("rejects invalid type", () => {
      const invalid = {
         type: "praise",
         title: "Great app",
         description: "Everything is super cool",
         url: "/",
      };

      const parsed = createFeedbackSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
   });

   it("rejects short title or short description", () => {
      const shortTitle = {
         type: "bug",
         title: "No",
         description: "This description is long enough to pass",
         url: "/",
      };
      expect(createFeedbackSchema.safeParse(shortTitle).success).toBe(false);

      const shortDesc = {
         type: "bug",
         title: "Valid Title Here",
         description: "Too short",
         url: "/",
      };
      expect(createFeedbackSchema.safeParse(shortDesc).success).toBe(false);
   });

   it("trims whitespace from fields", () => {
      const untrimmed = {
         type: "bug",
         title: "   Trimmed Title   ",
         description: "   This description has leading and trailing spaces   ",
         url: "   /test   ",
      };

      const parsed = createFeedbackSchema.safeParse(untrimmed);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
         expect(parsed.data.title).toBe("Trimmed Title");
         expect(parsed.data.description).toBe(
            "This description has leading and trailing spaces"
         );
         expect(parsed.data.url).toBe("/test");
      }
   });

   it("defaults attachments to an empty array", () => {
      const parsed = createFeedbackSchema.safeParse({
         type: "bug",
         title: "Valid Title",
         description: "This description is long enough to pass",
         url: "/",
      });

      expect(parsed.success).toBe(true);
      if (parsed.success) {
         expect(parsed.data.attachments).toEqual([]);
      }
   });

   it("accepts up to three trimmed attachment paths", () => {
      const parsed = createFeedbackSchema.safeParse({
         type: "bug",
         title: "Valid Title",
         description: "This description is long enough to pass",
         url: "/",
         attachments: [
            "  feedback-attachments/one.png  ",
            "feedback-attachments/two.mp4",
            "feedback-attachments/three.webm",
         ],
      });

      expect(parsed.success).toBe(true);
      if (parsed.success) {
         expect(parsed.data.attachments[0]).toBe(
            "feedback-attachments/one.png"
         );
         expect(parsed.data.attachments).toHaveLength(3);
      }
   });

   it("rejects more than three attachments", () => {
      const parsed = createFeedbackSchema.safeParse({
         type: "bug",
         title: "Valid Title",
         description: "This description is long enough to pass",
         url: "/",
         attachments: [
            "feedback-attachments/one.png",
            "feedback-attachments/two.png",
            "feedback-attachments/three.png",
            "feedback-attachments/four.png",
         ],
      });

      expect(parsed.success).toBe(false);
   });
});

describe("createFeedbackSchema link validation", () => {
   // Pin the origin so the absolute-URL cases do not depend on the developer's
   // or CI's AUTH_URL.
   beforeEach(() => {
      vi.stubEnv("AUTH_URL", "https://holdmetoit.com");
   });

   afterEach(() => {
      vi.unstubAllEnvs();
   });

   const base = {
      type: "bug",
      title: "Submit failed",
      description: "Clicking submit does not do anything at all",
      url: "/dashboard",
   };

   it("accepts a LogRocket session URL", () => {
      const parsed = createFeedbackSchema.safeParse({
         ...base,
         logrocketSessionId: "https://app.logrocket.com/org/app/s/1-abc/0",
      });

      expect(parsed.success).toBe(true);
   });

   it.each([
      "https://evil.example/phish",
      "http://app.logrocket.com/org/app/s/1",
      "https://app.logrocket.com.evil.example/s/1",
      "https://user:pass@app.logrocket.com/s/1",
      "javascript:alert(1)",
      "just-a-session-id",
   ])("rejects non-LogRocket session value %j", (logrocketSessionId) => {
      const parsed = createFeedbackSchema.safeParse({
         ...base,
         logrocketSessionId,
      });

      expect(parsed.success).toBe(false);
   });

   it("still allows a null or missing session value", () => {
      expect(
         createFeedbackSchema.safeParse({ ...base, logrocketSessionId: null })
            .success
      ).toBe(true);
      expect(createFeedbackSchema.safeParse(base).success).toBe(true);
   });

   it("accepts an absolute URL on the app origin", () => {
      expect(
         createFeedbackSchema.safeParse({
            ...base,
            url: "https://holdmetoit.com/dashboard",
         }).success
      ).toBe(true);
   });

   it.each([
      "https://holdmetoit.com/x\nhttps://evil.example/phish",
      "https://holdmetoit.com/x\ty",
      "https://holdmetoit.com/<script>",
      "https://holdmetoit.com/~https://evil.example/phish",
   ])("rejects an absolute URL with hidden or unsafe characters %j", (url) => {
      expect(createFeedbackSchema.safeParse({ ...base, url }).success).toBe(
         false
      );
   });

   it.each([
      "https://evil.example/phish",
      "https://holdmetoit.com.evil.example/",
      "//evil.example/phish",
      "javascript:alert(1)",
      "/[Click here](https://evil.example)",
      "/~https://evil.example/phish",
      "dashboard",
   ])("rejects page URL outside the app %j", (url) => {
      expect(createFeedbackSchema.safeParse({ ...base, url }).success).toBe(
         false
      );
   });
});
