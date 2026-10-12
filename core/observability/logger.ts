import {
   buildLogEntry,
   formatLogEntry,
   type LogContext,
} from "./domain/log-entry";
import type { LogEventName } from "./domain/log-events";
import { parseLogLevel, shouldEmit, type LogLevel } from "./domain/log-level";
import { isLogRocketEnabled } from "./logrocket-config";

/**
 * Universal diagnostics logger.
 *
 * Server: emits one-line JSON to stdout (captured by the serverless runtime).
 * Client: emits to the console in development and forwards events/errors to
 * LogRocket. The LogRocket transport is imported dynamically so it never leaks
 * into the server bundle.
 *
 * Every entry point is fail-safe: logging must never throw or change control flow.
 */

export type LogOptions = {
   scope?: string;
   context?: LogContext;
   error?: unknown;
   tags?: Record<string, string>;
};

const SERVER_DEFAULT_LEVEL: LogLevel =
   process.env.NODE_ENV === "production" ? "info" : "debug";

const CLIENT_DEFAULT_LEVEL: LogLevel =
   process.env.NODE_ENV === "production" ? "warn" : "debug";

const IS_DEV = process.env.NODE_ENV !== "production";

function resolveThreshold(): LogLevel {
   if (typeof window === "undefined") {
      return parseLogLevel(process.env.LOG_LEVEL, SERVER_DEFAULT_LEVEL);
   }

   return parseLogLevel(
      process.env.NEXT_PUBLIC_LOG_LEVEL,
      CLIENT_DEFAULT_LEVEL
   );
}

function toLogRocketProps(
   context?: LogContext
): Record<string, string | number | boolean> | undefined {
   if (!context) {
      return undefined;
   }

   const props: Record<string, string | number | boolean> = {};
   for (const [key, value] of Object.entries(context)) {
      if (value !== undefined && value !== null) {
         props[key] = value;
      }
   }

   return Object.keys(props).length > 0 ? props : undefined;
}

function forwardToLogRocket(event: LogEventName, options: LogOptions): void {
   if (typeof window === "undefined" || !isLogRocketEnabled()) {
      return;
   }

   void import("./logrocket")
      .then(({ trackLogRocketEvent, captureLogRocketException }) => {
         if (options.error !== undefined) {
            captureLogRocketException(options.error, {
               tags: {
                  event,
                  ...(options.scope ? { scope: options.scope } : {}),
                  ...options.tags,
               },
               extra: toLogRocketProps(options.context),
            });
            return;
         }

         trackLogRocketEvent(event, toLogRocketProps(options.context));
      })
      .catch(() => {
         // Ignore transport failures — diagnostics must never break the app.
      });
}

export function logEvent(
   level: LogLevel,
   event: LogEventName,
   options: LogOptions = {}
): void {
   try {
      const threshold = resolveThreshold();
      if (!shouldEmit(level, threshold)) {
         return;
      }

      const entry = buildLogEntry({
         level,
         event,
         scope: options.scope,
         context: options.context,
         error: options.error,
      });

      const line = formatLogEntry(entry, { pretty: IS_DEV });

      if (level === "error") {
         console.error(line);
      } else if (level === "warn") {
         console.warn(line);
      } else if (level === "debug") {
         console.debug(line);
      } else {
         console.info(line);
      }

      forwardToLogRocket(event, options);
   } catch {
      // Never let logging break application flow.
   }
}

export function logDebug(event: LogEventName, options?: LogOptions): void {
   logEvent("debug", event, options);
}

export function logInfo(event: LogEventName, options?: LogOptions): void {
   logEvent("info", event, options);
}

export function logWarn(event: LogEventName, options?: LogOptions): void {
   logEvent("warn", event, options);
}

export function logError(event: LogEventName, options?: LogOptions): void {
   logEvent("error", event, options);
}

export type ScopedLogger = {
   debug: (event: LogEventName, options?: Omit<LogOptions, "scope">) => void;
   info: (event: LogEventName, options?: Omit<LogOptions, "scope">) => void;
   warn: (event: LogEventName, options?: Omit<LogOptions, "scope">) => void;
   error: (event: LogEventName, options?: Omit<LogOptions, "scope">) => void;
};

export function createLogger(scope: string): ScopedLogger {
   return {
      debug: (event, options) =>
         logEvent("debug", event, { ...options, scope }),
      info: (event, options) => logEvent("info", event, { ...options, scope }),
      warn: (event, options) => logEvent("warn", event, { ...options, scope }),
      error: (event, options) =>
         logEvent("error", event, { ...options, scope }),
   };
}

export { logEvents } from "./domain/log-events";
export type { LogEventName } from "./domain/log-events";
