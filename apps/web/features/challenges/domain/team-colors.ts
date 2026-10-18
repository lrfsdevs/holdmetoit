/**
 * Pure Domain Color Engine for Challenge Teams (Law L7: Pure Domain Isolation)
 *
 * Takes 1 single base hex color input from the admin, locks the Hue (H) & Saturation (S),
 * and mathematically derives all required lightness and opacity variants for the Obsidian Dark UI.
 *
 * Zero external ORM/UI dependencies.
 */

export interface TeamColorPalette {
   /** The 100% full-intensity base color for progress bar fills, split-share meters, and swatches. */
   solid: string;
   /** High-contrast text color (Lightness boosted to >= 75%) guaranteed to pass WCAG on #0d0d0d / #141414. */
   text: string;
   /** Translucent dark background tint (14% alpha) for head-to-head match cards. */
   surface: string;
   /** Elevated translucent background tint (22% alpha) for hover states. */
   surfaceHover: string;
   /** Crisp 1px perimeter border (45% alpha) for match cards and active rings. */
   border: string;
   /** Subtle boundary border (20% alpha) for inactive cards or dividers. */
   borderMuted: string;
   /** House pill badge background (18% alpha). */
   badgeBg: string;
   /** House pill badge border (35% alpha). */
   badgeBorder: string;
   /** Leaderboard table row background tint (8% alpha). */
   rowTint: string;
   /** Leaderboard table row hover tint (16% alpha). */
   rowTintHover: string;
   /** Subtle ambient halo shadow (20% alpha). */
   glow: string;
}

export interface RgbColor {
   r: number;
   g: number;
   b: number;
}

export interface HslColor {
   h: number;
   s: number;
   l: number;
}

/** Ratified Obsidian Dark default fallback palettes if color is null, empty, or invalid. */
export const DEFAULT_OBSIDIAN_TEAM_COLORS: readonly string[] = [
   "#d9822b", // Honey Amber (Honey Bees)
   "#9986b8", // Lavender Purple (Lavender Butterflies)
   "#22c55e", // Emerald Serpents
   "#3b82f6", // Azure Raven
   "#ec4899", // Blossom Pink
   "#06b6d4", // Glacier Cyan
   "#f59e0b", // Solar Orange
   "#8b5cf6", // Dusk Violet
];

/** Strict hex format pattern matching 3, 4, 6, or 8 hexadecimal digits (with optional leading #). */
const HEX_COLOR_REGEX =
   /^(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/**
 * Parses any 3-, 4-, 6-, or 8-character hex color string into numeric RGB values.
 * Returns null if the input is not a strictly valid hex string.
 */
export function parseHexColor(
   input: string | null | undefined
): RgbColor | null {
   if (!input || typeof input !== "string") {
      return null;
   }

   const clean = input.trim().replace(/^#/, "");
   if (!HEX_COLOR_REGEX.test(clean)) {
      return null;
   }

   if (clean.length === 3 || clean.length === 4) {
      const r = parseInt(clean[0] + clean[0], 16);
      const g = parseInt(clean[1] + clean[1], 16);
      const b = parseInt(clean[2] + clean[2], 16);
      return { r, g, b };
   }

   if (clean.length === 6 || clean.length === 8) {
      const r = parseInt(clean.slice(0, 2), 16);
      const g = parseInt(clean.slice(2, 4), 16);
      const b = parseInt(clean.slice(4, 6), 16);
      return { r, g, b };
   }

   return null;
}

/**
 * Sanitizes fallbackIndex into a safe non-negative integer clamped to DEFAULT_OBSIDIAN_TEAM_COLORS bounds.
 */
export function sanitizeFallbackIndex(fallbackIndex: unknown): number {
   if (typeof fallbackIndex === "number" && Number.isFinite(fallbackIndex)) {
      return (
         Math.floor(Math.abs(fallbackIndex)) %
         DEFAULT_OBSIDIAN_TEAM_COLORS.length
      );
   }
   return 0;
}

/**
 * Converts RGB values ([0, 255]) to HSL values (h: [0, 360], s: [0, 1], l: [0, 1]).
 */
export function rgbToHsl(r: number, g: number, b: number): HslColor {
   const normR = Math.max(0, Math.min(255, r)) / 255;
   const normG = Math.max(0, Math.min(255, g)) / 255;
   const normB = Math.max(0, Math.min(255, b)) / 255;

   const max = Math.max(normR, normG, normB);
   const min = Math.min(normR, normG, normB);
   const delta = max - min;

   let h = 0;
   let s = 0;
   const l = (max + min) / 2;

   if (delta !== 0) {
      s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

      switch (max) {
         case normR:
            h = ((normG - normB) / delta + (normG < normB ? 6 : 0)) * 60;
            break;
         case normG:
            h = ((normB - normR) / delta + 2) * 60;
            break;
         case normB:
            h = ((normR - normG) / delta + 4) * 60;
            break;
      }
   }

   return { h: Math.round(h), s, l };
}

/**
 * Converts HSL values to a normalized 6-character hex string (#rrggbb).
 */
export function hslToHex(h: number, s: number, l: number): string {
   const normH = ((h % 360) + 360) % 360;
   const clampedS = Math.max(0, Math.min(1, s));
   const clampedL = Math.max(0, Math.min(1, l));
   const c = (1 - Math.abs(2 * clampedL - 1)) * clampedS;
   const x = c * (1 - Math.abs(((normH / 60) % 2) - 1));
   const m = clampedL - c / 2;

   let rPrime = 0;
   let gPrime = 0;
   let bPrime = 0;

   if (normH < 60) {
      rPrime = c;
      gPrime = x;
   } else if (normH < 120) {
      rPrime = x;
      gPrime = c;
   } else if (normH < 180) {
      gPrime = c;
      bPrime = x;
   } else if (normH < 240) {
      gPrime = x;
      bPrime = c;
   } else if (normH < 300) {
      rPrime = x;
      bPrime = c;
   } else {
      rPrime = c;
      bPrime = x;
   }

   const r = Math.max(0, Math.min(255, Math.round((rPrime + m) * 255)));
   const g = Math.max(0, Math.min(255, Math.round((gPrime + m) * 255)));
   const b = Math.max(0, Math.min(255, Math.round((bPrime + m) * 255)));

   const toHex = (n: number) => n.toString(16).padStart(2, "0");
   return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Preserves the base color's Hue (and Saturation), but clamps Lightness (L) to >= 75%
 * to guarantee high WCAG contrast against dark backgrounds (#0d0d0d / #141414).
 */
export function getReadableTextColor(r: number, g: number, b: number): string {
   const hsl = rgbToHsl(r, g, b);
   // Guarantee lightness is at least 76% for dark backgrounds. If saturation is low, bump lightness slightly more.
   const targetLightness = Math.max(hsl.l, hsl.s < 0.3 ? 0.82 : 0.76);
   return hslToHex(hsl.h, hsl.s, targetLightness);
}

/**
 * Normalizes a hex string to a clean 6-digit hex or falls back to a deterministic Obsidian preset.
 */
export function normalizeHex(
   color: string | null | undefined,
   fallbackIndex = 0
): string {
   const parsed = parseHexColor(color);
   if (!parsed) {
      const safeIndex = sanitizeFallbackIndex(fallbackIndex);
      return DEFAULT_OBSIDIAN_TEAM_COLORS[safeIndex]!;
   }
   const toHex = (n: number) => n.toString(16).padStart(2, "0");
   return `#${toHex(parsed.r)}${toHex(parsed.g)}${toHex(parsed.b)}`;
}

/** 5-minute TTL for in-memory palette cache (in milliseconds). */
export const PALETTE_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_PALETTE_CACHE_SIZE = 256;

interface CachedPaletteEntry {
   palette: TeamColorPalette;
   expiresAt: number;
}

const paletteCache = new Map<string, CachedPaletteEntry>();

/**
 * Clears the in-memory palette cache. Useful for tests or explicit cache evictions.
 */
export function clearTeamColorCache(): void {
   paletteCache.clear();
}

/**
 * Returns current size of the in-memory palette cache.
 */
export function getTeamColorCacheSize(): number {
   return paletteCache.size;
}

/**
 * Generates the complete 10-variant palette from a single base team color input.
 * Caches results in-memory for 5 minutes to avoid repetitive parsing and trigonometry math during renders.
 *
 * @param color The single base hex color input from the admin (e.g. "#d9822b").
 * @param fallbackIndex Deterministic rotation index for fallback when color is null or invalid.
 */
export function getTeamColorPalette(
   color: string | null | undefined,
   fallbackIndex = 0
): TeamColorPalette {
   const safeIndex = sanitizeFallbackIndex(fallbackIndex);
   const cacheKey = `${color ? color.trim().toLowerCase() : "null"}:${safeIndex}`;
   const now = Date.now();

   const cached = paletteCache.get(cacheKey);
   if (cached && now < cached.expiresAt) {
      return cached.palette;
   }

   let rgb = parseHexColor(color);
   let solidHex: string;

   if (!rgb) {
      solidHex = DEFAULT_OBSIDIAN_TEAM_COLORS[safeIndex]!;
      rgb = parseHexColor(solidHex)!;
   } else {
      const toHex = (n: number) => n.toString(16).padStart(2, "0");
      solidHex = `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
   }

   const { r, g, b } = rgb;
   const textColor = getReadableTextColor(r, g, b);

   // Invariant Guard: If the base color is pitch black or near-black, borders and glow
   // become invisible on #0d0d0d / #141414. Provide a subtle ambient charcoal floor for borders.
   const relativeLuminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
   const isExtremelyDark = relativeLuminance < 0.05;

   const borderRgb = isExtremelyDark ? "70, 70, 70" : `${r}, ${g}, ${b}`;
   const glowRgb = isExtremelyDark ? "80, 80, 80" : `${r}, ${g}, ${b}`;
   const surfaceTint = isExtremelyDark
      ? "rgba(35, 35, 35, 0.40)"
      : `rgba(${r}, ${g}, ${b}, 0.14)`;
   const surfaceHoverTint = isExtremelyDark
      ? "rgba(45, 45, 45, 0.50)"
      : `rgba(${r}, ${g}, ${b}, 0.22)`;

   const palette: TeamColorPalette = {
      solid: solidHex,
      text: textColor,
      surface: surfaceTint,
      surfaceHover: surfaceHoverTint,
      border: `rgba(${borderRgb}, 0.45)`,
      borderMuted: `rgba(${borderRgb}, 0.20)`,
      badgeBg: isExtremelyDark
         ? "rgba(40, 40, 40, 0.50)"
         : `rgba(${r}, ${g}, ${b}, 0.18)`,
      badgeBorder: `rgba(${borderRgb}, 0.35)`,
      rowTint: `rgba(${r}, ${g}, ${b}, 0.08)`,
      rowTintHover: `rgba(${r}, ${g}, ${b}, 0.16)`,
      glow: `0 0 16px rgba(${glowRgb}, 0.20)`,
   };

   if (paletteCache.size >= MAX_PALETTE_CACHE_SIZE) {
      const firstKey = paletteCache.keys().next().value;
      if (firstKey) {
         paletteCache.delete(firstKey);
      }
   }

   paletteCache.set(cacheKey, {
      palette,
      expiresAt: now + PALETTE_CACHE_TTL_MS,
   });

   return palette;
}

/**
 * Returns an inline CSS style object for rendering a team pill badge.
 */
export function getTeamBadgeStyle(
   color: string | null | undefined,
   fallbackIndex = 0
): {
   backgroundColor: string;
   borderColor: string;
   color: string;
} {
   const palette = getTeamColorPalette(color, fallbackIndex);
   return {
      backgroundColor: palette.badgeBg,
      borderColor: palette.badgeBorder,
      color: palette.text,
   };
}

/**
 * Returns an inline CSS style object for rendering a head-to-head match card.
 */
export function getTeamCardStyle(
   color: string | null | undefined,
   fallbackIndex = 0
): {
   backgroundColor: string;
   borderColor: string;
} {
   const palette = getTeamColorPalette(color, fallbackIndex);
   return {
      backgroundColor: palette.surface,
      borderColor: palette.border,
   };
}
