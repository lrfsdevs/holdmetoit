import { formatSecondsToClock } from "@/features/study-logs/domain/duration";

export function formatDurationMs(ms: number | null): string {
   if (ms === null || !Number.isFinite(ms)) return "—";
   if (ms < 1000) return `${Math.max(0, Math.round(ms))}ms`;

   const totalSeconds = Math.floor(ms / 1000);
   if (totalSeconds < 60) return `${totalSeconds}s`;

   const minutes = Math.floor(totalSeconds / 60);
   const seconds = totalSeconds % 60;
   if (minutes < 60) return `${minutes}m ${seconds}s`;

   return formatSecondsToClock(totalSeconds);
}

export function formatRelativeTime(iso: string | null): string {
   if (!iso) return "—";

   const diff = Date.now() - new Date(iso).getTime();
   if (!Number.isFinite(diff)) return "—";

   const seconds = Math.max(0, Math.floor(diff / 1000));
   if (seconds < 60) return "just now";

   const minutes = Math.floor(seconds / 60);
   if (minutes < 60) return `${minutes}m ago`;

   const hours = Math.floor(minutes / 60);
   if (hours < 24) return `${hours}h ago`;

   return `${Math.floor(hours / 24)}d ago`;
}

export function formatAbsoluteTime(iso: string | null): string {
   if (!iso) return "—";

   return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
   });
}

export function formatSeconds(value: number | null): string {
   if (value === null || !Number.isFinite(value)) return "—";
   return formatSecondsToClock(Math.max(0, Math.floor(value)));
}

export function shortId(id: string, length = 8): string {
   return id.length <= length ? id : `${id.slice(0, length)}…`;
}

export function summaryFilename(summary: unknown): string | null {
   if (!summary || typeof summary !== "object") return null;
   const value = (summary as { filename?: unknown }).filename;
   return typeof value === "string" ? value : null;
}

export function summarySize(summary: unknown): number | null {
   if (!summary || typeof summary !== "object") return null;
   const value = (summary as { sizeBytes?: unknown }).sizeBytes;
   return typeof value === "number" ? value : null;
}

export function formatBytes(value: number | null): string {
   if (value === null || !Number.isFinite(value)) return "—";
   if (value < 1024) return `${value} B`;
   if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
   return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
