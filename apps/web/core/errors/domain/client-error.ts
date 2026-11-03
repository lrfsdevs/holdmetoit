/**
 * Pure domain client error models, constants, and classifiers.
 * Adheres strictly to Law L7 (Pure Domain Isolation): zero external framework/ORM dependencies.
 */

export interface ClientError {
   readonly code: string;
   readonly message: string;
   readonly correlationId: string;
   readonly isDomainError: boolean;
}

export interface ClientErrorOptions {
   defaultCode?: string;
   defaultMessage?: string;
   correlationId?: string;
}

/**
 * Base class for all application domain errors.
 * Any error that inherits from DomainError or has `isDomainError: true`
 * is considered safe to display its message to clients.
 */
export class DomainError extends Error {
   readonly isDomainError = true;
   readonly code?: string;

   constructor(message: string, code?: string) {
      super(message);
      this.name = "DomainError";
      this.code = code;
      Object.setPrototypeOf(this, new.target.prototype);
   }
}

/**
 * Whitelisted error names originating from pure domain models or explicit
 * authorization checks that are designed to produce human-actionable messages.
 */
export const WHITELISTED_DOMAIN_ERROR_NAMES = new Set<string>([
   "DomainError",
   "AuthError",
   "AdminAccessError",
   "DevAccessError",
   "ParticipantAccessError",
   "ChallengeStateError",
   "DuoTeamIdentityError",
   "WagerValidationError",
   "BettingClosedError",
   "InvalidDurationError",
   "InvalidProgressError",
   "InsufficientFundsError",
   "InvalidReservationError",
   "WalletInvariantViolationError",
   "InvalidAmountError",
   "DeficitCalculationError",
   "DurationParseError",
   "DurationRangeError",
   "MaximumLeavesExceededError",
   "BannerNotFoundError",
   "BannerInactiveError",
   "InvalidBannerConfigError",
   "EmptyRarityPoolError",
   "SelectionEngineError",
   "InvalidYptClaimTransitionError",
   "WithdrawalError",
]);

/**
 * Fallback generator for correlation identifiers when crypto is unavailable.
 */
export function generateCorrelationId(): string {
   if (
      typeof globalThis !== "undefined" &&
      globalThis.crypto &&
      typeof globalThis.crypto.randomUUID === "function"
   ) {
      return globalThis.crypto.randomUUID();
   }
   return (
      "corr_" +
      Math.random().toString(36).slice(2, 11) +
      Date.now().toString(36)
   );
}

/**
 * Checks whether an error is a whitelisted domain error whose message is safe
 * to expose to end users and API clients.
 */
export function isDomainError(error: unknown): boolean {
   if (!error || typeof error !== "object") {
      return false;
   }
   const err = error as Record<string, unknown>;
   if (err.isDomainError === true) {
      return true;
   }
   if (
      typeof err.name === "string" &&
      WHITELISTED_DOMAIN_ERROR_NAMES.has(err.name)
   ) {
      return true;
   }
   if (
      typeof err.code === "string" &&
      (err.code === "FORBIDDEN_NOT_DEV" ||
         err.code === "FORBIDDEN_NOT_ADMIN" ||
         err.code === "UNAUTHORIZED" ||
         err.code === "NOT_ENROLLED")
   ) {
      return true;
   }
   return false;
}

/**
 * Resolves a safe ClientError from any thrown exception without leaking
 * Prisma, Supabase, Discord, GitHub, or Jira database/API internals.
 */
export function resolveClientError(
   error: unknown,
   options?: ClientErrorOptions
): ClientError {
   const correlationId = options?.correlationId ?? generateCorrelationId();

   if (isDomainError(error)) {
      const err = error as Record<string, unknown>;
      const code =
         typeof err.code === "string" && err.code.trim().length > 0
            ? err.code
            : (options?.defaultCode ?? "DOMAIN_ERROR");
      const message =
         typeof err.message === "string" && err.message.trim().length > 0
            ? err.message
            : (options?.defaultMessage ?? "Action could not be completed.");

      return {
         code,
         message,
         correlationId,
         isDomainError: true,
      };
   }

   return {
      code: options?.defaultCode ?? "INTERNAL_SERVER_ERROR",
      message:
         options?.defaultMessage ??
         "An unexpected error occurred. Please try again later.",
      correlationId,
      isDomainError: false,
   };
}
