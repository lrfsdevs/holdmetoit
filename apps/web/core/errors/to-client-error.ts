import {
   createLogger,
   logEvents,
   type LogEventName,
} from "@/core/observability/logger";
import {
   resolveClientError,
   type ClientError,
   type ClientErrorOptions,
} from "./domain/client-error";

export * from "./domain/client-error";

const defaultLogger = createLogger("client-error");

export interface ToClientErrorOptions extends ClientErrorOptions {
   scope?: string;
   event?: LogEventName;
   context?: Record<string, unknown>;
   log?: boolean;
}

/**
 * Converts any caught error into a safe client error, masking internal Prisma,
 * Supabase, Discord, GitHub, or Jira exceptions while logging the raw error
 * server-side with a correlation ID.
 */
export function toClientError(
   error: unknown,
   options?: ToClientErrorOptions
): ClientError {
   const clientError = resolveClientError(error, options);

   if (options?.log !== false) {
      const event = options?.event ?? logEvents.appError;
      const logger = options?.scope
         ? createLogger(options.scope)
         : defaultLogger;
      logger.error(event, {
         context: {
            correlationId: clientError.correlationId,
            code: clientError.code,
            isDomainError: clientError.isDomainError,
            ...(options?.context as Record<
               string,
               string | number | boolean | null | undefined
            >),
         },
         error,
      });
   }

   return clientError;
}
