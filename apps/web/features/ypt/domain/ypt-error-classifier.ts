/**
 * Pure domain error classification and sanitization for Yeolpumta (YPT) integrations.
 * Adheres strictly to Law L7 (Pure Domain Isolation): zero external framework/ORM dependencies.
 */

export type YptErrorKind =
   | "INVALID_CREDENTIALS" // Code 112: Wrong password
   | "ACCOUNT_NOT_FOUND" // Code 113: Unknown email
   | "ACCOUNT_SUSPENDED" // Code 114: Suspended account
   | "SESSION_EXPIRED" // HTTP 401 or token expired
   | "RATE_LIMITED" // HTTP 429
   | "NETWORK_ERROR" // Network failure, DNS, timeout
   | "VALIDATION_ERROR" // Schema or input failure
   | "TEMPORARY_SERVICE_ERROR" // HTTP 5xx or server outage
   | "UNKNOWN_ERROR";

export interface ClassifiedYptError {
   kind: YptErrorKind;
   statusCode?: number;
   apiCode?: number | string;
   sanitizedMessage: string;
   safeLogContext: {
      operation: string;
      httpStatus?: number;
      apiCode?: number | string;
      errorKind: YptErrorKind;
      sanitizedMessage: string;
   };
}

/**
 * Classifies an error originating from YPT API or ypt-js into safe, human-readable
 * error responses without leaking internal exception traces, tokens, or credentials.
 */
export function classifyYptError(
   error: unknown,
   operation: string = "ypt.operation"
): ClassifiedYptError {
   let statusCode: number | undefined;
   let apiCode: number | string | undefined;
   let rawMessage = "";

   if (error && typeof error === "object") {
      const errObj = error as Record<string, unknown>;
      if ("status" in errObj && typeof errObj.status === "number") {
         statusCode = errObj.status;
      }
      if (
         "code" in errObj &&
         (typeof errObj.code === "number" || typeof errObj.code === "string")
      ) {
         apiCode = errObj.code;
      }
      if ("message" in errObj && typeof errObj.message === "string") {
         rawMessage = errObj.message;
      }
   } else if (typeof error === "string") {
      rawMessage = error;
   }

   // Extract API error code from message if not provided on object directly (e.g. "YPT API error (code 112)")
   if (apiCode === undefined && rawMessage) {
      const match = rawMessage.match(/code\s*(\d+)/i);
      if (match) {
         apiCode = parseInt(match[1], 10);
      }
   }

   const numCode = typeof apiCode === "number" ? apiCode : Number(apiCode);

   // 1. Specific YPT Error Codes
   if (numCode === 112) {
      const sanitizedMessage =
         "Unable to authenticate with Yeolpumta. Incorrect password. Please check your credentials and try again.";
      return {
         kind: "INVALID_CREDENTIALS",
         statusCode,
         apiCode: 112,
         sanitizedMessage,
         safeLogContext: {
            operation,
            httpStatus: statusCode,
            apiCode: 112,
            errorKind: "INVALID_CREDENTIALS",
            sanitizedMessage,
         },
      };
   }

   if (numCode === 113) {
      const sanitizedMessage =
         "Unable to authenticate with Yeolpumta. No account found with this email. Please check your email and try again.";
      return {
         kind: "ACCOUNT_NOT_FOUND",
         statusCode,
         apiCode: 113,
         sanitizedMessage,
         safeLogContext: {
            operation,
            httpStatus: statusCode,
            apiCode: 113,
            errorKind: "ACCOUNT_NOT_FOUND",
            sanitizedMessage,
         },
      };
   }

   if (numCode === 114) {
      const sanitizedMessage =
         "Your Yeolpumta account has been suspended. Please contact Yeolpumta support.";
      return {
         kind: "ACCOUNT_SUSPENDED",
         statusCode,
         apiCode: 114,
         sanitizedMessage,
         safeLogContext: {
            operation,
            httpStatus: statusCode,
            apiCode: 114,
            errorKind: "ACCOUNT_SUSPENDED",
            sanitizedMessage,
         },
      };
   }

   // 2. HTTP Status Code Classifications
   if (statusCode === 401 || /unauthorized|expired/i.test(rawMessage)) {
      const sanitizedMessage =
         "Your Yeolpumta session has expired or is unauthorized. Please reconnect your account.";
      return {
         kind: "SESSION_EXPIRED",
         statusCode: 401,
         apiCode,
         sanitizedMessage,
         safeLogContext: {
            operation,
            httpStatus: 401,
            apiCode,
            errorKind: "SESSION_EXPIRED",
            sanitizedMessage,
         },
      };
   }

   if (statusCode === 429 || /too many requests|rate limit/i.test(rawMessage)) {
      const sanitizedMessage =
         "Too many authentication attempts. Please wait before retrying.";
      return {
         kind: "RATE_LIMITED",
         statusCode: 429,
         apiCode,
         sanitizedMessage,
         safeLogContext: {
            operation,
            httpStatus: 429,
            apiCode,
            errorKind: "RATE_LIMITED",
            sanitizedMessage,
         },
      };
   }

   if (statusCode && statusCode >= 500) {
      const sanitizedMessage =
         "Yeolpumta is temporarily unavailable. Please try again later.";
      return {
         kind: "TEMPORARY_SERVICE_ERROR",
         statusCode,
         apiCode,
         sanitizedMessage,
         safeLogContext: {
            operation,
            httpStatus: statusCode,
            apiCode,
            errorKind: "TEMPORARY_SERVICE_ERROR",
            sanitizedMessage,
         },
      };
   }

   // 3. Network & Transport Failures
   if (
      /fetch failed|network|econnrefused|etimedout|enotfound|dns/i.test(
         rawMessage
      ) ||
      (error &&
         typeof error === "object" &&
         (error as Error).name === "YptNetworkError")
   ) {
      const sanitizedMessage =
         "Yeolpumta servers are temporarily unreachable. Please check your internet connection and try again.";
      return {
         kind: "NETWORK_ERROR",
         statusCode,
         apiCode,
         sanitizedMessage,
         safeLogContext: {
            operation,
            httpStatus: statusCode,
            apiCode,
            errorKind: "NETWORK_ERROR",
            sanitizedMessage,
         },
      };
   }

   // 4. Validation Failures
   if (
      /validation|invalid input|zod/i.test(rawMessage) ||
      (error &&
         typeof error === "object" &&
         (error as Error).name === "YptValidationError")
   ) {
      const sanitizedMessage =
         "Invalid credentials format. Please ensure your email and password are valid.";
      return {
         kind: "VALIDATION_ERROR",
         statusCode,
         apiCode,
         sanitizedMessage,
         safeLogContext: {
            operation,
            httpStatus: statusCode,
            apiCode,
            errorKind: "VALIDATION_ERROR",
            sanitizedMessage,
         },
      };
   }

   // 5. Default Fallback
   const sanitizedMessage =
      "Unable to authenticate with Yeolpumta. Check your credentials and try again.";
   return {
      kind: "UNKNOWN_ERROR",
      statusCode,
      apiCode,
      sanitizedMessage,
      safeLogContext: {
         operation,
         httpStatus: statusCode,
         apiCode,
         errorKind: "UNKNOWN_ERROR",
         sanitizedMessage,
      },
   };
}
