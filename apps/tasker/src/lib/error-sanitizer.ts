/**
 * Error classification and sanitization for Tasker Discord bot commands.
 * Masks raw database, Discord API, and Gemini errors while preserving friendly messages.
 */

export const SAFE_TASKER_ERROR_NAMES = new Set([
   "DuplicateCategoryError",
   "DefaultCategoryDeletionError",
]);

export const SAFE_ERROR_MESSAGES = new Set([
   "All Gemini API keys are currently rate limited. Please try again in a moment.",
   "All Gemini models are currently experiencing high demand. Please try again in a moment.",
   "Gemini summarization failed. Please try again later.",
   "Failed to parse the AI summary into the expected structured format.",
   "No eligible messages found to summarize.",
   "GEMINI_API_KEY is not configured in the environment.",
]);

export function sanitizeTaskerError(
   err: unknown,
   fallback = "An unexpected error occurred. Please try again later."
): string {
   if (!err || typeof err !== "object") {
      return fallback;
   }

   const error = err as Error;

   if (error.name && SAFE_TASKER_ERROR_NAMES.has(error.name)) {
      return error.message;
   }

   if (error.message && SAFE_ERROR_MESSAGES.has(error.message)) {
      return error.message;
   }

   return fallback;
}
