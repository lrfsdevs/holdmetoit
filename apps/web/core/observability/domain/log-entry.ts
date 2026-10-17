import type { LogEventName } from "./log-events";
import type { LogLevel } from "./log-level";

/**
 * Pure log-entry model. No framework, React, Prisma or LogRocket imports (Law L7).
 */

export type LogContextValue = string | number | boolean | null | undefined;
export type LogContext = Record<string, LogContextValue>;

export type SerializedLogError = {
   name: string;
   message: string;
   stack?: string;
   code?: string | number;
};

export type LogEntry = {
   ts: string;
   level: LogLevel;
   event: LogEventName;
   scope?: string;
   ctx?: LogContext;
   error?: SerializedLogError;
};

function stringifyUnknown(value: unknown): string {
   if (typeof value === "string") {
      return value;
   }

   if (value === null || value === undefined) {
      return String(value);
   }

   try {
      return JSON.stringify(value);
   } catch {
      return String(value);
   }
}

/**
 * Normalizes any thrown value into a serializable error shape, mirroring the
 * behaviour of the existing LogRocket exception capture.
 */
export function serializeError(error: unknown): SerializedLogError {
   if (error instanceof Error) {
      const serialized: SerializedLogError = {
         name: error.name,
         message: error.message,
      };

      if (error.stack) {
         serialized.stack = error.stack;
      }

      const code = (error as { code?: unknown }).code;
      if (typeof code === "string" || typeof code === "number") {
         serialized.code = code;
      }

      return serialized;
   }

   return { name: "NonError", message: stringifyUnknown(error) };
}

export type BuildLogEntryInput = {
   level: LogLevel;
   event: LogEventName;
   scope?: string;
   context?: LogContext;
   error?: unknown;
   timestamp?: Date | string;
};

function resolveTimestamp(timestamp?: Date | string): string {
   if (!timestamp) {
      return new Date().toISOString();
   }

   return typeof timestamp === "string" ? timestamp : timestamp.toISOString();
}

export function buildLogEntry(input: BuildLogEntryInput): LogEntry {
   const entry: LogEntry = {
      ts: resolveTimestamp(input.timestamp),
      level: input.level,
      event: input.event,
   };

   if (input.scope) {
      entry.scope = input.scope;
   }

   if (input.context && Object.keys(input.context).length > 0) {
      entry.ctx = input.context;
   }

   if (input.error !== undefined) {
      entry.error = serializeError(input.error);
   }

   return entry;
}

function formatContext(context?: LogContext): string {
   if (!context) {
      return "";
   }

   return Object.entries(context)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}=${String(value)}`)
      .join(" ");
}

/**
 * Renders an entry as a single-line JSON record (production) or a readable
 * key=value line (development).
 */
export function formatLogEntry(
   entry: LogEntry,
   options?: { pretty?: boolean }
): string {
   if (!options?.pretty) {
      return JSON.stringify(entry);
   }

   const parts = [`[${entry.level}]`, entry.event];

   if (entry.scope) {
      parts.push(`(${entry.scope})`);
   }

   const context = formatContext(entry.ctx);
   if (context) {
      parts.push(context);
   }

   if (entry.error) {
      parts.push(`error=${entry.error.name}: ${entry.error.message}`);
   }

   return parts.join(" ");
}
