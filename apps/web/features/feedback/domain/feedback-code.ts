/**
 * Formats a sequential feedback number into a human-readable identifier.
 * Example: 42 -> "FB-42"
 */
export function formatFeedbackCode(feedbackNumber: number): string {
   if (!Number.isInteger(feedbackNumber) || feedbackNumber <= 0) {
      return `FB-${Math.max(1, Math.floor(feedbackNumber || 1))}`;
   }
   return `FB-${feedbackNumber}`;
}
