import { describe, expect, it, vi, beforeEach } from "vitest";
import {
   DomainError,
   isDomainError,
   resolveClientError,
   toClientError,
   WHITELISTED_DOMAIN_ERROR_NAMES,
} from "./to-client-error";
import * as loggerModule from "@/core/observability/logger";

vi.mock("@/core/observability/logger", async () => {
   const actual = await vi.importActual<
      typeof import("@/core/observability/logger")
   >("@/core/observability/logger");
   return {
      ...actual,
      createLogger: vi.fn(() => ({
         debug: vi.fn(),
         info: vi.fn(),
         warn: vi.fn(),
         error: vi.fn(),
      })),
   };
});

describe("to-client-error & domain error classifier", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   describe("isDomainError", () => {
      it("returns true for instances of DomainError", () => {
         const err = new DomainError("Sample domain failure", "SAMPLE_ERROR");
         expect(isDomainError(err)).toBe(true);
      });

      it("returns true for errors with isDomainError = true", () => {
         const customErr = {
            isDomainError: true,
            name: "CustomArbitraryError",
            message: "Actionable failure message",
         };
         expect(isDomainError(customErr)).toBe(true);
      });

      it("returns true for whitelisted domain error names", () => {
         WHITELISTED_DOMAIN_ERROR_NAMES.forEach((name) => {
            const err = new Error("Domain message");
            err.name = name;
            expect(isDomainError(err)).toBe(true);
         });
      });

      it("returns false for generic Error, Prisma, Supabase, Discord, GitHub, and Jira errors", () => {
         const rawErr = new Error("Table 'User' not found in database");
         expect(isDomainError(rawErr)).toBe(false);

         const prismaErr = new Error(
            "P2002: Unique constraint failed on the fields: (email)"
         );
         prismaErr.name = "PrismaClientKnownRequestError";
         expect(isDomainError(prismaErr)).toBe(false);

         const discordErr = new Error("DiscordAPIError[50001]: Missing Access");
         discordErr.name = "DiscordAPIError";
         expect(isDomainError(discordErr)).toBe(false);

         const jiraErr = new Error(
            "Failed to authenticate to https://jira.internal:8080/rest/api/3"
         );
         jiraErr.name = "JiraAPIError";
         expect(isDomainError(jiraErr)).toBe(false);

         expect(isDomainError(null)).toBe(false);
         expect(isDomainError(undefined)).toBe(false);
         expect(isDomainError("a string")).toBe(false);
      });
   });

   describe("resolveClientError", () => {
      it("preserves message and code for domain errors", () => {
         const domainErr = new DomainError(
            "Stake cannot exceed balance.",
            "INSUFFICIENT_FUNDS"
         );
         const result = resolveClientError(domainErr);

         expect(result.isDomainError).toBe(true);
         expect(result.code).toBe("INSUFFICIENT_FUNDS");
         expect(result.message).toBe("Stake cannot exceed balance.");
         expect(result.correlationId).toBeDefined();
         expect(typeof result.correlationId).toBe("string");
      });

      it("falls back to defaultCode when domain error has no code", () => {
         const authErr = new Error("You must be logged in.");
         authErr.name = "AuthError";

         const result = resolveClientError(authErr, {
            defaultCode: "UNAUTHENTICATED",
         });

         expect(result.isDomainError).toBe(true);
         expect(result.code).toBe("UNAUTHENTICATED");
         expect(result.message).toBe("You must be logged in.");
      });

      it("sanitizes untrusted Prisma and infrastructure errors", () => {
         const prismaErr = new Error(
            'FATAL: relation "wagers" does not exist at postgres://user:secret@internal-db:5432/hmt'
         );
         prismaErr.name = "PrismaClientKnownRequestError";

         const result = resolveClientError(prismaErr, {
            defaultCode: "WAGER_ERROR",
            defaultMessage: "An unexpected error occurred while placing wager.",
         });

         expect(result.isDomainError).toBe(false);
         expect(result.code).toBe("WAGER_ERROR");
         expect(result.message).toBe(
            "An unexpected error occurred while placing wager."
         );
         expect(result.message).not.toContain("postgres://");
         expect(result.message).not.toContain('relation "wagers"');
         expect(result.correlationId).toBeDefined();
      });

      it("respects custom correlationId when provided", () => {
         const err = new Error("Something went wrong");
         const result = resolveClientError(err, {
            correlationId: "custom-corr-1234",
         });

         expect(result.correlationId).toBe("custom-corr-1234");
      });
   });

   describe("toClientError", () => {
      it("resolves client error and emits logger.error with correlationId and context", () => {
         const rawErr = new Error("Database timeout after 5000ms");
         const result = toClientError(rawErr, {
            scope: "wager.actions",
            defaultCode: "WAGER_PERSIST_FAILED",
            defaultMessage: "Could not save wager.",
            context: { challengeId: "chal_1" },
         });

         expect(result.isDomainError).toBe(false);
         expect(result.code).toBe("WAGER_PERSIST_FAILED");
         expect(result.message).toBe("Could not save wager.");
         expect(result.correlationId).toBeDefined();
      });

      it("suppresses server logging when log: false is passed", () => {
         const domainErr = new DomainError(
            "Challenge locked.",
            "CHALLENGE_LOCKED"
         );
         const result = toClientError(domainErr, { log: false });

         expect(result.code).toBe("CHALLENGE_LOCKED");
         expect(result.message).toBe("Challenge locked.");
      });
   });
});
