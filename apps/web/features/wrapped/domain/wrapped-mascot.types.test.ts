import { describe, expect, it } from "vitest";
import {
   DEFAULT_WRAPPED_MASCOT,
   isWrappedMascotVariant,
   normalizeWrappedMascot,
   WRAPPED_MASCOT_OPTIONS,
   type WrappedMascotVariant,
} from "./wrapped-mascot.types";

describe("wrapped-mascot.types (Pure Domain)", () => {
   it("provides DEFAULT_WRAPPED_MASCOT as GOOGLY_EYES", () => {
      expect(DEFAULT_WRAPPED_MASCOT).toBe("GOOGLY_EYES");
   });

   it("defines all 4 required mascot options with descriptive metadata", () => {
      expect(WRAPPED_MASCOT_OPTIONS).toHaveLength(4);

      const ids = WRAPPED_MASCOT_OPTIONS.map((opt) => opt.id);
      expect(ids).toEqual(["GOOGLY_EYES", "CAT", "DOG", "BUNNY"]);

      for (const opt of WRAPPED_MASCOT_OPTIONS) {
         expect(opt.label).toBeTruthy();
         expect(opt.description).toBeTruthy();
         expect(typeof opt.label).toBe("string");
         expect(typeof opt.description).toBe("string");
      }
   });

   it("validates valid mascot variants correctly", () => {
      expect(isWrappedMascotVariant("GOOGLY_EYES")).toBe(true);
      expect(isWrappedMascotVariant("CAT")).toBe(true);
      expect(isWrappedMascotVariant("DOG")).toBe(true);
      expect(isWrappedMascotVariant("BUNNY")).toBe(true);

      expect(isWrappedMascotVariant("DRAGON")).toBe(false);
      expect(isWrappedMascotVariant("")).toBe(false);
      expect(isWrappedMascotVariant(null)).toBe(false);
      expect(isWrappedMascotVariant(undefined)).toBe(false);
      expect(isWrappedMascotVariant(123)).toBe(false);
   });

   it("normalizes unknown or invalid values to fallback or default", () => {
      expect(normalizeWrappedMascot("CAT")).toBe("CAT");
      expect(normalizeWrappedMascot("DOG")).toBe("DOG");
      expect(normalizeWrappedMascot("BUNNY")).toBe("BUNNY");
      expect(normalizeWrappedMascot("GOOGLY_EYES")).toBe("GOOGLY_EYES");

      expect(normalizeWrappedMascot("INVALID")).toBe("GOOGLY_EYES");
      expect(normalizeWrappedMascot(undefined)).toBe("GOOGLY_EYES");
      expect(normalizeWrappedMascot(null, "CAT")).toBe("CAT");
   });
});
