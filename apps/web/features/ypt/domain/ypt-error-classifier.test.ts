import { describe, it, expect } from "vitest";
import { classifyYptError } from "./ypt-error-classifier";

describe("classifyYptError", () => {
   it("classifies error 112 as INVALID_CREDENTIALS with sanitized message", () => {
      const err = new Error("YPT API error (code 112)");
      const result = classifyYptError(err, "ypt.auth.signIn");

      expect(result.kind).toBe("INVALID_CREDENTIALS");
      expect(result.apiCode).toBe(112);
      expect(result.sanitizedMessage).toContain("Incorrect password");
      expect(result.sanitizedMessage).not.toContain("112");
      expect(result.safeLogContext.errorKind).toBe("INVALID_CREDENTIALS");
   });

   it("classifies object with code: 112 as INVALID_CREDENTIALS", () => {
      const err = { code: 112, status: 200, message: "YPT API error" };
      const result = classifyYptError(err, "ypt.auth.signIn");

      expect(result.kind).toBe("INVALID_CREDENTIALS");
      expect(result.apiCode).toBe(112);
      expect(result.sanitizedMessage).toContain("Incorrect password");
   });

   it("classifies error 113 as ACCOUNT_NOT_FOUND", () => {
      const err = new Error("YPT API error (code 113)");
      const result = classifyYptError(err, "ypt.auth.signIn");

      expect(result.kind).toBe("ACCOUNT_NOT_FOUND");
      expect(result.apiCode).toBe(113);
      expect(result.sanitizedMessage).toContain(
         "No account found with this email"
      );
   });

   it("classifies error 114 as ACCOUNT_SUSPENDED", () => {
      const err = new Error("YPT API error (code 114)");
      const result = classifyYptError(err, "ypt.auth.signIn");

      expect(result.kind).toBe("ACCOUNT_SUSPENDED");
      expect(result.apiCode).toBe(114);
      expect(result.sanitizedMessage).toContain("account has been suspended");
   });

   it("classifies HTTP 401 as SESSION_EXPIRED", () => {
      const err = { status: 401, message: "Unauthorized" };
      const result = classifyYptError(err, "ypt.session.restore");

      expect(result.kind).toBe("SESSION_EXPIRED");
      expect(result.statusCode).toBe(401);
      expect(result.sanitizedMessage).toContain("session has expired");
   });

   it("classifies HTTP 429 as RATE_LIMITED", () => {
      const err = { status: 429, message: "Too many requests" };
      const result = classifyYptError(err, "ypt.auth.signIn");

      expect(result.kind).toBe("RATE_LIMITED");
      expect(result.statusCode).toBe(429);
      expect(result.sanitizedMessage).toContain(
         "Too many authentication attempts"
      );
   });

   it("classifies network errors as NETWORK_ERROR", () => {
      const err = new Error("fetch failed: ECONNREFUSED");
      const result = classifyYptError(err, "ypt.auth.signIn");

      expect(result.kind).toBe("NETWORK_ERROR");
      expect(result.sanitizedMessage).toContain(
         "servers are temporarily unreachable"
      );
   });

   it("classifies validation errors as VALIDATION_ERROR", () => {
      const err = new Error("Zod validation error: Invalid email");
      const result = classifyYptError(err, "ypt.auth.signIn");

      expect(result.kind).toBe("VALIDATION_ERROR");
      expect(result.sanitizedMessage).toContain("Invalid credentials format");
   });

   it("falls back to UNKNOWN_ERROR with safe message for unexpected errors", () => {
      const err = new Error("Something strange happened inside YPT");
      const result = classifyYptError(err, "ypt.auth.signIn");

      expect(result.kind).toBe("UNKNOWN_ERROR");
      expect(result.sanitizedMessage).toContain(
         "Unable to authenticate with Yeolpumta"
      );
      expect(result.sanitizedMessage).not.toContain("strange");
   });
});
