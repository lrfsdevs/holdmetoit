import { describe, expect, it } from "vitest";
import {
   assertValidBannerConfig,
   BannerConfig,
   isBannerActiveNow,
   TOTAL_BASIS_POINTS,
   validateBannerConfig,
} from "./banner-config";

describe("Banner Configuration Validation", () => {
   const validBaseConfig: BannerConfig = {
      name: "Kanto Starters Special",
      slug: "kanto-starters",
      description: "Featured summon for classic Kanto generation companions.",
      status: "ACTIVE",
      startAt: new Date(Date.now() - 3600000).toISOString(), // 1h ago
      endAt: new Date(Date.now() + 86400000).toISOString(), // 24h later
      pullCost: 500,
      allowedQuantities: [1],
      rarityRates: {
         NORMAL: 6000,
         UNCOMMON: 2500,
         RARE: 1000,
         EPIC: 400,
         LEGENDARY: 90,
         MYTHICAL: 10,
      },
      pityConfig: {
         hardPityThreshold: 50,
         targetRarity: "LEGENDARY",
         resetOnRarities: ["LEGENDARY", "MYTHICAL"],
         featuredGuarantee: true,
      },
   };

   it("accepts a perfectly valid banner configuration", () => {
      const res = validateBannerConfig(validBaseConfig);
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
      expect(() => assertValidBannerConfig(validBaseConfig)).not.toThrow();
   });

   it("rejects when probability total is not 10,000 basis points", () => {
      const invalidRates = {
         ...validBaseConfig,
         rarityRates: {
            NORMAL: 6000,
            UNCOMMON: 2500,
            RARE: 1000,
            EPIC: 400,
            LEGENDARY: 90, // sums to 9,990 (missing 10 bps)
         },
      };
      const res = validateBannerConfig(invalidRates);
      expect(res.valid).toBe(false);
      expect(
         res.errors.some((e) => e.includes("must sum to exactly 10000"))
      ).toBe(true);
   });

   it("rejects negative probability rates", () => {
      const invalidRates = {
         ...validBaseConfig,
         rarityRates: {
            NORMAL: 10100,
            UNCOMMON: -100,
         },
      };
      const res = validateBannerConfig(invalidRates);
      expect(res.valid).toBe(false);
      expect(
         res.errors.some((e) => e.includes("must be a non-negative integer"))
      ).toBe(true);
   });

   it("rejects invalid pull costs (zero or negative)", () => {
      const resZero = validateBannerConfig({ ...validBaseConfig, pullCost: 0 });
      expect(resZero.valid).toBe(false);

      const resNeg = validateBannerConfig({
         ...validBaseConfig,
         pullCost: -100,
      });
      expect(resNeg.valid).toBe(false);
   });

   it("rejects endAt timestamp earlier than startAt", () => {
      const now = Date.now();
      const res = validateBannerConfig({
         ...validBaseConfig,
         startAt: new Date(now + 10000).toISOString(),
         endAt: new Date(now).toISOString(),
      });
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes("strictly after startAt"))).toBe(
         true
      );
   });

   it("rejects invalid pity configuration", () => {
      const res = validateBannerConfig({
         ...validBaseConfig,
         pityConfig: {
            hardPityThreshold: 0,
            targetRarity: "INVALID_RARITY" as any,
            resetOnRarities: [],
         },
      });
      expect(res.valid).toBe(false);
      expect(
         res.errors.some((e) =>
            e.includes("Pity hard threshold must be a positive integer")
         )
      ).toBe(true);
      expect(
         res.errors.some((e) => e.includes("Pity targetRarity is invalid"))
      ).toBe(true);
      expect(
         res.errors.some((e) =>
            e.includes("resetOnRarities must be a non-empty array")
         )
      ).toBe(true);
   });

   it("evaluates isBannerActiveNow correctly across time windows", () => {
      const now = new Date("2026-10-16T12:00:00Z");

      // Active
      expect(
         isBannerActiveNow(
            {
               status: "ACTIVE",
               startAt: "2026-10-16T10:00:00Z",
               endAt: "2026-10-16T14:00:00Z",
            },
            now
         )
      ).toBe(true);

      // Not yet started
      expect(
         isBannerActiveNow(
            {
               status: "ACTIVE",
               startAt: "2026-10-16T13:00:00Z",
               endAt: "2026-10-16T14:00:00Z",
            },
            now
         )
      ).toBe(false);

      // Expired
      expect(
         isBannerActiveNow(
            {
               status: "ACTIVE",
               startAt: "2026-10-16T08:00:00Z",
               endAt: "2026-10-16T11:00:00Z",
            },
            now
         )
      ).toBe(false);

      // Inactive status even if within time window
      expect(
         isBannerActiveNow(
            {
               status: "PAUSED",
               startAt: "2026-10-16T10:00:00Z",
               endAt: "2026-10-16T14:00:00Z",
            },
            now
         )
      ).toBe(false);

      // Open-ended banner (no endAt)
      expect(
         isBannerActiveNow(
            {
               status: "ACTIVE",
               startAt: "2026-10-16T10:00:00Z",
               endAt: null,
            },
            now
         )
      ).toBe(true);
   });
});
