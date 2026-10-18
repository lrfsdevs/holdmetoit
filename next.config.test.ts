import { describe, expect, it } from "vitest";
import nextConfig from "./next.config.mjs";

describe("next.config.mjs redirects", () => {
   it("returns expected canonical redirect rules", async () => {
      expect(nextConfig.redirects).toBeDefined();
      const redirects = await nextConfig.redirects!();

      expect(redirects).toEqual(
         expect.arrayContaining([
            {
               source: "/dashboard",
               destination: "/",
               permanent: true,
            },
            {
               source: "/challenge",
               destination: "/challenges",
               permanent: true,
            },
            {
               source: "/challenges/new",
               destination: "/admin/challenges/new",
               permanent: true,
            },
            {
               source: "/challenges/:id/:path*",
               destination: "/challenge/:id/:path*",
               permanent: true,
            },
            {
               source: "/challenges/:id",
               destination: "/challenge/:id",
               permanent: true,
            },
         ])
      );
   });
});
