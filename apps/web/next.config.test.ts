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
            {
               source: "/pokedex",
               destination: "/pokemon",
               permanent: true,
            },
            {
               source: "/pokedex/:path*",
               destination: "/pokemon/:path*",
               permanent: true,
            },
            {
               source: "/leaderboards",
               destination: "/leaderboard",
               permanent: true,
            },
            {
               source: "/wallets",
               destination: "/wallet",
               permanent: true,
            },
            {
               source: "/pokemons",
               destination: "/pokemon",
               permanent: true,
            },
            {
               source: "/changelogs",
               destination: "/changelog",
               permanent: true,
            },
         ])
      );
   });
});
