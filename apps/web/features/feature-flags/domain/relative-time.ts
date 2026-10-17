/**
 * Formats a Date or ISO string into a concise human-readable relative time string
 * (e.g., "just now", "5m ago", "2h ago", "1d ago", "3d ago", or localized date).
 */
export function formatRelativeTime(
   dateInput: Date | string | number,
   nowInput: Date | string | number = new Date()
): string {
   const date = new Date(dateInput);
   const now = new Date(nowInput);

   const diffMs = now.getTime() - date.getTime();
   if (isNaN(diffMs) || diffMs < 0) return "just now";

   const diffSeconds = Math.floor(diffMs / 1000);
   if (diffSeconds < 60) return "just now";

   const diffMinutes = Math.floor(diffSeconds / 60);
   if (diffMinutes < 60) return `${diffMinutes}m ago`;

   const diffHours = Math.floor(diffMinutes / 60);
   if (diffHours < 24) return `${diffHours}h ago`;

   const diffDays = Math.floor(diffHours / 24);
   if (diffDays < 7) return `${diffDays}d ago`;

   return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
   });
}
