import { describe, expect, it } from "vitest";
import {
   SAFE_ERROR_MESSAGES,
   sanitizeTaskerError,
} from "../src/lib/error-sanitizer.js";
import {
   DefaultCategoryDeletionError,
   DuplicateCategoryError,
} from "../src/models/category.js";

describe("sanitizeTaskerError", () => {
   it("preserves Tasker domain error messages", () => {
      const dup = new DuplicateCategoryError("Studies");
      expect(sanitizeTaskerError(dup)).toBe(
         'Category "Studies" already exists.'
      );

      const del = new DefaultCategoryDeletionError();
      expect(sanitizeTaskerError(del)).toBe(
         "The Default category cannot be deleted."
      );
   });

   it("preserves known safe fallback messages from summarizer", () => {
      for (const msg of SAFE_ERROR_MESSAGES) {
         const err = new Error(msg);
         expect(sanitizeTaskerError(err)).toBe(msg);
      }
   });

   it("masks raw Discord, database, or Gemini API errors with fallback", () => {
      const rawApiErr = new Error(
         "GoogleGenAIError: 403 API_KEY_INVALID at https://generativelanguage.googleapis.com/v1beta/models"
      );
      expect(sanitizeTaskerError(rawApiErr)).toBe(
         "An unexpected error occurred. Please try again later."
      );

      const dbErr = new Error("FATAL: database connection failed on port 5432");
      expect(sanitizeTaskerError(dbErr, "Failed to perform operation.")).toBe(
         "Failed to perform operation."
      );

      expect(sanitizeTaskerError(null)).toBe(
         "An unexpected error occurred. Please try again later."
      );
   });
});
