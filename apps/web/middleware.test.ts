import { describe, expect, it, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { middleware, config } from "./middleware";

describe("Edge Middleware", () => {
   const originalEnv = process.env;

   beforeEach(() => {
      process.env = { ...originalEnv };
   });

   function createRequest(
      pathname: string,
      cookies: Record<string, string> = {}
   ): NextRequest {
      const url = `https://holdmetoit.com${pathname}`;
      const request = new NextRequest(url);
      for (const [key, value] of Object.entries(cookies)) {
         request.cookies.set(key, value);
      }
      return request;
   }

   it("has matcher configured for /admin, /devboard, and /profile", () => {
      expect(config.matcher).toEqual([
         "/admin/:path*",
         "/devboard/:path*",
         "/profile",
      ]);
   });

   it("redirects unauthenticated requests to /admin to / in production", () => {
      (process.env as Record<string, string | undefined>).NODE_ENV =
         "production";
      process.env.AUTH_DISCORD_ID = "discord_123";

      const request = createRequest("/admin");
      const response = middleware(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("https://holdmetoit.com/");
   });

   it("redirects unauthenticated requests to /devboard to / in production", () => {
      (process.env as Record<string, string | undefined>).NODE_ENV =
         "production";
      process.env.AUTH_DISCORD_ID = "discord_123";

      const request = createRequest("/devboard");
      const response = middleware(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("https://holdmetoit.com/");
   });

   it("allows /admin/challenges/new through when authjs.session-token is present", () => {
      (process.env as Record<string, string | undefined>).NODE_ENV =
         "production";
      process.env.AUTH_DISCORD_ID = "discord_123";

      const request = createRequest("/admin/challenges/new", {
         "authjs.session-token": "valid_token_xyz",
      });
      const response = middleware(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
   });

   it("allows /devboard through when __Secure-authjs.session-token is present", () => {
      (process.env as Record<string, string | undefined>).NODE_ENV =
         "production";
      process.env.AUTH_DISCORD_ID = "discord_123";

      const request = createRequest("/devboard", {
         "__Secure-authjs.session-token": "secure_token_123",
      });
      const response = middleware(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
   });

   it("allows access in development when dev bypass is active without cookies", () => {
      (process.env as Record<string, string | undefined>).NODE_ENV =
         "development";
      delete process.env.AUTH_DISCORD_ID;

      const request = createRequest("/admin/challenges/new");
      const response = middleware(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
   });

   it("redirects unauthenticated requests to /profile to /", () => {
      const request = createRequest("/profile");
      const response = middleware(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("https://holdmetoit.com/");
   });

   it("allows /profile through when authjs.session-token is present", () => {
      const request = createRequest("/profile", {
         "authjs.session-token": "valid_user_session",
      });
      const response = middleware(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
   });
});
