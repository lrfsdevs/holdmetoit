/**
 * In-memory sliding window rate limiter for security-sensitive operations.
 * Allows tracking attempts per key (e.g. user authentication or password checks).
 */

interface RateLimitRecord {
   timestamps: number[];
}

const store = new Map<string, RateLimitRecord>();

export interface RateLimitOptions {
   maxAttempts: number;
   windowMs: number;
}

export interface RateLimitResult {
   allowed: boolean;
   remaining: number;
   resetMs: number;
}

/**
 * Checks whether the given key has exceeded the allowed attempt threshold within the window.
 * If allowed, records the attempt timestamp.
 */
export function checkRateLimit(
   key: string,
   options: RateLimitOptions = { maxAttempts: 5, windowMs: 5 * 60 * 1000 }
): RateLimitResult {
   const now = Date.now();
   const record = store.get(key) || { timestamps: [] };

   // Prune expired timestamps
   record.timestamps = record.timestamps.filter(
      (ts) => now - ts < options.windowMs
   );

   if (record.timestamps.length >= options.maxAttempts) {
      const oldest = record.timestamps[0];
      const resetMs = Math.max(0, options.windowMs - (now - oldest));
      return {
         allowed: false,
         remaining: 0,
         resetMs,
      };
   }

   record.timestamps.push(now);
   store.set(key, record);

   const resetMs =
      record.timestamps.length > 0
         ? Math.max(0, options.windowMs - (now - record.timestamps[0]))
         : options.windowMs;

   return {
      allowed: true,
      remaining: options.maxAttempts - record.timestamps.length,
      resetMs,
   };
}

/**
 * Resets rate limit counts for a key (e.g. on successful authentication).
 */
export function resetRateLimit(key: string): void {
   store.delete(key);
}

/**
 * Clears the entire in-memory rate limit store (for testing).
 */
export function clearRateLimitStore(): void {
   store.clear();
}
