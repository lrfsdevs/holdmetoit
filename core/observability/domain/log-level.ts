/**
 * Pure log-level model. No framework, React, Prisma or LogRocket imports (Law L7).
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

export const LOG_LEVELS: readonly LogLevel[] = [
   "debug",
   "info",
   "warn",
   "error",
];

export const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
   debug: 10,
   info: 20,
   warn: 30,
   error: 40,
};

export function isLogLevel(value: unknown): value is LogLevel {
   return (
      typeof value === "string" &&
      (LOG_LEVELS as readonly string[]).includes(value)
   );
}

/**
 * Normalizes an env-provided level string, falling back when absent or invalid.
 */
export function parseLogLevel(
   value: string | null | undefined,
   fallback: LogLevel
): LogLevel {
   if (typeof value !== "string") {
      return fallback;
   }

   const normalized = value.trim().toLowerCase();
   return isLogLevel(normalized) ? normalized : fallback;
}

/**
 * Returns true when a message at `level` meets or exceeds the `threshold`.
 * `error` always passes any valid threshold, so failures are never silenced.
 */
export function shouldEmit(level: LogLevel, threshold: LogLevel): boolean {
   return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[threshold];
}
