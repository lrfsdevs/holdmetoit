import { describe, expect, it } from "vitest";
import {
   parseHexColor,
   rgbToHsl,
   hslToHex,
   getReadableTextColor,
   getTeamColorPalette,
   getTeamBadgeStyle,
   getTeamCardStyle,
   normalizeHex,
   DEFAULT_OBSIDIAN_TEAM_COLORS,
   clearTeamColorCache,
   getTeamColorCacheSize,
} from "./team-colors";

describe("features/challenges/domain/team-colors", () => {
   describe("parseHexColor", () => {
      it("parses valid 6-character hex strings", () => {
         expect(parseHexColor("#d9822b")).toEqual({ r: 217, g: 130, b: 43 });
         expect(parseHexColor("9986b8")).toEqual({ r: 153, g: 134, b: 184 });
      });

      it("parses valid 3-character hex shorthand", () => {
         expect(parseHexColor("#f0a")).toEqual({ r: 255, g: 0, b: 170 });
      });

      it("parses 8-character hex strings by ignoring alpha channel for base rgb", () => {
         expect(parseHexColor("#d9822b80")).toEqual({ r: 217, g: 130, b: 43 });
      });

      it("returns null for invalid strings or null/undefined", () => {
         expect(parseHexColor(null)).toBeNull();
         expect(parseHexColor(undefined)).toBeNull();
         expect(parseHexColor("")).toBeNull();
         expect(parseHexColor("invalid-color")).toBeNull();
         expect(parseHexColor("#12345")).toBeNull();
      });

      it("rejects hex strings with trailing non-hex characters (prevent parseInt corruption)", () => {
         expect(parseHexColor("#d9822z")).toBeNull();
         expect(parseHexColor("#12345!")).toBeNull();
         expect(parseHexColor("#12345q")).toBeNull();
         expect(parseHexColor("12g")).toBeNull();
      });

      it("supports 4-character CSS hex shorthand with alpha (#rgba)", () => {
         expect(parseHexColor("#f0a8")).toEqual({ r: 255, g: 0, b: 170 });
      });
   });

   describe("rgbToHsl and hslToHex conversions", () => {
      it("correctly converts pure colors back and forth", () => {
         const red = rgbToHsl(255, 0, 0);
         expect(red.h).toBe(0);
         expect(red.s).toBe(1);
         expect(red.l).toBe(0.5);
         expect(hslToHex(red.h, red.s, red.l)).toBe("#ff0000");

         const green = rgbToHsl(0, 255, 0);
         expect(green.h).toBe(120);
         expect(hslToHex(green.h, green.s, green.l)).toBe("#00ff00");
      });
   });

   describe("getReadableTextColor", () => {
      it("preserves hue and boosts lightness for dark colors", () => {
         // Very dark blue #001155 (L ~ 17%)
         const readable = getReadableTextColor(0, 17, 85);
         const parsed = parseHexColor(readable)!;
         const hsl = rgbToHsl(parsed.r, parsed.g, parsed.b);

         // Lightness is boosted to at least 75%
         expect(hsl.l).toBeGreaterThanOrEqual(0.75);
         // Hue is preserved around 228deg
         expect(Math.abs(hsl.h - 228)).toBeLessThanOrEqual(5);
      });

      it("ensures Honey Bees (#d9822b) text is bright and readable", () => {
         const { r, g, b } = parseHexColor("#d9822b")!;
         const text = getReadableTextColor(r, g, b);
         const parsedText = parseHexColor(text)!;
         const hsl = rgbToHsl(parsedText.r, parsedText.g, parsedText.b);

         expect(hsl.l).toBeGreaterThanOrEqual(0.75);
         // Hue stays in warm amber (~30-32deg)
         expect(hsl.h).toBeGreaterThanOrEqual(28);
         expect(hsl.h).toBeLessThanOrEqual(35);
      });

      it("ensures Lavender Butterflies (#9986b8) text is bright and readable", () => {
         const { r, g, b } = parseHexColor("#9986b8")!;
         const text = getReadableTextColor(r, g, b);
         const parsedText = parseHexColor(text)!;
         const hsl = rgbToHsl(parsedText.r, parsedText.g, parsedText.b);

         expect(hsl.l).toBeGreaterThanOrEqual(0.75);
         // Hue stays in lavender purple (~260-265deg)
         expect(hsl.h).toBeGreaterThanOrEqual(260);
         expect(hsl.h).toBeLessThanOrEqual(266);
      });
   });

   describe("normalizeHex and sanitizeFallbackIndex", () => {
      it("normalizes clean hex input", () => {
         expect(normalizeHex("#D9822B")).toBe("#d9822b");
         expect(normalizeHex("9986b8")).toBe("#9986b8");
      });

      it("falls back to deterministic defaults when null or invalid", () => {
         expect(normalizeHex(null, 0)).toBe(DEFAULT_OBSIDIAN_TEAM_COLORS[0]);
         expect(normalizeHex(undefined, 1)).toBe(
            DEFAULT_OBSIDIAN_TEAM_COLORS[1]
         );
         expect(normalizeHex("not-hex", 2)).toBe(
            DEFAULT_OBSIDIAN_TEAM_COLORS[2]
         );
      });

      it("safely handles floating-point, NaN, and negative fallback indices without crashing", () => {
         expect(normalizeHex(null, 1.8)).toBe(DEFAULT_OBSIDIAN_TEAM_COLORS[1]);
         expect(normalizeHex(null, -2.5)).toBe(DEFAULT_OBSIDIAN_TEAM_COLORS[2]);
         expect(normalizeHex(null, NaN as unknown as number)).toBe(
            DEFAULT_OBSIDIAN_TEAM_COLORS[0]
         );
         expect(normalizeHex(null, Infinity as unknown as number)).toBe(
            DEFAULT_OBSIDIAN_TEAM_COLORS[0]
         );
      });
   });

   describe("getTeamColorPalette", () => {
      it("generates all 10 color variants for Honey Bees (#d9822b)", () => {
         const palette = getTeamColorPalette("#d9822b");

         expect(palette.solid).toBe("#d9822b");
         expect(palette.surface).toBe("rgba(217, 130, 43, 0.14)");
         expect(palette.surfaceHover).toBe("rgba(217, 130, 43, 0.22)");
         expect(palette.border).toBe("rgba(217, 130, 43, 0.45)");
         expect(palette.borderMuted).toBe("rgba(217, 130, 43, 0.20)");
         expect(palette.badgeBg).toBe("rgba(217, 130, 43, 0.18)");
         expect(palette.badgeBorder).toBe("rgba(217, 130, 43, 0.35)");
         expect(palette.rowTint).toBe("rgba(217, 130, 43, 0.08)");
         expect(palette.rowTintHover).toBe("rgba(217, 130, 43, 0.16)");
         expect(palette.glow).toBe("0 0 16px rgba(217, 130, 43, 0.20)");

         // Text color is high contrast
         const textRgb = parseHexColor(palette.text)!;
         const textHsl = rgbToHsl(textRgb.r, textRgb.g, textRgb.b);
         expect(textHsl.l).toBeGreaterThanOrEqual(0.75);
      });

      it("falls back gracefully when input color is null", () => {
         const palette = getTeamColorPalette(null, 1);
         const expectedFallbackHex = DEFAULT_OBSIDIAN_TEAM_COLORS[1]; // Lavender #9986b8
         expect(palette.solid).toBe(expectedFallbackHex);
         expect(palette.surface).toContain("rgba(153, 134, 184,");
      });

      it("protects dark mode visibility for pitch black (#000000) inputs", () => {
         const palette = getTeamColorPalette("#000000");
         expect(palette.solid).toBe("#000000");
         // Borders and surfaces are given an ambient charcoal tint so they remain visible on #0d0d0d
         expect(palette.border).toBe("rgba(70, 70, 70, 0.45)");
         expect(palette.borderMuted).toBe("rgba(70, 70, 70, 0.20)");
         expect(palette.surface).toBe("rgba(35, 35, 35, 0.40)");
         expect(palette.badgeBg).toBe("rgba(40, 40, 40, 0.50)");
         // Text remains bright
         expect(palette.text).toBeDefined();
      });
   });

   describe("In-Memory 5-Minute TTL Palette Cache", () => {
      it("returns identical memoized palette references on consecutive calls", () => {
         const first = getTeamColorPalette("#22c55e", 2);
         const second = getTeamColorPalette("#22c55e", 2);
         expect(first).toBe(second); // Same object reference from cache
      });

      it("clears cache via clearTeamColorCache()", () => {
         getTeamColorPalette("#ec4899", 4);
         expect(getTeamColorCacheSize()).toBeGreaterThan(0);

         clearTeamColorCache();
         expect(getTeamColorCacheSize()).toBe(0);
      });
   });

   describe("Style Helpers", () => {
      it("generates valid badge style", () => {
         const style = getTeamBadgeStyle("#d9822b");
         expect(style.backgroundColor).toBe("rgba(217, 130, 43, 0.18)");
         expect(style.borderColor).toBe("rgba(217, 130, 43, 0.35)");
         expect(style.color).toBeDefined();
      });

      it("generates valid card style", () => {
         const style = getTeamCardStyle("#9986b8");
         expect(style.backgroundColor).toBe("rgba(153, 134, 184, 0.14)");
         expect(style.borderColor).toBe("rgba(153, 134, 184, 0.45)");
      });
   });
});
